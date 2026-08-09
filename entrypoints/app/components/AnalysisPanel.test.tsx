import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AnalysisPanel } from './AnalysisPanel';

const local = { headline: '本次提交尚未通过终态判题', facts: ['fact-a'], limitations: [] };

function render(props: Partial<Parameters<typeof AnalysisPanel>[0]>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(<AnalysisPanel local={local} error="" onRun={() => {}} onCancel={() => {}} {...props} />);
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
    const host = render({ streaming: '正在输出', onCancel });
    expect(host.textContent).toContain('正在输出');
    const button = host.querySelector<HTMLButtonElement>('.analysis header button');
    expect(button?.textContent).toBe('取消');
    act(() => button?.click());
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders saved json analysis', () => {
    const host = render({ analysis: { id: 'node:x', scope: 'node', problemKey: 'p', createdAt: 1, content: { kind: 'json', value: { summary: 's' } } } });
    expect(host.textContent).toContain('"summary": "s"');
  });
});
