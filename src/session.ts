// Who is signed in, and the tokens that prove it.
//
//  - access token:  memory only; short-lived (`expires_in`)
//  - refresh token: tokenStore.ts; swapped for a new pair by POST /auth/refresh
//  - Session:       the user fields the UI needs (and their school), persisted in AsyncStorage
//  - last school code typed at sign-in: AsyncStorage, kept after sign-out so
//    the login screen can fill it in
//
// refreshTokens() is single-flight: any number of parallel 401s share one
// /auth/refresh call. A refresh that returns 401 ends the session ('expired'),
// and App.tsx — subscribed via onSessionChange — goes back to the login screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAppResume } from './appEvents';
import { loadCache, resetCache } from './cache';
import { BRAND_COLOR_OVERRIDE } from './config';
import { ApiError, send } from './http';
import { t } from './i18n';
import { applyRoleTheme } from './theme';
import { tokenStore } from './tokenStore';
import type { AuthResponse, Session } from './types';

const SESSION_KEY = 'sw_app_session';
const LAST_ORG_KEY = 'sw_last_org_code';
/** Refresh this long before the access token's stated expiry. */
const EXPIRY_SKEW_MS = 30_000;

/** Why a session ended — the login screen shows a matching note. */
export type SessionEndReason = 'logout' | 'expired';

interface PersistedSession extends Session {
  /** Kept only when the server issued no refresh token (pre-refresh backend). */
  legacy_access_token?: string;
  /** Builds before refresh tokens stored the access token under this name. */
  token?: string;
}

let session: Session | null = null;
let accessToken: string | null = null;
let accessExpiresAt: number | null = null; // epoch ms; null = unknown
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

type Listener = (session: Session | null, reason?: SessionEndReason) => void;
const listeners = new Set<Listener>();

/** Subscribe to sign-in, sign-out, expiry and profile-flag changes. */
export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const emit = (reason?: SessionEndReason) => listeners.forEach(fn => fn(session, reason));

export const getSession = (): Session | null => session;
export const getAccessToken = (): string | null => accessToken;
export const getRefreshToken = (): string | null => refreshToken;
export const hasRefreshToken = (): boolean => !!refreshToken;

/** Whose cached responses these are (user type + id). */
export const cacheOwner = (s: Session | null = session): string | null => (s ? `${s.user_type}:${s.user_id}` : null);

export const isAccessExpired = (now = Date.now()): boolean =>
  !accessToken || (accessExpiresAt != null && now >= accessExpiresAt - EXPIRY_SKEW_MS);

function applyTheme(s: Session | null): void {
  applyRoleTheme(s?.user_type ?? null, s ? BRAND_COLOR_OVERRIDE ?? s.theme_color ?? null : null);
}

const pickSession = (p: Session): Session => ({
  user_id: p.user_id,
  full_name: p.full_name,
  user_type: p.user_type,
  theme_color: p.theme_color ?? null,
  must_change_password: !!p.must_change_password,
  ...(p.org_code ? { org_code: p.org_code, org_name: p.org_name ?? p.org_code } : {}),
});

const sameSession = (a: Session | null, b: Session | null): boolean =>
  !!a &&
  !!b &&
  a.user_id === b.user_id &&
  a.user_type === b.user_type &&
  a.full_name === b.full_name &&
  a.theme_color === b.theme_color &&
  a.org_code === b.org_code &&
  a.org_name === b.org_name &&
  !!a.must_change_password === !!b.must_change_password;

/** The school code last used to sign in on this phone ('' if none). */
export async function getLastOrgCode(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(LAST_ORG_KEY)) ?? '';
  } catch {
    return '';
  }
}

async function rememberOrgCode(code?: string): Promise<void> {
  if (!code) return;
  try {
    await AsyncStorage.setItem(LAST_ORG_KEY, code);
  } catch {
    // only a convenience
  }
}

async function persist(): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    const blob: PersistedSession = { ...session };
    if (!refreshToken && accessToken) blob.legacy_access_token = accessToken;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(blob));
  } catch {
    // Not fatal: the user just signs in again next launch.
  }
}

/** Restore the previous run's session (call once at boot). */
export async function loadSession(): Promise<Session | null> {
  let saved: PersistedSession | null = null;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    saved = raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    saved = null;
  }
  refreshToken = await tokenStore.getRefreshToken();
  // Access tokens are not persisted any more; older builds did, so reuse one
  // if found — it either still works or the first request ends the session.
  accessToken = saved?.legacy_access_token ?? saved?.token ?? null;
  accessExpiresAt = null;
  session = saved && saved.user_id != null && (refreshToken || accessToken) ? pickSession(saved) : null;
  if (!session) {
    accessToken = null;
    refreshToken = null;
  }
  applyTheme(session);
  await loadCache(cacheOwner(session));
  return session;
}

/**
 * Take the tokens (and any user fields) from an auth response.
 * `fresh` = a new sign-in (login / password reset): starts a clean cache.
 */
export async function applyAuthResponse(data: AuthResponse, { fresh }: { fresh: boolean }): Promise<Session> {
  const prev = fresh ? null : session;
  const user_id = data.user_id ?? prev?.user_id;
  const user_type = data.user_type ?? prev?.user_type;
  if (user_id == null || !user_type || !data.access_token) {
    throw new ApiError(t('err.badAuthResponse'), { status: 0 });
  }
  const next: Session = pickSession({
    user_id,
    user_type,
    full_name: data.full_name ?? prev?.full_name ?? '',
    theme_color: data.theme_color !== undefined ? data.theme_color : prev?.theme_color ?? null,
    must_change_password: data.must_change_password ?? prev?.must_change_password ?? false,
    org_code: data.org_code ?? prev?.org_code,
    org_name: data.org_name ?? prev?.org_name,
  });

  accessToken = data.access_token;
  accessExpiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : null;
  if (data.refresh_token || fresh) {
    refreshToken = data.refresh_token ?? null;
    await tokenStore.setRefreshToken(refreshToken);
  }

  const changed = !sameSession(session, next);
  session = next;
  if (fresh) resetCache(cacheOwner(next)); // never show a previous user's data
  applyTheme(next);
  await Promise.all([persist(), rememberOrgCode(data.org_code)]);
  if (changed || fresh) emit();
  return next;
}

/** Sign out locally (server-side revocation is the caller's job). */
export async function endSession(reason: SessionEndReason): Promise<void> {
  const had = !!session;
  session = null;
  accessToken = null;
  accessExpiresAt = null;
  refreshToken = null;
  resetCache(null);
  applyTheme(null);
  await Promise.all([tokenStore.clear(), persist()]);
  if (had) emit(reason);
}

/** Server said "Password change required" (403) → show the change-password screen. */
export async function setMustChangePassword(value: boolean): Promise<void> {
  if (!session || !!session.must_change_password === value) return;
  session = { ...session, must_change_password: value };
  await persist();
  emit();
}

/**
 * Swap the refresh token for a new pair. Resolves true when a new access
 * token is in place, false when there is no session to refresh (the session
 * is ended if the server rejected the refresh token). Network / server
 * errors reject and leave the session alone, so offline users stay signed in.
 */
export function refreshTokens(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshInFlight) {
    const sent = refreshToken;
    refreshInFlight = (async () => {
      try {
        const { data } = await send<AuthResponse>('/auth/refresh', { method: 'POST', body: { refresh_token: sent } });
        if (refreshToken !== sent) return !!accessToken; // signed out / in meanwhile
        await applyAuthResponse(data, { fresh: false });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          if (refreshToken === sent) await endSession('expired');
          return false;
        }
        throw e;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** Refresh first if the access token has (nearly) expired. Never throws. */
export async function ensureFreshAccessToken(): Promise<void> {
  if (refreshToken && isAccessExpired()) {
    await refreshTokens().catch(() => false);
  }
}

// Back from the background: refresh before the screens start fetching.
onAppResume(() => {
  if (session) ensureFreshAccessToken();
});
