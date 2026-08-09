import { useState } from 'react';
import type { SavedAnalysis } from '../../../src/ai/storage';
import type { LocalAnalysis } from '../../../src/workbench/analysis';
import { AnalysisResult } from './bits';
import type { StreamState } from './types';

type AIScope = 'node' | 'record';

const scopeMeta: Record<AIScope, { tab: string; run: string; rerun: string; hint: string }> = {
  node: { tab: '本次提交', run: '分析本次提交', rerun: '重新分析本次提交', hint: '针对当前选中的这一次提交' },
  record: { tab: '整体复盘', run: '生成整体复盘', rerun: '重新生成整体复盘', hint: '汇总本题的全部提交记录' },
};

export function AnalysisPanel(props: {
  local: LocalAnalysis;
  nodeAnalysis?: SavedAnalysis;
  recordAnalysis?: SavedAnalysis;
  stream: StreamState | null;
  error: string;
  onRun(scope: AIScope): void;
  onCancel(): void;
}) {
  const { local, nodeAnalysis, recordAnalysis, stream, error, onRun, onCancel } = props;
  const [tab, setTab] = useState<AIScope>('node');
  const analysis = tab === 'node' ? nodeAnalysis : recordAnalysis;
  const streaming = stream?.scope === tab ? stream.text : null;
  const meta = scopeMeta[tab];

  return (
    <article className="analysis">
      <header>
        <span>✦</span>
        <div><b>本地采集分析</b><small>DETERMINISTIC · 非 AI</small></div>
      </header>
      <section>
        <h3>{local.headline}</h3>
        <ul>{local.facts.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <header>
        <span>AI</span>
        <div><b>AI 分析</b><small>仅在明确点击后请求</small></div>
        {streaming != null
          ? <button onClick={onCancel}>取消</button>
          : <button disabled={stream != null} onClick={() => onRun(tab)}>{analysis ? meta.rerun : meta.run}</button>}
      </header>
      <div className="ai-tabs" role="tablist" aria-label="AI 分析范围">
        {(['node', 'record'] as const).map((scope) => (
          <button
            aria-selected={tab === scope}
            className={tab === scope ? 'active' : ''}
            key={scope}
            onClick={() => setTab(scope)}
            role="tab"
          >
            {scopeMeta[scope].tab}
            {stream?.scope === scope && <i className="ai-dot" aria-label="正在生成" />}
          </button>
        ))}
      </div>
      <p className="ai-hint">{meta.hint}</p>
      {error && <p className="error">{error}</p>}
      {streaming != null && (
        <pre className="ai-result streaming">
          {streaming || '正在连接模型…'}
          <span className="stream-cursor" aria-hidden="true" />
        </pre>
      )}
      {streaming == null && <AnalysisResult analysis={analysis} />}
    </article>
  );
}
