import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AccessibilityInfo } from 'react-native';
import { api, apiPage, errorText, peek, withQuery } from './api';
import { onAppResume } from './appEvents';
import { PAGE_SIZE } from './config';
import { getLang, setLang, subscribe, t } from './i18n';
import type { SchoolTimings } from './types';
import { getUiTheme, subscribeUiTheme } from './uiTheme';
import type { UiTheme } from './uiTheme';
import { getUpdatesVersion, hasNew, subscribeUpdates } from './updates';

/** The UI theme picked in Profile (uiTheme.ts); re-renders the reader when it changes. */
export function useUiTheme(): UiTheme {
  return useSyncExternalStore(subscribeUiTheme, getUiTheme);
}

/**
 * The home launchers' red "new" dots (updates.ts). Returns `hasNew(route)` and
 * a `version` that changes whenever any dot does — put it in the deps of a
 * memoised launcher list so only a real change redraws it.
 */
export function useUpdateDots(): { hasNew: (route: string) => boolean; version: number } {
  const version = useSyncExternalStore(subscribeUpdates, getUpdatesVersion);
  return { hasNew, version };
}

// ---- screen focus (provided per screen by components/ScreenStack) ----

/** Whether a screen is on top and at rest — a tiny store, so changes re-render only the hooks that read it. */
export interface ActiveStore {
  get: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

export function createActiveStore(initial: boolean): ActiveStore & { set: (value: boolean) => void } {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: next => {
      if (next === value) return;
      value = next;
      listeners.forEach(l => l());
    },
  };
}

const ALWAYS_ACTIVE: ActiveStore = { get: () => true, subscribe: () => () => {} };
export const ScreenActiveContext = createContext<ActiveStore>(ALWAYS_ACTIVE);

/** True while this screen is on top and no transition is running (true outside a ScreenStack). */
export function useScreenActive(): boolean {
  const store = useContext(ScreenActiveContext);
  return useSyncExternalStore(store.subscribe, store.get);
}

/** Runs `fn` each time this screen comes back to the top (not on first mount); never re-renders. */
export function useOnReturn(fn: () => void): void {
  const store = useContext(ScreenActiveContext);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let was = store.get();
    return store.subscribe(() => {
      const now = store.get();
      if (now && !was) ref.current();
      was = now;
    });
  }, [store]);
}

/** After this long in the background, data hooks re-fetch on resume
 *  (signed photo links expire, and the data has probably changed). */
const STALE_AFTER_AWAY_MS = 5 * 60 * 1000;

// Re-renders the component when the language changes.
// const { t, lang, setLang } = useI18n();
export function useI18n() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(x => x + 1)), []);
  return { t, lang: getLang(), setLang };
}

// True while the OS asks for less motion (iOS "Reduce Motion", Android
// "Remove animations") — skip decorative animations then.
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      enabled => {
        if (mounted) setReduceMotion(enabled);
      },
      () => {},
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

/** Run `fn` when the app comes back after being away for a while. */
export function useOnResume(fn: () => void, minAwayMs = STALE_AFTER_AWAY_MS): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => onAppResume(away => away >= minAwayMs && ref.current()), [minAwayMs]);
}

export interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh (shows the spinner). */
  refresh: () => void;
  /** Re-fetch quietly, e.g. after saving something. */
  reload: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
}

// Standard data-loading hook:
// const { data, error, loading, refresh } = useApi<HomeworkItem[]>('/student/homework')
// Opens with the last cached response for `path` (if any) and refreshes it in
// the background, so `loading` is only true when there is nothing to show yet.
// Pass `null` to skip loading (e.g. until a filter is chosen).
export function useApi<T = any>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(() => (path ? peek<T>(path) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !!path && peek(path) === null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!path) return;
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'initial') {
        const cached = peek<T>(path);
        setData(cached);
        setLoading(cached === null);
      }
      setError(null);
      try {
        const fresh = await api<T>(path);
        if (id === requestId.current) setData(fresh); // ignore answers for an older path
      } catch (e) {
        if (id === requestId.current) setError(errorText(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);
  useOnResume(() => load('silent'));

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => load('refresh'),
    reload: () => load('silent'),
    setData,
  };
}

export interface UsePagedApiResult<T> {
  /** Loaded rows; null until the first page (or its cache) is available. */
  items: T[] | null;
  /** No rows to show yet for the current path (first load or filter change). */
  loading: boolean;
  /** Some rows have been shown at least once — use it to show the skeleton
   *  only on first open, not every time a filter changes. */
  ready: boolean;
  /** Total rows on the server (X-Total-Count), when known. */
  total: number | null;
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Pull-to-refresh: back to the first page. */
  refresh: () => void;
  /** Quiet first-page reload, e.g. after saving something. */
  reload: () => void;
  /** Wire to ListScreen's onEndReached. */
  loadMore: () => void;
  setItems: Dispatch<SetStateAction<T[] | null>>;
}

const keyOfItem = (item: unknown): unknown =>
  item && typeof item === 'object' && 'id' in item ? (item as { id: unknown }).id : item;

/** Append a page, dropping rows already shown (rows shift when data changes between pages). */
function appendUnique<T>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map(keyOfItem));
  return prev.concat(next.filter(item => !seen.has(keyOfItem(item))));
}

/**
 * Paginated list (`?limit=&offset=` + X-Total-Count) with infinite scroll.
 *   const list = usePagedApi<Notice>('/notices');
 *   <ListScreen data={list.items} onEndReached={list.loadMore} loadingMore={list.loadingMore} … />
 * The first page is cached like useApi, so the list opens instantly. Changing
 * `path` (e.g. a filter) starts over; late answers for an old path are ignored.
 */
export function usePagedApi<T>(path: string | null, pageSize = PAGE_SIZE): UsePagedApiResult<T> {
  const firstPage = path ? withQuery(path, { limit: pageSize, offset: 0 }) : null;
  const [items, setItems] = useState<T[] | null>(() => (firstPage ? peek<T[]>(firstPage) : null));
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ready, setReady] = useState(items !== null);
  if (items !== null && !ready) setReady(true);

  const requestId = useRef(0); // bumps on every first-page load → stale pages are dropped
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const moreBusy = useRef(false);
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const settle = (loaded: number, pageLen: number, pageTotal: number | null) => {
    setTotal(pageTotal);
    setHasMore(pageTotal != null ? loaded < pageTotal : pageLen >= pageSize);
  };

  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!path || !firstPage) return;
      const id = ++requestId.current;
      moreBusy.current = false;
      setLoadingMore(false);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'initial') {
        setItems(peek<T[]>(firstPage));
        setHasMore(false);
      }
      setError(null);
      try {
        const page = await apiPage<T>(path, pageSize, 0);
        if (id !== requestId.current) return;
        setItems(page.items);
        settle(page.items.length, page.items.length, page.total);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(errorText(e)); // screens show the error instead of the skeleton
      } finally {
        if (id === requestId.current) setRefreshing(false);
      }
    },
    // settle only reads pageSize
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, firstPage, pageSize],
  );

  const loadMore = useCallback(async () => {
    const loaded = itemsRef.current;
    if (!path || !loaded || !hasMoreRef.current || moreBusy.current) return;
    const id = requestId.current;
    moreBusy.current = true;
    setLoadingMore(true);
    try {
      const page = await apiPage<T>(path, pageSize, loaded.length);
      if (id !== requestId.current) return;
      const before = itemsRef.current ?? [];
      const merged = appendUnique(before, page.items);
      setItems(merged);
      // A short page — or one with nothing new (an endpoint that ignores
      // limit/offset) — means the end, whatever the count says.
      if (page.items.length < pageSize || merged.length === before.length) setHasMore(false);
      else settle(merged.length, page.items.length, page.total);
    } catch (e) {
      if (id === requestId.current) {
        setError(errorText(e));
        setHasMore(false); // stop onEndReached retry loops; pull-to-refresh starts over
      }
    } finally {
      if (id === requestId.current) {
        moreBusy.current = false;
        setLoadingMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, pageSize]);

  useEffect(() => {
    loadFirst('initial');
  }, [loadFirst]);
  useOnResume(() => loadFirst('silent'));

  return {
    items,
    loading: items === null && !error,
    ready,
    total,
    error,
    refreshing,
    loadingMore,
    hasMore,
    refresh: () => loadFirst('refresh'),
    reload: () => loadFirst('silent'),
    loadMore,
    setItems,
  };
}

/** True when the server does not have this endpoint yet (older backend). */
export const isMissingEndpoint = (e: unknown): boolean =>
  !!e && typeof e === 'object' && 'status' in e && [404, 405, 501].includes(Number((e as { status: unknown }).status));

/**
 * The school's bell schedule (GET /settings/school-timings), or null while
 * loading / when the school hasn't set it (timetables then show no clock times).
 */
export function useSchoolTimings(): { timings: SchoolTimings | null; reload: () => void } {
  const res = useApi<SchoolTimings>('/settings/school-timings');
  return { timings: res.data && res.data.start_time ? res.data : null, reload: res.reload };
}
