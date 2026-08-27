export type Filter = 'all' | 'leetcode' | 'luogu';

export interface SettingsView {
  baseUrl: string;
  model: string;
  timeout: number;
  hasApiKey?: boolean;
}

export interface StreamState {
  scope: 'node' | 'record';
  text: string;
  /** 分析目标：node 为 captureId，record 为 problemKey，用于把流式输出锁定到发起它的记录 */
  target: string;
}

export function activeStreamFor(stream: StreamState | null, key: string | undefined): StreamState | null {
  return stream && key && stream.target === key ? stream : null;
}
