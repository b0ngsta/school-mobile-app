// App lifecycle events shared by the session (token refresh on resume) and
// data hooks (re-fetch after the app was in the background for a while).
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

type ResumeListener = (awayMs: number) => void;
type BackgroundListener = () => void;

const resumeListeners = new Set<ResumeListener>();
const backgroundListeners = new Set<BackgroundListener>();
let backgroundedAt: number | null = null;

/** Called with how long the app was away each time it returns to the foreground. */
export function onAppResume(fn: ResumeListener): () => void {
  resumeListeners.add(fn);
  return () => {
    resumeListeners.delete(fn);
  };
}

/** Called each time the app goes to the background (e.g. to pause polling, flush saves). */
export function onAppBackground(fn: BackgroundListener): () => void {
  backgroundListeners.add(fn);
  return () => {
    backgroundListeners.delete(fn);
  };
}

/** True unless the app is in the background (unknown counts as open). */
export function isAppInForeground(): boolean {
  return backgroundedAt == null && AppState.currentState !== 'background';
}

/** Start watching AppState (call once at boot). Returns a stop function. */
export function startAppStateWatch(): () => void {
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background') {
      if (backgroundedAt == null) backgroundListeners.forEach(fn => fn());
      backgroundedAt = Date.now();
    } else if (state === 'active' && backgroundedAt != null) {
      const away = Date.now() - backgroundedAt;
      backgroundedAt = null;
      resumeListeners.forEach(fn => fn(away));
    }
  });
  return () => sub.remove();
}
