import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptureEntry, IssueEntry } from '../../src/db/captureLog';
import type { GalleryImage } from '../../src/db/gallery';
import { addImage, getActiveId, getOpacity, listImages, removeImage, setActiveId, setOpacity } from '../../src/db/gallery';
import type { SavedAnalysis } from '../../src/ai/storage';
import { streamAnalysis } from '../../src/ai/streamClient';
import type { StreamStart } from '../../src/ai/streamProtocol';
import type { ThemeMode } from '../../src/theme';
import { applyTheme, loadTheme, nextTheme, saveTheme } from '../../src/theme';
import { fileToDataUrl, isAcceptedImage } from '../../src/utils/image';
import { groupCaptures } from '../../src/workbench/analysis';
import { buildHeatmapDays, inDayRange } from '../../src/workbench/heatmap';
import type { DayRange } from '../../src/workbench/heatmap';
import { Toast } from './components/bits';
import { DetailPanel } from './components/DetailPanel';
import { GalleryModal } from './components/GalleryModal';
import { RecordList } from './components/RecordList';
import { SettingsModal } from './components/SettingsModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import { activeStreamFor } from './components/types';
import type { Filter, SettingsView, StreamState } from './components/types';

interface Data {
  captures: CaptureEntry[];
  issues: IssueEntry[];
}

export default function App() {
  const [data, setData] = useState<Data>({ captures: [], issues: [] });
  const [filter, setFilter] = useState<Filter>('all');
  const [dayRange, setDayRange] = useState<DayRange | null>(null);
  const [groupKey, setGroupKey] = useState('');
  const [captureId, setCaptureId] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [bgOpacity, setBgOpacity] = useState(55);
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
    void refreshGallery();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['leetx:theme']) void loadTheme().then((x) => { setTheme(x); applyTheme(x); });
      if (changes['leetx:captureLog'] || changes['leetx:captureIssues']) {
        void chrome.runtime.sendMessage({ type: 'leetx/list-captures' }).then(setData);
      }
      if (changes['leetx:gallery'] || changes['leetx:galleryActive'] || changes['leetx:bgOpacity']) void refreshGallery();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const current = images.find((x) => x.id === activeId);
    document.body.classList.toggle('has-bg', !!current);
    document.body.style.setProperty('--bg-image', current ? `url("${current.dataUrl}")` : 'none');
    document.body.style.setProperty('--panel-alpha', `${bgOpacity}%`);
    return () => {
      document.body.classList.remove('has-bg');
      document.body.style.removeProperty('--bg-image');
      document.body.style.removeProperty('--panel-alpha');
    };
  }, [images, activeId, bgOpacity]);

  async function refreshGallery() {
    setImages(await listImages(chrome.storage.local));
    setActiveIdState(await getActiveId(chrome.storage.local));
    setBgOpacity(await getOpacity(chrome.storage.local));
  }

  async function uploadBackgrounds(files: File[]) {
    for (const file of files) {
      if (!isAcceptedImage(file)) { setToast(`「${file.name}」不是 JPG/PNG 图片，已跳过`); continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        const entry: GalleryImage = {
          id: `bg:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          dataUrl,
          createdAt: Date.now(),
        };
        await addImage(chrome.storage.local, entry);
        await setActiveId(chrome.storage.local, entry.id);
        setToast('背景已更新');
      } catch (err) {
        setToast(err instanceof Error ? err.message : '图片上传失败');
      }
    }
  }

  async function selectBackground(id: string | null) {
    await setActiveId(chrome.storage.local, id);
  }

  async function removeBackground(id: string) {
    await removeImage(chrome.storage.local, id);
    setToast('已删除该背景');
  }

  async function changeOpacity(value: number) {
    setBgOpacity(value);
    await setOpacity(chrome.storage.local, value);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const onPlatform = (platform: string) => filter === 'all' || (filter === 'luogu' ? platform === 'luogu' : platform.startsWith('leetcode'));
  const heatmap = useMemo(() => buildHeatmapDays(data.captures.filter((c) => onPlatform(c.platform))), [data, filter]);
  const ranged = useMemo(() => (dayRange ? data.captures.filter((c) => inDayRange(dayRange, c.submittedAt)) : data.captures), [data, dayRange]);
  const groups = useMemo(() => groupCaptures(ranged), [ranged]);
  const visible = groups.filter((g) => onPlatform(g.platform));
  const group = visible.find((x) => x.key === groupKey) ?? visible[0];
  const current = group?.submissions.find((x) => x.captureId === captureId) ?? group?.submissions.at(-1);
  const index = current && group ? group.submissions.indexOf(current) : -1;
  const previous = group && index > 0 ? group.submissions[index - 1] : undefined;
  const nodeAI = analyses.find((x) => x.id === `node:${current?.captureId}`);
  const recordAI = analyses.find((x) => x.id === `record:${group?.problemKey}`);
  const activeStream = activeStreamFor(stream, stream?.scope === 'node' ? current?.captureId : group?.problemKey);

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
    setStream({ scope, text: '', target: scope === 'node' ? current.captureId : group.problemKey });
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
        onOpenGallery={() => setGalleryOpen(true)}
      />
      <main className="workspace">
        <RecordList
          filter={filter}
          groups={visible}
          heatmap={heatmap}
          dayRange={dayRange}
          activeKey={group?.key}
          onFilter={(x) => { setFilter(x); setGroupKey(''); }}
          onRange={setDayRange}
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
          stream={activeStream}
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
      {galleryOpen && (
        <GalleryModal
          images={images}
          activeId={activeId}
          opacity={bgOpacity}
          onClose={() => setGalleryOpen(false)}
          onUpload={(files) => void uploadBackgrounds(files)}
          onSelect={(id) => void selectBackground(id)}
          onRemove={(id) => void removeBackground(id)}
          onOpacity={(value) => void changeOpacity(value)}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
