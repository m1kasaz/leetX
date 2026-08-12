import type { ReactNode } from 'react';
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

function MarkdownText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    const token = match[0];
    nodes.push(token.startsWith('`')
      ? <code key={index}>{token.slice(1, -1)}</code>
      : <strong key={index}>{token.slice(2, -2)}</strong>);
    cursor = index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export function AnalysisResult({ analysis }: { analysis?: SavedAnalysis }) {
  if (!analysis) return <p className="muted">尚未调用 AI，不会自动产生费用。</p>;
  if (analysis.content.kind === 'json') return <AnalysisDoc value={analysis.content.value} />;
  return (
    <div className="ai-result markdown-text">
      <MarkdownText text={analysis.content.value} />
    </div>
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
  problemUnderstanding: '题意确认',
  coreIdea: '核心思路',
  code: '代码',
  exampleValidation: '示例验证',
};

function AnalysisDoc({ value }: { value: unknown }) {
  const doc = (value ?? {}) as Record<string, unknown>;
  const summary = asString(doc.summary) || asString(doc.overall) || asString(doc.conclusion);
  const complexity = asString(doc.complexity);
  const preferredListFields = ['coreIdea', 'issues', 'improvements', 'strengths', 'risks', 'suggestions'];
  const listFields = [
    ...preferredListFields.filter((key) => asList(doc[key]).length > 0),
    ...Object.keys(doc).filter(
      (key) => !preferredListFields.includes(key) && Array.isArray(doc[key]) && asList(doc[key]).length > 0,
    ),
  ];
  const textFields = Object.entries(doc)
    .filter(([key, item]) => !['summary', 'overall', 'conclusion', 'problemUnderstanding', 'complexity', 'code', 'exampleValidation'].includes(key) && typeof item === 'string' && item.trim())
    .map(([key, item]) => [key, (item as string).trim()] as const);

  if (!summary && !asString(doc.problemUnderstanding) && !asString(doc.code) && !complexity && !asString(doc.exampleValidation) && listFields.length === 0 && textFields.length === 0) {
    return <pre className="ai-result">{JSON.stringify(value, null, 2)}</pre>;
  }

  return (
    <div className="ai-doc">
      {summary && <p className="ai-lead"><MarkdownText text={summary} /></p>}
      {asString(doc.problemUnderstanding) && (
        <section className="ai-block">
          <h4>题意确认</h4>
          <p><MarkdownText text={asString(doc.problemUnderstanding)} /></p>
        </section>
      )}
      {listFields.map((key) => (
        <section className={`ai-block ${key}`} key={key}>
          <h4>{fieldLabel[key] ?? key}</h4>
          <ul>
            {asList(doc[key]).map((item, i) => <li key={i}><MarkdownText text={item} /></li>)}
          </ul>
        </section>
      ))}
      {textFields.map(([key, item]) => (
        <section className="ai-block" key={key}>
          <h4>{fieldLabel[key] ?? key}</h4>
          <p><MarkdownText text={item} /></p>
        </section>
      ))}
      {asString(doc.code) && (
        <section className="ai-block code">
          <h4>代码</h4>
          <pre className="ai-code"><code>{asString(doc.code)}</code></pre>
        </section>
      )}
      {complexity && (
        <p className="ai-complexity"><span>复杂度分析</span><span><MarkdownText text={complexity} /></span></p>
      )}
      {asString(doc.exampleValidation) && (
        <section className="ai-block">
          <h4>示例验证</h4>
          <p><MarkdownText text={asString(doc.exampleValidation)} /></p>
        </section>
      )}
    </div>
  );
}
