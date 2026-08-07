export type ThemeMode='dark'|'light'|'system';
export const THEME_KEY='leetx:theme';
export function resolvedTheme(mode:ThemeMode,darkSystem:boolean):'dark'|'light'{return mode==='system'?(darkSystem?'dark':'light'):mode}
export function nextTheme(mode:ThemeMode):ThemeMode{return mode==='system'?'light':mode==='light'?'dark':'system'}
export function applyTheme(mode:ThemeMode,darkSystem=matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme=resolvedTheme(mode,darkSystem)}
export async function loadTheme():Promise<ThemeMode>{const value=(await chrome.storage.local.get(THEME_KEY))[THEME_KEY];return value==='dark'||value==='light'?value:'system'}
export async function saveTheme(mode:ThemeMode){await chrome.storage.local.set({[THEME_KEY]:mode});applyTheme(mode)}
