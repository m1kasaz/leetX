export type SyntaxTokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'type' | 'operator'

export interface SyntaxToken {
  kind: SyntaxTokenKind
  text: string
}

type DialectName = 'python' | 'cpp' | 'java' | 'js' | 'go' | 'rust' | 'csharp' | 'kotlin' | 'swift' | 'plain'

interface Dialect {
  keywords: Set<string>
  types: Set<string>
  hashComment?: boolean
  backtickString?: boolean
}

const words = (list: string) => new Set(list.split(' '))

const dialects: Record<Exclude<DialectName, 'plain'>, Dialect> = {
  python: {
    keywords: words('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'),
    types: words('bool bytes dict float frozenset int list object set str tuple'),
    hashComment: true,
  },
  cpp: {
    keywords: words('alignas alignof and asm auto bitand bitor break case catch class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern false for friend goto if inline mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor'),
    types: words('bool char char8_t char16_t char32_t double float int long size_t string uint8_t uint16_t uint32_t uint64_t vector map set unordered_map unordered_set'),
  },
  java: {
    keywords: words('abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public record return static strictfp super switch synchronized this throw throws transient try var volatile while true false null'),
    types: words('boolean byte char double float int long short void String Integer Long Double Boolean Character Object List Map Set HashMap ArrayList LinkedList HashSet TreeMap TreeSet Queue Deque Stack Optional StringBuilder StringBuffer'),
  },
  js: {
    keywords: words('abstract async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in instanceof interface let namespace new of package private protected public readonly require return set static super switch this throw try type typeof var void while with yield true false null undefined'),
    types: words('any bigint boolean never number object string symbol unknown Array Map Set WeakMap WeakSet Promise Record Partial Pick Omit Readonly Date RegExp Error JSON Math console'),
    backtickString: true,
  },
  go: {
    keywords: words('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota'),
    types: words('int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 bool byte rune string error any comparable'),
    backtickString: true,
  },
  rust: {
    keywords: words('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'),
    types: words('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box HashMap HashSet'),
  },
  csharp: {
    keywords: words('abstract as base break case catch checked class const continue default delegate do else enum event explicit extern false finally fixed for foreach goto if implicit in interface internal is lock namespace new null object operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw true try typeof unchecked unsafe using var virtual volatile while record init'),
    types: words('bool byte char decimal double float int long sbyte short string uint ulong ushort void List Dictionary HashSet Queue Stack StringBuilder'),
  },
  kotlin: {
    keywords: words('abstract annotation as break by class companion constructor continue data do else enum false final for fun if in init inline interface internal is lazy null object open override package private protected public return sealed super suspend this throw true try typealias val var vararg when while'),
    types: words('Boolean Byte Char Double Float Int Long Short String Unit Any List Map Set HashMap ArrayList HashSet MutableList MutableMap MutableSet StringBuilder'),
  },
  swift: {
    keywords: words('associatedtype break case catch class continue default defer deinit do else enum extension fallthrough false final for func guard if import in init inout internal let nil open operator private protocol public repeat return self static struct subscript super switch throw throws true try typealias var where while'),
    types: words('Bool Character Double Float Int String UInt Array Dictionary Set Optional StringBuilder'),
  },
}

export function normalizeLanguage(language: string): DialectName {
  const value = language.toLowerCase()
  if (value.includes('python') || value === 'py') return 'python'
  // javascript/typescript 必须先于 java 判断（"javascript" 以 "java" 开头）
  if (value.includes('javascript') || value.includes('typescript') || value === 'js' || value === 'ts' || value === 'jsx' || value === 'tsx' || value === 'node') return 'js'
  if (value.startsWith('java')) return 'java'
  if (value.includes('c#') || value.includes('csharp')) return 'csharp'
  if (value.includes('c++') || value.includes('cpp') || value === 'c') return 'cpp'
  if (value === 'go' || value.includes('golang')) return 'go'
  if (value.includes('rust')) return 'rust'
  if (value.includes('kotlin')) return 'kotlin'
  if (value.includes('swift')) return 'swift'
  return 'plain'
}

export function tokenizeCode(source: string, language: string): SyntaxToken[] {
  const name = normalizeLanguage(language)
  if (name === 'plain' || !source) return source ? [{ kind: 'plain', text: source }] : []
  const dialect = dialects[name]
  const { keywords, types } = dialect
  const tokens: SyntaxToken[] = []
  let index = 0
  const push = (kind: SyntaxTokenKind, text: string) => tokens.push({ kind, text })
  while (index < source.length) {
    const rest = source.slice(index)
    const comment = dialect.hashComment ? rest.match(/^#[^\n]*/) : rest.match(/^\/\/[^\n]*|^\/\*[\s\S]*?(?:\*\/|$)/)
    if (comment) { push('comment', comment[0]); index += comment[0].length; continue }
    const string = rest.match(/^(?:[rubf]{0,2})(?:'''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$)|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/i)
      ?? (dialect.backtickString ? rest.match(/^`(?:\\.|[^`\\])*(?:`|$)/) : null)
    if (string) { push('string', string[0]); index += string[0].length; continue }
    const number = rest.match(/^\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/)
    if (number) { push('number', number[0]); index += number[0].length; continue }
    const identifier = rest.match(/^[A-Za-z_$][\w$]*/)
    if (identifier) {
      const text = identifier[0]
      const next = source.slice(index + text.length).match(/^\s*(.)/)?.[1]
      push(keywords.has(text) ? 'keyword' : types.has(text) || /^[A-Z]\w*$/.test(text) ? 'type' : next === '(' ? 'function' : 'plain', text)
      index += text.length
      continue
    }
    const operator = rest.match(/^(?:->|::|<<=?|>>=?|=>|===?|!==?|<=|>=|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||\?\?|\*\*|:=|[+\-*/%=<>!&|^~?:])/)
    if (operator) { push('operator', operator[0]); index += operator[0].length; continue }
    const plain = rest.match(/^[^A-Za-z_0-9'"#`/+\-*%=<>!&|^~?:]+/)?.[0] ?? rest[0]
    push('plain', plain); index += plain.length
  }
  return tokens
}
