import type { SettingsView } from './types';

export function SettingsModal(props: {
  settings: SettingsView;
  apiKey: string;
  busy: string;
  error: string;
  onChange(settings: SettingsView): void;
  onApiKey(value: string): void;
  onClose(): void;
  onTest(): void;
  onSave(): void;
}) {
  const { settings, apiKey, busy, error, onChange, onApiKey, onClose, onTest, onSave } = props;
  return (
    <div className="modal">
      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <header>
          <h2>AI 设置</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <label>Base URL
          <input value={settings.baseUrl} onChange={(e) => onChange({ ...settings, baseUrl: e.target.value })} />
        </label>
        <label>API Key
          <input type="password" autoComplete="off" value={apiKey} onChange={(e) => onApiKey(e.target.value)} />
        </label>
        <label>Model
          <input value={settings.model} onChange={(e) => onChange({ ...settings, model: e.target.value })} />
        </label>
        <label>超时时间（秒）
          <input
            type="number" min={60} max={300}
            value={Math.round(settings.timeout / 1000)}
            onChange={(e) => onChange({ ...settings, timeout: Math.min(300, Math.max(60, Number(e.target.value) || 60)) * 1000 })}
          />
        </label>
        <p className="muted">API Key 仅保存在本次浏览器会话，重启后需重新填写。</p>
        {error && <p className="error">{error}</p>}
        <footer>
          <button type="button" onClick={onTest}>{busy === 'test' ? '测试中…' : '测试连接'}</button>
          <button type="submit">{busy === 'save' ? '保存中…' : '保存'}</button>
        </footer>
      </form>
    </div>
  );
}
