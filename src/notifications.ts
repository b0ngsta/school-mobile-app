// In-app notification inbox: unread count for the bell + helpers to open
// what a notification points at. Push (FCM) delivery is wired in push.ts;
// this module works with or without it (the bell polls while the app is open).
import { api } from './api';
import { onAppResume } from './appEvents';
import type { RouteName } from './routes';
import type { AppNotification, RouteParams } from './types';

type Listener = (count: number) => void;

let unread = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let supported = true; // flips off when the backend has no /notifications yet
const listeners = new Set<Listener>();

const POLL_MS = 60_000;

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

/** Start polling while signed in. Returns a stop function. */
export function startUnreadPolling(): () => void {
  supported = true;
  refreshUnread();
  timer && clearInterval(timer);
  timer = setInterval(refreshUnread, POLL_MS);
  const offResume = onAppResume(() => refreshUnread());
  return () => {
    timer && clearInterval(timer);
    timer = null;
    offResume();
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
