import { describe, expect, it, vi } from 'vitest';
import { requestOpenAI, requestOpenAIStream } from './provider';

const settings = { baseUrl: 'https://a.test/v1', model: 'm', timeout: 1000 };

describe('provider', () => {
  it('parses structured output', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"score":1}\n```' } }] }) });
    expect(await requestOpenAI(settings, 'secret', 'p', fetcher)).toEqual({ kind: 'json', value: { score: 1 } });
    expect(fetcher.mock.calls[0][0]).toBe('https://a.test/v1/chat/completions');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request).toMatchObject({ max_tokens: 8192 });
    expect(request.messages[0]).toMatchObject({ role: 'system' });
    expect(request.messages[0].content).toContain('算法代码审查助手');
    expect(request.messages[0].content).toContain('changes');
    expect(request.messages[1]).toEqual({ role: 'user', content: 'p' });
    expect(request).not.toHaveProperty('temperature');
  });

  it('rejects non-ASCII API keys', async () => {
    await expect(requestOpenAI(settings, '错误-key', 'p', vi.fn())).rejects.toThrow('API Key 包含中文');
  });

  it('includes provider error details', async () => {
    const response = { ok: false, status: 400, clone: () => response, json: async () => ({ error: { message: 'invalid model' } }), text: async () => '' };
    await expect(requestOpenAI(settings, 'k', 'p', vi.fn().mockResolvedValue(response))).rejects.toThrow('HTTP 400）：invalid model');
  });

  it('falls back to text', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'analysis' } }] }) });
    expect(await requestOpenAI(settings, 'k', 'p', fetcher)).toEqual({ kind: 'text', value: 'analysis' });
  });
});

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

function neverEndingResponse(init: RequestInit): Response {
  const holder: { controller?: ReadableStreamDefaultController<Uint8Array> } = {};
  const stream = new ReadableStream<Uint8Array>({ start(controller) { holder.controller = controller; } });
  init.signal?.addEventListener('abort', () => holder.controller?.error(new DOMException('Aborted', 'AbortError')));
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
      const fetcher = vi.fn().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(neverEndingResponse(init)));
      const promise = requestOpenAIStream(settings, 'k', 'p', { fetcher, idleTimeoutMs: 1000 });
      const assertion = expect(promise).rejects.toThrow('超时');
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it('rejects when externally cancelled', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(neverEndingResponse(init)));
    const promise = requestOpenAIStream(settings, 'k', 'p', { fetcher, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow('已取消');
  });
});
