// Response cache for "show cached data instantly" (stale-while-revalidate).
//
// Every successful GET made through api() is remembered here, per user.
// Screens seed their state with peek(path), so they open straight away with
// the last data they showed, and their normal load() then fetches fresh data
// in the background and swaps it in. The cache is persisted to AsyncStorage,
// so this also works right after the app is reopened.
//
// Safety:
//  - keyed by user: another user logging in never sees someone else's data
//  - cleared on logout
//  - entries older than MAX_AGE_MS are ignored
//  - size-capped (AsyncStorage on Android struggles with very large values)
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'sw_app_cache_v1';
// Responses carry signed photo/file links that expire 24 h after the server
// issued them, so cached data must never outlive that.
const MAX_AGE_MS = 20 * 60 * 60 * 1000; // 20 hours
const MAX_ENTRIES = 80;
const MAX_ENTRY_CHARS = 300_000; // skip caching unusually large responses
const MAX_TOTAL_CHARS = 1_500_000; // keep the persisted blob well under limits
const SAVE_DELAY_MS = 1500;

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
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Restore the cache saved on a previous run, if it belongs to this user. */
export async function loadCache(userKey: string | null): Promise<void> {
  owner = userKey;
  entries = new Map();
  if (!userKey) return;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Persisted;
    if (saved.owner !== userKey || owner !== userKey) return;
    const now = Date.now();
    for (const [path, e] of saved.entries) {
      if (now - e.at < MAX_AGE_MS) entries.set(path, e);
    }
  } catch {
    entries = new Map();
  }
}

/** Start a fresh, empty cache for this user (login) or nobody (logout). */
export function resetCache(userKey: string | null): void {
  owner = userKey;
  entries = new Map();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  AsyncStorage.removeItem(STORE_KEY).catch(() => {});
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
  entries.delete(path); // re-insert = most recent
  if (size > MAX_ENTRY_CHARS) {
    scheduleSave();
    return;
  }
  entries.set(path, { data, at: Date.now(), size });
  trim();
  scheduleSave();
}

function trim(): void {
  let total = 0;
  entries.forEach(e => {
    total += e.size;
  });
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES && total <= MAX_TOTAL_CHARS) break;
    total -= entries.get(key)!.size;
    entries.delete(key);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!owner) return;
    const blob: Persisted = { owner, entries: Array.from(entries.entries()) };
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(blob)).catch(() => {});
  }, SAVE_DELAY_MS);
}
