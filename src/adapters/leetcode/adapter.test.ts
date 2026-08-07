import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotProvider } from '../types';
import { createLeetCodeAdapter } from './adapter';

const bridge = (code: string | null): SnapshotProvider => ({
  getEditorSnapshot: async () => code ? { code, language: 'python' } : null,
});

beforeEach(() => {
  history.pushState({}, '', '/problems/two-sum/');
  document.body.innerHTML = '<h1>两数之和</h1>';
});

describe('LeetCode adapter', () => {
  it('matches problem pages and reads identity', async () => {
    const adapter = createLeetCodeAdapter('leetcode-cn', { bridge: bridge(null) });
    expect(adapter.matchLocation(new URL('https://leetcode.cn/problems/two-sum/'))).toBe(true);
    expect(await adapter.getProblemIdentity()).toMatchObject({
      problemKey: 'two-sum',
      title: '两数之和',
      accountKey: 'anonymous',
    });
  });

  it('reads editor model first', async () => {
    await expect(createLeetCodeAdapter('leetcode-cn', { bridge: bridge('print(1)') })
      .readEditorSnapshot()).resolves.toMatchObject({ code: 'print(1)', method: 'editor-model' });
  });

  it('falls back to textarea when the MAIN-world editor model is unavailable', async () => {
    document.body.innerHTML += '<textarea class="inputarea">return [0, 1]</textarea>';
    await expect(createLeetCodeAdapter('leetcode-cn', { bridge: bridge(null) })
      .readEditorSnapshot()).resolves.toMatchObject({ code: 'return [0, 1]', method: 'textarea' });
  });

  it('reconstructs rendered CodeMirror lines without losing line breaks', async () => {
    document.body.innerHTML += '<div class="cm-content"><div class="cm-line">line 1</div><div class="cm-line">line 2</div></div>';
    await expect(createLeetCodeAdapter('leetcode-cn', { bridge: bridge(null) })
      .readEditorSnapshot()).resolves.toMatchObject({ code: 'line 1\nline 2', method: 'rendered-code' });
  });

  it('detects role buttons and localized submit labels', () => {
    document.body.innerHTML += '<div role="button"><span>提交</span></div>';
    const callback = vi.fn();
    const stop = createLeetCodeAdapter('leetcode-cn', { bridge: bridge(null) }).observeSubmit(callback);
    document.querySelector('[role="button"] span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);
    stop();
  });
});
