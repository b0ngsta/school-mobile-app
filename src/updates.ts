// "Something new inside" red dots on the home launchers (both themes, every role).
//
// Source: GET /updates (backend services/updates.py) — for each section the
// signed-in role can open, the time of the newest thing in it:
//   { server_time, sections: { homework: { latest_at }, messages: { latest_at, unread }, ... } }
// This module remembers, per device and per account, when each section was
// last opened (AsyncStorage `sw_seen_v1:<school>:<role>:<user id>`; kept after
// sign-out so a re-login doesn't bring dots back for things already seen) and
// a launcher shows a dot while its section's `latest_at` is newer than that.
//
// When it checks: App.tsx starts it at sign-in / cold start (first check), the
// homes call refreshUpdates() on pull-to-refresh, when you come back to the
// home and on app resume. Opening a screen (App.tsx navigate) clears its dot —
// and leaving it does again, so your own changes in there never light it.
// A section never opened on this device counts things from the last
// NEW_WINDOW_DAYS as new (a fresh install doesn't light every launcher).
// Servers without /updates (404/405) → no dots, nothing breaks.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/** Launcher route → section key in GET /updates (the server decides what each key means per role). */
export const SECTION_OF_ROUTE: Readonly<Record<string, string>> = {
  // student / parent
  Homework: 'homework',
  Notices: 'notices',
  ClassAnnouncements: 'class_announcements',
  Remarks: 'remarks',
  StudentTimetable: 'timetable',
  Syllabus: 'syllabus',
  FullSyllabus: 'syllabus',
  Events: 'events',
  Attendance: 'attendance',
  Fees: 'fees',
  Exams: 'exams',
  ReportCards: 'report_cards',
  Holidays: 'holidays',
  MyTransport: 'transport',
  // staff (teacher / driver / managers)
  StaffNotices: 'notices',
  MyTimetable: 'timetable',
  Substitutions: 'substitutions',
  Leaves: 'leaves',
  Salary: 'salary',
  FeeClaims: 'fee_claims',
};

export interface UpdatesResponse {
  server_time: string;
  sections: Record<string, { latest_at: string | null; unread?: number }>;
}

export const SEEN_KEY_PREFIX = 'sw_seen_v1:';
export const NEW_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

let owner: string | null = null;
let seen: Record<string, number> = {};
let latest: Record<string, number> = {};
let offsetMs = 0; // server clock − device clock, from the last check
let supported = true;
let ready: Promise<void> = Promise.resolve();
let inflight: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

const serverNow = () => Date.now() + offsetMs;
const emit = () => {
  version += 1;
  listeners.forEach(l => l());
};
const persist = () => {
  if (owner) AsyncStorage.setItem(SEEN_KEY_PREFIX + owner, JSON.stringify(seen)).catch(() => {});
};

export const getUpdatesVersion = (): number => version;

export function subscribeUpdates(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Whether the screen behind this launcher route has something not opened yet. */
export function hasNew(route: string): boolean {
  const key = SECTION_OF_ROUTE[route];
  if (!key || !(key in latest)) return false;
  return latest[key] > (seen[key] ?? 0);
}

/**
 * Signed in as `ownerKey` ("<school>:<role>:<user id>"): load what this
 * account has already opened on this device, then run the first check.
 * Returns the stop function (sign-out / account change).
 */
export function startUpdates(ownerKey: string): () => void {
  owner = ownerKey;
  seen = {};
  latest = {};
  supported = true;
  inflight = null;
  ready = AsyncStorage.getItem(SEEN_KEY_PREFIX + ownerKey)
    .then(raw => {
      if (owner !== ownerKey || !raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number') seen[k] = Math.max(seen[k] ?? 0, v);
      }
    })
    .catch(() => {});
  refreshUpdates();
  return () => {
    if (owner !== ownerKey) return;
    owner = null;
    seen = {};
    latest = {};
    emit();
  };
}

/** Ask the server what's new (quietly: a failure keeps the dots as they are). Single-flight. */
export function refreshUpdates(): Promise<void> {
  if (!owner || !supported) return Promise.resolve();
  if (inflight) return inflight;
  const me = owner;
  const run = (async () => {
    await ready;
    try {
      const res = await api<UpdatesResponse>('/updates');
      if (owner !== me || !res?.sections) return;
      const server = Date.parse(res.server_time);
      if (Number.isFinite(server)) offsetMs = server - Date.now();
      const next: Record<string, number> = {};
      let baselined = false;
      for (const [key, s] of Object.entries(res.sections)) {
        const at = s?.latest_at ? Date.parse(s.latest_at) : NaN;
        next[key] = Number.isFinite(at) ? at : 0;
        if (seen[key] === undefined) {
          // Never opened on this device: only the last few days count as new.
          seen[key] = serverNow() - NEW_WINDOW_DAYS * DAY_MS;
          baselined = true;
        }
      }
      latest = next;
      if (baselined) persist();
      emit();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 404 || status === 405) supported = false;
    }
  })();
  inflight = run;
  run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** The screen behind `route` was opened (or left): everything in it up to now is seen. */
export function markSeen(route: string): void {
  const key = SECTION_OF_ROUTE[route];
  if (!key || !owner) return;
  const had = hasNew(route);
  seen[key] = Math.max(seen[key] ?? 0, serverNow(), latest[key] ?? 0);
  persist();
  if (had) emit();
}
