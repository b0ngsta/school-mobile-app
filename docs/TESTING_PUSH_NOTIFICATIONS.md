# Testing live Firebase push notifications

This is a step-by-step guide to switching on real push notifications (Firebase Cloud Messaging, FCM) in the EduManage mobile app and testing them end to end: from the Firebase console, and from real school events sent by the backend.

It follows how **this** codebase works today, so read §1 first. It explains what is already wired and what is still off.

---

## 1. How push works in this project (today)

| Piece | Where | State |
|---|---|---|
| Firebase JS packages `@react-native-firebase/app` + `messaging` **26.4.0** | `package.json` | ✅ installed (native code autolinks) |
| Push client | `src/push.ts` | ✅ written; **off** until `PUSH_ENABLED = true` in `src/config.ts` |
| Background handler | `index.js` → `registerBackgroundPushHandler()` | ✅ (no-op while off) |
| Start / stop | `src/App.tsx`: `initPush()` after sign-in, `stopPush()` on sign-out | ✅ |
| `google-services.json` | `android/app/` | ❌ missing (your Firebase project) |
| Google services Gradle plugin | `android/build.gradle`, `android/app/build.gradle` | ❌ not applied |
| `POST_NOTIFICATIONS` permission (Android 13+) | `AndroidManifest.xml` | ❌ missing |
| Server sender | backend `app/services/notify.py` (`firebase-admin`) | ✅ written; sends only when `FIREBASE_CREDENTIALS` is set |
| Device registry | backend `POST /devices` / `DELETE /devices/{token}`, table `device_tokens` | ✅ |
| iOS | `ios/` is the untouched React Native template | ❌ never built (the app ships for Android) |

**What the app does with a push (`src/push.ts`):**

- **Sign-in** → asks for the notification permission (Android 13+), gets the FCM token, sends it to `POST /devices {token, platform}`, and listens for token refreshes. In debug builds it also logs `[push] FCM token: …`.
- **Foreground** (`onMessage`) → **no system banner by design**. The bell's unread count refreshes (`refreshUnread()`).
- **Background** → Android shows the notification itself. Tapping it fires `onNotificationOpenedApp` → the app opens `data.route` with `data.params`.
- **Killed** → Android shows it. Tapping it starts the app → after sign-in, `getInitialNotification()` → opens `data.route`.
- **Sign-out** → listeners removed and `DELETE /devices/{token}`, so this phone stops getting that account's pushes.

**What the server sends (`notify.py` `_message`)** is a *notification* message (title + body) plus string data:

```json
{ "type": "homework", "route": "Homework", "params": "{}" , "web_path": "…(optional)" }
```

It also sets Android `priority: high` and `channel_id: "default"`. Pushes go out after the database commit, in a background job, to every token in `device_tokens` for the recipients. FCM's "unregistered" and "invalid" tokens are deleted automatically.

Events that push today: attendance marked (parents, including "attended half the day"), fee created / due soon / overdue / paid, a new notice (everyone), homework, a leave reviewed, every substitution event, a timetable or syllabus file shared, a message to students, and a new event. Students' routes are `Attendance`, `Fees`, `Notices`, `Homework`, `StudentTimetable`, `Syllabus`, `Messages` (+ `{id}`) and `Events`. Staff routes are `FeesAdmin`, `StaffNotices`, `Leaves` and `Substitutions` (+ `{tab, id}`).

---

## 2. Prerequisites

- A Google account with access to the [Firebase console](https://console.firebase.google.com).
- **A physical Android phone** (recommended) with Google Play services, or an emulator image *with Google Play* (the ones with the Play Store icon). Plain AOSP emulator images cannot receive FCM.
- Android Studio / SDK + JDK as you already use for `npm run apk`. Node ≥ 22, `npm install` done.
- `adb` on your PATH (`adb devices` lists the phone).
- Backend access: you can set environment variables on the server (Render dashboard for `https://school-app-docker-v1.onrender.com`, or your local `.env`), and `firebase-admin` is installed (it is in `requirements.txt`).
- For iOS only: a Mac with Xcode, a **paid Apple Developer account**, and a real iPhone. The iOS Simulator can't receive remote pushes reliably, and APNs needs the paid account.

---

## 3. Firebase console setup

1. **Create a project.** Firebase console → **Add project** → name it (e.g. `edumanage-push`). Google Analytics is optional (you can turn it off).
2. **Add the Android app.** Project overview → **Add app** → Android.
   - **Android package name:** `com.shelfwatchstudent` (this is `applicationId` in `android/app/build.gradle`, *not* the Kotlin namespace `com.shelfwatchplus`).
   - App nickname: anything. SHA-1: optional for FCM.
   - **Download `google-services.json`** and put it at `android/app/google-services.json`. It holds project ids, not secrets, but keep it out of public repos if you prefer.
3. **Make a server key for the backend.** ⚙ Project settings → **Service accounts** → **Generate new private key**. A JSON file downloads; this one **is** a secret. The backend uses it as `FIREBASE_CREDENTIALS`.
4. Check that **Cloud Messaging** is enabled: Project settings → **Cloud Messaging** → "Firebase Cloud Messaging API (V1)" should say *Enabled*. The legacy API is not needed; `firebase-admin` uses V1.

---

## 4. Wire Firebase into the app (Android)

1. `android/build.gradle`, inside `buildscript { dependencies { … } }`, add:
   ```gradle
   classpath("com.google.gms:google-services:4.4.2")
   ```
2. `android/app/build.gradle`, at the very bottom, add:
   ```gradle
   apply plugin: "com.google.gms.google-services"
   ```
3. `android/app/src/main/AndroidManifest.xml`, next to the `INTERNET` permission, add:
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```
4. `src/config.ts`:
   ```ts
   export const PUSH_ENABLED = true;
   ```
   Do **not** turn this on before steps 1–3 and `google-services.json` are in place, or Firebase fails at start-up ("No Firebase App '[DEFAULT]' has been created").
5. Rebuild and install:
   ```bash
   npm install
   cd android && ./gradlew clean && cd ..
   npm run android          # debug build on the connected phone (Metro shows the JS logs)
   # or: npm run apk && adb install -r android/app/build/outputs/apk/release/app-release.apk
   #     (release builds need the upload key once: npm run keystore — see CLAUDE.md "Release signing")
   ```
   A Gradle or JS change alone is not enough. Push needs a **new APK**; reloading the JS bundle won't do it.

> Version note: `@react-native-firebase/messaging` 26 only has the *modular* API (`getMessaging()`, `getToken(messaging)`…) and no default export. `src/push.ts` already uses that, so don't copy older snippets like `messaging().getToken()`.

---

## 5. Wire Firebase into the backend

Set **`FIREBASE_CREDENTIALS`** to the service-account JSON from §3.3. It must come from **the same Firebase project** as `google-services.json`. Either form works (`app/core/config.py`):

- the JSON itself, on one line (easiest on Render: Dashboard → service → **Environment** → add `FIREBASE_CREDENTIALS`, paste the file's contents), or
- a file path, e.g. `FIREBASE_CREDENTIALS=/run/secrets/firebase.json` (Docker secret / mounted file).

Restart the service. Nothing is logged when push is configured correctly. If the variable is set but wrong you'll see `FIREBASE_CREDENTIALS file not found` or `firebase-admin is not installed; push is off` in the logs. With the variable unset, actions still succeed and only the in-app inbox is filled.

---

## 6. Get the device's FCM token

Sign in on the phone with any account first: the token is only fetched and registered after sign-in. Then use any of these:

1. **Metro / logcat (debug builds).** `src/push.ts` logs it:
   ```bash
   adb logcat -s ReactNativeJS | grep "FCM token"
   # [push] FCM token: fLx3…:APA91b…
   ```
2. **The backend database.** The app registered it through `POST /devices`:
   ```sql
   SELECT u.username, u.user_type, d.platform, d.last_seen_at, d.token
   FROM device_tokens d JOIN users u ON u.id = d.user_id
   ORDER BY d.last_seen_at DESC LIMIT 5;
   ```
   No row means registration didn't happen (see §10: permission denied, `PUSH_ENABLED` off, or the server is unreachable).
3. Release builds don't print console logs. Use option 2, or install a debug build (`npm run apk:debug`).

The token changes after a reinstall, after clearing app data, and sometimes after an update. The app re-registers automatically (`onTokenRefresh`), but copy a fresh one whenever you reinstall.

---

## 7. Send a test notification from the Firebase console

1. Firebase console → **Messaging** (under *Run* / *Engage*) → **Create your first campaign** / **New campaign** → **Firebase Notification messages**.
2. Fill in **Notification title** ("Test from Firebase") and **Notification text**.
3. Click **Send test message** (right side) → paste the token from §6 → **+** → **Test**.
4. To test **tap-to-open a screen**, set the same data keys the server sends before sending: *Additional options → Custom data*:

   | Key | Value (student login) | Value (staff login) |
   |---|---|---|
   | `type` | `homework` | `notice` |
   | `route` | `Homework` | `StaffNotices` |
   | `params` | `{}` | `{}` |

   `route` must be a route name from `src/routes.ts` that exists for that role. Unknown routes are ignored. `params` is a JSON **string**, e.g. `{"id":12}` for `Messages` opens that message.

A "Send test message" only goes to the tokens you paste. A full campaign goes to the whole app, so don't use one on a live school's project.

---

## 8. Test the three app states (Android)

Use one signed-in phone. Expected results follow `src/push.ts`.

| State | How to get there | Send | Expected |
|---|---|---|---|
| **Foreground** | App open on any screen | Console test (§7) or a real event (§9) | **No banner** (by design). Within a moment the **bell's unread badge** goes up. That only happens for real events, which write an inbox row; console tests don't, so the count stays the same. Push arrival shows in Metro logs if you add a log in `onMessage`. |
| **Background** | Open the app, press **Home** | Same | System notification with sound/heads-up (Android "Miscellaneous" or "default" channel). **Tap** → the app comes to the front on `route` (e.g. Homework). |
| **Killed** | Open the app, then swipe it away in Recents | Same | System notification appears. **Tap** → the app starts, restores the session, then opens `route`. |

Tips:
- Lock the screen for background and killed tests to check heads-up and lock-screen display.
- **Don't use Settings → Apps → Force stop** for the "killed" test. Android blocks FCM delivery to force-stopped apps until the user opens them again. Swiping from Recents is the right test.
- Check the per-app switch: Settings → Apps → *Shelfwatch Student* → Notifications → allowed.

---

## 9. End-to-end tests with real school events

These go through the real path: server action → `notifications` row → background FCM send → phone. Use two devices or accounts: an **admin/teacher** who acts (web app, staff app, or `curl`) and a **parent/teacher phone** that receives.

```bash
API=https://school-app-docker-v1.onrender.com     # or http://localhost:8000
# sign in as the school's admin (org_code = the school code)
TOKEN=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123","org_code":"DEFAULT"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 1) Notice → every student and staff member except the poster (route Notices / StaffNotices)
curl -s $API/notices -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Push test","body":"Hello from the backend"}'

# 2) Message to one student → that parent (route Messages + {id})
curl -s $API/messages -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Push test","body":"Message for one student","student_ids":[STUDENT_USER_ID]}'

# 3) Event → students (route Events)
curl -s $API/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Push test event","start_date":"2026-11-02","end_date":"2026-11-02"}'
```

Other real triggers you can use from the apps: mark attendance for the student's section (parent push), create homework for the section, approve a teacher's leave (teacher push), or send a substitution request (substitute teacher push).

For each one, check the following:
- the phone shows the notification (background/killed) or the bell count goes up (foreground);
- tapping opens the right screen;
- the in-app **Notifications** list has the same item;
- the home's red "new" dot appears on that launcher (updates.ts, after the next home refresh).

**Sending straight from the backend (no app action), handy for checking credentials:**

```bash
cd shelfwatch_sfa_ir_backend && source venv/bin/activate
python - <<'PY'
import json, os, firebase_admin
from firebase_admin import credentials, messaging
raw = os.environ["FIREBASE_CREDENTIALS"]
info = json.loads(raw) if raw.lstrip().startswith("{") else raw
app = firebase_admin.initialize_app(credentials.Certificate(info))
print(messaging.send(messaging.Message(
    token="PASTE_DEVICE_TOKEN",
    notification=messaging.Notification(title="Backend test", body="firebase-admin works"),
    data={"type": "notice", "route": "Notices", "params": "{}"},
    android=messaging.AndroidConfig(priority="high"),
)))
PY
```
A printed `projects/…/messages/…` id means Google accepted it. `SenderIdMismatch` means the service account and `google-services.json` are from different projects.

---

## 10. iOS (only if you decide to ship on iOS)

The `ios/` folder is the plain React Native template. It has never been built for this app, so this is set-up work rather than a quick test.

1. Apple Developer → **Keys** → create an **APNs Authentication Key** (.p8). Note the Key ID and Team ID.
2. Firebase console → **Add app → iOS**. Use the bundle id from Xcode (*ShelfwatchPlus* target → Signing & Capabilities). Download **`GoogleService-Info.plist`** and add it to the Xcode target.
3. Firebase → Project settings → **Cloud Messaging → Apple app configuration** → upload the .p8 with its Key ID and Team ID.
4. Xcode → target → **Signing & Capabilities**: add **Push Notifications** and **Background Modes → Remote notifications**.
5. `ios/Podfile`: React Native Firebase needs static frameworks. Follow the [RNFirebase iOS install](https://rnfirebase.io/#3-ios-setup) for your RN version (`use_frameworks! :linkage => :static`, `$RNFirebaseAsStaticFramework = true`). Then add `FirebaseApp.configure()` in `AppDelegate.swift` and run `cd ios && pod install`.
6. Run on a **real iPhone** (`npm run ios --device`). Allow notifications when prompted (`requestPermission()` in `push.ts`), then repeat §6–§9. On iOS a foreground push also shows nothing (same code path), and background and killed taps open the route.

The backend needs no change for iOS: `firebase-admin` sends to APNs through FCM with the same token flow (`platform` is stored as `ios`).

---

## 11. Common problems and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| No `[push] FCM token` log, no `device_tokens` row | `PUSH_ENABLED` still `false`, or the app wasn't rebuilt | Set it, rebuild the APK (§4) |
| App crashes or logs `No Firebase App '[DEFAULT]'` | `google-services.json` missing / plugin not applied | §4 steps 1–2, `./gradlew clean`, rebuild |
| `Default FirebaseApp failed to initialize` / wrong package | `google-services.json` was made for another package | Re-download it for **`com.shelfwatchstudent`** |
| Token exists, console test never arrives | Emulator without Google Play / no Play services | Use a real phone or a "Google Play" emulator image |
| Permission prompt never appeared; nothing shows (Android 13+) | `POST_NOTIFICATIONS` missing in the manifest, or the user denied it | Add the permission (§4.3). Re-allow in Settings → Apps → Notifications, or clear app data |
| Works in background, nothing in foreground | Expected: the app shows no banner in the foreground | Check the bell count (real events). To show banners in the foreground, add a local-notification library (e.g. Notifee) in `onMessage` |
| Killed-state pushes never arrive on Xiaomi / Oppo / Vivo / Realme | Aggressive battery managers | Allow **Autostart**, set Battery → *No restrictions* for the app; avoid Force stop |
| Arrives on Wi-Fi only / late | Doze / data saver | Messages already use `priority: high`; turn off data saver for the app and test again |
| Real events don't push, console tests do | Backend `FIREBASE_CREDENTIALS` unset/wrong, or `firebase-admin` missing | §5; check the server logs; run the §9 backend script |
| `SenderIdMismatch` / `MismatchSenderId` | App and server use different Firebase projects | Use the service account of the project that made `google-services.json` |
| `Requested entity was not found` / `UNREGISTERED` | Stale token (reinstall / data cleared / signed out) | Sign in again to register a fresh token. The server deletes dead tokens itself |
| Tap opens the app but not the screen | `route` not in `src/routes.ts`, the route is for the other role, or `params` isn't a JSON string | Use the routes in §1 and §7. Student routes on a staff login are ignored |
| Pushes for the previous account after switching users | Old token still registered (sign-out failed offline) | Sign out while online (`DELETE /devices/{token}`), or delete the row in `device_tokens` |
| Notification shows under "Miscellaneous" | The server asks for channel `default`, which the app doesn't create | Harmless. To brand it, create a `default` channel at start-up (e.g. Notifee) or change `channel_id` in `notify.py` |
| Render free instance asleep: push arrives ~30–60 s late | Cold start before the action runs | Expected on the free plan; retest once the server is warm |

---

## 12. Quick checklist

- [ ] Firebase project created; Android app `com.shelfwatchstudent` added; `google-services.json` in `android/app/`
- [ ] Gradle classpath + plugin, `POST_NOTIFICATIONS`, `PUSH_ENABLED = true`, APK rebuilt and installed
- [ ] Backend `FIREBASE_CREDENTIALS` = the same project's service account; service restarted
- [ ] Signed in on the phone; token visible in logcat or in `device_tokens`
- [ ] Console test received in background and killed states; tap opens the custom-data route
- [ ] Real notice / message / event received; bell count, inbox item and home red dot all match
- [ ] Sign out → the token row disappears → no more pushes for that account
