import type { CaptureEntry } from '../db/captureLog';

const MAX_CODE_CHARS = 8_000;
const MAX_PREVIOUS_CODE_CHARS = 2_000;
const MAX_RECORD_SUBMISSIONS = 8;

function compactCode(code: string, limit: number): string {
  if (code.length <= limit) return code;
  const head = Math.floor(limit * 0.7);
  const tail = limit - head;
  return `${code.slice(0, head)}\n/* 中间代码已省略 */\n${code.slice(-tail)}`;
}

function codeBlock(label: string, code: string): string {
  return `${label}:\n---CODE---\n${code}\n---END CODE---`;
}

export function nodeAnalysisPrompt(current: CaptureEntry, previous?: CaptureEntry): string {
  const parts = [
    '任务：分析本次提交。只依据给定代码指出根因并给出修正后的完整代码；不要复述通用解题模板。',
    `题目：${current.title || current.problemKey}`,
    `语言：${current.language}`,
    `判题：${current.verdict ?? 'pending'}`,
    codeBlock('当前代码', compactCode(current.code, MAX_CODE_CHARS)),
  ];
  if (previous) {
    parts.push(`上次判题：${previous.verdict ?? 'pending'}`);
    parts.push(codeBlock('上次代码（仅用于比较）', compactCode(previous.code, MAX_PREVIOUS_CODE_CHARS)));
  }
  return parts.join('\n');
}

export function recordAnalysisPrompt(problemKey: string, submissions: CaptureEntry[]): string {
  const recent = submissions.slice(-MAX_RECORD_SUBMISSIONS);
  const final = recent.at(-1);
  const title = final?.title || problemKey;
  const verdicts = recent.map(item => `${item.language}:${item.verdict ?? 'pending'}`).join(', ');
  return [
    '任务：概括这道题的提交演进，重点说明最终方案、曾出现的根因和可改进点；不要复述通用解题模板。',
    `题目：${title}`,
    `提交总数：${submissions.length}`,
    `最近状态：${verdicts}`,
    codeBlock('最终代码', final ? compactCode(final.code, MAX_CODE_CHARS) : ''),
  ].join('\n');
}
