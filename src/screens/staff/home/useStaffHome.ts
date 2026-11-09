// Staff home (teacher / coordinator / sub admin / admin / principal / driver)
// — everything both home UIs share: the role's launcher list (GRIDS), the
// data (/auth/me, today's check-in/out, the latest notice and, for admin /
// principal, the fee / payment / students / attendance overview), check-in /
// check-out, pull-to-refresh and the quiet reloads on app resume / coming
// back to the home (each also re-checks the red "new" dots, updates.ts).
// The UI files (HomeStaff.default.tsx, HomeStaff.creative.tsx) only draw it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorText, peek } from '../../../api';
import { inr } from '../../../components/ui';
import type { GridItem } from '../../../components/ui';
import { useI18n, useOnResume, useOnReturn } from '../../../hooks';
import type {
  AttendanceStats,
  AuthUser,
  DashboardStats,
  FeeStats,
  NavigateFn,
  Notice,
  Session,
  StaffAttendanceRecord,
  TransactionStats,
} from '../../../types';
import { refreshUpdates } from '../../../updates';
import { featuresKey, hasFeature, withFeatures } from '../../../features';

/** Only the newest notice is shown on the home screen. */
export const LATEST_NOTICE = '/notices?limit=1';

/** A home launcher entry: the route plus a short subtitle (orbit card). */
export type HomeTile = GridItem & { sub: string };
export type RouteArg = Parameters<NavigateFn>[0];

export const GRIDS: Record<'manager' | 'teacher' | 'driver', HomeTile[]> = {
  manager: [
    { icon: 'google-classroom', label: 'Classes', sub: 'All sections', route: 'StaffClasses' },
    { icon: 'account-tie', label: 'Teachers', sub: 'Staff directory', route: 'Teachers' },
    { icon: 'microsoft-excel', label: 'Import Students', sub: 'Excel upload', route: 'StudentImport' },
    { icon: 'clipboard-check-outline', label: 'Mark Attendance', sub: 'Take the roll', route: 'MarkAttendance' },
    { icon: 'clock-outline', label: 'Time table', sub: 'Teacher schedules', route: 'Teachers', params: { hint: 'timetable' } },
    { icon: 'currency-inr', label: 'Fees', sub: 'Collect & track', route: 'FeesAdmin' },
    { icon: 'receipt', label: 'Fee Claims', sub: 'Review claims', route: 'FeeClaims' },
    { icon: 'school', label: 'Exams', sub: 'Exams & results', route: 'StaffExams' },
    { icon: 'calendar-star', label: 'Holidays', sub: 'Days off', route: 'Holidays' },
    { icon: 'bag-suitcase-outline', label: 'Leave Requests', sub: 'Approve leave', route: 'Leaves' },
    { icon: 'account-switch-outline', label: 'Substitutions', sub: 'Cover classes', route: 'Substitutions' },
    { icon: 'clock-time-four-outline', label: 'School Timings', sub: 'Bells & periods', route: 'SchoolTimings' },
    { icon: 'cash-multiple', label: 'Salary', sub: 'Pay slips', route: 'Salary' },
    { icon: 'account-group-outline', label: 'Staff Users', sub: 'Manage staff', route: 'Users' },
    { icon: 'notebook-outline', label: 'Lesson Plans', sub: 'Plan lessons', route: 'LessonPlans' },
    { icon: 'book-education-outline', label: 'Syllabus', sub: 'Share with parents', route: 'StaffSyllabus' },
    { icon: 'room-service-outline', label: 'Reception', sub: 'Visitors & enquiries', route: 'Reception' },
    { icon: 'bus-school', label: 'Transport', sub: 'Buses & routes', route: 'Transport' },
    { icon: 'credit-card-outline', label: 'Payments', sub: 'Transactions', route: 'Payments' },
    { icon: 'message-processing-outline', label: 'Bulk SMS', sub: 'Message parents', route: 'BulkSMS' },
    { icon: 'bullhorn-outline', label: 'Notice Board', sub: 'School or classes', route: 'StaffNotices' },
    { icon: 'account-voice', label: 'Class Announcements', sub: 'Teachers to classes', route: 'StaffClassAnnouncements' },
    { icon: 'account-circle-outline', label: 'Profile', sub: 'Your details', route: 'StaffProfile' },
  ],
  teacher: [
    { icon: 'calendar-account-outline', label: 'My Attendance', sub: 'Your record', route: 'StaffAttendance' },
    { icon: 'google-classroom', label: 'My Classes', sub: 'Your sections', route: 'MyClasses' },
    { icon: 'microsoft-excel', label: 'Import Students', sub: 'Class teacher · Excel', route: 'StudentImport' },
    { icon: 'clipboard-check-outline', label: 'Mark Attendance', sub: 'Take the roll', route: 'MarkAttendance' },
    { icon: 'clock-outline', label: 'Time table', sub: 'Your schedule', route: 'MyTimetable' },
    { icon: 'school', label: 'Marks Entry', sub: 'Results & Excel upload', route: 'StaffExams' },
    { icon: 'notebook-outline', label: 'Lesson Plans', sub: 'Plan lessons', route: 'LessonPlans' },
    { icon: 'book-education-outline', label: 'Syllabus', sub: 'Upload syllabus', route: 'StaffSyllabus' },
    { icon: 'receipt', label: 'Fee Claims', sub: 'Your claims', route: 'FeeClaims' },
    { icon: 'bag-suitcase-outline', label: 'Leave Request', sub: 'Apply for leave', route: 'Leaves' },
    { icon: 'account-switch-outline', label: 'Substitutions', sub: 'Cover classes', route: 'Substitutions' },
    { icon: 'cash-multiple', label: 'Salary', sub: 'Pay slips', route: 'Salary' },
    { icon: 'calendar-star', label: 'Holidays', sub: 'Days off', route: 'Holidays' },
    { icon: 'account-voice', label: 'Announcements', sub: 'Tell your classes', route: 'StaffClassAnnouncements' },
    { icon: 'bullhorn-outline', label: 'Notice Board', sub: 'School updates', route: 'StaffNotices' },
    { icon: 'account-circle-outline', label: 'Profile', sub: 'Your details', route: 'StaffProfile' },
  ],
  driver: [
    { icon: 'map-marker-path', label: 'My Routine', sub: 'Shifts & students', route: 'MyRoutine' },
    { icon: 'bus-school', label: 'Transport', sub: 'Buses & routes', route: 'Transport' },
    { icon: 'calendar-account-outline', label: 'My Attendance', sub: 'Your record', route: 'StaffAttendance' },
    { icon: 'bag-suitcase-outline', label: 'Leave Request', sub: 'Apply for leave', route: 'Leaves' },
    { icon: 'cash-multiple', label: 'Salary', sub: 'Pay slips', route: 'Salary' },
    { icon: 'calendar-star', label: 'Holidays', sub: 'Days off', route: 'Holidays' },
    { icon: 'bullhorn-outline', label: 'Notice Board', sub: 'School updates', route: 'StaffNotices' },
    { icon: 'account-circle-outline', label: 'Profile', sub: 'Your details', route: 'StaffProfile' },
  ],
};

export const gridForRole = (role: string): HomeTile[] =>
  GRIDS[role === 'teacher' ? 'teacher' : role === 'driver' ? 'driver' : 'manager'];

export interface StaffHomeData {
  grid: HomeTile[];
  /** modules HQ may switch off for the school (features.ts) */
  hasFees: boolean;
  hasAttendance: boolean;
  me: AuthUser | null;
  isTopManager: boolean;
  today: StaffAttendanceRecord | null;
  notice: Notice | null;
  feeStats: FeeStats | null;
  payStats: TransactionStats | null;
  dashStats: DashboardStats | null;
  attStats: AttendanceStats | null;
  /** live second lines for the launchers, by label ("₹1,80,000 due", the latest notice…) */
  live: Record<string, string | null | undefined>;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  busyAtt: boolean;
  checkInOut: () => void;
}

export function useStaffHome(session: Session): StaffHomeData {
  const role = session.user_type;
  const isTopManager = ['admin', 'principal'].includes(role);
  // launchers of modules switched off for the school are left out (features.ts)
  const flags = featuresKey(session);
  const grid = useMemo(() => withFeatures(gridForRole(role), session), [role, flags]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasFees = hasFeature(session, 'fees');
  const hasAttendance = hasFeature(session, 'attendance');
  const { t } = useI18n();

  const [me, setMe] = useState<AuthUser | null>(() => peek<AuthUser>('/auth/me'));
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [feeStats, setFeeStats] = useState<FeeStats | null>(() => peek<FeeStats>('/fees/stats'));
  const [payStats, setPayStats] = useState<TransactionStats | null>(() => peek<TransactionStats>('/transactions/stats'));
  const [dashStats, setDashStats] = useState<DashboardStats | null>(() => peek<DashboardStats>('/dashboard/stats'));
  const [attStats, setAttStats] = useState<AttendanceStats | null>(() => peek<AttendanceStats>('/attendance/stats'));
  const [notice, setNotice] = useState<Notice | null>(() => peek<Notice[]>(LATEST_NOTICE)?.[0] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => peek('/auth/me') === null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAtt, setBusyAtt] = useState(false);

  const load = useCallback(async (r = false) => {
    r ? setRefreshing(true) : setLoading(peek('/auth/me') === null);
    refreshUpdates(); // red "new" dots (quiet; the first check at sign-in is App.tsx's)
    const meRequest = api<AuthUser>('/auth/me').then(setMe);
    // The ID card needs /auth/me; everything else fills in as it arrives.
    meRequest.finally(() => setLoading(false)).catch(() => {});
    const requests: Promise<unknown>[] = [
      meRequest,
      api<StaffAttendanceRecord | null>('/staff-attendance/today').then(setToday),
      api<Notice[]>(LATEST_NOTICE).then(ns => setNotice(ns?.[0] ?? null)),
    ];
    if (isTopManager) {
      requests.push(
        ...(hasFees ? [api<FeeStats>('/fees/stats').then(setFeeStats)] : []),
        ...(hasFees ? [api<TransactionStats>('/transactions/stats').then(setPayStats)] : []),
        api<DashboardStats>('/dashboard/stats').then(setDashStats),
        ...(hasAttendance ? [api<AttendanceStats>('/attendance/stats').then(setAttStats)] : []),
      );
    }
    const results = await Promise.allSettled(requests);
    const failed = results.find((x): x is PromiseRejectedResult => x.status === 'rejected');
    setError(failed ? errorText(failed.reason) : null);
    setRefreshing(false);
  }, [isTopManager, hasFees, hasAttendance]);
  useEffect(() => {
    load();
  }, [load]);
  useOnResume(() => load());
  useOnReturn(() => load());

  const checkInOut = useCallback(async () => {
    setBusyAtt(true);
    try {
      if (!today?.in_time) await api('/staff-attendance/check-in', { method: 'POST' });
      else if (!today?.out_time) await api('/staff-attendance/check-out', { method: 'POST' });
      setToday(await api('/staff-attendance/today'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyAtt(false);
    }
  }, [today]);

  const live: Record<string, string | null | undefined> = {
    'Notice Board': notice?.title,
    Fees: isTopManager && feeStats ? t('{amount} due', { amount: inr(feeStats.pending + feeStats.overdue) }) : null,
    Payments: isTopManager && payStats ? t('{amount} today', { amount: inr(payStats.today_collection) }) : null,
    Classes: isTopManager && dashStats?.students != null ? t('{n} students', { n: dashStats.students }) : null,
    Teachers: isTopManager && dashStats?.teachers != null ? t('{n} teachers', { n: dashStats.teachers }) : null,
    'Mark Attendance':
      isTopManager && attStats ? t('{present}/{marked} present', { present: attStats.present, marked: attStats.marked }) : null,
  };

  const refresh = useCallback(() => load(true), [load]);
  return {
    grid, hasFees, hasAttendance, me, isTopManager, today, notice, feeStats, payStats, dashStats, attStats, live,
    error, loading, refreshing, refresh, busyAtt, checkInOut,
  };
}
