import { installPageBridge } from '../src/bridge/pageBridge';

export default defineContentScript({
  matches: [
    '*://leetcode.cn/*',
    '*://www.leetcode.cn/*',
    '*://leetcode.com/*',
    '*://www.leetcode.com/*',
  ],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installPageBridge(document.documentElement?.dataset.leetxNonce ?? '');
  },
});
