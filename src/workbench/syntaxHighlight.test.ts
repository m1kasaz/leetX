import { describe, expect, it } from 'vitest'
import { normalizeLanguage, tokenizeCode } from './syntaxHighlight'

describe('syntax highlighting', () => {
  it('recognizes Python tokens without changing source text', () => {
    const source = 'def solve(value: int):\n    # note\n    return "ok" if value >= 12 else None'
    const tokens = tokenizeCode(source, 'python3')
    expect(tokens.map(token => token.text).join('')).toBe(source)
    expect(tokens).toEqual(expect.arrayContaining([
      { kind: 'keyword', text: 'def' },
      { kind: 'function', text: 'solve' },
      { kind: 'type', text: 'int' },
      { kind: 'comment', text: '# note' },
      { kind: 'string', text: '"ok"' },
      { kind: 'number', text: '12' },
      { kind: 'operator', text: '>=' },
    ]))
  })

  it('recognizes C++ types, comments, functions, and operators', () => {
    const source = 'vector<int> solve(int n) { // go\n  return n + 1;\n}'
    const tokens = tokenizeCode(source, 'GNU C++17')
    expect(tokens.map(token => token.text).join('')).toBe(source)
    expect(tokens.some(token => token.kind === 'type' && token.text === 'vector')).toBe(true)
    expect(tokens.some(token => token.kind === 'function' && token.text === 'solve')).toBe(true)
    expect(tokens.some(token => token.kind === 'comment' && token.text === '// go')).toBe(true)
  })

  it('recognizes Java keywords, types, and comments', () => {
    const source = 'class Solution {\n  public int solve(int[] nums) { // go\n    return nums.length;\n  }\n}'
    const tokens = tokenizeCode(source, 'Java')
    expect(tokens.map(token => token.text).join('')).toBe(source)
    expect(tokens).toEqual(expect.arrayContaining([
      { kind: 'keyword', text: 'class' },
      { kind: 'keyword', text: 'public' },
      { kind: 'keyword', text: 'return' },
      { kind: 'type', text: 'int' },
      { kind: 'function', text: 'solve' },
      { kind: 'comment', text: '// go' },
    ]))
  })

  it('recognizes JavaScript/TypeScript tokens including template strings', () => {
    const source = 'const solve = (nums: number[]): number => `sum=${nums.length}`; // ts'
    const tokens = tokenizeCode(source, 'TypeScript')
    expect(tokens.map(token => token.text).join('')).toBe(source)
    expect(tokens).toEqual(expect.arrayContaining([
      { kind: 'keyword', text: 'const' },
      { kind: 'type', text: 'number' },
      { kind: 'operator', text: '=>' },
      { kind: 'string', text: '`sum=${nums.length}`' },
      { kind: 'comment', text: '// ts' },
    ]))
    expect(normalizeLanguage('JavaScript')).toBe('js')
    expect(normalizeLanguage('Java')).toBe('java')
  })

  it('recognizes Go and Rust keywords', () => {
    expect(tokenizeCode('func solve() int { return 0 }', 'Golang')
      .some(token => token.kind === 'keyword' && token.text === 'func')).toBe(true)
    expect(tokenizeCode('fn solve() -> i32 { 0 }', 'Rust')
      .some(token => token.kind === 'keyword' && token.text === 'fn')).toBe(true)
  })

  it('falls back safely for unsupported languages', () => {
    expect(normalizeLanguage('MySQL')).toBe('plain')
    expect(tokenizeCode('<script>', 'MySQL')).toEqual([{ kind: 'plain', text: '<script>' }])
  })
})
