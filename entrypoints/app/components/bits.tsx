import { Fragment, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SavedAnalysis } from '../../../src/ai/storage';
import { toNoteDoc } from '../../../src/ai/analysisDoc';
import { parseChangeDoc } from '../../../src/ai/changeDoc';
import { diffLines } from '../../../src/workbench/diff';
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

export function AnalysisResult({ analysis, originalCode, language, tipsEnabled = true }: { analysis?: SavedAnalysis; originalCode?: string; language?: string; tipsEnabled?: boolean }) {
  if (!analysis) return <p className="muted">尚未调用 AI，不会自动产生费用。</p>;
  if (analysis.content.kind === 'json') return <AnalysisDiff value={analysis.content.value} originalCode={originalCode} language={language} tipsEnabled={tipsEnabled} />;
  return (
    <div className="ai-result markdown-text">
      <MarkdownText text={analysis.content.value} />
    </div>
  );
}

// 最小改动 diff 视图：新增/删除行高亮，有解释的改动行悬浮时在左侧冒泡显示 reason
function AnalysisDiff({ value, originalCode, language, tipsEnabled = true }: { value: unknown; originalCode?: string; language?: string; tipsEnabled?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const doc = parseChangeDoc(value);
  if (!doc.code) {
    // 旧格式分析（无 code 字段）退回扁平笔记渲染
    const legacy = toNoteDoc(value);
    if (!legacy.lead && legacy.bullets.length === 0) return <p className="muted">分析结果为空，请重新分析。</p>;
    return (
      <div className="ai-doc ai-note">
        {legacy.lead && <p className="ai-lead"><MarkdownText text={legacy.lead} /></p>}
        <ul className="ai-points">
          {legacy.bullets.map((item, i) => <li key={i}><MarkdownText text={item} /></li>)}
        </ul>
      </div>
    );
  }
  if (!originalCode) return <pre className="ai-code"><code><HighlightedCode code={doc.code} language={language ?? ''} /></code></pre>;

  // 两侧都去掉末尾空白，避免结尾换行差被 diff 成一条空的删除行
  const diff = diffLines(originalCode.replace(/\s+$/, ''), doc.code);
  const changedIndexes = diff.flatMap((line, i) => (line.kind === 'same' ? [] : [i]));
  if (changedIndexes.length === 0) return <p className="muted">AI 认为当前代码无需修改。</p>;

  const reasons = new Map<number, string>();
  const used = new Set<number>();
  for (const change of doc.changes) {
    const needle = change.code.trim();
    const hit = changedIndexes.find((i) => !used.has(i) && diff[i]!.text.trim().includes(needle));
    if (hit != null) {
      used.add(hit);
      reasons.set(hit, change.reason);
    }
    // 匹配不到改动行的 reason 直接丢弃，不额外渲染
  }
  // 连续的同类改动合并分组（diff-hunk 视觉上是 display:contents，仅作语义分组）
  const segments: { kind: string; rows: { index: number; text: string; reason?: string }[] }[] = [];
  diff.forEach((line, index) => {
    const row = { index, text: line.text, reason: reasons.get(index) };
    const last = segments.at(-1);
    if (last && last.kind === line.kind) last.rows.push(row);
    else segments.push({ kind: line.kind, rows: [row] });
  });
  const tipsOn = tipsEnabled && reasons.size > 0;
  const showTip = (text: string) => (event: MouseEvent<HTMLElement>) => {
    // 冒泡 portal 到 body、fixed 定位：垂直对齐该行，右缘贴在分析面板左缘外侧
    const rowRect = event.currentTarget.getBoundingClientRect();
    const panelLeft = wrapRef.current?.getBoundingClientRect().left ?? rowRect.left;
    setTip({ text, top: rowRect.top + rowRect.height / 2, left: panelLeft });
  };
  const renderRow = (kind: string) => (row: { index: number; text: string; reason?: string }) => (
    <code
      className={`${kind}${row.reason && tipsOn ? ' chg' : ''}`}
      key={row.index}
      onMouseEnter={row.reason && tipsOn ? showTip(row.reason) : undefined}
      onMouseLeave={row.reason && tipsOn ? () => setTip(null) : undefined}
    >
      <span>{kind === 'added' ? '+' : kind === 'removed' ? '-' : ' '}</span>
      <HighlightedCode code={row.text} language={language ?? ''} />
      {'\n'}
    </code>
  );
  return (
    <div className="ai-diff-wrap" ref={wrapRef}>
      <div className={`diff ai-diff${tipsOn ? ' tips' : ''}`} ref={scrollerRef} onScroll={() => setTip(null)}>
        {segments.map((segment, si) => (
          segment.kind === 'same'
            ? <Fragment key={si}>{segment.rows.map(renderRow('same'))}</Fragment>
            : <div className={`diff-hunk ${segment.kind}`} key={si}>{segment.rows.map(renderRow(segment.kind))}</div>
        ))}
      </div>
      {tipsOn && tip && createPortal(
        <div className="diff-bubble" style={{ top: tip.top, right: window.innerWidth - tip.left + 10 }}>{tip.text}</div>,
        document.body,
      )}
    </div>
  );
}
