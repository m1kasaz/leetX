import type { AISettings } from './settings';

export type AIContent = { kind: 'json'; value: unknown } | { kind: 'text'; value: string };
export async function requestOpenAI(settings: AISettings, apiKey: string, prompt: string, fetcher: typeof fetch = fetch): Promise<AIContent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeout);
  try {
    const response = await fetcher(settings.baseUrl, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: settings.model, messages: [{ role: 'system', content: '你是编程练习分析助手。仅依据输入事实分析；优先返回 JSON。' }, { role: 'user', content: prompt }], temperature: 0.2 }) });
    if (!response.ok) throw new Error(`Provider 请求失败（HTTP ${response.status}）`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Provider 返回了空结果');
    const candidate = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return { kind: 'json', value: JSON.parse(candidate) }; } catch { return { kind: 'text', value: text }; }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error(`请求超时（${settings.timeout}ms）`);
    throw error;
  } finally { clearTimeout(timer); }
}
