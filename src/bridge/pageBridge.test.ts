import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPageBridge } from './pageBridge';

const DETAIL = {
  code: 'class Solution:\n    pass',
  timestamp: 1786784697,
  statusDisplay: 'Wrong Answer',
  isMine: true,
  runtimeDisplay: 'N/A',
  memoryDisplay: 'N/A',
  lang: 'python3',
  langVerboseName: 'Python3',
  question: { questionId: '128', titleSlug: 'longest-consecutive-sequence', title: 'Longest Consecutive Sequence', translatedTitle: '最长连续序列' },
  user: { userSlug: 'clever-mir2akhanizvq' },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function installFetchStub(graphqlBodies: unknown[] = [{ data: { submissionDetail: DETAIL } }]) {
  const stub = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/submit/')) return jsonResponse({ submission_id: 742416874 });
    if (url.includes('/check/')) return jsonResponse({ state: 'SUCCESS' });
    if (url.includes('/graphql')) return jsonResponse(graphqlBodies.shift() ?? { data: { submissionDetail: null } });
    throw new Error(`unexpected url: ${url}`);
  });
  vi.stubGlobal('fetch', stub);
  return stub;
}

function collectDetails(count = 1): Promise<Record<string, unknown>[]> {
  return new Promise((resolve) => {
    const details: Record<string, unknown>[] = [];
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { source?: string; event?: string; payload?: Record<string, unknown> };
      if (message.source === 'leetx-page' && message.event === 'SUBMISSION_DETAIL' && message.payload) {
        details.push(message.payload);
        if (details.length === count) resolve(details);
      }
    });
  });
}

describe('pageBridge submission detail capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as unknown as { __leetxFetchBridge?: unknown }).__leetxFetchBridge;
  });

  it('polls submissionDetails after a submit response and publishes the verdict', async () => {
    installFetchStub();
    installPageBridge('nonce-123456', { pollDelayMs: 0, pollAttempts: 5 });
    const details = collectDetails();
    await window.fetch('https://leetcode.cn/problems/longest-consecutive-sequence/submit/', { method: 'POST' });
    const [detail] = await details;
    expect(detail.statusDisplay).toBe('Wrong Answer');
    expect((detail.question as { titleSlug: string }).titleSlug).toBe('longest-consecutive-sequence');
  });

  it('publishes only once for duplicate submit/check triggers', async () => {
    installFetchStub();
    installPageBridge('nonce-123456', { pollDelayMs: 0, pollAttempts: 5 });
    const details = collectDetails();
    await window.fetch('https://leetcode.cn/problems/longest-consecutive-sequence/submit/', { method: 'POST' });
    await window.fetch('https://leetcode.cn/submissions/detail/742416874/check/');
    await window.fetch('https://leetcode.cn/problems/longest-consecutive-sequence/submit/', { method: 'POST' });
    const [detail] = await details;
    expect(detail.statusDisplay).toBe('Wrong Answer');
    // Give any duplicate polls a chance to fire, then assert nothing more arrived.
    let extra = 0;
    window.addEventListener('message', (event: MessageEvent) => {
      if ((event.data as { event?: string }).event === 'SUBMISSION_DETAIL') extra += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(extra).toBe(0);
  });

  it('keeps polling while the judge reports a non-terminal status', async () => {
    installFetchStub([
      { data: { submissionDetail: { ...DETAIL, statusDisplay: 'Pending' } } },
      { data: { submissionDetail: DETAIL } },
    ]);
    installPageBridge('nonce-123456', { pollDelayMs: 0, pollAttempts: 5 });
    const details = collectDetails();
    await window.fetch('https://leetcode.cn/submissions/detail/742416874/check/');
    const [detail] = await details;
    expect(detail.statusDisplay).toBe('Wrong Answer');
  });
});
