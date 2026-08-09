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
