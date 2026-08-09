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
  return (
    <pre className="ai-result">
      {analysis.content.kind === 'json' ? JSON.stringify(analysis.content.value, null, 2) : analysis.content.value}
    </pre>
  );
}
