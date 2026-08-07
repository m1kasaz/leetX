import { defineConfig } from 'wxt';

export default defineConfig({
  alias: { '@': 'src' },
  manifest: {
    name: 'leetX',
    description: 'Local-first practice capture for LeetCode and Luogu (stage 0).',
    permissions: ['storage'],
    host_permissions: ['https://leetcode.cn/*', 'https://leetcode.com/*', 'https://www.luogu.com.cn/*'],
    web_accessible_resources: [{
      resources: ['pageBridge.js'],
      matches: ['https://leetcode.cn/*', 'https://leetcode.com/*', 'https://www.luogu.com.cn/*'],
    }],
  },
});
