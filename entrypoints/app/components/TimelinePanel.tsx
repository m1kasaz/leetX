import type { CaptureEntry } from '../../../src/db/captureLog';
import type { CaptureGroup } from '../../../src/workbench/analysis';
import { time, verdictName } from './bits';

export function TimelinePanel(props: {
  group?: CaptureGroup;
  current?: CaptureEntry;
  onSelect(captureId: string): void;
}) {
  const { group, current, onSelect } = props;
  return (
    <section className="timeline-panel">
      {group && (
        <div className="timeline">
          {group.submissions.map((x, i) => {
            const state = x.verdict ? (x.verdict === 'accepted' ? 'ok' : 'bad') : 'pending';
            const label = verdictName[x.verdict ?? ''] ?? '等待终态';
            const tooltip = `第 ${i + 1} 次提交 · ${time(x.submittedAt)} · ${x.language} · ${label}`;
            return (
              <button
                aria-label={tooltip}
                className={`node ${state} ${current?.captureId === x.captureId ? 'active' : ''}`}
                data-tooltip={tooltip}
                key={x.captureId}
                onClick={() => onSelect(x.captureId)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
