import { createAdapterForLocation } from '../src/adapters/registry';
import { createBridgeClient } from '../src/bridge/client';
import { startCaptureController } from '../src/capture/captureController';
import type { InboundMessage } from '../src/messaging/messages';

export default defineContentScript({
  matches: [
    '*://leetcode.cn/*',
    '*://www.leetcode.cn/*',
    '*://leetcode.com/*',
    '*://www.leetcode.com/*',
    '*://www.luogu.com.cn/*',
  ],
  runAt: 'document_idle',
  main() {
    if (document.documentElement.dataset.leetxContentReady === 'true') {
      console.info('[leetX] Capture already initialized');
      return;
    }
    document.documentElement.dataset.leetxContentReady = 'true';

    const nonce = crypto.randomUUID();
    document.documentElement.dataset.leetxNonce = nonce;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/pageBridge.js');
    script.onload = () => script.remove();
    script.onerror = () => console.warn('[leetX] MAIN-world bridge failed to load');
    document.documentElement.appendChild(script);

    const adapter = createAdapterForLocation(new URL(location.href), {
      bridge: createBridgeClient({ nonce }),
    });
    if (!adapter) return;

    const send = (message: InboundMessage) => {
      void chrome.runtime.sendMessage(message).catch((error: unknown) => {
        console.error('[leetX] Failed to send capture message', error);
      });
    };

    startCaptureController({
      adapter,
      send,
      reportIssue: (reason, detail) => send({
        type: 'leetx/capture-issue',
        platform: adapter.platform,
        reason,
        detail,
        at: Date.now(),
      }),
    });

    console.info('[leetX] Capture initialized', { platform: adapter.platform, url: location.href });
  },
});
