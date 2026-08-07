export type Platform = 'leetcode-cn' | 'leetcode-com' | 'luogu';
export interface ProblemIdentity { platform: Platform; problemKey: string; title: string; canonicalUrl: string; accountKey: string }
export interface SubmitIntent { kind: 'click' | 'shortcut'; at: number }
export type CaptureMethod = 'editor-model' | 'textarea' | 'rendered-code' | 'manual';
export interface CodeSnapshot { code: string; language: string; method: CaptureMethod }
export type Verdict = 'pending' | 'accepted' | 'wrong_answer' | 'time_limit_exceeded' | 'memory_limit_exceeded' | 'runtime_error' | 'compile_error' | 'output_limit_exceeded' | 'cancelled' | 'unknown';
export type TerminalVerdict = Exclude<Verdict, 'pending'>;
export interface VerdictSnapshot { rawText: string; verdict: TerminalVerdict; runtimeText?: string; memoryText?: string; errorSummary?: string; at: number }
export interface SnapshotProvider { getEditorSnapshot(): Promise<{ code: string; language: string } | null> }
export interface AdapterDeps { bridge: SnapshotProvider; now?: () => number }
export interface JudgeAdapter {
  platform: Platform; matchLocation(url: URL): boolean; observeRouteChange(callback: () => void): () => void;
  getProblemIdentity(): Promise<ProblemIdentity | null>; observeSubmit(callback: (event: SubmitIntent) => void): () => void;
  readEditorSnapshot(): Promise<CodeSnapshot | null>; observeVerdict(callback: (result: VerdictSnapshot) => void): () => void;
}
