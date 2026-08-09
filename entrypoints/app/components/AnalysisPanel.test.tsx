import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AnalysisPanel } from './AnalysisPanel';

const local = { headline: '本次提交尚未通过终态判题', facts: ['fact-a'], limitations: [] };

function render(props: Partial<Parameters<typeof AnalysisPanel>[0]>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      <AnalysisPanel local={local} stream={null} error="" onRun={() => {}} onCancel={() => {}} {...props} />,
    );
  });
  return host;
}

describe('AnalysisPanel', () => {
  it('shows the empty hint when nothing ran yet', () => {
    const host = render({});
    expect(host.textContent).toContain('尚未调用 AI');
  });

  it('renders streaming text with a cancel button', () => {
    const onCancel = vi.fn();
    const host = render({ stream: { scope: 'node', text: '正在输出' }, onCancel });
    expect(host.textContent).toContain('正在输出');
    const button = host.querySelector<HTMLButtonElement>('.analysis header button');
    expect(button?.textContent).toBe('取消');
    act(() => button?.click());
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders saved json analysis as structured document', () => {
    const host = render({
      nodeAnalysis: {
        id: 'node:x',
        scope: 'node',
        problemKey: 'p',
        createdAt: 1,
        content: { kind: 'json', value: { summary: 's', issues: ['issue-1'], complexity: 'O(n)' } },
      },
    });
    expect(host.textContent).toContain('s');
    expect(host.textContent).toContain('存在的问题');
    expect(host.textContent).toContain('issue-1');
    expect(host.textContent).toContain('O(n)');
    expect(host.textContent).not.toContain('"summary"');
  });

  it('switches between node and record tabs', () => {
    const onRun = vi.fn();
    const host = render({ onRun });
    const tabs = host.querySelectorAll<HTMLButtonElement>('.ai-tabs button');
    expect(tabs).toHaveLength(2);
    act(() => tabs[1].click());
    const runButton = host.querySelector<HTMLButtonElement>('.analysis header button');
    expect(runButton?.textContent).toBe('生成整体复盘');
    act(() => runButton?.click());
    expect(onRun).toHaveBeenCalledWith('record');
  });

  it('keeps showing node streaming while the record tab is selected', () => {
    const host = render({ stream: { scope: 'node', text: 'node 流式中' } });
    act(() => host.querySelectorAll<HTMLButtonElement>('.ai-tabs button')[1].click());
    expect(host.textContent).toContain('尚未调用 AI');
    const dot = host.querySelector('.ai-dot');
    expect(dot).not.toBeNull();
  });
});
