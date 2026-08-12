import { createAdapterForLocation } from '../src/adapters/registry';
import { createBridgeClient } from '../src/bridge/client';
import { startCaptureController } from '../src/capture/captureController';
import type { InboundMessage } from '../src/messaging/messages';
import { BRIDGE_CHANNEL } from '../src/bridge/protocol';
import { normalizeLeetCodeVerdict } from '../src/adapters/leetcode/verdict';
import { sha256Hex } from '../src/utils/hash';
import { newCaptureId } from '../src/utils/id';

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
    document.dispatchEvent(new CustomEvent('leetx:stop-capture'));
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

    const onSubmissionDetail = async (event: MessageEvent) => {
      const message = event.data as { source?: string; channel?: string; nonce?: string; event?: string; payload?: Record<string, unknown> };
      if (event.source !== window || message.source !== 'leetx-page' || message.channel !== BRIDGE_CHANNEL || message.nonce !== nonce || message.event !== 'SUBMISSION_DETAIL') return;
      const detail = message.payload;
      const question = detail?.question as { titleSlug?: string; translatedTitle?: string; title?: string } | undefined;
      const user = detail?.user as { userSlug?: string } | undefined;
      const code = typeof detail?.code === 'string' ? detail.code : '';
      const status = typeof detail?.statusDisplay === 'string' ? detail.statusDisplay : '';
      const slug = question?.titleSlug;
      if (!detail?.isMine || !code || !status || !slug) return;
      const identity = await adapter.getProblemIdentity();
      const title = question?.translatedTitle || identity?.title || question?.title || slug;
      void sha256Hex(code).then((codeHash) => {
        const captureId = newCaptureId();
        const submittedAt = typeof detail.timestamp === 'number' ? detail.timestamp * 1000 : Date.now();
        const verdict = normalizeLeetCodeVerdict(status);
        if (verdict === 'unknown') return;
        send({ type: 'leetx/capture-submit', captureId, platform: adapter.platform, problemKey: slug, title, canonicalUrl: `${location.origin}/problems/${slug}/`, accountKey: user?.userSlug || 'anonymous', language: typeof detail.langVerboseName === 'string' ? detail.langVerboseName : String(detail.lang || 'unknown'), code, codeHash, captureMethod: 'editor-model', captureConfidence: 'high', submittedAt, sourceUrl: location.href, issues: [], verdict, rawVerdict: status, runtimeText: typeof detail.runtimeDisplay === 'string' ? detail.runtimeDisplay : undefined, memoryText: typeof detail.memoryDisplay === 'string' ? detail.memoryDisplay : undefined, verdictAt: Date.now() });
      });
    };
    window.addEventListener('message', onSubmissionDetail);

    const stopCapture = startCaptureController({
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

    const cleanup = () => {
      stopCapture();
      window.removeEventListener('message', onSubmissionDetail);
      delete document.documentElement.dataset.leetxContentReady;
      delete document.documentElement.dataset.leetxNonce;
    };
    document.addEventListener('leetx:stop-capture', cleanup, { once: true });

    console.info('[leetX] Capture initialized', { platform: adapter.platform, url: location.href });
  },
});
