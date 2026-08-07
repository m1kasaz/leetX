import type{TerminalVerdict}from'../types';import{extractMetric,normalizeVerdict,type VerdictRule}from'../../capture/normalize';
export const LUOGU_VERDICT_RULES:VerdictRule[]=[[/^Accepted\b/i,'accepted'],[/Wrong Answer/i,'wrong_answer'],[/Time Limit Exceeded/i,'time_limit_exceeded'],[/Memory Limit Exceeded/i,'memory_limit_exceeded'],[/Runtime Error/i,'runtime_error'],[/Compile Error/i,'compile_error'],[/Output Limit Exceeded/i,'output_limit_exceeded']];
export function normalizeLuoguVerdict(raw:string):TerminalVerdict{return normalizeVerdict(raw,LUOGU_VERDICT_RULES)}
export function extractLuoguMetrics(text:string):{runtimeText?:string;memoryText?:string}{return{runtimeText:extractMetric(text,/time|用时/i),memoryText:extractMetric(text,/memory|内存/i)}}
