import type { AISettings } from './settings';

export type AIContent = { kind: 'json'; value: unknown } | { kind: 'text'; value: string };

export const STREAM_IDLE_TIMEOUT_MS = 60_000;

const ASCII_KEY_PATTERN = /^[\x21-\x7E]+$/;
const SYSTEM_PROMPT = `你是算法代码审查助手。请用中文审查用户提供的提交代码。
只返回一个 JSON 对象，不要输出 Markdown 围栏或额外文字。对象必须且只能包含以下两个字段：
{"code":"在原提交代码上做最小改动后的完整代码，关键改动行尾部附中文注释","changes":[{"code":"被改动行的内容（去掉行尾注释）","reason":"一句话说明为什么改，不超过30字"}]}
code 必须保留原代码的结构与命名，只改必要之处，不要重排格式。changes 与 code 中的改动一一对应，每条 code 字段取自改动后代码中的某一行。无改动时 code 返回原代码、changes 返回空数组。
不要输出题意、思路、复杂度、示例验证等任何其他分析，也不要把它们写进 changes；changes 里每条都必须对应 code 中真实改动的一行。只依据输入事实，不知道题目细节时不要猜测。`;

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
    max_tokens: 8192,
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

export function parseAIContent(text: string, diagnostics = ''): AIContent {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`Provider 返回了空结果${diagnostics}`);
  const candidate = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return { kind: 'json', value: JSON.parse(candidate) }; } catch { return { kind: 'text', value: trimmed }; }
}

// 空结果时给出可定位的线索：finish_reason=length 说明 max_tokens 被吃光，
// reasoning_content 非空说明是思考型模型把额度用在了推理上。
function emptyResultDiagnostics(body: { choices?: Array<{ finish_reason?: string; message?: { reasoning_content?: string }; delta?: { reasoning_content?: string } }> } | undefined): string {
  const choice = body?.choices?.[0];
  if (!choice) return '（响应中没有 choices，请检查 Base URL 是否为 OpenAI 兼容端点）';
  const parts = [`finish_reason=${choice.finish_reason ?? '未知'}`];
  if (choice.message?.reasoning_content || choice.delta?.reasoning_content) parts.push('reasoning 非空（思考占用了输出额度）');
  return `（${parts.join('，')}）`;
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
    return parseAIContent(body.choices?.[0]?.message?.content ?? '', emptyResultDiagnostics(body));
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
      return parseAIContent(body.choices?.[0]?.message?.content ?? '', emptyResultDiagnostics(body));
    }
    if (!response.body) throw new Error('Provider 不支持流式响应');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let finished = false;
    let lastChunk: { choices?: Array<{ finish_reason?: string; delta?: { content?: string; reasoning_content?: string } }> } | undefined;
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
        let chunk: NonNullable<typeof lastChunk>;
        try { chunk = JSON.parse(data) as typeof chunk; } catch { throw new Error('Provider 返回了无法解析的流式数据'); }
        lastChunk = chunk;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) { full += delta; options.onDelta?.(delta); }
      }
    }
    return parseAIContent(full, emptyResultDiagnostics(lastChunk));
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
