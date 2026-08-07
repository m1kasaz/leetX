import type { StorageLike } from '../db/captureLog';
import type { AIContent } from './provider';
export const ANALYSIS_KEY = 'leetx:aiAnalyses';
export interface SavedAnalysis { id: string; scope: 'node'|'record'; problemKey: string; captureId?: string; createdAt: number; content: AIContent }
export async function saveAnalysis(storage: StorageLike, value: SavedAnalysis): Promise<void> { const raw=(await storage.get(ANALYSIS_KEY))[ANALYSIS_KEY]; const all=Array.isArray(raw)?raw as SavedAnalysis[]:[]; await storage.set({[ANALYSIS_KEY]:[...all.filter(x=>x.id!==value.id),value].slice(-200)}); }
export async function listAnalyses(storage: StorageLike, problemKey?: string): Promise<SavedAnalysis[]> { const raw=(await storage.get(ANALYSIS_KEY))[ANALYSIS_KEY]; const all=Array.isArray(raw)?raw as SavedAnalysis[]:[]; return problemKey?all.filter(x=>x.problemKey===problemKey):all; }
