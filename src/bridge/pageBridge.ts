import { BRIDGE_CHANNEL, bridgeRequestSchema } from './protocol';
import { BRIDGE_SELECTORS } from './selectors';

interface MonacoModelLike { getValue(): string; getLanguageId?(): string }
interface CodeMirror5Like { getValue(): string; getOption?(key: string): unknown }
interface BridgeWindow extends Window {
  __leetxFetchBridge?: { nonce: string };
}

export function readMainWorldSnapshot(): { code: string; language: string } | null {
  const monaco = (window as unknown as { monaco?: { editor?: { getModels?: () => MonacoModelLike[] } } }).monaco;
  const model = (monaco?.editor?.getModels?.() ?? []).find((item) => item.getValue().trim().length > 0);
  if (model) return { code: model.getValue(), language: model.getLanguageId?.() ?? '' };
  const host = document.querySelector(BRIDGE_SELECTORS.codeMirrorHost) as (Element & { CodeMirror?: CodeMirror5Like }) | null;
  const codeMirror = host?.CodeMirror;
  if (codeMirror) {
    const code = codeMirror.getValue();
    const mode = codeMirror.getOption?.('mode');
    if (code.trim()) return { code, language: typeof mode === 'string' ? mode : '' };
  }
  return null;
}

function installFetchBridge(nonce: string): void {
  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow.__leetxFetchBridge) {
    bridgeWindow.__leetxFetchBridge.nonce = nonce;
    return;
  }
  const state = { nonce };
  bridgeWindow.__leetxFetchBridge = state;
  const publishSubmissionDetail = (json: unknown) => {
    const responses = Array.isArray(json) ? json : [json];
    for (const response of responses) {
      const detail = (response as { data?: { submissionDetail?: unknown } })?.data?.submissionDetail;
      if (!detail) continue;
      window.postMessage({
        source: 'leetx-page',
        channel: BRIDGE_CHANNEL,
        nonce: document.documentElement.dataset.leetxNonce ?? state.nonce,
        event: 'SUBMISSION_DETAIL',
        payload: detail,
      }, location.origin);
    }
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (requestUrl.includes('/graphql')) publishSubmissionDetail(await response.clone().json());
    } catch {
      // Never interfere with LeetCode's own fetch flow.
    }
    return response;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    const requestUrl = String(url);
    if (requestUrl.includes('/graphql')) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === 'json') publishSubmissionDetail(this.response);
          else if (!this.responseType || this.responseType === 'text') publishSubmissionDetail(JSON.parse(this.responseText));
        } catch {
          // Never interfere with LeetCode's own XMLHttpRequest flow.
        }
      });
    }
    return nativeOpen.call(this, method, url, ...(rest as [boolean?, string?, string?]));
  };
}

export function installPageBridge(nonce: string): void {
  installFetchBridge(nonce);
  window.addEventListener('message', (event: MessageEvent) => {
    const parsed = bridgeRequestSchema.safeParse(event.data);
    const activeNonce = document.documentElement.dataset.leetxNonce ?? nonce;
    if (!parsed.success || parsed.data.nonce !== activeNonce) return;
    let result: Record<string, unknown>;
    try {
      const snapshot = readMainWorldSnapshot();
      result = snapshot ? { ok: true, payload: snapshot } : { ok: false, error: 'no-editor-found' };
    } catch (error) {
      result = { ok: false, error: String(error) };
    }
    window.postMessage({ source: 'leetx-page', channel: BRIDGE_CHANNEL, nonce: activeNonce, requestId: parsed.data.requestId, ...result }, location.origin);
  });
}
