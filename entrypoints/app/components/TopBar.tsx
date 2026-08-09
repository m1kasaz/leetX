import type { ThemeMode } from '../../../src/theme';

export function TopBar(props: {
  theme: ThemeMode;
  captureCount: number;
  onCycleTheme(): void;
  onOpenSettings(): void;
}) {
  const { theme, captureCount, onCycleTheme, onOpenSettings } = props;
  return (
    <header className="topbar">
      <div className="brand"><span>lX</span><div><b>leetX</b></div></div>
      <div className="state"><i /> 本地采集已启用 <b>STAGE 0</b></div>
      <div className="top-actions">
        <span>{captureCount} 次提交</span>
        <button aria-label={`主题：${theme}`} data-tooltip={`主题：${theme}`} onClick={onCycleTheme}>
          <span aria-hidden="true">{theme === 'system' ? '◐' : theme === 'light' ? '☀' : '☾'}</span>
        </button>
        <button aria-label="设置" data-tooltip="设置" onClick={onOpenSettings}>
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>
  );
}
