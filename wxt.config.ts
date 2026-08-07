import { defineConfig } from 'wxt';

const supportedOrigins = [
  'https://leetcode.cn/*',
  'https://www.leetcode.cn/*',
  'https://leetcode.com/*',
  'https://www.leetcode.com/*',
  'https://www.luogu.com.cn/*',
];

export default defineConfig({
  alias: { '@': 'src' },
  manifest: {
    name: 'leetX',
    description: 'Local-first practice capture for LeetCode and Luogu (stage 0).',
    permissions: ['storage'],
    host_permissions: supportedOrigins,
    web_accessible_resources: [{
      resources: ['pageBridge.js'],
      matches: supportedOrigins,
    }],
  },
});
