import type { CaptureEntry } from '../../../src/db/captureLog';
import type { SavedAnalysis } from '../../../src/ai/storage';
import type { CaptureGroup } from '../../../src/workbench/analysis';
import { diffLines } from '../../../src/workbench/diff';
import { AnalysisPanel } from './AnalysisPanel';
import { Empty, HighlightedCode } from './bits';
import type { StreamState } from './types';

export function DetailPanel(props: {
  group?: CaptureGroup;
  current?: CaptureEntry;
  previous?: CaptureEntry;
  showDiff: boolean;
  onToggleDiff(value: boolean): void;
  nodeAI?: SavedAnalysis;
  recordAI?: SavedAnalysis;
  stream: StreamState | null;
  error: string;
  onRun(scope: 'node' | 'record'): void;
  onCancel(): void;
}) {
  const { group, current, previous, showDiff, onToggleDiff, nodeAI, stream, error, onRun, onCancel } = props;
  return (
    <section className="detail">
      {current && group ? (
        <div className="detail-swap" key={current.captureId}>
          <div className="detail-grid">
            <article className="code-card">
              <header>
                <div className="dots">● ● ● <b>{current.language}</b></div>
                <div>
                  <button className={!showDiff ? 'active' : ''} onClick={() => onToggleDiff(false)}>当前代码</button>
                  <button className={showDiff ? 'active' : ''} onClick={() => onToggleDiff(true)}>行级 Diff</button>
                </div>
              </header>
              {showDiff ? (
                <pre className="diff">
                  {diffLines(previous?.code ?? '', current.code).map((l, i) => (
                    <code className={l.kind} key={i}>
                      <span>{l.kind === 'added' ? '+' : l.kind === 'removed' ? '-' : ' '}</span>
                      <HighlightedCode code={l.text} language={current.language} />
                      {'\n'}
                    </code>
                  ))}
                </pre>
              ) : (
                <pre><HighlightedCode code={current.code} language={current.language} /></pre>
              )}
              <footer>{current.captureMethod}<span>{current.code.split('\n').length} lines</span></footer>
            </article>
            <AnalysisPanel
              nodeAnalysis={nodeAI}
              currentCode={current.code}
              language={current.language}
              stream={stream}
              error={error}
              onRun={onRun}
              onCancel={onCancel}
            />
          </div>
        </div>
      ) : (
        <Empty text="选择或产生一条采集记录" />
      )}
    </section>
  );
}
