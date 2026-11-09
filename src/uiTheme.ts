// UI theme the user picked in Profile → Theme — client-side only, no API.
//   'creative' → the night-sky planetarium look (today: the home orbit)
//   'default'  → the classic card-and-tile layout
// Saved on the device (AsyncStorage `sw_ui_theme`), loaded at boot with the
// session and the language. The choice lasts for one sign-in: signing out
// clears it (resetUiTheme, called from App.tsx), so every login starts on the
// default theme. Every role has the picker (components/ThemePicker.tsx). Screens never read this directly: routes.ts wraps
// each screen with themedScreen() (screens/themed.tsx), which renders the
// file for the active theme. Not to be confused with theme.ts (role colours).
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UiTheme = 'default' | 'creative';

export const UI_THEMES: readonly UiTheme[] = ['default', 'creative'];

export const UI_THEME_KEY = 'sw_ui_theme';

/** Used when nothing is saved: fresh install, and after every sign-out. */
export const DEFAULT_UI_THEME: UiTheme = 'default';

let current: UiTheme = DEFAULT_UI_THEME;
const listeners = new Set<() => void>();

const isUiTheme = (v: unknown): v is UiTheme => v === 'default' || v === 'creative';

export const getUiTheme = (): UiTheme => current;

/** Re-render hook plumbing (see useUiTheme in hooks.ts). */
export function subscribeUiTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Read the saved theme (call once at boot). Unknown / missing → DEFAULT_UI_THEME. */
export async function loadUiTheme(): Promise<UiTheme> {
  try {
    const saved = await AsyncStorage.getItem(UI_THEME_KEY);
    current = isUiTheme(saved) ? saved : DEFAULT_UI_THEME;
  } catch {
    current = DEFAULT_UI_THEME;
  }
  return current;
}

/** Switch theme: every themed screen re-renders at once; saved in the background. */
export function setUiTheme(theme: UiTheme): void {
  if (!isUiTheme(theme) || theme === current) return;
  current = theme;
  listeners.forEach(l => l());
  AsyncStorage.setItem(UI_THEME_KEY, theme).catch(() => {});
}

/**
 * Sign-out: forget the choice so the next login (any account) starts on the
 * default theme. Re-renders themed screens if the theme actually changes.
 */
export function resetUiTheme(): void {
  const changed = current !== DEFAULT_UI_THEME;
  current = DEFAULT_UI_THEME;
  AsyncStorage.removeItem(UI_THEME_KEY).catch(() => {});
  if (changed) listeners.forEach(l => l());
}

/** Whether the home is the night-sky orbit — the creative theme, for every role. */
export const homeIsOrbit = (_role: string | undefined, theme: UiTheme = current): boolean => theme === 'creative';
