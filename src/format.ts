// Formatting + date helpers shared by every screen (no React here).
import { t } from './i18n';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse an API date. "YYYY-MM-DD" is read as a LOCAL calendar date —
 * `new Date('2026-10-18')` would be UTC midnight, which is the previous day
 * in any timezone west of UTC.
 */
export function parseDate(d?: string | Date | null): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const m = DATE_ONLY.exec(String(d).trim());
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** "18 Oct 2026" (localized month). */
export const fmtDate = (d?: string | Date | null): string => {
  if (!d) return '—';
  const dt = parseDate(d);
  if (!dt) return String(d);
  const months = t('months');
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
};

/** Local calendar date as "YYYY-MM-DD" (NOT toISOString, which is UTC). */
export function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  const m = DATE_ONLY.exec(s.trim());
  if (!m) return false;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.getFullYear() === Number(m[1]) && dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[3]);
}

/** "Tue, 12 May" (localized month; weekday in English/Hindi via t()). */
export function fmtDayShort(d?: string | Date | null): string {
  const dt = parseDate(d ?? null);
  if (!dt) return '—';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${t(days[dt.getDay()])}, ${dt.getDate()} ${t('months')[dt.getMonth()]}`;
}

const HM = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([ap]\.?m\.?)?$/i;

/** Minutes since midnight from "07:05", "7:05:33", "07:05:33.123", "7:05 pm"; null when unreadable. */
export function parseClock(value?: string | null): number | null {
  if (value == null) return null;
  const m = HM.exec(String(value).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[4]?.toLowerCase().replace(/\./g, '');
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 24h "HH:MM" from minutes since midnight (wraps past midnight). */
export function clockHm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "9:30 AM" from minutes since midnight. */
export function clock12(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Any time the API sends → "9:30 AM". Accepts "09:30:12" (seconds dropped),
 * "09:30", ISO date-times ("2026-10-19T09:30:12+05:30" → device local time;
 * no offset → the wall-clock time as written), Date objects and numbers
 * (seconds since midnight, or a Unix timestamp in s/ms). "—" when empty.
 */
export function fmtTime(value?: string | number | Date | null): string {
  if (value == null || value === '') return '—';
  if (value instanceof Date) return isNaN(value.getTime()) ? '—' : clock12(value.getHours() * 60 + value.getMinutes());
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (value < 86400) return clock12(Math.floor(value / 60));
    const d = new Date(value > 1e11 ? value : value * 1000);
    return clock12(d.getHours() * 60 + d.getMinutes());
  }
  const s = String(value).trim();
  const plain = parseClock(s);
  if (plain != null) return clock12(plain);
  const iso = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (iso) {
    if (!iso[2]) return clock12(parseClock(iso[1]) ?? 0);
    const d = new Date(s.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return clock12(d.getHours() * 60 + d.getMinutes());
  }
  return s;
}

// One shared formatter: Number#toLocaleString builds a new Intl formatter on
// every call, which is slow on Hermes when a list renders many amounts.
const INR_FORMAT: Intl.NumberFormat | null = (() => {
  try {
    return new Intl.NumberFormat('en-IN');
  } catch {
    return null;
  }
})();

export const inr = (n?: number | null): string => {
  const v = Number(n || 0);
  return `₹${INR_FORMAT ? INR_FORMAT.format(v) : v.toLocaleString('en-IN')}`;
};
