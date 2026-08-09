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
}
