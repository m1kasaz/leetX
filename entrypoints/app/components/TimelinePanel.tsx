import type { CaptureEntry } from '../../../src/db/captureLog';
import type { SavedAnalysis } from '../../../src/ai/storage';
import { summarizeGroup, type CaptureGroup } from '../../../src/workbench/analysis';
import { AnalysisResult, PlatformIcon, time, verdictName } from './bits';
import type { StreamState } from './types';

export function TimelinePanel(props: {
  group?: CaptureGroup;
  current?: CaptureEntry;
  recordAI?: SavedAnalysis;
  stream: StreamState | null;
  onSelect(captureId: string): void;
  onRunRecord(): void;
  onCancel(): void;
}) {
  const { group, current, recordAI, stream, onSelect, onRunRecord, onCancel } = props;
  return (
    <section className="timeline-panel">
      {group && (
        <>
          <div className="problem">
            <span><PlatformIcon platform={group.platform} /></span>
            <div><small>{group.platform}</small><h2>{group.title || group.problemKey}</h2></div>
          </div>
          <div className="summary">
            {summarizeGroup(group)}
            {stream?.scope === 'record'
              ? <button onClick={onCancel}>取消</button>
              : <button onClick={onRunRecord}>{recordAI ? '重新进行最终 AI 分析' : '最终 AI 分析'}</button>}
          </div>
          {stream?.scope === 'record' && (
            <pre className="ai-result streaming">{stream.text || '正在连接模型…'}<span className="stream-cursor" aria-hidden="true" /></pre>
          )}
          {stream?.scope !== 'record' && recordAI && <AnalysisResult analysis={recordAI} />}
          <div className="timeline">
            {group.submissions.map((x, i) => (
              <button
                className={`node ${current?.captureId === x.captureId ? 'active' : ''}`}
                onClick={() => onSelect(x.captureId)}
                key={x.captureId}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <b>第 {i + 1} 次提交</b>
                  <time>{time(x.submittedAt)}</time>
                  <p>{x.language} · <em className={x.verdict === 'accepted' ? 'ok' : 'bad'}>{verdictName[x.verdict ?? ''] ?? '等待终态'}</em></p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
