import { createLeetCodeAdapter } from './leetcode/adapter';
import { createLuoguAdapter } from './luogu/adapter';
import type { AdapterDeps, JudgeAdapter } from './types';

export function createAdapterForLocation(url: URL, deps: AdapterDeps): JudgeAdapter | null {
  if (url.hostname === 'leetcode.cn' || url.hostname === 'www.leetcode.cn') {
    return createLeetCodeAdapter('leetcode-cn', deps);
  }
  if (url.hostname === 'leetcode.com' || url.hostname === 'www.leetcode.com') {
    return createLeetCodeAdapter('leetcode-com', deps);
  }
  if (/(^|\.)luogu\.com\.cn$/.test(url.hostname)) return createLuoguAdapter(deps);
  return null;
}
