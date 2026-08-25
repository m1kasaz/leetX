export interface HeatmapDay {
  key: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export interface HeatmapGrid {
  weeks: HeatmapDay[][];
  max: number;
}

export interface DayRange {
  start: string;
  end: string;
}

export const HEATMAP_WEEKS = 12;

export function dateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function inDayRange(range: DayRange, timestamp: number): boolean {
  const key = dateKey(timestamp);
  return key >= range.start && key <= range.end;
}

export function buildHeatmapDays(
  captures: readonly { submittedAt: number }[],
  today: Date = new Date(),
  weeks: number = HEATMAP_WEEKS,
): HeatmapGrid {
  const counts = new Map<string, number>();
  for (const entry of captures) {
    const key = dateKey(entry.submittedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const todayKey = dateKey(today.getTime());
  // 对齐到本周周一，再向前推 weeks-1 周作为起点
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const cursor = new Date(start);
  const grid: HeatmapDay[][] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dateKey(cursor.getTime());
      const count = counts.get(key) ?? 0;
      max = Math.max(max, count);
      week.push({ key, count, level: 0, future: key > todayKey });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(week);
  }
  if (max > 0) {
    for (const week of grid) {
      for (const day of week) {
        day.level = day.count === 0 ? 0 : (Math.ceil((day.count / max) * 4) as 1 | 2 | 3 | 4);
      }
    }
  }
  return { weeks: grid, max };
}
