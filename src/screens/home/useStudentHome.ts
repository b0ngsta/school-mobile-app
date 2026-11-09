// Student home — everything both home UIs share: the launcher list, the data
// (dashboard + fees, cached via peek), pull-to-refresh, and the quiet reloads
// on app resume / coming back to the home (each also re-checks the red
// "new" dots, updates.ts). The UI files
// (HomeStudent.default.tsx, HomeStudent.creative.tsx) only draw it.
import { useCallback, useEffect, useState } from 'react';
import { api, errorText, peek } from '../../api';
import type { GridItem } from '../../components/ui';
import { useOnResume, useOnReturn } from '../../hooks';
import type { FeesResponse, NavigateFn, StudentDashboard } from '../../types';
import { refreshUpdates } from '../../updates';

/** A home launcher entry: the route plus a short subtitle (orbit card / tile caption). */
export type HomeTile = GridItem & { sub: string };

/** Every screen a student can open from home — same list and order in both themes. */
export const STUDENT_MENU: HomeTile[] = [
  { icon: 'calendar-check', label: 'Attendance', sub: 'Daily record', route: 'Attendance' },
  { icon: 'currency-inr', label: 'Fees', sub: 'Pay & receipts', route: 'Fees' },
  { icon: 'book-open-variant', label: 'Homework', sub: 'Tasks to finish', route: 'Homework' },
  { icon: 'clock-outline', label: 'Time table', sub: 'Your schedule', route: 'StudentTimetable' },
  { icon: 'bullhorn-outline', label: 'Notice Board', sub: 'School updates', route: 'Notices' },
  { icon: 'party-popper', label: 'Events', sub: 'School events', route: 'Events' },
  { icon: 'message-text-outline', label: 'Message', sub: 'From teachers', route: 'Messages' },
  { icon: 'bus-school', label: 'Transport', sub: 'Bus & driver', route: 'MyTransport' },
  { icon: 'calendar-star', label: 'Holidays', sub: 'Days off', route: 'Holidays' },
  { icon: 'account-tie', label: 'Subject Teacher', sub: 'Your teachers', route: 'SubjectTeachers' },
  { icon: 'book-education-outline', label: 'Syllabus', sub: 'Subject syllabus', route: 'Syllabus' },
  { icon: 'school', label: 'Exam Result', sub: 'Marks & results', route: 'Exams' },
  { icon: 'chart-box-outline', label: 'Performance Report', sub: 'Track progress', route: 'ReportCards' },
  // HIDDEN for now (Oct 2026) — Remarks is switched off in the student portal. To bring it back,
  // uncomment this line, the two Remarks lines in routes.ts and its colour in HomeStudent.default.tsx.
  // { icon: 'comment-quote-outline', label: 'Remarks', sub: 'Teacher remarks', route: 'Remarks' },
  // School Info has no tile: it opens from the school header on the home (both themes).
  { icon: 'account-circle-outline', label: 'Profile', sub: 'Your details', route: 'Profile' },
];

/** Shown after Syllabus only when the class has a full syllabus (dashboard `full_syllabus` > 0, Nov 2026). */
export const FULL_SYLLABUS_TILE: HomeTile = {
  icon: 'book-multiple', label: 'Full Syllabus', sub: 'All subjects', route: 'FullSyllabus',
};

/** The launcher list for this student: STUDENT_MENU (+ Full Syllabus when the class has one). */
export function studentMenu(dash: StudentDashboard | null): HomeTile[] {
  if (!dash?.full_syllabus) return STUDENT_MENU;
  const at = STUDENT_MENU.findIndex(m => m.route === 'Syllabus') + 1;
  return [...STUDENT_MENU.slice(0, at), FULL_SYLLABUS_TILE, ...STUDENT_MENU.slice(at)];
}

export type RouteArg = Parameters<NavigateFn>[0];

export interface StudentHomeData {
  dash: StudentDashboard | null;
  fees: FeesResponse | null;
  error: string | null;
  /** Nothing cached to show yet. */
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh. */
  refresh: () => void;
}

export function useStudentHome(): StudentHomeData {
  const [dash, setDash] = useState<StudentDashboard | null>(() => peek<StudentDashboard>('/student/dashboard'));
  const [fees, setFees] = useState<FeesResponse | null>(() => peek<FeesResponse>('/student/fees'));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => peek('/student/dashboard') === null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = false) => {
    // With a cached dashboard the screen stays up while fresh data loads.
    r ? setRefreshing(true) : setLoading(peek('/student/dashboard') === null);
    refreshUpdates(); // red "new" dots (quiet; the first check at sign-in is App.tsx's)
    try {
      setDash(await api<StudentDashboard>('/student/dashboard'));
      api<FeesResponse>('/student/fees').then(setFees).catch(() => {});
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useOnResume(() => load());
  useOnReturn(() => load());

  const refresh = useCallback(() => load(true), [load]);
  return { dash, fees, error, loading, refreshing, refresh };
}
