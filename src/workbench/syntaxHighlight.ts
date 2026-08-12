export type SyntaxTokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'type' | 'operator'

export interface SyntaxToken {
  kind: SyntaxTokenKind
  text: string
}

const pythonKeywords = new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '))
const cppKeywords = new Set('alignas alignof and asm auto bitand bitor break case catch class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern false for friend goto if inline mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor'.split(' '))
const cppTypes = new Set('bool char char8_t char16_t char32_t double float int long size_t string uint8_t uint16_t uint32_t uint64_t vector map set unordered_map unordered_set'.split(' '))
const pythonTypes = new Set('bool bytes dict float frozenset int list object set str tuple'.split(' '))

export function normalizeLanguage(language: string): 'python' | 'cpp' | 'plain' {
  const value = language.toLowerCase()
  if (value.includes('python') || value === 'py') return 'python'
  if (value.includes('c++') || value.includes('cpp') || value === 'c') return 'cpp'
  return 'plain'
}

export function tokenizeCode(source: string, language: string): SyntaxToken[] {
  const dialect = normalizeLanguage(language)
  if (dialect === 'plain' || !source) return source ? [{ kind: 'plain', text: source }] : []
  const tokens: SyntaxToken[] = []
  const keywords = dialect === 'python' ? pythonKeywords : cppKeywords
  const types = dialect === 'python' ? pythonTypes : cppTypes
  let index = 0
  const push = (kind: SyntaxTokenKind, text: string) => tokens.push({ kind, text })
  while (index < source.length) {
    const rest = source.slice(index)
    const comment = dialect === 'python' ? rest.match(/^#[^\n]*/) : rest.match(/^\/\/[^\n]*|^\/\*[\s\S]*?(?:\*\/|$)/)
    if (comment) { push('comment', comment[0]); index += comment[0].length; continue }
    const string = rest.match(/^(?:[rubf]{0,2})(?:'''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$)|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/i)
    if (string) { push('string', string[0]); index += string[0].length; continue }
    const number = rest.match(/^\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/)
    if (number) { push('number', number[0]); index += number[0].length; continue }
    const identifier = rest.match(/^[A-Za-z_]\w*/)
    if (identifier) {
      const text = identifier[0]
      const next = source.slice(index + text.length).match(/^\s*(.)/)?.[1]
      push(keywords.has(text) ? 'keyword' : types.has(text) || /^[A-Z]\w*$/.test(text) ? 'type' : next === '(' ? 'function' : 'plain', text)
      index += text.length
      continue
    }
    const operator = rest.match(/^(?:->|::|<<=?|>>=?|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||\*\*|:=|[+\-*/%=<>!&|^~?:])/)
    if (operator) { push('operator', operator[0]); index += operator[0].length; continue }
    const plain = rest.match(/^[^A-Za-z_0-9'"#/+\-*%=<>!&|^~?:]+/)?.[0] ?? rest[0]
    push('plain', plain); index += plain.length
  }
  return tokens
}
