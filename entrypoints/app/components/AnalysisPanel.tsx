import { useState } from 'react';
import type { SavedAnalysis } from '../../../src/ai/storage';
import { AnalysisResult } from './bits';
import type { StreamState } from './types';

export function AnalysisPanel(props: {
  nodeAnalysis?: SavedAnalysis;
  currentCode?: string;
  language?: string;
  stream: StreamState | null;
  error: string;
  onRun(scope: 'node' | 'record'): void;
  onCancel(): void;
}) {
  const { nodeAnalysis, currentCode, language, stream, error, onRun, onCancel } = props;
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const streaming = stream?.scope === 'node' ? stream.text : null;

  return (
    <article className="analysis">
      <header>
        <span>AI</span>
        <div><b>AI 分析</b><small>仅在明确点击后请求</small></div>
        <label className="tip-switch" title="悬浮改动行时显示解释">
          <input
            type="checkbox"
            checked={tipsEnabled}
            onChange={(event) => setTipsEnabled(event.target.checked)}
          />
          <i aria-hidden="true" />行内解释
        </label>
        {streaming != null
          ? <button onClick={onCancel}>取消</button>
          : <button disabled={stream != null} title="针对当前选中的这一次提交" onClick={() => onRun('node')}>分析</button>}
      </header>
      {error && <p className="error">{error}</p>}
      {streaming != null && (
        <pre className="ai-result streaming">
          {streaming || '正在连接模型…'}
          <span className="stream-cursor" aria-hidden="true" />
        </pre>
      )}
      {streaming == null && <AnalysisResult analysis={nodeAnalysis} originalCode={currentCode} language={language} tipsEnabled={tipsEnabled} />}
    </article>
  );
}
