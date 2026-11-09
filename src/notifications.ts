// In-app notification inbox: unread count for the bell + helpers to open
// what a notification points at. Push (FCM) delivery is wired in push.ts;
// this module works with or without it.
//
// The bell's count is re-read while the app is OPEN only: never in the
// background (the next resume re-reads it at once), every minute without
// push, and only every few minutes once push works on this phone (a push
// arriving in the foreground re-reads it straight away — push.ts).
import { api } from './api';
import { isAppInForeground, onAppBackground, onAppResume } from './appEvents';
import type { RouteName } from './routes';
import type { AppNotification, RouteParams } from './types';

type Listener = (count: number) => void;

let unread = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
let pushActive = false;
let supported = true; // flips off when the backend has no /notifications yet
const listeners = new Set<Listener>();

/** Re-read interval while the app is open and push isn't working. */
export const POLL_MS = 60_000;
/** Re-read interval once push is registered on this phone. */
export const POLL_WITH_PUSH_MS = 5 * 60_000;

export const getUnread = (): number => unread;

function setUnread(n: number) {
  if (n === unread) return;
  unread = n;
  listeners.forEach(fn => fn(n));
}

export function onUnreadChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Re-read the unread count (quietly — failures keep the last value). */
export async function refreshUnread(): Promise<void> {
  if (!supported) return;
  try {
    const res = await api<{ count: number }>('/notifications/unread-count');
    setUnread(Math.max(0, Number(res?.count) || 0));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 404 || status === 405) supported = false;
  }
}

function stopTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Plan the next re-read (none while in the background or signed out). */
function scheduleNext(): void {
  stopTimer();
  if (!polling || !isAppInForeground()) return;
  timer = setTimeout(async () => {
    timer = null;
    await refreshUnread();
    scheduleNext();
  }, pushActive ? POLL_WITH_PUSH_MS : POLL_MS);
}

/** push.ts: pushes reach this phone (true) or stopped (false). */
export function setPushActive(active: boolean): void {
  if (pushActive === active) return;
  pushActive = active;
  if (polling) scheduleNext();
}

/** Start polling while signed in. Returns a stop function. */
export function startUnreadPolling(): () => void {
  supported = true;
  polling = true;
  refreshUnread();
  scheduleNext();
  const offResume = onAppResume(() => {
    refreshUnread();
    scheduleNext();
  });
  const offBackground = onAppBackground(stopTimer);
  return () => {
    polling = false;
    stopTimer();
    offResume();
    offBackground();
    setUnread(0);
  };
}

export async function markRead(n: AppNotification): Promise<void> {
  if (n.read_at) return;
  try {
    await api(`/notifications/${n.id}/read`, { method: 'PUT' });
  } catch {}
  refreshUnread();
}

export async function markAllRead(): Promise<void> {
  await api('/notifications/read-all', { method: 'PUT' });
  setUnread(0);
}

/** Fallback targets by type when the server didn't send data.route. */
const TYPE_ROUTES: Record<string, { staff: RouteName; student: RouteName }> = {
  attendance: { staff: 'MarkAttendance', student: 'Attendance' },
  fee: { staff: 'FeesAdmin', student: 'Fees' },
  notice: { staff: 'StaffNotices', student: 'Notices' },
  homework: { staff: 'MyClasses', student: 'Homework' },
  leave: { staff: 'Leaves', student: 'Notices' },
  substitution_request: { staff: 'Substitutions', student: 'Notices' },
  substitution_update: { staff: 'Substitutions', student: 'Notices' },
  message: { staff: 'Notifications', student: 'Messages' },
  event: { staff: 'Notifications', student: 'Events' },
  timetable: { staff: 'Notifications', student: 'StudentTimetable' },
  syllabus: { staff: 'Notifications', student: 'Syllabus' },
};

/** Where tapping a notification (in the inbox or from a push) should go. */
export function targetOf(
  n: Pick<AppNotification, 'type' | 'data'>,
  isStudent: boolean,
  known: (route: string) => boolean,
): { route: RouteName; params?: RouteParams } | null {
  const route = n.data?.route;
  if (route && known(route)) return { route: route as RouteName, params: (n.data?.params || undefined) as RouteParams | undefined };
  const byType = TYPE_ROUTES[n.type];
  return byType ? { route: isStudent ? byType.student : byType.staff } : null;
}
