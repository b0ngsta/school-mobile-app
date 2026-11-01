// Push notifications (Firebase Cloud Messaging).
//
// The server sends a push for: attendance marked (to the student's parents),
// fee created / due / overdue / paid, new notices, homework, leave reviews and
// every substitution event (see BACKEND_README.md → "Notifications").
// The same events also land in the in-app inbox (notifications.ts), so the
// app is useful before push is switched on.
//
// Switching push on needs the school's own Firebase project, so it can't be
// pre-wired here. Steps (≈10 min):
//   1. npm i @react-native-firebase/app @react-native-firebase/messaging
//   2. Firebase console → add Android app "com.shelfwatchstudent" → download
//      google-services.json into android/app/
//   3. android/build.gradle  dependencies { classpath("com.google.gms:google-services:4.4.2") }
//      android/app/build.gradle  add `apply plugin: "com.google.gms.google-services"` at the bottom
//   4. AndroidManifest.xml: <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
//   5. Replace the body of `loadMessaging()` below with:
//        return require('@react-native-firebase/messaging').default;
//   6. Rebuild the APK (npm run apk).
// Nothing else changes: App.tsx already calls initPush() after sign-in and
// stopPush() on sign-out.
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';
import { send } from './http';
import { refreshUnread } from './notifications';

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

/** Returns the Firebase messaging module once it's installed (step 5 above). */
function loadMessaging(): MessagingFactory | null {
  return null;
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
  await api('/devices', { method: 'POST', body: { token: t, platform: Platform.OS } }).catch(() => {});
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
  if (!token) return;
  const old = token;
  token = null;
  // Runs after the session ended, so no auth: the token itself identifies the device.
  await send(`/devices/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => {});
}
