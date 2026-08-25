import { memo, useState } from 'react';
import type { DayRange, HeatmapGrid } from '../../../src/workbench/heatmap';
import { dateKey } from '../../../src/workbench/heatmap';

export const HeatmapCalendar = memo(function HeatmapCalendar(props: {
  grid: HeatmapGrid;
  range: DayRange | null;
  onRange(range: DayRange | null): void;
}) {
  const { grid, range, onRange } = props;
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState('');
  const todayKey = dateKey(Date.now());

  function toggle() {
    if (enabled) {
      setPending('');
      onRange(null); // 关掉开关时同时取消日期筛选
    }
    setEnabled(!enabled);
  }

  function pick(key: string) {
    if (!enabled) return;
    if (!pending) {
      setPending(key);
      return;
    }
    onRange({ start: pending < key ? pending : key, end: pending < key ? key : pending });
    setPending('');
  }

  function clear() {
    setPending('');
    onRange(null);
  }

  const firstKey = grid.weeks[0]?.[0]?.key ?? todayKey;
  const short = (key: string) => key.slice(5); // 'MM-DD'
  const label = range
    ? `${short(range.start)} ~ ${short(range.end)}`
    : pending
      ? `${short(pending)} ~`
      : `${short(firstKey)} ~ ${short(todayKey)}`;

  return (
    <div className={`heatmap${enabled ? '' : ' off'}`}>
      <div className="heatmap-head">
        <small>{label}</small>
        {(range || pending) && (
          <button className="heatmap-clear" onClick={clear} aria-label="清除日期筛选">
            清除
          </button>
        )}
        <label className="tip-switch">
          <input type="checkbox" checked={enabled} onChange={toggle} aria-label="启用日期筛选" />
          <i aria-hidden="true" />
        </label>
      </div>
      <div className="heatmap-grid" aria-label="每日提交热力图">
        {grid.weeks.flat().map((day) => {
          const classes = ['heatmap-day', `l${day.level}`];
          if (day.future) classes.push('future');
          if (day.key === todayKey) classes.push('today');
          if (day.key === pending) classes.push('pending');
          if (range && day.key >= range.start && day.key <= range.end) classes.push('in-range');
          return (
            <button
              key={day.key}
              className={classes.join(' ')}
              disabled={day.future}
              onClick={() => pick(day.key)}
              aria-label={`${day.key} ${day.count} 次提交`}
              data-tooltip={`${day.key} · ${day.count} 次提交`}
            />
          );
        })}
      </div>
    </div>
  );
});
