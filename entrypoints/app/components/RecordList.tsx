import type { CaptureGroup } from '../../../src/workbench/analysis';
import { PlatformIcon, time } from './bits';
import type { Filter } from './types';

export function RecordList(props: {
  filter: Filter;
  groups: CaptureGroup[];
  activeKey?: string;
  onFilter(filter: Filter): void;
  onSelect(key: string): void;
}) {
  const { filter, groups, activeKey, onFilter, onSelect } = props;
  return (
    <aside className="records">
      <div className="heading"><small>CAPTURE RECORDS</small><h1>刷题记录</h1></div>
      <div className="filters">
        {(['all', 'leetcode', 'luogu'] as Filter[]).map((x) => (
          <button
            className={filter === x ? 'active' : ''}
            onClick={() => onFilter(x)}
            key={x}
            aria-label={x === 'all' ? '全部平台' : x === 'leetcode' ? '力扣' : '洛谷'}
            data-tooltip={x === 'all' ? '全部平台' : x === 'leetcode' ? '力扣' : '洛谷'}
          >
            <PlatformIcon platform={x} />
          </button>
        ))}
      </div>
      <div className="record-list">
        {groups.map((x) => (
          <button key={x.key} className={`record ${activeKey === x.key ? 'active' : ''}`} onClick={() => onSelect(x.key)}>
            <div>
              <em><PlatformIcon platform={x.platform} /><span>{x.platform}</span></em>
              <time>{time(x.latestAt)}</time>
            </div>
            <h3>{x.title || x.problemKey}</h3>
            <p>{x.problemKey}<b>{x.submissions.length} 次</b></p>
          </button>
        ))}
      </div>
    </aside>
  );
}
