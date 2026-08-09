import type { ThemeMode } from '../../../src/theme';

const themeLabel: Record<ThemeMode, string> = { system: '跟随系统', light: '浅色', dark: '深色' };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: ThemeMode }) {
  if (theme === 'light') {
    return (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </Icon>
    );
  }
  if (theme === 'dark') {
    return (
      <Icon>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </Icon>
    );
  }
  return (
    <Icon>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17v4" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Icon>
  );
}

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
        <button aria-label={`主题：${themeLabel[theme]}`} data-tooltip={`主题：${themeLabel[theme]}`} onClick={onCycleTheme}>
          <ThemeIcon theme={theme} />
        </button>
        <button aria-label="设置" data-tooltip="设置" onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
