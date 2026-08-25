import { describe, expect, it } from 'vitest';
import { buildHeatmapDays, dateKey, inDayRange } from './heatmap';

const at = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();
const today = new Date(2026, 7, 24, 15, 30); // 2026-08-24 周一

describe('buildHeatmapDays', () => {
  it('同一天的多次提交合并计数', () => {
    const grid = buildHeatmapDays([{ submittedAt: at(2026, 8, 24, 9) }, { submittedAt: at(2026, 8, 24, 20) }], today);
    const day = grid.weeks.flat().find((x) => x.key === '2026-08-24');
    expect(day?.count).toBe(2);
  });

  it('空记录时所有天计数为 0 且最大值为 0', () => {
    const grid = buildHeatmapDays([], today);
    expect(grid.max).toBe(0);
    expect(grid.weeks.flat().every((x) => x.count === 0 && x.level === 0)).toBe(true);
  });

  it('网格为 12 周 × 7 天，最后一周包含今天且以周日结尾', () => {
    const grid = buildHeatmapDays([], today);
    expect(grid.weeks).toHaveLength(12);
    for (const week of grid.weeks) expect(week).toHaveLength(7);
    const lastWeek = grid.weeks[11]!;
    expect(lastWeek.some((x) => x.key === '2026-08-24')).toBe(true);
    expect(lastWeek[6]!.key).toBe('2026-08-30'); // 周日
    expect(grid.weeks[0]![0]!.key).toBe('2026-06-08'); // 12 周前的周一
  });

  it('窗口开始日之前的提交不计入', () => {
    const grid = buildHeatmapDays([{ submittedAt: at(2026, 6, 7) }], today); // 窗口外一天
    expect(grid.max).toBe(0);
  });

  it('level 按当天最大值分为 4 档', () => {
    const entries = [
      ...Array.from({ length: 8 }, () => ({ submittedAt: at(2026, 8, 24) })),
      ...Array.from({ length: 4 }, () => ({ submittedAt: at(2026, 8, 23) })),
      { submittedAt: at(2026, 8, 22) },
    ];
    const grid = buildHeatmapDays(entries, today);
    const days = grid.weeks.flat();
    expect(days.find((x) => x.key === '2026-08-24')?.level).toBe(4);
    expect(days.find((x) => x.key === '2026-08-23')?.level).toBe(2);
    expect(days.find((x) => x.key === '2026-08-22')?.level).toBe(1);
    expect(days.find((x) => x.key === '2026-08-21')?.level).toBe(0);
  });

  it('今天之后的日子标记为 future', () => {
    const grid = buildHeatmapDays([], today);
    const days = grid.weeks.flat();
    expect(days.find((x) => x.key === '2026-08-25')?.future).toBe(true);
    expect(days.find((x) => x.key === '2026-08-24')?.future).toBe(false);
  });
});

describe('dateKey', () => {
  it('按本地时区格式化日期', () => {
    expect(dateKey(at(2026, 1, 5, 23))).toBe('2026-01-05');
  });
});

describe('inDayRange', () => {
  const range = { start: '2026-08-10', end: '2026-08-12' };
  it('包含首尾两天，排除范围外', () => {
    expect(inDayRange(range, at(2026, 8, 10, 0))).toBe(true);
    expect(inDayRange(range, at(2026, 8, 12, 23))).toBe(true);
    expect(inDayRange(range, at(2026, 8, 9, 23))).toBe(false);
    expect(inDayRange(range, at(2026, 8, 13, 0))).toBe(false);
  });
});
