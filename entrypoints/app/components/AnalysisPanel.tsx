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
  const { local, analysis, error, onRun } = props;
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
        <button onClick={onRun}>{analysis ? '重试' : '开始分析'}</button>
      </header>
      {error && <p className="error">{error}</p>}
      {analysis ? <AnalysisResult analysis={analysis} /> : null}
    </article>
  );
}
