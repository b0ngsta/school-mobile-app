// Form rules shared by every create/edit form, so they match the server's.
// Each check returns an error message (already translated) or null.
import { isIsoDate } from './format';
import { t } from './i18n';

export const PASSWORD_MIN = 6;
export const EMAIL_MAX = 120;
export const RESET_CODE_LENGTH = 6;

// something@domain.tld — same shape the backend accepts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(value: string, { required = true }: { required?: boolean } = {}): string | null {
  const v = value.trim();
  if (!v) return required ? t('Email is required') : null;
  if (v.length > EMAIL_MAX) return t('Email must be at most {n} characters', { n: EMAIL_MAX });
  if (!EMAIL_RE.test(v)) return t('Enter a valid email address');
  return null;
}

export function passwordError(value: string): string | null {
  if (value.length < PASSWORD_MIN) return t('Password must be at least {n} characters', { n: PASSWORD_MIN });
  return null;
}

/** New password + confirmation. */
export function newPasswordError(value: string, confirm: string): string | null {
  return passwordError(value) ?? (value !== confirm ? t('Passwords do not match') : null);
}

export function resetCodeError(code: string): string | null {
  return new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`).test(code) ? null : t('Enter the {n}-digit code', { n: RESET_CODE_LENGTH });
}

/** Optional/required YYYY-MM-DD date field. */
export function dateError(value: string, { required = true }: { required?: boolean } = {}): string | null {
  const v = value.trim();
  if (!v) return required ? t('Enter a date as YYYY-MM-DD') : null;
  return isIsoDate(v) ? null : t('Enter a date as YYYY-MM-DD');
}

/** from ≤ to, both YYYY-MM-DD (string compare is safe for that format). */
export function dateRangeError(from: string, to: string, opts: { required?: boolean } = {}): string | null {
  const e = dateError(from, opts) ?? dateError(to, opts);
  if (e) return e;
  if (from.trim() && to.trim() && from.trim() > to.trim()) return t('The end date is before the start date');
  return null;
}

/** First message of several checks, or null when all pass. */
export const firstError = (...errors: (string | null | false | undefined)[]): string | null =>
  (errors.find(Boolean) as string | undefined) ?? null;
