// App-wide settings. Everything environment- or brand-specific lives here so
// screens never hard-code it.
//
// NOTE: keep no `src/config.js` next to this file — Metro resolves `.js`
// before `.ts`, so a config.js (even an empty one) silently shadows this module.

// API base URL.
//  - Android emulator:            http://10.0.2.2:8000  (maps to host machine's localhost)
//  - Real device, same Wi-Fi:     http://<your-laptop-LAN-IP>:8000  e.g. http://192.168.1.5:8000
//  - Deployed server:             https://<server-domain>
// export const API_URL = 'http://10.0.2.2:8000';
export const API_URL = 'https://school-app-docker-v1.onrender.com';

/** Give up on a request after this long (the hosted server can cold-start slowly). */
export const REQUEST_TIMEOUT_MS = 60_000;
/** File uploads get longer. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Firebase push notifications (push.ts). ON since Oct 2026: Firebase project
 * "edumanage-push" — android/app/google-services.json + the google-services
 * Gradle plugin + POST_NOTIFICATIONS are wired in
 * (docs/TESTING_PUSH_NOTIFICATIONS.md). Turning it on without that config makes
 * Firebase fail at start-up. false = in-app inbox only.
 */
export const PUSH_ENABLED = true;

/** Rows per page for paginated lists (the server accepts 1–500). */
export const PAGE_SIZE = 30;

/**
 * Brand colour forced on every account, or null to use the colour the server
 * sends at login (`theme_color`) and otherwise the per-role theme (theme.ts).
 * Moved here from api.ts, where it was hard-coded inside login().
 */
export const BRAND_COLOR_OVERRIDE: string | null = '#ff3333';

// School branding shown in the app header.
export const SCHOOL_NAME = 'EduManage School';
export const SCHOOL_CITY = '';

// Academic session label, e.g. "2026-2027" (April–March).
export function sessionLabel(d: Date = new Date()): string {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
