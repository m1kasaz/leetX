import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { HeatmapCalendar } from './HeatmapCalendar';
import { buildHeatmapDays } from '../../../src/workbench/heatmap';
import type { DayRange } from '../../../src/workbench/heatmap';

const grid = buildHeatmapDays([{ submittedAt: new Date(2026, 7, 20, 10).getTime() }], new Date(2026, 7, 24, 15));

function render(props: Partial<Parameters<typeof HeatmapCalendar>[0]>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(<HeatmapCalendar grid={grid} range={null} onRange={() => {}} {...props} />);
  });
  return host;
}

const day = (host: HTMLElement, key: string) =>
  host.querySelector<HTMLButtonElement>(`.heatmap-day[aria-label^="${key}"]`);

const enable = (host: HTMLElement) => {
  act(() => host.querySelector<HTMLInputElement>('.tip-switch input')?.click());
};

describe('HeatmapCalendar', () => {
  it('开关关闭时点选不生效', () => {
    const onRange = vi.fn();
    const host = render({ onRange });
    act(() => day(host, '2026-08-20')?.click());
    act(() => day(host, '2026-08-24')?.click());
    expect(onRange).not.toHaveBeenCalled();
    expect(day(host, '2026-08-20')?.className).not.toContain('pending');
  });

  it('打开开关后点两天提交一个自动排序的范围', () => {
    const onRange = vi.fn();
    const host = render({ onRange });
    enable(host);
    act(() => day(host, '2026-08-24')?.click());
    expect(onRange).not.toHaveBeenCalled();
    expect(day(host, '2026-08-24')?.className).toContain('pending');
    act(() => day(host, '2026-08-20')?.click());
    expect(onRange).toHaveBeenCalledWith({ start: '2026-08-20', end: '2026-08-24' });
  });

  it('同一天点两次得到单日范围', () => {
    const onRange = vi.fn();
    const host = render({ onRange });
    enable(host);
    act(() => day(host, '2026-08-20')?.click());
    act(() => day(host, '2026-08-20')?.click());
    expect(onRange).toHaveBeenCalledWith({ start: '2026-08-20', end: '2026-08-20' });
  });

  it('关闭开关时清除已提交的范围', () => {
    const onRange = vi.fn();
    const host = render({ onRange });
    enable(host);
    act(() => day(host, '2026-08-20')?.click());
    act(() => day(host, '2026-08-24')?.click());
    expect(onRange).toHaveBeenCalledWith({ start: '2026-08-20', end: '2026-08-24' });
    enable(host); // 再点一次即关闭
    expect(onRange).toHaveBeenLastCalledWith(null);
  });

  it('清除按钮重置已提交的范围', () => {
    const onRange = vi.fn();
    const range: DayRange = { start: '2026-08-20', end: '2026-08-24' };
    const host = render({ range, onRange });
    enable(host);
    expect(host.textContent).toContain('08-20 ~ 08-24');
    expect(day(host, '2026-08-22')?.className).toContain('in-range');
    act(() => host.querySelector<HTMLButtonElement>('.heatmap-clear')?.click());
    expect(onRange).toHaveBeenCalledWith(null);
  });

  it('未来日期的格子不可选', () => {
    const host = render({});
    expect(day(host, '2026-08-25')?.disabled).toBe(true);
    expect(day(host, '2026-08-24')?.disabled).toBe(false);
  });
});
