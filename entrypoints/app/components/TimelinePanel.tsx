import type { CaptureEntry } from '../../../src/db/captureLog';
import { summarizeGroup, type CaptureGroup } from '../../../src/workbench/analysis';
import { PlatformIcon, time, verdictName } from './bits';

export function TimelinePanel(props: {
  group?: CaptureGroup;
  current?: CaptureEntry;
  onSelect(captureId: string): void;
}) {
  const { group, current, onSelect } = props;
  return (
    <section className="timeline-panel">
      {group && (
        <>
          <div className="problem">
            <span><PlatformIcon platform={group.platform} /></span>
            <div><small>{group.platform}</small><h2>{group.title || group.problemKey}</h2></div>
          </div>
          <div className="summary">
            <small>本题概览</small>
            <p>{summarizeGroup(group)}</p>
          </div>
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
