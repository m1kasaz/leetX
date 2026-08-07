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
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxCo84YtdnQEi9QNOrE3rZQUDLBaRKXHXiWM1041KjX5NYlhI71QKZLRvGSs5pMcGEWUlmHFep0L/jckBpy4T4u4VUjMrZN5P4+ddyqy2S/wrn6OfFxFxL366C6vGokgO6jYfwFjwxliH4dVi7et/96fgsp54Bmn4MP1UktU2Bv0G8uTPY38xFuBa3S4RO8yjaPHbhNByCgdoK140QEICWrsrATcyMGsfhtplede1YTsDw1Ykg4K87URTeGiRisixYiebhcIqR+3MlmRGbkwSbFDJEPT/+tSi12jbivl65pFfWAPRfyhGjmyCZgy7Z/KsRG9Yw5kNxF8+9Gy0dxXxjQIDAQAB',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: supportedOrigins,
    web_accessible_resources: [{
      resources: ['pageBridge.js'],
      matches: supportedOrigins,
    }],
  },
});
