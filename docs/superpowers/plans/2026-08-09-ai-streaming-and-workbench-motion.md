# AI 流式分析 + 工作台灵动化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 分析改为 SSE 流式 + Port 推送（修复 30s 硬超时），恢复记录级分析入口，并把工作台前端拆分为可读组件 + 纯 CSS 动效系统。

**Architecture:** `requestOpenAIStream` 在后台 Service Worker 中流式读取 OpenAI 兼容端点；`streamServer`（依赖注入、可单测）经 `leetx:ai-stream` Port 向工作台推送 delta/done/error；工作台 `streamClient` 封装 Port，组件层实时渲染。前端拆分为 `entrypoints/app/components/*`，样式拆为 `style.css` + `motion.css`。

**Tech Stack:** WXT 0.20 + TypeScript + React 18 + Vitest(jsdom) + zod。Node ≥ 20（本机 `/Users/bytedance/.nvm/versions/node/v24.16.0/bin`）。

## Global Constraints

- Spec：`docs/superpowers/specs/2026-08-09-ai-streaming-and-workbench-motion-design.md`。
- API Key 只存 `chrome.storage.session`；不新增持久化选项。
- 空闲超时固定 60s；总超时默认 180000ms，schema 范围 1000–300000ms；UI 以秒展示、毫秒存储。
- 动效纯 CSS，无新依赖；`prefers-reduced-motion: reduce` 全部降级。
- 组件单文件 100–300 行；不改动采集链路（`src/capture`、`src/adapters`、`src/bridge`）。
- 每个任务结束 `npm test` 保持绿；Node 用 v24：
  `export PATH=/Users/bytedance/.nvm/versions/node/v24.16.0/bin:/usr/bin:/bin:/usr/sbin:/sbin`

---

### Task 1: 测试环境修复（webcrypto + React 组件测试支持）

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Interfaces:**
- Produces: `npm test` 可运行 `src/**/*.test.{ts,tsx}` 与 `entrypoints/**/*.test.{ts,tsx}`；jsdom 中 `crypto.subtle` 可用；`IS_REACT_ACT_ENVIRONMENT` 开启。

- [ ] **Step 1: 修改 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'entrypoints/**/*.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(dirname, 'src') } },
});
```

- [ ] **Step 2: 创建 vitest.setup.ts**

```ts
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
```

- [ ] **Step 3: 验证**

Run: `npm test`
Expected: 17 个测试文件全绿（`src/utils/hash.test.ts` 由红转绿）。

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts vitest.setup.ts
git commit -m "test: inject webcrypto and enable component tests"
```

---

### Task 2: provider 流式请求

**Files:**
- Modify: `src/ai/provider.ts`（整体重写为下方代码）
- Test: `src/ai/provider.test.ts`（追加流式 describe 块）

**Interfaces:**
- Consumes: `AISettings`（`src/ai/settings.ts`）。
- Produces:
  - `parseAIContent(text: string): AIContent`（空文本抛"Provider 返回了空结果"）
  - `STREAM_IDLE_TIMEOUT_MS = 60_000`
  - `StreamRequestOptions { onDelta?(text:string):void; signal?:AbortSignal; idleTimeoutMs?:number; fetcher?:typeof fetch }`
  - `requestOpenAIStream(settings, apiKey, prompt, options?): Promise<AIContent>`
  - `requestOpenAI`（签名不变，供测试连接使用）

- [ ] **Step 1: 写失败测试**（追加到 `src/ai/provider.test.ts`，需要 `import{ReadableStream}from'node:stream/web'` 不需要——jsdom/Node24 全局已有）

```ts
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

describe('requestOpenAIStream', () => {
  it('accumulates SSE deltas and parses json', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"{\\"score\\":"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"1}"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const deltas: string[] = [];
    const fetcher = vi.fn().mockResolvedValue(sseResponse(chunks));
    const result = await requestOpenAIStream(settings, 'secret', 'p', { fetcher, onDelta: (t) => deltas.push(t) });
    expect(result).toEqual({ kind: 'json', value: { score: 1 } });
    expect(deltas.join('')).toBe('{"score":1}');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ stream: true });
  });

  it('falls back to non-streaming json responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'analysis' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    expect(await requestOpenAIStream(settings, 'k', 'p', { fetcher })).toEqual({ kind: 'text', value: 'analysis' });
  });

  it('aborts after idle timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(new Response(
        new ReadableStream<Uint8Array>({ start() { /* never emits */ } }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )));
      const promise = requestOpenAIStream(settings, 'k', 'p', { fetcher, idleTimeoutMs: 1000 });
      const assertion = expect(promise).rejects.toThrow('超时');
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it('rejects when externally cancelled', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(new Response(
      new ReadableStream<Uint8Array>({ start() { /* never emits */ } }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )));
    const promise = requestOpenAIStream(settings, 'k', 'p', { fetcher, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow('已取消');
  });
});
```

注：Node/浏览器中 `AbortController.abort()` 会让基于该 signal 的 `Response.body.getReader().read()` 以 `AbortError` 拒绝，mock 的 `ReadableStream` 也遵循该行为（Response 由全局构造、signal 无关时不会自动拒绝）。若 mock 流不随 abort 拒绝，把 idle 用例的 `fetcher` 改为在 `init.signal` 上监听 abort 并 `controller.error(new DOMException('Aborted','AbortError'))`。实现后两个超时/取消用例必须真实通过，不允许改断言绕过。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ai/provider.test.ts`
Expected: FAIL，`requestOpenAIStream is not a function` / 未导出。

- [ ] **Step 3: 重写 `src/ai/provider.ts`**

```ts
import type { AISettings } from './settings';

export type AIContent = { kind: 'json'; value: unknown } | { kind: 'text'; value: string };

export const STREAM_IDLE_TIMEOUT_MS = 60_000;

const ASCII_KEY_PATTERN = /^[\x21-\x7E]+$/;
const SYSTEM_PROMPT = '你是编程练习分析助手。严格遵循用户给出的输出结构和长度限制，只输出最终答案。';

function assertAsciiKey(apiKey: string): void {
  if (!ASCII_KEY_PATTERN.test(apiKey)) throw new Error('API Key 包含中文、空格或不可见字符，请重新复制纯英文 Key');
}

function chatEndpoint(baseUrl: string): string {
  const endpoint = new URL(baseUrl);
  if (!/\/chat\/completions\/?$/.test(endpoint.pathname)) endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/chat/completions`;
  return endpoint.toString();
}

function requestBody(settings: AISettings, prompt: string, stream: boolean): string {
  return JSON.stringify({
    model: settings.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    ...(stream ? { stream: true } : {}),
  });
}

async function httpError(response: Response): Promise<Error> {
  let detail = '';
  try {
    const body = await response.clone().json() as { error?: { message?: string; code?: string } | string; message?: string };
    detail = typeof body.error === 'string' ? body.error : body.error?.message || body.error?.code || body.message || '';
  } catch {
    try { detail = (await response.text()).trim(); } catch { detail = ''; }
  }
  return new Error(`Provider 请求失败（HTTP ${response.status}）${detail ? `：${detail.slice(0, 300)}` : ''}`);
}

export function parseAIContent(text: string): AIContent {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Provider 返回了空结果');
  const candidate = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return { kind: 'json', value: JSON.parse(candidate) }; } catch { return { kind: 'text', value: trimmed }; }
}

export async function requestOpenAI(settings: AISettings, apiKey: string, prompt: string, fetcher: typeof fetch = fetch): Promise<AIContent> {
  assertAsciiKey(apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeout);
  try {
    const response = await fetcher(chatEndpoint(settings.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: requestBody(settings, prompt, false),
    });
    if (!response.ok) throw await httpError(response);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseAIContent(body.choices?.[0]?.message?.content ?? '');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error(`请求超时（${settings.timeout}ms）`);
    throw error;
  } finally { clearTimeout(timer); }
}

export interface StreamRequestOptions {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  fetcher?: typeof fetch;
}

export async function requestOpenAIStream(settings: AISettings, apiKey: string, prompt: string, options: StreamRequestOptions = {}): Promise<AIContent> {
  assertAsciiKey(apiKey);
  const fetcher = options.fetcher ?? fetch;
  const idleMs = options.idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS;
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleMs);
  };
  const totalTimer = setTimeout(() => controller.abort(), settings.timeout);
  resetIdle();
  try {
    const response = await fetcher(chatEndpoint(settings.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: requestBody(settings, prompt, true),
    });
    if (!response.ok) throw await httpError(response);
    if ((response.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return parseAIContent(body.choices?.[0]?.message?.content ?? '');
    }
    if (!response.body) throw new Error('Provider 不支持流式响应');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') { finished = true; break; }
        let chunk: { choices?: Array<{ delta?: { content?: string } }> };
        try { chunk = JSON.parse(data) as typeof chunk; } catch { throw new Error('Provider 返回了无法解析的流式数据'); }
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) { full += delta; options.onDelta?.(delta); }
      }
    }
    return parseAIContent(full);
  } catch (error) {
    if (options.signal?.aborted) throw new Error('分析已取消');
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`请求超时（空闲 ${Math.round(idleMs / 1000)}s 无数据或超过总时长 ${Math.round(settings.timeout / 1000)}s）`);
    }
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/ai/provider.test.ts`
Expected: 8 个用例全绿（原 4 个 + 新 4 个）。

- [ ] **Step 5: Commit**

```bash
git add src/ai/provider.ts src/ai/provider.test.ts
git commit -m "feat: add streaming OpenAI-compatible request with idle timeout"
```

---

### Task 3: Port 协议 + streamServer

**Files:**
- Create: `src/ai/streamProtocol.ts`
- Create: `src/ai/streamServer.ts`
- Test: `src/ai/streamServer.test.ts`

**Interfaces:**
- Consumes: `requestOpenAIStream`、`parseAIContent`、`nodeAnalysisPrompt`、`recordAnalysisPrompt`、`saveAnalysis`、`makeInMemoryStorage`（测试）。
- Produces:
  - `AI_STREAM_PORT = 'leetx:ai-stream'`
  - `StreamStart` / `StreamEvent`（见代码）
  - `StreamServerDeps`、`StreamPortLike`、`handleStreamPort(port, deps)`

- [ ] **Step 1: 写失败测试 `src/ai/streamServer.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { handleStreamPort, type StreamPortLike, type StreamServerDeps } from './streamServer';
import type { StreamEvent, StreamStart } from './streamProtocol';
import { makeInMemoryStorage, type CaptureEntry } from '../db/captureLog';

function fakePort() {
  const sent: StreamEvent[] = [];
  const listeners = { message: [] as Array<(m: unknown) => void>, disconnect: [] as Array<() => void> };
  const port: StreamPortLike = {
    postMessage: (m) => sent.push(m),
    onMessage: { addListener: (cb) => listeners.message.push(cb) },
    onDisconnect: { addListener: (cb) => listeners.disconnect.push(cb) },
  };
  return { port, sent, emit: (m: StreamStart) => listeners.message.forEach((cb) => cb(m)), disconnect: () => listeners.disconnect.forEach((cb) => cb()) };
}

function capture(partial: Partial<CaptureEntry>): CaptureEntry {
  return { captureId: 'capture-0001', platform: 'leetcode-cn', problemKey: 'two-sum', title: '两数之和', canonicalUrl: 'https://leetcode.cn/problems/two-sum/', accountKey: 'u', language: 'cpp', code: 'int main(){}', codeHash: 'abcd1234', captureMethod: 'editor-model', captureConfidence: 'high', submittedAt: 1722500000000, sourceUrl: 'https://leetcode.cn/problems/two-sum/', issues: [], idempotencyKey: 'k', createdAt: 1, updatedAt: 1, ...partial };
}

function deps(overrides: Partial<StreamServerDeps> = {}): StreamServerDeps {
  return {
    loadSettings: async () => ({ baseUrl: 'https://a.test/v1', model: 'm', timeout: 1000 }),
    loadApiKey: async () => 'secret',
    requirePermission: async () => {},
    storage: makeInMemoryStorage(),
    request: async (_s, _k, _p, options) => { options?.onDelta?.('部分'); return { kind: 'text', value: '完整' }; },
    ...overrides,
  };
}

describe('handleStreamPort', () => {
  it('streams node analysis and stores the result', async () => {
    const { port, sent, emit } = fakePort();
    handleStreamPort(port, deps());
    emit({ kind: 'start', scope: 'node', current: capture({}) });
    await vi.waitFor(() => expect(sent.some((m) => m.kind === 'done')).toBe(true));
    expect(sent[0]).toEqual({ kind: 'delta', text: '部分' });
    const done = sent.find((m) => m.kind === 'done');
    expect(done).toMatchObject({ analysis: { id: 'node:capture-0001', scope: 'node', content: { kind: 'text', value: '完整' } } });
  });

  it('rejects record analysis without submissions', async () => {
    const { port, sent, emit } = fakePort();
    handleStreamPort(port, deps());
    emit({ kind: 'start', scope: 'record', problemKey: 'two-sum', submissions: [] });
    await vi.waitFor(() => expect(sent.some((m) => m.kind === 'error')).toBe(true));
    expect(sent.at(-1)).toEqual({ kind: 'error', message: '记录为空' });
  });

  it('rejects when api key is missing', async () => {
    const { port, sent, emit } = fakePort();
    handleStreamPort(port, deps({ loadApiKey: async () => '' }));
    emit({ kind: 'start', scope: 'node', current: capture({}) });
    await vi.waitFor(() => expect(sent.some((m) => m.kind === 'error')).toBe(true));
    expect(sent.at(-1)).toEqual({ kind: 'error', message: '请先配置 API Key' });
  });

  it('rejects a second start while running', async () => {
    const { port, sent, emit } = fakePort();
    let release!: (value: { kind: 'text'; value: string }) => void;
    handleStreamPort(port, deps({ request: () => new Promise((resolve) => { release = resolve; }) }));
    emit({ kind: 'start', scope: 'node', current: capture({}) });
    emit({ kind: 'start', scope: 'node', current: capture({ captureId: 'capture-0002' }) });
    await vi.waitFor(() => expect(sent.some((m) => m.kind === 'error')).toBe(true));
    expect(sent.at(-1)).toEqual({ kind: 'error', message: '已有进行中的分析' });
    release({ kind: 'text', value: 'x' });
  });

  it('aborts the request when the port disconnects', async () => {
    const { port, sent, emit, disconnect } = fakePort();
    let observed: AbortSignal | undefined;
    handleStreamPort(port, deps({ request: (_s, _k, _p, options) => { observed = options?.signal; return new Promise(() => {}); } }));
    emit({ kind: 'start', scope: 'node', current: capture({}) });
    await vi.waitFor(() => expect(observed).toBeDefined());
    disconnect();
    expect(observed?.aborted).toBe(true);
    expect(sent.some((m) => m.kind === 'done' || m.kind === 'error')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ai/streamServer.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 创建 `src/ai/streamProtocol.ts`**

```ts
import type { CaptureEntry } from '../db/captureLog';
import type { SavedAnalysis } from './storage';

export const AI_STREAM_PORT = 'leetx:ai-stream';

export type StreamStart =
  | { kind: 'start'; scope: 'node'; current: CaptureEntry; previous?: CaptureEntry }
  | { kind: 'start'; scope: 'record'; problemKey: string; submissions: CaptureEntry[] };

export type StreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'done'; analysis: SavedAnalysis }
  | { kind: 'error'; message: string };
```

- [ ] **Step 4: 创建 `src/ai/streamServer.ts`**

```ts
import { nodeAnalysisPrompt, recordAnalysisPrompt } from './prompts';
import { requestOpenAIStream, type AIContent, type StreamRequestOptions } from './provider';
import type { AISettings } from './settings';
import { saveAnalysis, type SavedAnalysis } from './storage';
import type { StorageLike } from '../db/captureLog';
import type { StreamEvent, StreamStart } from './streamProtocol';

export interface StreamServerDeps {
  loadSettings(): Promise<AISettings>;
  loadApiKey(): Promise<string>;
  requirePermission(baseUrl: string): Promise<void>;
  storage: StorageLike;
  request?: (settings: AISettings, apiKey: string, prompt: string, options: StreamRequestOptions) => Promise<AIContent>;
}

export interface StreamPortLike {
  postMessage(message: StreamEvent): void;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

const ASCII_KEY_PATTERN = /^[\x21-\x7E]+$/;

export function handleStreamPort(port: StreamPortLike, deps: StreamServerDeps): void {
  const request = deps.request ?? requestOpenAIStream;
  let active: AbortController | null = null;
  let disconnected = false;
  const send = (message: StreamEvent) => {
    if (disconnected) return;
    try { port.postMessage(message); } catch { /* port already gone */ }
  };
  port.onDisconnect.addListener(() => {
    disconnected = true;
    active?.abort();
    active = null;
  });
  port.onMessage.addListener((raw) => {
    const message = raw as StreamStart | null;
    if (!message || message.kind !== 'start') return;
    if (active) { send({ kind: 'error', message: '已有进行中的分析' }); return; }
    const controller = new AbortController();
    active = controller;
    void run(message, controller.signal)
      .catch((error: unknown) => {
        if (disconnected) return;
        send({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => { active = null; });
  });

  async function run(message: StreamStart, signal: AbortSignal): Promise<void> {
    const settings = await deps.loadSettings();
    const apiKey = (await deps.loadApiKey()).trim();
    if (!apiKey) throw new Error('请先配置 API Key');
    if (!ASCII_KEY_PATTERN.test(apiKey)) throw new Error('API Key 包含中文、空格或不可见字符，请重新配置');
    await deps.requirePermission(settings.baseUrl);
    const onDelta = (text: string) => send({ kind: 'delta', text });
    let analysis: SavedAnalysis;
    if (message.scope === 'node') {
      const content = await request(settings, apiKey, nodeAnalysisPrompt(message.current, message.previous), { signal, onDelta });
      analysis = { id: `node:${message.current.captureId}`, scope: 'node', problemKey: message.current.problemKey, captureId: message.current.captureId, createdAt: Date.now(), content };
    } else {
      const final = message.submissions.at(-1);
      if (!final) throw new Error('记录为空');
      const content = await request(settings, apiKey, recordAnalysisPrompt(message.problemKey, message.submissions), { signal, onDelta });
      analysis = { id: `record:${message.problemKey}`, scope: 'record', problemKey: message.problemKey, createdAt: Date.now(), content };
    }
    await saveAnalysis(deps.storage, analysis);
    send({ kind: 'done', analysis });
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/ai/streamServer.test.ts`
Expected: 5 个用例全绿。

- [ ] **Step 6: Commit**

```bash
git add src/ai/streamProtocol.ts src/ai/streamServer.ts src/ai/streamServer.test.ts
git commit -m "feat: add AI stream port protocol and server"
```

---

### Task 4: streamClient

**Files:**
- Create: `src/ai/streamClient.ts`
- Test: `src/ai/streamClient.test.ts`

**Interfaces:**
- Consumes: `AI_STREAM_PORT`、`StreamStart`、`StreamEvent`（Task 3）。
- Produces: `streamAnalysis(request: StreamStart, handlers: StreamHandlers): () => void`；`StreamHandlers { onDelta(text:string):void; onDone(a:SavedAnalysis):void; onError(message:string):void }`。

- [ ] **Step 1: 写失败测试 `src/ai/streamClient.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamAnalysis } from './streamClient';
import { AI_STREAM_PORT, type StreamStart } from './streamProtocol';

function fakePort() {
  const listeners = { message: [] as Array<(m: unknown) => void>, disconnect: [] as Array<() => void> };
  const port = {
    postMessage: vi.fn(),
    disconnect: vi.fn(() => listeners.disconnect.forEach((cb) => cb())),
    onMessage: { addListener: (cb: (m: unknown) => void) => listeners.message.push(cb) },
    onDisconnect: { addListener: (cb: () => void) => listeners.disconnect.push(cb) },
  };
  return { port, emit: (m: unknown) => listeners.message.forEach((cb) => cb(m)) };
}

const start: StreamStart = { kind: 'start', scope: 'record', problemKey: 'p', submissions: [] };

describe('streamAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const { port, emit } = fakePort();
    const connect = vi.fn(() => port);
    vi.stubGlobal('chrome', { runtime: { connect } });
    const handlers = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    const cancel = streamAnalysis(start, handlers);
    return { port, emit, connect, handlers, cancel };
  }

  it('connects to the stream port and sends the start message', () => {
    const { port, connect } = setup();
    expect(connect).toHaveBeenCalledWith({ name: AI_STREAM_PORT });
    expect(port.postMessage).toHaveBeenCalledWith(start);
  });

  it('forwards deltas and finishes on done', () => {
    const { emit, handlers, port } = setup();
    emit({ kind: 'delta', text: 'a' });
    emit({ kind: 'delta', text: 'b' });
    emit({ kind: 'done', analysis: { id: 'record:p' } });
    expect(handlers.onDelta).toHaveBeenCalledTimes(2);
    expect(handlers.onDone).toHaveBeenCalledWith({ id: 'record:p' });
    expect(port.disconnect).toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('reports server errors and settles', () => {
    const { emit, handlers } = setup();
    emit({ kind: 'error', message: '请先配置 API Key' });
    expect(handlers.onError).toHaveBeenCalledWith('请先配置 API Key');
  });

  it('reports unexpected disconnects', () => {
    const { port, handlers } = setup();
    port.disconnect();
    expect(handlers.onError).toHaveBeenCalledWith('分析通道已断开，请重试');
  });

  it('cancel disconnects exactly once', () => {
    const { port, cancel, handlers } = setup();
    cancel();
    cancel();
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ai/streamClient.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 创建 `src/ai/streamClient.ts`**

```ts
import { AI_STREAM_PORT, type StreamEvent, type StreamStart } from './streamProtocol';
import type { SavedAnalysis } from './storage';

export interface StreamHandlers {
  onDelta(text: string): void;
  onDone(analysis: SavedAnalysis): void;
  onError(message: string): void;
}

export function streamAnalysis(request: StreamStart, handlers: StreamHandlers): () => void {
  const port = chrome.runtime.connect({ name: AI_STREAM_PORT });
  let settled = false;
  port.onMessage.addListener((raw) => {
    const message = raw as StreamEvent;
    if (message.kind === 'delta') { handlers.onDelta(message.text); return; }
    settled = true;
    port.disconnect();
    if (message.kind === 'done') handlers.onDone(message.analysis);
    else handlers.onError(message.message);
  });
  port.onDisconnect.addListener(() => {
    if (settled) return;
    settled = true;
    handlers.onError('分析通道已断开，请重试');
  });
  port.postMessage(request);
  return () => {
    if (settled) return;
    settled = true;
    port.disconnect();
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/ai/streamClient.test.ts`
Expected: 5 个用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/ai/streamClient.ts src/ai/streamClient.test.ts
git commit -m "feat: add workbench-side AI stream client"
```

---

### Task 5: background 接线 + 默认超时

**Files:**
- Modify: `entrypoints/background.ts`
- Modify: `src/ai/settings.ts`（`DEFAULT_AI_SETTINGS.timeout` 30000 → 180000）

**Interfaces:**
- Consumes: `handleStreamPort`、`AI_STREAM_PORT`（Task 3）。
- Produces: 后台监听 `leetx:ai-stream` Port；新装扩展默认总超时 180s。

- [ ] **Step 1: 修改 `src/ai/settings.ts`**

```ts
export const DEFAULT_AI_SETTINGS: AISettings = { baseUrl: '', model: '', timeout: 180000 };
```

- [ ] **Step 2: 修改 `entrypoints/background.ts`**

import 区追加：

```ts
import { AI_STREAM_PORT } from '../src/ai/streamProtocol';
import { handleStreamPort } from '../src/ai/streamServer';
```

`defineBackground` 回调内、`chrome.runtime.onMessage.addListener` 之后追加：

```ts
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;
    const url = port.sender?.url ?? '';
    if (port.sender?.id !== chrome.runtime.id || !url.startsWith(chrome.runtime.getURL('/'))) {
      port.disconnect();
      return;
    }
    handleStreamPort(port, { loadSettings: settings, loadApiKey: key, requirePermission, storage });
  });
```

现有 `leetx/analyze-node|record` 非流式消息保留不动。

- [ ] **Step 3: 验证**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 4: Commit**

```bash
git add entrypoints/background.ts src/ai/settings.ts
git commit -m "feat: wire AI stream port in background and raise default timeout"
```

---

### Task 6: 工作台组件拆分（行为不变）

**Files:**
- Create: `entrypoints/app/components/types.ts`
- Create: `entrypoints/app/components/bits.tsx`
- Create: `entrypoints/app/components/TopBar.tsx`
- Create: `entrypoints/app/components/RecordList.tsx`
- Create: `entrypoints/app/components/TimelinePanel.tsx`
- Create: `entrypoints/app/components/DetailPanel.tsx`
- Create: `entrypoints/app/components/AnalysisPanel.tsx`
- Create: `entrypoints/app/components/SettingsModal.tsx`
- Modify: `entrypoints/app/App.tsx`（重写为编排层）

**Interfaces:**

`components/types.ts`：

```ts
export type Filter = 'all' | 'leetcode' | 'luogu';
export interface SettingsView { baseUrl: string; model: string; timeout: number; hasApiKey?: boolean }
export interface StreamState { scope: 'node' | 'record'; text: string }
```

各组件 props（Task 7 复用，签名以此为准）：

```tsx
// bits.tsx
export function PlatformIcon({ platform }: { platform: string }): JSX.Element
export function HighlightedCode({ code, language }: { code: string; language: string }): JSX.Element
export function Empty({ text }: { text: string }): JSX.Element
export function Toast({ text }: { text: string }): JSX.Element
export function AnalysisResult({ analysis }: { analysis?: SavedAnalysis }): JSX.Element
// AnalysisResult：无 analysis 渲染 <p className="muted">尚未调用 AI，不会自动产生费用。</p>；
// 有则 <pre className="ai-result">（json 美化 / text 原文）。

// TopBar.tsx
export function TopBar(props: { theme: ThemeMode; captureCount: number; onCycleTheme(): void; onOpenSettings(): void }): JSX.Element

// RecordList.tsx
export function RecordList(props: { filter: Filter; groups: CaptureGroup[]; activeKey?: string; onFilter(filter: Filter): void; onSelect(key: string): void }): JSX.Element

// TimelinePanel.tsx
export function TimelinePanel(props: {
  group?: CaptureGroup; current?: CaptureEntry; recordAI?: SavedAnalysis; stream: StreamState | null;
  onSelect(captureId: string): void; onRunRecord(): void; onCancel(): void;
}): JSX.Element

// AnalysisPanel.tsx
export function AnalysisPanel(props: {
  local: LocalAnalysis; analysis?: SavedAnalysis; streaming?: string | null; error: string;
  onRun(): void; onCancel(): void;
}): JSX.Element

// DetailPanel.tsx
export function DetailPanel(props: {
  group: CaptureGroup; current: CaptureEntry; index: number; previous?: CaptureEntry;
  showDiff: boolean; onToggleDiff(value: boolean): void; local: LocalAnalysis;
  nodeAI?: SavedAnalysis; stream: StreamState | null; error: string;
  onRunNode(): void; onCancel(): void;
}): JSX.Element

// SettingsModal.tsx
export function SettingsModal(props: {
  settings: SettingsView; apiKey: string; theme: ThemeMode; busy: string; error: string;
  onChange(settings: SettingsView): void; onApiKey(value: string): void; onTheme(mode: ThemeMode): void;
  onClose(): void; onTest(): void; onSave(): void;
}): JSX.Element
```

- [ ] **Step 1: 抽取实现**

把当前 `App.tsx`（压缩单行）中的 JSX 逐块搬入对应组件，保持 className、结构、文案不变；`App.tsx` 只保留状态、effects、`openSettings`/`configure`/`run` 与组件组装。搬运映射：

- `<header className="topbar">…` → `TopBar`
- `<aside className="records">…` → `RecordList`（含 heading/filters/record-list）
- `<section className="timeline-panel">…` → `TimelinePanel`（恢复 summary 行留给 Task 7，本任务先保持现状结构）
- `<section className="detail">…` → `DetailPanel`（code-card 留在 DetailPanel 内）
- `<article className="analysis">…` → `AnalysisPanel`
- `<div className="modal">…` → `SettingsModal`
- `PlatformIcon`/`HighlightedCode`/`Empty` → `bits.tsx`；toast 块 → `Toast`
- `verdictName`、`time` 工具 → `bits.tsx` 导出

App.tsx 重写后不得超过 250 行；每个组件文件正常多行格式。

- [ ] **Step 2: 验证**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功（本任务不改行为，构建产物即验证）。

- [ ] **Step 3: Commit**

```bash
git add entrypoints/app
git commit -m "refactor: split workbench app into readable components"
```

---

### Task 7: 流式 UI 接入 + 恢复记录级分析与超时设置

**Files:**
- Modify: `entrypoints/app/App.tsx`
- Modify: `entrypoints/app/components/TimelinePanel.tsx`
- Modify: `entrypoints/app/components/AnalysisPanel.tsx`
- Modify: `entrypoints/app/components/SettingsModal.tsx`
- Test: `entrypoints/app/components/AnalysisPanel.test.tsx`

**Interfaces:**
- Consumes: `streamAnalysis`（Task 4）、`StreamStart`（Task 3）、Task 6 组件签名。
- Produces: 节点/记录分析按钮走流式；流式中可取消；记录级入口与空态提示恢复；设置面板含超时（秒）。

- [ ] **Step 1: 写组件测试 `entrypoints/app/components/AnalysisPanel.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AnalysisPanel } from './AnalysisPanel';

const local = { headline: '本次提交尚未通过终态判题', facts: ['fact-a'], limitations: [] };

function render(props: Partial<Parameters<typeof AnalysisPanel>[0]>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(<AnalysisPanel local={local} error="" onRun={() => {}} onCancel={() => {}} {...props} />);
  });
  return host;
}

describe('AnalysisPanel', () => {
  it('shows the empty hint when nothing ran yet', () => {
    const host = render({});
    expect(host.textContent).toContain('尚未调用 AI');
  });

  it('renders streaming text with a cancel button', () => {
    const onCancel = vi.fn();
    const host = render({ streaming: '正在输出', onCancel });
    expect(host.textContent).toContain('正在输出');
    const button = host.querySelector<HTMLButtonElement>('.analysis header button');
    expect(button?.textContent).toBe('取消');
    act(() => button?.click());
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders saved json analysis', () => {
    const host = render({ analysis: { id: 'node:x', scope: 'node', problemKey: 'p', createdAt: 1, content: { kind: 'json', value: { summary: 's' } } } });
    expect(host.textContent).toContain('"summary": "s"');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run entrypoints/app/components/AnalysisPanel.test.tsx`
Expected: FAIL（streaming/cancel 行为尚未实现）。

- [ ] **Step 3: 实现流式状态与恢复入口**

`App.tsx`：
- 新增 `const [stream, setStream] = useState<StreamState | null>(null)` 与 `cancelRef = useRef<(() => void) | null>(null)`。
- `run(scope)` 改为：

```ts
function run(scope: 'node' | 'record') {
  if (!current || !group || stream) return;
  setError('');
  const request: StreamStart = scope === 'node'
    ? { kind: 'start', scope, current, previous }
    : { kind: 'start', scope, problemKey: group.problemKey, submissions: group.submissions };
  setStream({ scope, text: '' });
  cancelRef.current = streamAnalysis(request, {
    onDelta: (text) => setStream((s) => (s ? { ...s, text: s.text + text } : s)),
    onDone: (analysis) => {
      setStream(null);
      cancelRef.current = null;
      setAnalyses((list) => [...list.filter((a) => a.id !== analysis.id), analysis]);
    },
    onError: (message) => {
      setStream(null);
      cancelRef.current = null;
      setError(message);
      if (message.includes('配置')) void openSettings();
    },
  });
}
function cancelStream() { cancelRef.current?.(); cancelRef.current = null; setStream(null); }
```

- 移除旧 `busy` 中 node/record 用法（`busy` 仅保留 'save'|'test'）。

`AnalysisPanel.tsx` 按钮区：

```tsx
{streaming != null
  ? <button onClick={onCancel}>取消</button>
  : <button onClick={onRun}>{analysis ? '重试' : '开始分析'}</button>}
{streaming != null && (
  <pre className="ai-result streaming">
    {streaming || '正在连接模型…'}
    <span className="stream-cursor" aria-hidden="true" />
  </pre>
)}
{streaming == null && <AnalysisResult analysis={analysis} />}
```

`TimelinePanel.tsx`：problem 块下恢复（`summarizeGroup` 从 `src/workbench/analysis` 导入）：

```tsx
<div className="summary">
  {summarizeGroup(group)}
  {stream?.scope === 'record'
    ? <button onClick={onCancel}>取消</button>
    : <button onClick={onRunRecord}>{recordAI ? '重新进行最终 AI 分析' : '最终 AI 分析'}</button>}
</div>
{stream?.scope === 'record' && (
  <pre className="ai-result streaming">{stream.text || '正在连接模型…'}<span className="stream-cursor" aria-hidden="true" /></pre>
)}
{stream?.scope !== 'record' && <AnalysisResult analysis={recordAI} />}
```

（record 无结果时不显示空态提示，保持时间线紧凑；空态提示只在 AnalysisPanel。）

`SettingsModal.tsx`：Model 字段后追加：

```tsx
<label>超时时间（秒）
  <input
    type="number" min={60} max={300}
    value={Math.round(settings.timeout / 1000)}
    onChange={(e) => onChange({ ...settings, timeout: Math.min(300, Math.max(60, Number(e.target.value) || 60)) * 1000 })}
  />
</label>
<p className="muted">API Key 仅保存在本次浏览器会话，重启后需重新填写。</p>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/app
git commit -m "feat: stream AI analysis into the workbench with cancel"
```

---

### Task 8: style.css 重排 + motion.css

**Files:**
- Modify: `entrypoints/app/style.css`（机械重排为多行，不改规则）
- Create: `entrypoints/app/motion.css`
- Modify: `entrypoints/app/main.tsx`（import 顺序 `./style.css` → `./motion.css`）
- Modify: `entrypoints/app/components/DetailPanel.tsx`（详情容器加 `key` + `detail-swap`）

- [ ] **Step 1: 重排 style.css**

用 Node 一行脚本按 `}` `{` `;` 加换行缩进（本仓库 CSS 无嵌套，media query 手动检查一遍），人工抽查首尾与媒体查询块。规则内容、顺序不变。

- [ ] **Step 2: 创建 `entrypoints/app/motion.css`**

```css
/* Motion tokens */
:root {
  --dur-fast: 120ms;
  --dur: 200ms;
  --dur-slow: 320ms;
  --ease: cubic-bezier(.2, .7, .3, 1);
}

/* Theme switch + hover color transitions */
.topbar, .records, .timeline-panel, .detail, .code-card, .analysis, .modal form,
.record, .node, .filters button, .top-actions button, .code-card button,
.analysis header button, .modal button, .ok, .bad {
  transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}

/* Record list stagger-in */
@keyframes record-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.record-list .record { animation: record-in var(--dur) var(--ease) backwards; }
.record-list .record:nth-child(2) { animation-delay: 20ms; }
.record-list .record:nth-child(3) { animation-delay: 40ms; }
.record-list .record:nth-child(4) { animation-delay: 60ms; }
.record-list .record:nth-child(5) { animation-delay: 80ms; }
.record-list .record:nth-child(6) { animation-delay: 100ms; }
.record-list .record:nth-child(7) { animation-delay: 120ms; }
.record-list .record:nth-child(n+8) { animation-delay: 140ms; }

/* Timeline node selection */
.node > span { transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.node.active > span { box-shadow: 0 0 0 3px color-mix(in srgb, var(--lime) 25%, transparent); }
@keyframes node-pop { 0% { transform: scale(.6); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
.node.active > span { animation: node-pop var(--dur-slow) var(--ease); }

/* Detail content switch fade */
@keyframes detail-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.detail-swap { animation: detail-in var(--dur-fast) var(--ease); }

/* Modal */
@keyframes modal-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes modal-panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.modal { animation: modal-in var(--dur-fast) ease-out; }
.modal form { animation: modal-panel-in var(--dur) var(--ease); }

/* AI streaming cursor + result fade */
@keyframes cursor-breathe { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
.stream-cursor {
  display: inline-block; width: 8px; height: 14px; margin-left: 2px;
  vertical-align: -2px; background: var(--lime);
  animation: cursor-breathe 1s ease-in-out infinite;
}
@keyframes ai-in { from { opacity: 0; } to { opacity: 1; } }
.ai-result { animation: ai-in 160ms ease-out; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-delay: 0ms !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 3: main.tsx 与 DetailPanel 接线**

`main.tsx`：

```ts
import './style.css';
import './motion.css';
```

`DetailPanel.tsx` 最外层内容包一层（key 变化触发淡入）：

```tsx
<div className="detail-swap" key={current.captureId}>
  {/* 原 detail 内容（header / detail-grid） */}
</div>
```

- [ ] **Step 4: 验证**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功，产物 CSS 含 `--dur-fast` 与 `stream-cursor`。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/app
git commit -m "feat: add workbench motion system with reduced-motion support"
```

---

### Task 9: 全量验证与收尾

- [ ] **Step 1: 全量测试与构建**

Run: `npm test && npm run build`
Expected: 全绿；`.output/chrome-mv3` 构建成功。

- [ ] **Step 2: 检查 git 状态并提交剩余文件**

```bash
git status --short
git add -A
git commit -m "chore: finalize AI streaming and motion work"  # 仅在仍有未提交文件时
```

- [ ] **Step 3: 交付说明**

告知用户：用 Node 24 跑 `npm run build`，到 `chrome://extensions` 重新加载 `.output/chrome-mv3`，按 spec 第 6 节做真机回归（尤其慢模型流式分析与取消），结果记入 `docs/stage0-verification.md`。

---

## Self-Review 记录

- Spec 覆盖：§3.2→Task 2；§3.3/3.5→Task 3/5；§3.4→Task 4；§3.6→Task 5/7；
  §4.1→Task 6；§4.2→Task 8；§4.3→Task 7；§5 测试→各任务内；§6.7 真机回归→Task 9。
- 类型一致性：`StreamStart/StreamEvent/StreamState/SavedAnalysis/StreamRequestOptions`
  在 Task 2/3/4/6/7 间签名一致；`AnalysisResult` 空态提示文案与 spec §4.3 一致。
- 无占位符：新增模块代码完整；组件拆分任务的 JSX 来源于现有 `App.tsx` 逐块搬运。
