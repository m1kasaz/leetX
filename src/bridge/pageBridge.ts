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

// After clicking 提交, LeetCode only POSTs /problems/<slug>/submit/ (returning
// submission_id) and then polls /submissions/detail/<id>/check/ — neither is a
// GraphQL call, so passively watching /graphql never sees the verdict. We hook
// those endpoints and proactively query submissionDetails ourselves.
export const SUBMISSION_DETAILS_QUERY = `query submissionDetails($submissionId: ID!) {
  submissionDetail(submissionId: $submissionId) {
    code
    timestamp
    statusDisplay
    isMine
    runtimeDisplay: runtime
    memoryDisplay: memory
    lang
    langVerboseName
    question { questionId titleSlug title translatedTitle }
    user { userSlug }
  }
}`;

const SUBMIT_PATH = /\/problems\/[\w-]+\/submit\/?(?:[?#]|$)/;
const CHECK_PATH = /\/submissions\/detail\/(\d+)\/check\//;
const NON_TERMINAL_STATUS = /pending|judging/i;

export interface BridgeOptions {
  pollDelayMs?: number;
  pollAttempts?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match?.[1] ?? '';
}

function installFetchBridge(nonce: string, options: BridgeOptions = {}): void {
  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow.__leetxFetchBridge) {
    bridgeWindow.__leetxFetchBridge.nonce = nonce;
    return;
  }
  const state = { nonce };
  bridgeWindow.__leetxFetchBridge = state;
  const pollDelayMs = options.pollDelayMs ?? 1500;
  const pollAttempts = options.pollAttempts ?? 20;
  const published = new Set<string>();
  const polling = new Set<string>();

  const publishDetail = (detail: Record<string, unknown>) => {
    const key = [detail.timestamp, String(detail.code ?? '').length, detail.statusDisplay].join('|');
    if (published.has(key)) return;
    published.add(key);
    window.postMessage({
      source: 'leetx-page',
      channel: BRIDGE_CHANNEL,
      nonce: document.documentElement.dataset.leetxNonce ?? state.nonce,
      event: 'SUBMISSION_DETAIL',
      payload: detail,
    }, location.origin);
  };

  const publishSubmissionDetail = (json: unknown) => {
    const responses = Array.isArray(json) ? json : [json];
    for (const response of responses) {
      const detail = (response as { data?: { submissionDetail?: Record<string, unknown> } })?.data?.submissionDetail;
      if (!detail) continue;
      publishDetail(detail);
    }
  };

  const nativeFetch = window.fetch.bind(window);

  const pollSubmissionDetail = async (submissionId: string): Promise<void> => {
    if (polling.has(submissionId)) return;
    polling.add(submissionId);
    try {
      for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
        try {
          const response = await nativeFetch(`${location.origin}/graphql/`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Referer: location.href,
              'x-csrftoken': readCsrfToken(),
            },
            body: JSON.stringify({
              operationName: 'submissionDetails',
              query: SUBMISSION_DETAILS_QUERY,
              variables: { submissionId },
            }),
          });
          const json = await response.json();
          const detail = (json as { data?: { submissionDetail?: Record<string, unknown> } })?.data?.submissionDetail;
          const status = typeof detail?.statusDisplay === 'string' ? detail.statusDisplay : '';
          if (detail && status && !NON_TERMINAL_STATUS.test(status)) {
            publishDetail(detail);
            return;
          }
        } catch {
          // Retry below; never interfere with LeetCode's own flow.
        }
        await sleep(pollDelayMs);
      }
    } finally {
      polling.delete(submissionId);
    }
  };

  const ensureSubmissionDetail = (submissionId: string): void => {
    void pollSubmissionDetail(submissionId);
  };

  const handleResponse = (requestUrl: string, json: unknown) => {
    if (requestUrl.includes('/graphql')) {
      publishSubmissionDetail(json);
      return;
    }
    if (SUBMIT_PATH.test(requestUrl)) {
      const id = (json as { submission_id?: number | string } | null)?.submission_id;
      if (id != null) ensureSubmissionDetail(String(id));
      return;
    }
    const check = requestUrl.match(CHECK_PATH);
    if (check?.[1] && (json as { state?: string } | null)?.state === 'SUCCESS') {
      ensureSubmissionDetail(check[1]);
    }
  };

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (/graphql|\/submit\/?([?#]|$)|\/check\//.test(requestUrl)) handleResponse(requestUrl, await response.clone().json());
    } catch {
      // Never interfere with LeetCode's own fetch flow.
    }
    return response;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    const requestUrl = String(url);
    if (/graphql|\/submit\/?([?#]|$)|\/check\//.test(requestUrl)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === 'json') handleResponse(requestUrl, this.response);
          else if (!this.responseType || this.responseType === 'text') handleResponse(requestUrl, JSON.parse(this.responseText));
        } catch {
          // Never interfere with LeetCode's own XMLHttpRequest flow.
        }
      });
    }
    return nativeOpen.call(this, method, url, ...(rest as [boolean?, string?, string?]));
  };
}

export function installPageBridge(nonce: string, options: BridgeOptions = {}): void {
  installFetchBridge(nonce, options);
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
