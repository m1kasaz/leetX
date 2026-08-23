import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptureEntry, IssueEntry } from '../../src/db/captureLog';
import type { SavedAnalysis } from '../../src/ai/storage';
import { streamAnalysis } from '../../src/ai/streamClient';
import type { StreamStart } from '../../src/ai/streamProtocol';
import type { ThemeMode } from '../../src/theme';
import { applyTheme, loadTheme, nextTheme, saveTheme } from '../../src/theme';
import { groupCaptures } from '../../src/workbench/analysis';
import { Toast } from './components/bits';
import { DetailPanel } from './components/DetailPanel';
import { RecordList } from './components/RecordList';
import { SettingsModal } from './components/SettingsModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import type { Filter, SettingsView, StreamState } from './components/types';

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
  const [stream, setStream] = useState<StreamState | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'leetx/list-captures' }).then(setData);
    void loadTheme().then((x) => { setTheme(x); applyTheme(x); });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['leetx:theme']) void loadTheme().then((x) => { setTheme(x); applyTheme(x); });
      if (changes['leetx:captureLog'] || changes['leetx:captureIssues']) {
        void chrome.runtime.sendMessage({ type: 'leetx/list-captures' }).then(setData);
      }
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
  const nodeAI = analyses.find((x) => x.id === `node:${current?.captureId}`);
  const recordAI = analyses.find((x) => x.id === `record:${group?.problemKey}`);

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

  function run(scope: 'node' | 'record') {
    if (!current || !group || stream) return;
    setError('');
    const request: StreamStart = scope === 'node'
      ? { kind: 'start', scope, current, previous }
      : { kind: 'start', scope, problemKey: group.problemKey, submissions: group.submissions };
    setStream({ scope, text: '' });
    cancelRef.current = streamAnalysis(request, {
      onDelta: (text) => setStream((s) => (s ? { ...s, text: s.text + text } : s)),
      onDone: (analysis) => {
        setStream(null);
        cancelRef.current = null;
        setAnalyses((list) => [...list.filter((a) => a.id !== analysis.id), analysis]);
      },
      onError: (message) => {
        setStream(null);
        cancelRef.current = null;
        setError(message);
        if (message.includes('配置')) void openSettings();
      },
    });
  }

  function cancelStream() {
    cancelRef.current?.();
    cancelRef.current = null;
    setStream(null);
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
          onSelect={setCaptureId}
        />
        <DetailPanel
          group={group}
          current={current}
          previous={previous}
          showDiff={showDiff}
          onToggleDiff={setShowDiff}
          nodeAI={nodeAI}
          recordAI={recordAI}
          stream={stream}
          error={error}
          onRun={(scope) => run(scope)}
          onCancel={cancelStream}
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
