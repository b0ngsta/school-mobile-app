// Low-level HTTP: one fetch against the API, with a timeout, JSON parsing and
// the backend's error shapes turned into an ApiError with a user-facing
// message. Knows nothing about sessions — api.ts adds tokens and refresh.
import { API_URL, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './config';
import { t } from './i18n';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SendOptions {
  method?: HttpMethod;
  body?: Record<string, unknown>;
  formData?: FormData;
  /** Bearer token to send, if any. */
  token?: string | null;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/** FastAPI validation item: {"loc": [...], "msg": "...", "type": "..."}. */
interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

/**
 * Every failed request ends up as one of these. `message` is ready to show;
 * the other fields let screens react to specific cases (401, 409, 429…).
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached / timed out. */
  readonly status: number;
  /** Raw `detail` from the body (string, validation list, or undefined). */
  readonly detail: unknown;
  /** X-Request-ID / request_id — quote it when reporting a server error. */
  readonly requestId: string | null;
  /** Seconds to wait before retrying (429 Retry-After), if the server said. */
  readonly retryAfterSec: number | null;

  constructor(
    message: string,
    opts: { status: number; detail?: unknown; requestId?: string | null; retryAfterSec?: number | null },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.detail = opts.detail;
    this.requestId = opts.requestId ?? null;
    this.retryAfterSec = opts.retryAfterSec ?? null;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** "Value error, Enter a valid email address" → "Enter a valid email address". */
function validationMessage(items: ValidationItem[]): string | null {
  const msgs = items
    .map(i => (typeof i?.msg === 'string' ? i.msg.replace(/^Value error,\s*/i, '').trim() : ''))
    .filter(Boolean);
  return msgs.length ? Array.from(new Set(msgs)).join('\n') : null;
}

/** Retry-After is either seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, Math.ceil(secs));
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}

/** 45 → "45 seconds", 150 → "3 minutes". */
export function formatWait(seconds: number): string {
  if (seconds < 60) return t(seconds === 1 ? '{n} second' : '{n} seconds', { n: seconds });
  const mins = Math.ceil(seconds / 60);
  return t(mins === 1 ? '{n} minute' : '{n} minutes', { n: mins });
}

/** Build the ApiError for a non-2xx response. Exported for tests. */
export function toApiError(status: number, body: any, headers: Pick<Headers, 'get'>): ApiError {
  const detail = body?.detail;
  const requestId: string | null = body?.request_id || headers.get('X-Request-ID') || null;
  const retryAfterSec = parseRetryAfter(headers.get('Retry-After'));

  let message: string | null = null;
  if (status >= 500) {
    message = requestId ? t('err.serverRef', { ref: requestId }) : t('err.server');
  } else if (typeof detail === 'string' && detail.trim()) {
    message = detail;
  } else if (Array.isArray(detail)) {
    message = validationMessage(detail);
  }
  if (status === 429) {
    const wait = retryAfterSec != null ? t('err.waitFor', { wait: formatWait(retryAfterSec) }) : '';
    message = `${message || t('err.tooMany')}${wait}`;
  }
  return new ApiError(message || t('err.request', { code: status }), { status, detail, requestId, retryAfterSec });
}

export async function send<T>(path: string, { method = 'GET', body, formData, token }: SendOptions = {}): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // multipart: let fetch set the boundary — do NOT set Content-Type
  if (body) headers['Content-Type'] = 'application/json';

  // Request logging only in dev: in release builds console.log still runs
  // and serialises every body (incl. upload FormData) on the JS thread.
  if (__DEV__) console.log(`${method} ${API_URL}${path}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), formData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = (e as Error)?.name === 'AbortError';
    throw new ApiError(t(timedOut ? 'err.timeout' : 'err.network'), { status: 0 });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw toApiError(res.status, data, res.headers);
  return { data: data as T, status: res.status, headers: res.headers };
}

/** Error → text for an ErrorBox (works for ApiError and anything else thrown). */
export const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : t('err.unknown');
