import { describe, expect, it } from 'vitest';
import { parseChangeDoc, tipMap } from './changeDoc';

describe('parseChangeDoc', () => {
  it('parses code and valid changes', () => {
    const doc = parseChangeDoc({
      code: '\nlet a = 1;\n',
      changes: [
        { code: '  let a = 1;  ', reason: '初始化变量' },
        { code: '', reason: '缺 code 丢弃' },
        { code: 'x()', reason: '' },
        'not-an-object',
      ],
    });
    expect(doc).toEqual({ code: 'let a = 1;', changes: [{ code: 'let a = 1;', reason: '初始化变量' }] });
  });

  it('handles empty and legacy docs', () => {
    expect(parseChangeDoc(null)).toEqual({ code: '', changes: [] });
    expect(parseChangeDoc({ problemUnderstanding: '旧格式' })).toEqual({ code: '', changes: [] });
  });
});

describe('tipMap', () => {
  it('maps trimmed line to reason, first wins', () => {
    const map = tipMap([
      { code: 'x = 1', reason: '第一条' },
      { code: 'x = 1', reason: '重复忽略' },
      { code: 'y = 2', reason: '第二条' },
    ]);
    expect(map.get('x = 1')).toBe('第一条');
    expect(map.get('y = 2')).toBe('第二条');
    expect(map.size).toBe(2);
  });
});
