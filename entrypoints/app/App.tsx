import { useEffect, useMemo, useState } from 'react';
import type { CaptureEntry, IssueEntry } from '../../src/db/captureLog';
import type { SavedAnalysis } from '../../src/ai/storage';
import type { ThemeMode } from '../../src/theme';
import { applyTheme, loadTheme, nextTheme, saveTheme } from '../../src/theme';
import { analyzeCapture, groupCaptures } from '../../src/workbench/analysis';
import { Toast } from './components/bits';
import { DetailPanel } from './components/DetailPanel';
import { RecordList } from './components/RecordList';
import { SettingsModal } from './components/SettingsModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import type { Filter, SettingsView } from './components/types';

interface Data {
  captures: CaptureEntry[];
  issues: IssueEntry[];
}

export default function App() {
  const [data, setData] = useState<Data>({ captures: [], issues: [] });
  const [filter, setFilter] = useState<Filter>('all');
  const [groupKey, setGroupKey] = useState('');
  const [captureId, setCaptureId] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsView>({ baseUrl: '', model: '', timeout: 180000 });
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'leetx/list-captures' }).then(setData);
    void loadTheme().then((x) => { setTheme(x); applyTheme(x); });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['leetx:theme']) void loadTheme().then((x) => { setTheme(x); applyTheme(x); });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const groups = useMemo(() => groupCaptures(data.captures), [data]);
  const visible = groups.filter((g) => filter === 'all' || (filter === 'luogu' ? g.platform === 'luogu' : g.platform.startsWith('leetcode')));
  const group = visible.find((x) => x.key === groupKey) ?? visible[0];
  const current = group?.submissions.find((x) => x.captureId === captureId) ?? group?.submissions.at(-1);
  const index = current && group ? group.submissions.indexOf(current) : -1;
  const previous = group && index > 0 ? group.submissions[index - 1] : undefined;
  const local = current ? analyzeCapture(current, previous) : undefined;
  const nodeAI = analyses.find((x) => x.id === `node:${current?.captureId}`);

  useEffect(() => {
    if (group) void chrome.runtime.sendMessage({ type: 'leetx/list-analyses', problemKey: group.problemKey }).then(setAnalyses);
  }, [group?.problemKey]);

  async function openSettings() {
    const value = await chrome.runtime.sendMessage({ type: 'leetx/get-ai-settings' }) as SettingsView;
    setSettings(value);
    setSettingsOpen(true);
  }

  async function configure(action: 'save' | 'test') {
    setBusy(action);
    setError('');
    try {
      const origin = `${new URL(settings.baseUrl).origin}/*`;
      const granted = await chrome.permissions.contains({ origins: [origin] }) || await chrome.permissions.request({ origins: [origin] });
      if (!granted) { setError('未授予该 AI 端点的访问权限'); setBusy(''); return; }
    } catch {
      setError('Base URL 必须是有效的 HTTP(S) URL');
      setBusy('');
      return;
    }
    const result = await chrome.runtime.sendMessage({ type: action === 'save' ? 'leetx/save-ai-settings' : 'leetx/test-ai-connection', settings, apiKey: apiKey || undefined });
    setBusy('');
    if (!result.ok) setError(result.error);
    else if (action === 'test') setToast('连接测试成功');
    else { setSettingsOpen(false); setApiKey(''); }
  }

  async function run(scope: 'node' | 'record') {
    if (!current || !group) return;
    setBusy(scope);
    setError('');
    const result = await chrome.runtime.sendMessage(scope === 'node'
      ? { type: 'leetx/analyze-node', current, previous }
      : { type: 'leetx/analyze-record', problemKey: group.problemKey, submissions: group.submissions });
    setBusy('');
    if (result.ok === false) {
      setError(result.error);
      if (String(result.error).includes('配置')) void openSettings();
    } else {
      setAnalyses((x) => [...x.filter((a) => a.id !== result.id), result]);
    }
  }

  return (
    <div className="shell">
      <TopBar
        theme={theme}
        captureCount={data.captures.length}
        onCycleTheme={() => { const n = nextTheme(theme); setTheme(n); void saveTheme(n); }}
        onOpenSettings={() => void openSettings()}
      />
      <main className="workspace">
        <RecordList
          filter={filter}
          groups={visible}
          activeKey={group?.key}
          onFilter={(x) => { setFilter(x); setGroupKey(''); }}
          onSelect={(key) => { setGroupKey(key); setCaptureId(''); }}
        />
        <TimelinePanel
          group={group}
          current={current}
          stream={null}
          onSelect={setCaptureId}
          onRunRecord={() => void run('record')}
          onCancel={() => {}}
        />
        <DetailPanel
          group={group}
          current={current}
          index={index}
          previous={previous}
          showDiff={showDiff}
          onToggleDiff={setShowDiff}
          local={local}
          nodeAI={nodeAI}
          stream={null}
          error={error}
          onRunNode={() => void run('node')}
          onCancel={() => {}}
        />
      </main>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          apiKey={apiKey}
          busy={busy}
          error={error}
          onChange={setSettings}
          onApiKey={setApiKey}
          onClose={() => setSettingsOpen(false)}
          onTest={() => void configure('test')}
          onSave={() => void configure('save')}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
