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
