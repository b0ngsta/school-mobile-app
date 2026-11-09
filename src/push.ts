// Push notifications (Firebase Cloud Messaging).
//
// The server sends a push for: attendance marked (to the student's parents),
// fee created / due / overdue / paid, new notices, homework, leave reviews,
// every substitution event, and (student portal) timetable / syllabus files,
// messages and events (backend app/services/notify.py). Each push carries
// data { type, route, params (JSON string) } — route is the screen to open.
// The same events also land in the in-app inbox (notifications.ts), so the
// app is useful before push is switched on.
//
// Switching push on needs the school's own Firebase project, so it can't be
// pre-wired here. The packages (@react-native-firebase/app + messaging) are
// already in package.json. Full step-by-step + testing guide:
// docs/TESTING_PUSH_NOTIFICATIONS.md. In short:
//   1. Firebase console → add Android app "com.shelfwatchstudent" → download
//      google-services.json into android/app/
//   2. android/build.gradle  dependencies { classpath("com.google.gms:google-services:4.4.2") }
//      android/app/build.gradle  add `apply plugin: "com.google.gms.google-services"` at the bottom
//   3. AndroidManifest.xml: <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
//   4. src/config.ts: PUSH_ENABLED = true
//   5. Rebuild the APK (npm run apk); backend: FIREBASE_CREDENTIALS = the same project's service account.
// Nothing else changes: App.tsx already calls initPush() after sign-in and
// stopPush() on sign-out; index.js registers the background handler.
//
// Behaviour by app state: foreground → no system banner, the bell's unread
// count refreshes (onMessage); background / killed → Android shows the
// notification, tapping it opens `route` (onNotificationOpenedApp /
// getInitialNotification — the latter after sign-in, when initPush runs).
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';
import { PUSH_ENABLED } from './config';
import { send } from './http';
import { refreshUnread, setPushActive } from './notifications';

/** Minimal slice of @react-native-firebase/messaging that we use. */
interface RemoteMessage {
  data?: Record<string, string | object>;
  notification?: { title?: string; body?: string };
}
interface Messaging {
  requestPermission(): Promise<number>;
  getToken(): Promise<string>;
  deleteToken(): Promise<void>;
  onTokenRefresh(fn: (token: string) => void): () => void;
  onMessage(fn: (m: RemoteMessage) => void): () => void;
  onNotificationOpenedApp(fn: (m: RemoteMessage) => void): () => void;
  getInitialNotification(): Promise<RemoteMessage | null>;
}
type MessagingFactory = () => Messaging;

/**
 * @react-native-firebase/messaging v26 has only the modular API (getMessaging()
 * + functions taking the instance — no default export any more), so wrap it
 * in the small Messaging shape above. Required lazily, only when push is on.
 */
function firebaseMessaging(): MessagingFactory | null {
  if (!PUSH_ENABLED) return null;
  try {
    const m = require('@react-native-firebase/messaging');
    return () => {
      const inst = m.getMessaging();
      return {
        requestPermission: () => m.requestPermission(inst),
        getToken: () => m.getToken(inst),
        deleteToken: () => m.deleteToken(inst),
        onTokenRefresh: (fn: (token: string) => void) => m.onTokenRefresh(inst, fn),
        onMessage: (fn: (msg: RemoteMessage) => void) => m.onMessage(inst, fn),
        onNotificationOpenedApp: (fn: (msg: RemoteMessage) => void) => m.onNotificationOpenedApp(inst, fn),
        getInitialNotification: () => m.getInitialNotification(inst),
      };
    };
  } catch {
    return null;
  }
}

/** The Firebase messaging module, or null while push is off (config.ts PUSH_ENABLED). */
function loadMessaging(): MessagingFactory | null {
  return firebaseMessaging();
}

/**
 * index.js, before AppRegistry: lets Android deliver pushes while the app is
 * in the background / killed without the "no background message handler"
 * warning. The system tray shows `notification` messages by itself; the bell
 * catches up on the next start/resume (notifications.ts polling).
 */
export function registerBackgroundPushHandler(): void {
  if (!PUSH_ENABLED) return;
  try {
    const m = require('@react-native-firebase/messaging');
    m.setBackgroundMessageHandler(m.getMessaging(), async () => {});
  } catch {}
}

/** What a tapped push should open: { route, params } from its data payload. */
export type PushOpenHandler = (data: { type?: string; route?: string; params?: Record<string, unknown> }) => void;

let token: string | null = null;
let unsubs: (() => void)[] = [];

function parseData(m?: RemoteMessage | null) {
  const d = (m?.data || {}) as Record<string, unknown>;
  let params: Record<string, unknown> | undefined;
  if (typeof d.params === 'string') {
    try {
      params = JSON.parse(d.params);
    } catch {}
  } else if (d.params && typeof d.params === 'object') {
    params = d.params as Record<string, unknown>;
  }
  return { type: d.type as string | undefined, route: d.route as string | undefined, params };
}

async function register(t: string) {
  token = t;
  // Debug builds print the token for testing (Metro / `adb logcat | grep FCM`); see docs/TESTING_PUSH_NOTIFICATIONS.md.
  if (__DEV__) console.log(`[push] FCM token: ${t}`);
  try {
    await api('/devices', { method: 'POST', body: { token: t, platform: Platform.OS } });
    // the server knows this phone: the bell needn't be polled every minute
    setPushActive(true);
  } catch {}
}

/** Ask permission, register this device with the server and listen for pushes. */
export async function initPush(onOpen: PushOpenHandler): Promise<void> {
  const factory = loadMessaging();
  if (!factory) return; // Firebase not installed yet — inbox polling still works
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
    }
    const messaging = factory();
    await messaging.requestPermission();
    await register(await messaging.getToken());
    unsubs.push(messaging.onTokenRefresh(register));
    // Foreground: the OS shows nothing — bump the bell instead.
    unsubs.push(messaging.onMessage(() => refreshUnread()));
    unsubs.push(messaging.onNotificationOpenedApp(m => onOpen(parseData(m))));
    const initial = await messaging.getInitialNotification();
    if (initial) onOpen(parseData(initial));
  } catch {
    // Permission denied or Play Services missing: in-app inbox only.
  }
}

/** Sign-out: stop listening and tell the server to forget this device. */
export async function stopPush(): Promise<void> {
  unsubs.forEach(u => u());
  unsubs = [];
  setPushActive(false);
  if (!token) return;
  const old = token;
  token = null;
  // Runs after the session ended, so no auth: the token itself identifies the device.
  await send(`/devices/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => {});
}
