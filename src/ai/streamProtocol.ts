import type { CaptureEntry } from '../db/captureLog';
import type { SavedAnalysis } from './storage';

export const AI_STREAM_PORT = 'leetx:ai-stream';

export type StreamStart =
  | { kind: 'start'; scope: 'node'; current: CaptureEntry; previous?: CaptureEntry }
  | { kind: 'start'; scope: 'record'; problemKey: string; submissions: CaptureEntry[] };

export type StreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'done'; analysis: SavedAnalysis }
  | { kind: 'error'; message: string };
