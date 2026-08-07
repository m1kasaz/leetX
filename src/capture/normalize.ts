import type { TerminalVerdict } from '../adapters/types';
export type VerdictRule=readonly [RegExp,TerminalVerdict];
export function normalizeVerdict(raw:string,rules:readonly VerdictRule[]):TerminalVerdict { const text=raw.trim(); for(const [pattern,verdict] of rules){ pattern.lastIndex=0; if(pattern.test(text)) return verdict; } return 'unknown'; }
export function extractMetric(text:string,labels:RegExp):string|undefined { const match=text.match(new RegExp(`(?:${labels.source})\\s*[:：]?\\s*([\\d.]+%?\\s*[a-zA-Z]+)`,labels.flags)); return match?.[1]?.trim(); }
