// Wakes the API before the first screen needs it. The free hosting (Render) puts the server to
// sleep when idle and the first request can take 30–60 s; the splash screen (components/
// SplashScreen.tsx) waits for this ping — up to a limit — so the app opens on real data instead
// of a row of spinners. Any HTTP answer (even 404) means the server is up. No network → resolves
// at once (the offline cache takes over).
import { API_URL } from './config';

export type WarmupResult = 'ready' | 'offline' | 'slow';

export function warmUpServer(maxWaitMs: number): Promise<WarmupResult> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (r: WarmupResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(r);
      }
    };
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Give up waiting (the request keeps going in the background and still wakes the server).
    const timer = setTimeout(() => finish('slow'), maxWaitMs);
    if (typeof fetch !== 'function') {
      finish('offline');
      return;
    }
    fetch(`${API_URL}/`, { method: 'GET', signal: controller?.signal }).then(
      () => finish('ready'),
      () => finish('offline'),
    );
  });
}
