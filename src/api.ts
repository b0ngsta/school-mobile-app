// The API surface screens use: authenticated requests (with automatic token
// refresh), paginated lists, and the auth endpoints. Accepts ALL roles:
// student, teacher, admin, principal, sub_admin, coordinator, driver.
//
// Layers:  screens → api.ts → session.ts (tokens) → http.ts (fetch + errors)
import { remember } from './cache';
import { API_URL } from './config';
import { ApiError, send } from './http';
import type { HttpMethod } from './http';
import { t } from './i18n';
import {
  applyAuthResponse,
  cacheOwner,
  endSession,
  ensureFreshAccessToken,
  getAccessToken,
  getRefreshToken,
  getSession,
  hasRefreshToken,
  isAccessExpired,
  refreshTokens,
  setMustChangePassword,
} from './session';
import type { AuthResponse, SchoolInfo, Session } from './types';

export { peek } from './cache';
export { ApiError, errorText } from './http';
export { getLastOrgCode, getSession, loadSession, onSessionChange } from './session';
export type { SessionEndReason } from './session';

export interface ApiOptions {
  method?: HttpMethod;
  body?: Record<string, unknown>;
  formData?: FormData;
}

const PASSWORD_CHANGE_REQUIRED = 'Password change required';
let featureRefreshAt = 0;

/** Authenticated request; resolves with the full response (data + headers). */
async function authed<T>(path: string, opts: ApiOptions, retried = false) {
  const owner = cacheOwner();
  await ensureFreshAccessToken();
  try {
    const res = await send<T>(path, { ...opts, token: getAccessToken() });
    if ((opts.method ?? 'GET') === 'GET') remember(path, res.data, owner);
    return res;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 401 && getSession()) {
      // Expired or revoked: refresh once (shared with parallel calls), retry.
      // A network failure during the refresh propagates as itself.
      if (!retried && hasRefreshToken() && (await refreshTokens())) {
        return authed<T>(path, opts, true);
      }
      if (!hasRefreshToken()) await endSession('expired');
      throw new ApiError(t('err.sessionExpired'), { status: 401, detail: e.detail, requestId: e.requestId });
    }
    if (e.status === 403 && e.detail === PASSWORD_CHANGE_REQUIRED) await setMustChangePassword(true);
    // HQ switched this module off since our flags were saved: a refresh brings the new map
    // (session.features → launchers disappear). Not awaited: the caller shows the server's message.
    if (e.status === 403 && e.code === 'feature_disabled' && hasRefreshToken() && Date.now() - featureRefreshAt > 60_000) {
      featureRefreshAt = Date.now(); // at most once a minute, whatever keeps asking
      refreshTokens().catch(() => {});
    }
    throw e;
  }
}

/** GET (or any method) as the signed-in user; resolves with the JSON body. */
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  return (await authed<T>(path, opts)).data;
}

export interface Page<T> {
  items: T[];
  /** X-Total-Count, when the server sent it. */
  total: number | null;
}

/** Append query params to a path that may already have some. */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  if (!qs) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

/** One page of a paginated list (`?limit=&offset=`, total in X-Total-Count). */
export async function apiPage<T>(path: string, limit: number, offset: number): Promise<Page<T>> {
  const res = await authed<T[]>(withQuery(path, { limit, offset }), {});
  const header = res.headers.get('X-Total-Count');
  const total = header != null && header !== '' && Number.isFinite(Number(header)) ? Number(header) : null;
  return { items: Array.isArray(res.data) ? res.data : [], total };
}

/* --------------------------------- auth ---------------------------------- */
// One server hosts many schools: sign-in and password reset name the school
// by its code (`org_code`, case-insensitive); usernames are unique per school.
// Without a code the server uses its default school.

const withOrg = (orgCode: string | undefined, body: Record<string, unknown>) => {
  const code = (orgCode ?? '').trim();
  return code ? { org_code: code, ...body } : body;
};

/** A solved picture challenge for login() (see getCaptcha / needsCaptcha). */
export interface CaptchaAnswer {
  id: string;
  answer: string;
}

export async function login(
  username: string,
  password: string,
  orgCode?: string,
  captcha?: CaptchaAnswer | null,
): Promise<Session> {
  // captcha_supported: after a few wrong passwords the server asks for the
  // characters in a picture (428) instead of locking the account for everyone.
  const body: Record<string, unknown> = { username, password, captcha_supported: true };
  if (captcha) {
    body.captcha_id = captcha.id;
    body.captcha_answer = captcha.answer;
  }
  const { data } = await send<AuthResponse>('/auth/login', { method: 'POST', body: withOrg(orgCode, body) });
  return applyAuthResponse(data, { fresh: true });
}

/** The picture challenge the server asks for after repeated failed sign-ins. */
export interface Captcha {
  captcha_id: string;
  /** data:image/png;base64,… */
  image: string;
  expires_in: number;
  length: number;
}

export const getCaptcha = async (): Promise<Captcha> =>
  (await send<Captcha>('/auth/captcha', { method: 'POST' })).data;

/** login() failed because the picture is needed (first time, or the answer was wrong). */
export const needsCaptcha = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 428 && (e.code === 'captcha_required' || e.code === 'captcha_invalid');

/** The school's name for a code (404 = unknown code). */
export const lookupSchool = async (orgCode: string): Promise<SchoolInfo> =>
  (await send<SchoolInfo>(`/organisations/${encodeURIComponent(orgCode.trim())}`, {})).data;

/** Sign out this device. The server call is best-effort and not awaited. */
export async function logout(): Promise<void> {
  const access = isAccessExpired() ? null : getAccessToken();
  const refresh = getRefreshToken();
  if (access || refresh) {
    send('/auth/logout', {
      method: 'POST',
      token: access,
      body: refresh ? { refresh_token: refresh } : undefined,
    }).catch(() => {});
  }
  await endSession('logout');
}

/** Sign out every device of this account (including this one). */
export async function logoutAll(): Promise<void> {
  await api('/auth/logout-all', { method: 'POST' });
  await endSession('logout');
}

/** Change password; the server returns fresh tokens for this device (others are signed out). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const data = await api<AuthResponse>('/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });
  if (data?.access_token) await applyAuthResponse({ ...data, must_change_password: false }, { fresh: false });
  else await setMustChangePassword(false);
}

/* ----------------------------- forgot password ---------------------------- */

export interface ForgotPasswordResult {
  requested: boolean;
  /** Seconds the emailed code stays valid. */
  code_expires_in: number;
}

export const requestPasswordReset = async (loginId: string, orgCode?: string): Promise<ForgotPasswordResult> =>
  (
    await send<ForgotPasswordResult>('/auth/forgot-password', {
      method: 'POST',
      body: withOrg(orgCode, { login: loginId }),
    })
  ).data;

export async function verifyResetCode(loginId: string, code: string, orgCode?: string): Promise<boolean> {
  const { data } = await send<{ valid: boolean }>('/auth/verify-reset-code', {
    method: 'POST',
    body: withOrg(orgCode, { login: loginId, code }),
  });
  return !!data?.valid;
}

/** Set a new password with the emailed code; signs this device in. */
export async function resetPassword(
  loginId: string,
  code: string,
  newPassword: string,
  orgCode?: string,
): Promise<Session> {
  const { data } = await send<AuthResponse>('/auth/reset-password', {
    method: 'POST',
    body: withOrg(orgCode, { login: loginId, code, new_password: newPassword }),
  });
  return applyAuthResponse(data, { fresh: true });
}

/* --------------------------------- files ---------------------------------- */

/**
 * Absolute URL of an uploaded file (photo_path, screenshot_path, paper_path).
 * The server signs these links and they expire after 24 h — render them, but
 * never store them; re-fetch the list/profile instead.
 */
export const photoUrl = (p?: string | null): string | null =>
  p ? `${API_URL}/${p.replace(/^\/+/, '')}` : null;
