// School day maths: start time + prayer + periods + breaks → clock times.
//
//   start 06:30, prayer 30 min, 45-min periods, break of 20 min after period 3
//   → prayer 06:30–07:00, P1 07:00–07:45, P2 07:45–08:30, P3 08:30–09:15,
//     break 09:15–09:35, P4 09:35–10:20 …
//
// The backend stores the settings (GET/PUT /settings/school-timings) and may
// send the computed `periods`; when it does, those win, so both apps and the
// server always agree. No React here.
import { clockHm, parseClock } from './format';
import { t } from './i18n';
import type { PeriodTime, SchoolTimings } from './types';

export const DEFAULT_PERIODS_PER_DAY = 8;
export const MAX_PERIODS_PER_DAY = 12;

export const EMPTY_TIMINGS: SchoolTimings = {
  start_time: '08:00',
  prayer_minutes: 15,
  period_minutes: 40,
  periods_per_day: DEFAULT_PERIODS_PER_DAY,
  breaks: [],
};

export type ScheduleRow =
  | { kind: 'prayer'; start: string; end: string }
  | { kind: 'period'; period: number; start: string; end: string }
  | { kind: 'break'; afterPeriod: number; label: string; start: string; end: string };

/** Problems with a timings form (already translated), or null when it can be saved. */
export function timingsError(tm: SchoolTimings): string | null {
  if (parseClock(tm.start_time) == null) return t('Pick the school start time');
  const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  if (!whole(tm.prayer_minutes, 0, 120)) return t('Prayer time must be 0–120 minutes');
  if (!whole(tm.period_minutes, 10, 180)) return t('Period length must be 10–180 minutes');
  if (!whole(tm.periods_per_day, 1, MAX_PERIODS_PER_DAY)) {
    return t('Periods per day must be 1–{n}', { n: MAX_PERIODS_PER_DAY });
  }
  const seen = new Set<number>();
  for (const b of tm.breaks) {
    if (!whole(b.after_period, 1, tm.periods_per_day - 1)) {
      return t('A break must come after period 1–{n}', { n: Math.max(1, tm.periods_per_day - 1) });
    }
    if (!whole(b.minutes, 1, 180)) return t('Break length must be 1–180 minutes');
    if (seen.has(b.after_period)) return t('Only one break after period {n}', { n: b.after_period });
    seen.add(b.after_period);
  }
  const startMin = parseClock(tm.start_time) ?? 0;
  const total = tm.prayer_minutes + tm.period_minutes * tm.periods_per_day + tm.breaks.reduce((a, b) => a + b.minutes, 0);
  if (startMin + total > 24 * 60) return t('The school day runs past midnight');
  return null;
}

/** Prayer, periods and breaks in order, with "HH:MM" start/end. */
export function buildSchedule(tm: SchoolTimings): ScheduleRow[] {
  let at = parseClock(tm.start_time);
  if (at == null) return [];
  const rows: ScheduleRow[] = [];
  const prayer = Math.max(0, Number(tm.prayer_minutes) || 0);
  if (prayer > 0) {
    rows.push({ kind: 'prayer', start: clockHm(at), end: clockHm(at + prayer) });
    at += prayer;
  }
  const breaks = new Map((tm.breaks || []).map(b => [Number(b.after_period), b]));
  const len = Math.max(1, Number(tm.period_minutes) || 0);
  const count = Math.min(MAX_PERIODS_PER_DAY, Math.max(1, Number(tm.periods_per_day) || DEFAULT_PERIODS_PER_DAY));
  // Server-computed times win (they may include per-period lengths later on).
  const server = new Map((tm.periods || []).map(p => [p.period, p]));
  for (let p = 1; p <= count; p++) {
    const fixed = server.get(p);
    const start: string = fixed?.start?.slice(0, 5) || clockHm(at);
    const end: string = fixed?.end?.slice(0, 5) || clockHm(at + len);
    rows.push({ kind: 'period', period: p, start, end });
    at = (parseClock(end) ?? at + len);
    const b = breaks.get(p);
    if (b && p < count) {
      const mins = Math.max(0, Number(b.minutes) || 0);
      rows.push({ kind: 'break', afterPeriod: p, label: b.label?.trim() || t('Break'), start: clockHm(at), end: clockHm(at + mins) });
      at += mins;
    }
  }
  return rows;
}

/** period → {start, end}; empty when timings are unknown. */
export function periodTimes(tm?: SchoolTimings | null): Record<number, PeriodTime> {
  const out: Record<number, PeriodTime> = {};
  if (!tm) return out;
  for (const r of buildSchedule(tm)) if (r.kind === 'period') out[r.period] = { period: r.period, start: r.start, end: r.end };
  return out;
}

/** Number of periods to draw in timetables. */
export const periodCount = (tm?: SchoolTimings | null): number =>
  Math.min(MAX_PERIODS_PER_DAY, Math.max(1, Number(tm?.periods_per_day) || DEFAULT_PERIODS_PER_DAY));
