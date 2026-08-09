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
      if (message.submissions.length === 0) throw new Error('记录为空');
      const content = await request(settings, apiKey, recordAnalysisPrompt(message.problemKey, message.submissions), { signal, onDelta });
      analysis = { id: `record:${message.problemKey}`, scope: 'record', problemKey: message.problemKey, createdAt: Date.now(), content };
    }
    await saveAnalysis(deps.storage, analysis);
    send({ kind: 'done', analysis });
  }
}
