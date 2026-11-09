// Response cache for "show cached data instantly" (stale-while-revalidate).
//
// Every successful GET made through api() is remembered here, per user.
// Screens seed their state with peek(path), so they open straight away with
// the last data they showed, and their normal load() then fetches fresh data
// in the background and swaps it in. The cache is also saved on the phone,
// so this works right after the app is reopened (and offline).
//
// What is saved where (Oct 2026 — before, everything was plain AsyncStorage):
//  - school-wide responses with nothing personal in them (timetables,
//    holidays, notices, events, class lists, totals…; SCHOOL_WIDE below):
//    plain JSON in AsyncStorage, as before
//  - everything else — anything about a student, parent or staff member
//    (profiles, addresses, phone numbers, the driver's routine, fees, marks,
//    messages, salaries…): ENCRYPTED (cryptoBox.ts) with a key held in the
//    phone's secure storage (secureStore.ts), newest first up to
//    MAX_SECURE_CHARS; anything beyond stays in memory only. Without secure
//    storage on a phone, personal responses are kept in memory only.
//  New endpoints are personal (encrypted) unless added to SCHOOL_WIDE.
//
// Safety:
//  - keyed by user: another user logging in never sees someone else's data
//  - cleared on logout (and the key is deleted)
//  - entries older than MAX_AGE_MS are ignored
//  - size-capped (AsyncStorage on Android struggles with very large values)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAppBackground } from './appEvents';
import { newKey, open, seal } from './cryptoBox';
import { secureStore } from './secureStore';

const PLAIN_KEY = 'sw_app_cache_v2';
const SECURE_KEY = 'sw_app_cache_secure_v1';
/** Builds before Oct 2026 kept the whole cache here in plain text. */
const LEGACY_KEY = 'sw_app_cache_v1';
/** secureStore name of the encryption key: "<owner>|<base64 key>". */
const KEY_SECRET = 'cache_key';

// Responses carry signed photo/file links that expire 24 h after the server
// issued them, so cached data must never outlive that.
const MAX_AGE_MS = 20 * 60 * 60 * 1000; // 20 hours
const MAX_ENTRIES = 80;
const MAX_ENTRY_CHARS = 300_000; // skip caching unusually large responses
const MAX_TOTAL_CHARS = 1_500_000; // keep the persisted blob well under limits
/** Encryption runs on the JS thread: keep the encrypted part small. */
const MAX_SECURE_CHARS = 120_000; // ~60 ms to encrypt in Hermes on a desktop CPU
const SAVE_DELAY_MS = 1500;
/** Re-encrypt less often; saving also happens when the app goes to the background. */
const SECURE_SAVE_DELAY_MS = 6000;

/**
 * Paths whose responses hold nothing about a particular person — safe to keep
 * on disk unencrypted. Matched against the full path (with its query).
 */
const SCHOOL_WIDE: RegExp[] = [
  /^\/(student\/)?(timetable|holidays|calendar|notices|events|syllabus|announcements|documents)(\/(mine|week|subjects))?([?]|$)/,
  /^\/(classes|lessons|exams|assignments\/mine|school|updates|homework)([?]|$)/,
  /^\/classes\/\d+\/(sections|subjects)([?]|$)/,
  /^\/exams\/\d+\/classes\/\d+\/papers([?]|$)/,
  /^\/settings\/(school|school-timings)([?]|$)/,
  /^\/(dashboard|attendance|fees|fees\/claims|transactions|vehicles|enquiries|exams)\/stats([?]|$)/,
  /^\/notifications\/unread-count([?]|$)/,
];

/** True when a response for this path has nothing personal in it. Exported for tests. */
export const isSchoolWide = (path: string): boolean => SCHOOL_WIDE.some(re => re.test(path));

interface Entry {
  data: unknown;
  at: number; // when it was fetched (ms)
  size: number; // JSON length, for the size cap
}

interface Persisted {
  owner: string;
  entries: [string, Entry][];
}

/** Which user the cache belongs to (null = logged out, nothing is cached). */
let owner: string | null = null;
/** Insertion-ordered: oldest first, so trimming drops the least recent. */
let entries = new Map<string, Entry>();
let plainTimer: ReturnType<typeof setTimeout> | null = null;
let secureTimer: ReturnType<typeof setTimeout> | null = null;
let secureDirty = false;
/** The encryption key for `owner` (base64), once known. */
let cacheKey: string | null = null;
/** Secret to derive a new key from when the phone has no secure random source. */
let keySeed: string | null = null;

/** Restore the cache saved on a previous run, if it belongs to this user. */
export async function loadCache(userKey: string | null, seed: string | null = null): Promise<void> {
  clearTimers();
  owner = userKey;
  entries = new Map();
  cacheKey = null;
  keySeed = seed;
  if (!userKey) return;
  let plain: string | null = null;
  let secure: string | null = null;
  let legacy: string | null = null;
  try {
    [plain, secure, legacy] = await Promise.all([
      AsyncStorage.getItem(PLAIN_KEY),
      AsyncStorage.getItem(SECURE_KEY),
      AsyncStorage.getItem(LEGACY_KEY),
    ]);
  } catch {
    return;
  }
  const found: [string, Entry][] = [];
  const take = (raw: string | null) => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Persisted;
      if (saved.owner === userKey && Array.isArray(saved.entries)) found.push(...saved.entries);
    } catch {}
  };
  take(plain);
  take(legacy);
  let key: string | null = null;
  if (secure) {
    key = await storedKey(userKey);
    if (key) take(open(key, secure));
  }
  if (owner !== userKey) return; // signed out / in while reading
  cacheKey = key;
  const now = Date.now();
  found
    .filter(([, e]) => e && typeof e.at === 'number' && now - e.at < MAX_AGE_MS)
    .sort((a, b) => a[1].at - b[1].at)
    .forEach(([path, e]) => {
      entries.delete(path);
      entries.set(path, e);
    });
  if (legacy) {
    // move the old plain-text cache into the new split (personal part encrypted)
    AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
    secureDirty = true;
    scheduleSave(0);
  }
}

/** Start a fresh, empty cache for this user (login) or nobody (logout). */
export function resetCache(userKey: string | null, seed: string | null = null): void {
  clearTimers();
  owner = userKey;
  entries = new Map();
  cacheKey = null;
  keySeed = seed;
  secureDirty = false;
  AsyncStorage.removeMany([PLAIN_KEY, SECURE_KEY, LEGACY_KEY]).catch(() => {});
  // a new user gets a new key (sign-out deletes every secret: tokenStore.clear)
  if (userKey) secureStore.set(KEY_SECRET, null).catch(() => {});
}

/** Last data fetched for this exact GET path, or null if none (or too old). */
export function peek<T>(path: string): T | null {
  if (!owner) return null;
  const e = entries.get(path);
  if (!e || Date.now() - e.at > MAX_AGE_MS) return null;
  return e.data as T;
}

/** Remember a fresh GET response (called by api()). */
export function remember(path: string, data: unknown, userKey: string | null): void {
  if (!owner || userKey !== owner) return; // response from a previous session
  let size: number;
  try {
    size = JSON.stringify(data).length;
  } catch {
    return;
  }
  const had = entries.delete(path); // re-insert = most recent
  if (!isSchoolWide(path) && (had || size <= MAX_ENTRY_CHARS)) secureDirty = true;
  if (size > MAX_ENTRY_CHARS) {
    scheduleSave();
    return;
  }
  entries.set(path, { data, at: Date.now(), size });
  trim();
  scheduleSave();
}

/** Write pending changes now (the app is going to the background). */
export function flushCache(): Promise<void> {
  if (!plainTimer && !secureTimer) return Promise.resolve();
  clearTimers();
  return save(true);
}

function trim(): void {
  let total = 0;
  entries.forEach(e => {
    total += e.size;
  });
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES && total <= MAX_TOTAL_CHARS) break;
    total -= entries.get(key)!.size;
    if (!isSchoolWide(key)) secureDirty = true;
    entries.delete(key);
  }
}

function clearTimers(): void {
  if (plainTimer) clearTimeout(plainTimer);
  if (secureTimer) clearTimeout(secureTimer);
  plainTimer = secureTimer = null;
}

function scheduleSave(delay = SAVE_DELAY_MS): void {
  if (plainTimer) clearTimeout(plainTimer);
  plainTimer = setTimeout(() => {
    plainTimer = null;
    save(false).catch(() => {});
  }, delay);
  if (secureDirty && !secureTimer) {
    secureTimer = setTimeout(() => {
      secureTimer = null;
      save(true).catch(() => {});
    }, Math.max(delay, SECURE_SAVE_DELAY_MS));
  }
}

/** The stored key, if it belongs to this user. */
async function storedKey(userKey: string): Promise<string | null> {
  try {
    const v = await secureStore.get(KEY_SECRET);
    if (!v) return null;
    const bar = v.lastIndexOf('|');
    return bar > 0 && v.slice(0, bar) === userKey ? v.slice(bar + 1) : null;
  } catch {
    return null;
  }
}

/** This user's key; makes (and stores) one the first time. Null = can't encrypt here. */
async function keyFor(userKey: string): Promise<string | null> {
  if (cacheKey) return cacheKey;
  const existing = await storedKey(userKey);
  if (existing) return (cacheKey = existing);
  const fresh = newKey(keySeed, userKey);
  if (!fresh || !(await secureStore.set(KEY_SECRET, `${userKey}|${fresh}`))) return null;
  keySeed = null; // no longer needed
  return (cacheKey = fresh);
}

async function save(includeSecure: boolean): Promise<void> {
  const who = owner;
  if (!who) return;
  const plain: [string, Entry][] = [];
  const personal: [string, Entry][] = [];
  entries.forEach((e, path) => (isSchoolWide(path) ? plain : personal).push([path, e]));
  const writes: Record<string, string> = { [PLAIN_KEY]: JSON.stringify({ owner: who, entries: plain } as Persisted) };
  const removes = [LEGACY_KEY];

  if (includeSecure && secureDirty) {
    secureDirty = false;
    // newest first until the cap; the rest stays in memory only
    const kept: [string, Entry][] = [];
    let total = 0;
    for (let i = personal.length - 1; i >= 0; i--) {
      if (total + personal[i][1].size > MAX_SECURE_CHARS) continue;
      total += personal[i][1].size;
      kept.unshift(personal[i]);
    }
    const key = kept.length ? await keyFor(who) : null;
    if (owner !== who) return; // signed out meanwhile
    if (key) writes[SECURE_KEY] = seal(key, JSON.stringify({ owner: who, entries: kept } as Persisted));
    else removes.push(SECURE_KEY);
  }
  try {
    await AsyncStorage.setMany(writes);
    await AsyncStorage.removeMany(removes);
  } catch {}
}

// Going to the background: write now (Android may end the process soon).
onAppBackground(() => {
  flushCache().catch(() => {});
});
