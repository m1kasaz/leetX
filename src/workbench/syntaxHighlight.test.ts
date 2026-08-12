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

  it('falls back safely for unsupported languages', () => {
    expect(normalizeLanguage('Java')).toBe('plain')
    expect(tokenizeCode('<script>', 'Java')).toEqual([{ kind: 'plain', text: '<script>' }])
  })
})
