# CLAUDE.md — ShelfwatchPlus (EduManage mobile app)

Read this first; open other files only when the task needs them.

## The system (3 repos, one product: "EduManage" school management — names say "shelfwatch", it is NOT retail)
| Repo (on disk) | What | Stack |
|---|---|---|
| `IRCTC_Clone/shelfwatch_sfa_ir_backend` | REST API, source of truth for rules (own CLAUDE.md) | FastAPI, PyMySQL raw SQL, MySQL/TiDB, Alembic |
| `IRCTC_Clone/shelfwatch-plus` | Admin/staff web app (own CLAUDE.md) | Vite + React 18 + Tailwind, plain JSX |
| `IRCTC_Clone/work/ShelfwatchPlus` (this) | Android app for ALL roles; parents log in as `student` | React Native **0.87.1**, React 19, TypeScript, Node ≥ 22 |

**Multi-school**: the backend serves many schools ("organisations"); every login names a school code and data never crosses schools (backend `docs/ORGANISATIONS.md`).

## Run / build
`npm install` · `npm start` (Metro) · `npm run android` · `npm run apk` (release, signed with debug.keystore) · `npm run apk:debug`
`npm test` (jest, `__tests__/`: http, session, schedule, pickers, validation, features) · `npm run typecheck` · `npm run lint`
Android: applicationId `com.shelfwatchstudent`, versionCode 2 / "2.0", display name "Shelfwatch Student".
Gradle wrapper points at the local `gradle-9.4.1-bin.zip` (137 MB) in repo root — never read it.
API: `src/config.ts` `API_URL` = https://school-app-docker-v1.onrender.com (emulator: http://10.0.2.2:8000). Timeouts 60 s / 120 s uploads (Render cold starts). `PAGE_SIZE` 30. `BRAND_COLOR_OVERRIDE` '#ff3333' forces the brand colour.
**Never create `src/config.js`** — Metro resolves .js before .ts and it shadows config.ts.

## Architecture (no navigation library, no state library)
- `index.js` → `src/App.tsx`: boot (loadSession + loadLang) → Login (school code + username + password) / ForgotPassword (school code + username/email) / ForcedPasswordChange, else a home screen + a push stack. `navigate(route, params)` pushes, `goBack()` pops, Android back pops. Stack resets when the user changes.
- `src/routes.ts` — `SCREENS` registry `{component, title | titleKey, transition?}`; `homeForRole`: student → `HomeStudent`, everyone else → `HomeStaff` (tile grid picked by role: teacher / driver / manager; admin+principal = "top manager").
- `src/components/ScreenStack.tsx` animates routes that opt in (`transition: 'fadeScale'`).
- Every screen gets `ScreenProps {navigate, goBack, params, session, onLogout}` (`src/types.ts`, which also holds all API response types).
- Navigation is GRID-ONLY: home tile grid → pushed screens. New screen = file in `src/screens/` (staff ones in `screens/staff/`) + entry in `SCREENS`.

## Data layer — layers: screens → `api.ts` → `session.ts` → `http.ts`
- `http.ts` `send()` — fetch + timeout, turns errors into `ApiError{status (0 = network), detail, requestId, retryAfterSec}` with a ready-to-show message; `errorText(e)`.
- `session.ts` — access token in memory only; refresh token in `tokenStore.ts` (AsyncStorage; swap for keychain later); Session (incl. `org_code`, `org_name`) in AsyncStorage `sw_app_session`; last school code in `sw_last_org_code` (kept after sign-out; `getLastOrgCode()`). Single-flight `refreshTokens()`, refresh on app resume, refresh 401 → `endSession('expired')`. `onSessionChange` drives App.tsx.
- `api.ts` — `api(path, opts)` authed request (auto refresh+retry on 401; 403 "Password change required" → forced change screen), `apiPage(path, limit, offset)` → `{items, total}` from X-Total-Count, `withQuery`, auth calls (`login(username, password, orgCode?)`, logout, logoutAll, changePassword, forgot/verify/reset — `orgCode` is the last, optional arg; sent as `org_code`), `lookupSchool(code)` (public `GET /organisations/{code}` → `{code, name}`), `photoUrl()` (signed URLs expire 24 h — never store them).
- `cache.ts` — stale-while-revalidate: every GET is remembered per user (20 h max, 80 entries, persisted); screens seed state with `peek(path)`. Cleared on logout / new login.
- `hooks.ts` — `useApi(path)`, `usePagedApi(path)`, `useOnResume`, `useI18n`, `useReduceMotion`, `useSchoolTimings`, `isMissingEndpoint(e)` (404/405 → "needs server update" fallback).
- `notifications.ts` — unread count polling + `onUnreadChange`, markRead/markAllRead, `targetOf()` maps a notification to a route. `push.ts` — FCM; packages are in package.json but **push is OFF**: `loadMessaging()` returns null and there is no `google-services.json`. Steps to enable are in the file header.

## UI kit (use these, don't hand-roll)
- `components/ui.tsx` — Screen, ListScreen, Card, Hero, Badge, StatCard, IconStat, SectionTitle, Row, ListItem, Button, Input, PasswordInput, TextLink, Chip, Segments, Sheet (bottom modal), Fab, Tile/TileGrid, MiniStat, UpdatesBar, Empty, Loading, Skeleton family (Bone, ListSkeleton, CardSkeleton…), ErrorBox, NoticeBox, Avatar; re-exports `fmtDate`, `inr`.
- `components/pickers.tsx` — DateField, CalendarModal, TimeField, Checkbox. Also Timetable, SubstituteFinder, AccountActions, AuthLayout, `SchoolCodeInput` (+ `useSchoolName` debounced lookup; shows the school's name or "not found" under the field). Profile / StaffProfile show the school from the session.
- `theme.ts` — mutable `colors` (role themes applied at login via `applyRoleTheme`, so read colours inline at render), `radius`, `shadow`, `ACCENTS`, `badge(status)`, `ROLE_LABELS`. Icons: MaterialCommunityIcons.
- `i18n.ts` — `t(key, vars)`; English + Hindi (`hi`). Keys are dotted ids (`'title.Fees'`, defined in `en`) or plain English phrases. New user-visible strings go through `t()`; add Hindi when practical.
- `format.ts` (dates, clock, `inr`), `validation.ts`, `schedule.ts` (school timings → periods; same logic as web `src/lib/schedule.js`), `roles.ts` (MANAGER_ROLES).

## Conventions (same as backend)
Dates `YYYY-MM-DD`, times 24h `HH:MM`, weekday Mon=0…Sat=5. Errors `{"detail"}`. Lists `?limit=&offset=` + `X-Total-Count`.
`BACKEND_README.md` (identical copy in web repo) = contract for notifications, substitutions, leave CRUD, school timings, week timetable, class homework — now mostly implemented in the backend.

## State
Git: one commit ("Initial commit"), no remote; nearly all of `src/` is staged/uncommitted. `README.md` is the RN template boilerplate (ignore).
Latest uncommitted work: school code on login/forgot-password (multi-school backend). Builds already installed send no code → the server's `DEFAULT_ORG_CODE` school.
