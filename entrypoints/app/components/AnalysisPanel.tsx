import type { SavedAnalysis } from '../../../src/ai/storage';
import type { LocalAnalysis } from '../../../src/workbench/analysis';
import { AnalysisResult } from './bits';

export function AnalysisPanel(props: {
  local: LocalAnalysis;
  analysis?: SavedAnalysis;
  streaming?: string | null;
  error: string;
  onRun(): void;
  onCancel(): void;
}) {
  const { local, analysis, streaming, error, onRun, onCancel } = props;
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
          : <button onClick={onRun}>{analysis ? '重试' : '开始分析'}</button>}
      </header>
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
