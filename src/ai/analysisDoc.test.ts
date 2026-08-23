import { describe, expect, it } from 'vitest';
import { toNoteDoc } from './analysisDoc';

describe('toNoteDoc', () => {
  it('flattens the standard analysis JSON into lead + bullets + code', () => {
    const doc = toNoteDoc({
      problemUnderstanding: '题意概括',
      coreIdea: ['思路一', '思路二'],
      code: 'class Solution {}',
      complexity: 'O(n) 时间',
      exampleValidation: '示例通过',
    });
    expect(doc).toEqual({
      lead: '',
      bullets: ['题意概括', '思路一', '思路二', '复杂度：O(n) 时间', '示例通过'],
      code: 'class Solution {}',
      changes: [],
    });
  });

  it('prefers summary as lead and merges all list fields in preferred order', () => {
    const doc = toNoteDoc({
      summary: '总体还行',
      improvements: ['改进'],
      coreIdea: ['思路'],
      customList: ['自定义'],
      customText: '一段话',
    });
    expect(doc.lead).toBe('总体还行');
    expect(doc.bullets).toEqual(['思路', '改进', '自定义', '一段话']);
  });

  it('skips empty fields and trims whitespace', () => {
    const doc = toNoteDoc({ coreIdea: ['', '  ', '保留'], code: '  x = 1  ', complexity: '' });
    expect(doc).toEqual({ lead: '', bullets: ['保留'], code: 'x = 1', changes: [] });
  });

  it('parses changes with code and reason, dropping malformed entries', () => {
    const doc = toNoteDoc({
      code: 'return 0',
      changes: [
        { code: 'return 0', reason: '先跑通示例' },
        { code: '', reason: '缺 code' },
        { reason: '缺 code 字段' },
        'not-an-object',
      ],
    });
    expect(doc.changes).toEqual([{ code: 'return 0', reason: '先跑通示例' }]);
  });

  it('handles null and empty input', () => {
    expect(toNoteDoc(null)).toEqual({ lead: '', bullets: [], code: '', changes: [] });
    expect(toNoteDoc({})).toEqual({ lead: '', bullets: [], code: '', changes: [] });
  });
});
