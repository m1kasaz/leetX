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
    await vi.waitFor(() => expect(release).toBeDefined());
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
