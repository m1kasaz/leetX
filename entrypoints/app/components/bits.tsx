import type { SavedAnalysis } from '../../../src/ai/storage';
import { tokenizeCode } from '../../../src/workbench/syntaxHighlight';

export const verdictName: Record<string, string> = {
  accepted: '通过',
  wrong_answer: '答案错误',
  time_limit_exceeded: '超时',
  memory_limit_exceeded: '超内存',
  runtime_error: '运行错误',
  compile_error: '编译错误',
  unknown: '未知',
};

export const time = (value: number): string =>
  new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function PlatformIcon({ platform }: { platform: string }) {
  const value = platform.toLowerCase();
  if (value === 'all') return <span className="platform-mark all" aria-hidden="true">◇</span>;
  const site = value.startsWith('leetcode') ? 'leetcode' : 'luogu';
  return <img className={`platform-logo ${site}`} src={`/platforms/${site}.ico`} alt="" aria-hidden="true" />;
}

export function HighlightedCode({ code, language }: { code: string; language: string }) {
  return (
    <>
      {tokenizeCode(code, language).map((token, index) => (
        <span className={`syntax-${token.kind}`} key={`${index}-${token.kind}`}>{token.text}</span>
      ))}
    </>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty"><span>⌁</span><b>{text}</b></div>;
}

export function Toast({ text }: { text: string }) {
  return <div className="toast" role="status"><span aria-hidden="true">✓</span>{text}</div>;
}

export function AnalysisResult({ analysis }: { analysis?: SavedAnalysis }) {
  if (!analysis) return <p className="muted">尚未调用 AI，不会自动产生费用。</p>;
  if (analysis.content.kind === 'json') return <AnalysisDoc value={analysis.content.value} />;
  return (
    <pre className="ai-result">
      {analysis.content.value}
    </pre>
  );
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString).filter(Boolean) : [];

const fieldLabel: Record<string, string> = {
  issues: '存在的问题',
  improvements: '改进建议',
  strengths: '做得好的地方',
  risks: '风险',
  suggestions: '建议',
};

function AnalysisDoc({ value }: { value: unknown }) {
  const doc = (value ?? {}) as Record<string, unknown>;
  const summary = asString(doc.summary) || asString(doc.overall) || asString(doc.conclusion);
  const complexity = asString(doc.complexity);
  const listFields = Object.keys(doc).filter(
    (key) => Array.isArray(doc[key]) && asList(doc[key]).length > 0,
  );
  const textFields = Object.entries(doc)
    .filter(([key, item]) => !['summary', 'overall', 'conclusion', 'complexity'].includes(key) && typeof item === 'string' && item.trim())
    .map(([key, item]) => [key, (item as string).trim()] as const);

  if (!summary && !complexity && listFields.length === 0 && textFields.length === 0) {
    return <pre className="ai-result">{JSON.stringify(value, null, 2)}</pre>;
  }

  return (
    <div className="ai-doc">
      {summary && <p className="ai-lead">{summary}</p>}
      {complexity && (
        <p className="ai-complexity"><span>复杂度</span>{complexity}</p>
      )}
      {listFields.map((key) => (
        <section className={`ai-block ${key}`} key={key}>
          <h4>{fieldLabel[key] ?? key}</h4>
          <ul>
            {asList(doc[key]).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      ))}
      {textFields.map(([key, item]) => (
        <section className="ai-block" key={key}>
          <h4>{fieldLabel[key] ?? key}</h4>
          <p>{item}</p>
        </section>
      ))}
    </div>
  );
}
