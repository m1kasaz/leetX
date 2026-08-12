import type { AISettings } from './settings';

export type AIContent = { kind: 'json'; value: unknown } | { kind: 'text'; value: string };

export const STREAM_IDLE_TIMEOUT_MS = 60_000;

const ASCII_KEY_PATTERN = /^[\x21-\x7E]+$/;
const SYSTEM_PROMPT = `你是算法代码审查助手。请用中文直接分析用户提供的提交，优先指出导致错误、超时或低效的具体根因，并给出可执行的修正。
只返回一个 JSON 对象，不要输出 Markdown 围栏或额外文字。对象必须包含以下字段且顺序固定：
{"problemUnderstanding":"题意与根因概括","coreIdea":["具体问题或方案"],"code":"与当前提交语言一致的完整修正代码","complexity":"时间与空间复杂度","exampleValidation":"简短验证；不需要时为空字符串"}
只依据输入事实，不知道题目细节时不要猜测。`;

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
    max_tokens: 2048,
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
