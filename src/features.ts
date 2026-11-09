// Per-school feature flags (backend migration 0019, app/core/features.py).
//
// EduManage HQ switches a module off for one school; the API then answers
// 403 {code: "feature_disabled"} on its endpoints, and this app hides it:
// launchers (both home themes, every role) and `navigate()` to its screens
// (old push notifications, deep links). The flags arrive with every token
// response (login / refresh, kept on `session.features` by session.ts).
// A missing map or key (older server) means ON — nothing changes until HQ
// switches something off.
import type { Session } from './types';

export type FeatureKey = 'attendance' | 'fees' | 'transport' | 'lesson_plans' | 'salary';

/**
 * Screens that belong to a module (route name → feature). A route not listed is
 * always available. New gated screen: add it here (launchers and navigate()
 * follow automatically).
 */
export const ROUTE_FEATURE: Record<string, FeatureKey> = {
  // parent
  Attendance: 'attendance',
  AttendanceMonth: 'attendance',
  Fees: 'fees',
  MyTransport: 'transport',
  // staff
  MarkAttendance: 'attendance',
  FeesAdmin: 'fees',
  FeeClaims: 'fees',
  Payments: 'fees',
  Transport: 'transport',
  MyRoutine: 'transport',
  LessonPlans: 'lesson_plans',
  Salary: 'salary',
};

export const featureOfRoute = (route: string): FeatureKey | undefined => ROUTE_FEATURE[route];

/** Is `key` on for this session's school? No key / no flags (older server) = on. */
export function hasFeature(session: Pick<Session, 'features'> | null | undefined, key?: FeatureKey | null): boolean {
  if (!key) return true;
  const flags = session?.features;
  return !flags || flags[key] !== false;
}

/** Launcher lists (`{route}` items) without the screens whose module is off. */
export function withFeatures<T extends { route: string }>(
  items: T[],
  session: Pick<Session, 'features'> | null | undefined,
): T[] {
  if (!session?.features) return items;
  return items.filter(item => hasFeature(session, featureOfRoute(item.route)));
}

/** A stable string of the flags, for memo / effect deps. */
export const featuresKey = (session: Pick<Session, 'features'> | null | undefined): string =>
  session?.features ? JSON.stringify(session.features) : '';
