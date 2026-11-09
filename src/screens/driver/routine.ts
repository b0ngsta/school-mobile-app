// Driver "My Routine" — the pure parts (no React): which shift to open first,
// which one is running / next, the shift chip text, phone numbers for the
// dialer and the Google Maps link. Tested in __tests__/routine.test.tsx.
import { fmtTime, parseClock } from '../../format';
import type { RoutineShift, RoutineStudent } from '../../types';

export type ShiftState = 'now' | 'next' | 'done' | 'later';

const minutes = (hhmm?: string | null): number | null => parseClock(hhmm ?? null);

/**
 * Where each shift stands at `nowMin` (minutes since midnight) on the day
 * shown. Not today → no state. The first shift still to come is "next";
 * every one running is "now" (overlapping shifts can both be running).
 */
export function shiftStates(shifts: RoutineShift[], nowMin: number, isToday: boolean): Record<string, ShiftState> {
  const out: Record<string, ShiftState> = {};
  if (!isToday) return out;
  let nextGiven = false;
  for (const s of shifts) {
    const start = minutes(s.start_time);
    const end = minutes(s.end_time) ?? start;
    if (start == null || end == null) continue;
    if (nowMin >= start && nowMin < end) out[s.key] = 'now';
    else if (nowMin >= end) out[s.key] = 'done';
    else if (!nextGiven) {
      out[s.key] = 'next';
      nextGiven = true;
    } else out[s.key] = 'later';
  }
  return out;
}

/** The shift to open: the running one, else the next one, else the last (all done) — the first when not today. */
export function defaultShiftKey(shifts: RoutineShift[], nowMin: number, isToday: boolean): string | null {
  if (!shifts.length) return null;
  const states = shiftStates(shifts, nowMin, isToday);
  return (
    shifts.find(s => states[s.key] === 'now')?.key ??
    shifts.find(s => states[s.key] === 'next')?.key ??
    (isToday ? shifts[shifts.length - 1].key : shifts[0].key)
  );
}

/** "7:00 AM – 8:30 AM" (just the start when there is no end). */
export function shiftRange(s: Pick<RoutineShift, 'start_time' | 'end_time'>): string {
  if (!s.start_time) return '';
  return s.end_time ? `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}` : fmtTime(s.start_time);
}

/** Morning before noon, Evening after (the label next to the time on the chip). */
export const periodOf = (s: Pick<RoutineShift, 'start_time'>): 'Morning' | 'Evening' =>
  (minutes(s.start_time) ?? 0) < 12 * 60 ? 'Morning' : 'Evening';

/**
 * A dialable number for a `tel:` link: spaces, dashes and brackets removed,
 * a leading + kept. Null when it isn't a plausible phone number (7–15 digits).
 */
export function dialable(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (/[^\d\s+\-().]/.test(trimmed)) return null; // letters etc. — not a number
  return (trimmed.startsWith('+') ? '+' : '') + digits;
}

/** tel: link — opens the dialer with the number typed in (never calls by itself). */
export const telUrl = (phone?: string | null): string | null => {
  const n = dialable(phone);
  return n ? `tel:${n}` : null;
};

export interface Contact {
  /** i18n key: 'Parent / Guardian' or 'Student' */
  label: string;
  name?: string | null;
  phone?: string | null;
  /** the raw number is shown; `dial` is null when it can't be dialled */
  dial: string | null;
}

/** Who can be called for this student: the parent / guardian first, then the student's own phone. */
export function contactsOf(st: RoutineStudent): Contact[] {
  const guardian = [st.father_name, st.mother_name].filter(Boolean).join(' / ') || null;
  const out: Contact[] = [
    { label: 'Parent / Guardian', name: guardian, phone: st.guardian_phone, dial: dialable(st.guardian_phone) },
  ];
  if (st.student_phone && dialable(st.student_phone) !== dialable(st.guardian_phone)) {
    out.push({ label: 'Student', name: st.full_name, phone: st.student_phone, dial: dialable(st.student_phone) });
  }
  return out;
}

/** The number the card's call button dials (first contact that can be dialled). */
export const primaryDial = (st: RoutineStudent): string | null => contactsOf(st).find(c => c.dial)?.dial ?? null;

/** Google Maps directions to the stop's pin; null without coordinates. */
export function mapsUrl(st: Pick<RoutineStudent, 'latitude' | 'longitude'>): string | null {
  const { latitude: lat, longitude: lng } = st;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** The short place line on a card: the stop name, else the first part of the address. */
export function shortPlace(st: Pick<RoutineStudent, 'stop_name' | 'address' | 'landmark'>): string {
  if (st.stop_name) return st.stop_name;
  const first = (st.address || '').split(',').map(p => p.trim()).filter(Boolean).slice(0, 2).join(', ');
  return first || st.landmark || '';
}

/** "Class 5 - A" */
export const classLabel = (st: Pick<RoutineStudent, 'class_name' | 'section_name'>): string =>
  [st.class_name, st.section_name].filter(Boolean).join(' - ');
