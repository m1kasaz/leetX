import { useCallback, useEffect, useState } from 'react';
import type { CaptureEntry, IssueEntry } from '../../src/db/captureLog';

interface Data { captures: CaptureEntry[]; issues: IssueEntry[] }
type Connection = 'connecting' | 'connected' | 'unsupported' | 'failed';

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');

  const loadData = useCallback(() => {
    void chrome.runtime.sendMessage({ type: 'leetx/list-captures' })
      .then((value) => setData(value as Data));
  }, []);

  const connectCurrentPage = useCallback(async () => {
    setConnection('connecting');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url || !/^https:\/\/(?:www\.)?(?:leetcode\.(?:cn|com)|luogu\.com\.cn)\//.test(tab.url)) {
        setConnection('unsupported');
        return;
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'],
      });
      setConnection('connected');
      loadData();
    } catch (error) {
      console.error('[leetX] Failed to connect current page', error);
      setConnection('failed');
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
    void connectCurrentPage();
  }, [connectCurrentPage, loadData]);

  const openWorkbench = () => void chrome.tabs.create({ url: chrome.runtime.getURL('/app.html') });
  const statusText = {
    connecting: '正在连接当前页面…',
    connected: '当前题目页已连接',
    unsupported: '请在力扣或洛谷页面打开',
    failed: '连接失败，点击重试',
  }[connection];

  if (!data) return <main className="popup">加载中…</main>;
  return (
    <main className="popup">
      <header>
        <div><b>leetX</b><span>本地采集运行中</span></div>
        <i className={connection === 'connected' ? '' : 'inactive'} />
      </header>
      <button className={`connection ${connection}`} onClick={() => void connectCurrentPage()}>
        <span>{statusText}</span><b>{connection === 'connected' ? '✓' : '↻'}</b>
      </button>
      <section className="stats">
        <div><strong>{data.captures.length}</strong><span>提交记录</span></div>
        <div><strong>{data.issues.length}</strong><span>采集异常</span></div>
      </section>
      <h2>最近提交</h2>
      <ul>{data.captures.slice(0, 5).map((item) => (
        <li key={item.captureId}>
          <span className={`dot ${item.verdict === 'accepted' ? 'ok' : 'warn'}`} />
          <div><b>{item.problemKey}</b><small>{item.language} · {item.verdict ?? '等待终态'}</small></div>
        </li>
      ))}</ul>
      {!data.captures.length && <p className="empty">连接题目页后提交代码，记录会显示在这里。</p>}
      <button onClick={openWorkbench}>打开完整工作台 <b>→</b></button>
    </main>
  );
}
