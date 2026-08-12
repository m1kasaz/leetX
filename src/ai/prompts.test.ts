import { describe, expect, it } from 'vitest';
import type { CaptureEntry } from '../db/captureLog';
import { nodeAnalysisPrompt, recordAnalysisPrompt } from './prompts';

const capture = (code: string, index = 1): CaptureEntry => ({
  captureId: `capture-${index}`,
  platform: 'leetcode-cn',
  problemKey: 'two-sum',
  title: '两数之和',
  canonicalUrl: 'https://leetcode.cn/problems/two-sum/',
  accountKey: 'anonymous',
  language: 'Python3',
  code,
  codeHash: `hash-${index}`,
  captureMethod: 'editor-model',
  captureConfidence: 'high',
  submittedAt: index,
  sourceUrl: 'https://leetcode.cn/problems/two-sum/',
  issues: [],
});

describe('AI prompts', () => {
  it('keeps node input compact without repeating the output contract', () => {
    const prompt = nodeAnalysisPrompt(capture('x'.repeat(30_000)));
    expect(prompt.length).toBeLessThan(9_000);
    expect(prompt).toContain('题目：两数之和');
    expect(prompt).toContain('当前代码');
    expect(prompt).toContain('中间代码已省略');
    expect(prompt).not.toContain('output_example');
    expect(prompt).not.toContain('output_schema');
  });

  it('keeps only recent record metadata and final code', () => {
    const prompt = recordAnalysisPrompt('two-sum', Array.from({ length: 20 }, (_, index) => capture(`code-${index}`, index + 1)));
    expect(prompt).toContain('提交总数：20');
    expect((prompt.match(/Python3:/g) ?? [])).toHaveLength(8);
    expect(prompt).not.toContain('code-10');
    expect(prompt).toContain('code-19');
  });
});
