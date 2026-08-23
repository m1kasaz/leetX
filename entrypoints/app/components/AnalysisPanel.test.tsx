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

  it('renders saved json analysis as a highlighted diff with hover reasons', () => {
    const host = render({
      currentCode: 'pass\n',
      language: 'python',
      nodeAnalysis: {
        id: 'node:x',
        scope: 'node',
        problemKey: 'p',
        createdAt: 1,
        content: {
          kind: 'json',
          value: { code: 'return 1\n', changes: [{ code: 'return 1', reason: '返回结果' }] },
        },
      },
    });
    expect(host.querySelector('.diff .added')?.textContent).toContain('return 1');
    expect(host.querySelector('.diff .removed')?.textContent).toContain('pass');
    expect(host.querySelector('.diff-hunk.added code')?.textContent).toContain('return 1');
    expect(host.querySelector('.diff-hunk.removed code')?.textContent).toContain('pass');
    expect(host.querySelector('.diff .syntax-keyword')?.textContent).toBe('return');
    expect(host.textContent).not.toContain('"code"');
    // 悬浮有解释的行 → 冒泡 portal 到 body，浮出在分析栏左侧，移出后消失
    const row = host.querySelector('code.chg');
    expect(row).toBeTruthy();
    expect(host.querySelector('.ai-diff')?.className).toContain('tips');
    act(() => { row!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.body.querySelector('.diff-bubble')?.textContent).toBe('返回结果');
    act(() => { row!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    expect(document.body.querySelector('.diff-bubble')).toBeNull();
  });

  it('toggles inline explanations off from the header switch', () => {
    const host = render({
      currentCode: 'pass\n',
      nodeAnalysis: {
        id: 'node:x',
        scope: 'node',
        problemKey: 'p',
        createdAt: 1,
        content: {
          kind: 'json',
          value: { code: 'return 1\n', changes: [{ code: 'return 1', reason: '返回结果' }] },
        },
      },
    });
    expect(host.querySelector('.ai-diff')?.className).toContain('tips');
    expect(host.querySelector('code.chg')).toBeTruthy();
    const toggle = host.querySelector<HTMLInputElement>('.tip-switch input');
    act(() => toggle?.click());
    expect(host.querySelector('.ai-diff')?.className).not.toContain('tips');
    expect(host.querySelector('code.chg')).toBeNull();
  });

  it('drops reasons that do not match any changed line', () => {
    const host = render({
      currentCode: 'let a = 1;\n',
      nodeAnalysis: {
        id: 'node:x',
        scope: 'node',
        problemKey: 'p',
        createdAt: 1,
        content: {
          kind: 'json',
          value: {
            code: 'let b = 2;\n',
            changes: [
              { code: 'let b = 2;', reason: '修正变量初始化' },
              { code: 'def solve():', reason: '复杂度：O(n)' },
            ],
          },
        },
      },
    });
    expect(host.querySelectorAll('code.chg')).toHaveLength(1);
    expect(host.querySelector('.ai-change-reasons')).toBeNull();
    expect(host.textContent).not.toContain('复杂度');
  });

  it('tells the user when the AI sees nothing to change', () => {
    const host = render({
      currentCode: 'let a = 1;',
      nodeAnalysis: {
        id: 'node:x',
        scope: 'node',
        problemKey: 'p',
        createdAt: 1,
        content: { kind: 'json', value: { code: 'let a = 1;\n', changes: [] } },
      },
    });
    expect(host.textContent).toContain('无需修改');
  });

  it('runs node-scope analysis without scope tabs', () => {
    const onRun = vi.fn();
    const host = render({ onRun });
    expect(host.querySelector('.ai-tabs')).toBeNull();
    const runButton = host.querySelector<HTMLButtonElement>('.analysis header button');
    expect(runButton?.textContent).toBe('分析');
    expect(runButton?.title).toBe('针对当前选中的这一次提交');
    act(() => runButton?.click());
    expect(onRun).toHaveBeenCalledWith('node');
  });
});
