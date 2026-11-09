// Central domain models + navigation contracts.
// Type-only module: safe to import from anywhere (erased at compile time).
import type { RouteName } from './routes';

/* ---------------------------------- auth --------------------------------- */

export type Role =
  | 'student'
  | 'teacher'
  | 'admin'
  | 'principal'
  | 'sub_admin'
  | 'coordinator'
  | 'driver';

/**
 * The signed-in user as the UI sees it. Tokens are NOT part of it — they live
 * in session.ts (access token in memory, refresh token in tokenStore.ts).
 */
export interface Session {
  user_id: number;
  full_name: string;
  user_type: Role;
  /** Brand color from the backend (e.g. "#BF40BF"). Optional — when missing
   *  or invalid, the role theme is used. */
  theme_color?: string | null;
  /** Server asks this user to pick a new password before using the app. */
  must_change_password?: boolean;
  /** The school (organisation) the account belongs to, e.g. "XYZPS" / "XYZ Public School". */
  org_code?: string;
  org_name?: string;
  /** Per-school feature flags set by EduManage HQ (features.ts); missing = older server = all on. */
  features?: Record<string, boolean>;
}

/** Body of POST /auth/login, /auth/refresh, /auth/reset-password, /auth/change-password. */
export interface AuthResponse {
  access_token: string;
  token_type?: string;
  /** Seconds until access_token expires. */
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  must_change_password?: boolean;
  user_id?: number;
  user_type?: Role;
  full_name?: string;
  theme_color?: string | null;
  /** The account's school; sent by servers that host several schools. */
  org_id?: number;
  org_code?: string;
  org_name?: string;
  /** Per-school feature flags (backend migration 0019); older servers leave it out. */
  features?: Record<string, boolean> | null;
}

/** GET /organisations/{code}: what the login screen shows for a school code. */
export interface SchoolInfo {
  code: string;
  name: string;
}

/* ------------------------------- navigation ------------------------------ */

export type RouteParams = { title?: string } & Record<string, any>;

export type NavigateFn = (route: RouteName, params?: RouteParams) => void;

/** Props injected into every routed screen by App.tsx. */
export interface ScreenProps {
  navigate: NavigateFn;
  goBack: () => void;
  params?: RouteParams;
  session: Session;
  onLogout: () => void;
}

/* --------------------------------- student ------------------------------- */

export interface StudentProfile {
  full_name: string;
  username?: string;
  photo_path?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  roll_no?: string | number | null;
  admission_no?: string | null;
  dob?: string | null;
  email?: string | null;
  phone?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_phone?: string | null;
  address?: string | null;
}

/** A file attached to a record (signed link — render it, never store it). */
export interface AttachmentFields {
  attachment_path?: string | null;
  attachment_name?: string | null;
  /** 'pdf' | 'image' (null on records without a file). */
  attachment_type?: FileKind | null;
}

export type FileKind = 'pdf' | 'image';

export interface Notice extends AttachmentFields {
  id: number;
  title: string;
  body: string;
  posted_by: string;
  created_at: string;
  /** 'school' = everyone, 'classes' = only `class_ids` (backend 0018; missing on older servers). */
  audience?: 'school' | 'classes';
  /** "Class 1, Class 2" / "Whole school"; class announcements: "Class 1 — A, B". */
  audience_label?: string | null;
  class_ids?: number[];
}

/** A teacher's announcement to sections they teach (backend 0018, /class-announcements). */
export interface ClassAnnouncement extends Notice {
  created_by?: number | null;
  recipients_count?: number;
  section_ids?: number[];
  posted_by_photo?: string | null;
}

/** A section the caller may post a class announcement to (GET /class-announcements/targets). */
export interface AnnouncementTarget {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  subjects: string | null;
  class_teacher: boolean;
  label: string;
}

/** The school shown in the student home header (part of /student/dashboard). */
export interface DashboardSchool {
  name: string;
  code: string;
  logo_path?: string | null;
  /** Academic session label, e.g. "2026-2027". */
  session: string;
}

export interface StudentDashboard {
  profile: StudentProfile;
  /** Newer servers only. */
  school?: DashboardSchool;
  attendance?: { percent: number | null };
  latest_notices?: Notice[];
  /** How many full-syllabus files the class has (newer servers, Nov 2026); > 0 shows the Full Syllabus launcher. */
  full_syllabus?: number;
}

/** GET /school — the School Info screen. */
export interface SchoolProfile {
  code: string;
  name: string;
  logo_path?: string | null;
  director_name?: string | null;
  principal_name?: string | null;
  affiliation_no?: string | null;
  phone?: string | null;
  tel?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  session_start_month: number;
  session: { label: string; start: string; end: string };
}

/** GET /student/announcements — the app-launch popup. */
export interface Announcement {
  id: number;
  title: string;
  body?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  created_at: string;
  images: { id: number; image_path: string }[];
}

export interface AttendanceMonth {
  year: number;
  month: number; // 1-12
  days: number;
  sundays: number;
  holidays: number;
  working_days: number;
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  percent: number | null;
}

/** GET /student/attendance/overview */
export interface AttendanceOverview {
  session: { label: string; start: string; end: string };
  totals: {
    working_days: number;
    present: number;
    absent: number;
    half_day: number;
    leave: number;
    holidays: number;
    percent: number | null;
  };
  /** Session start … this month, oldest first. */
  months: AttendanceMonth[];
}

export type AttendanceDayStatus = 'present' | 'absent' | 'leave' | 'half_day' | 'holiday' | 'sunday' | 'not_marked';

/** GET /student/attendance/month?year=&month= */
export interface AttendanceMonthDetail {
  year: number;
  month: number;
  days: { date: string; status: AttendanceDayStatus; holiday?: string | null }[];
  summary: { present: number; half_day: number; absent: number; leave: number; holiday: number; not_marked: number };
  working_days: number;
  percent: number | null;
}

/** GET /student/homework/subjects */
export interface HomeworkSubject {
  subject: string;
  count: number;
  last_given: string | null;
}

/** Timetable / syllabus file shared by the school. */
export interface SchoolDocument extends AttachmentFields {
  id: number;
  kind: 'timetable' | 'syllabus';
  title: string;
  note?: string | null;
  subject?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface SyllabusSubject {
  subject: string;
  documents: SchoolDocument[];
}

export interface EventMedia {
  id: number;
  kind: 'image' | 'video';
  media_path?: string | null;
  url?: string | null;
  caption?: string | null;
}

export interface SchoolEvent {
  id: number;
  title: string;
  description?: string | null;
  venue?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: 'upcoming' | 'completed';
  media: EventMedia[];
}

/** GET /student/transport (null when the child doesn't use school transport). */
export interface StudentTransport {
  vehicle_id: number;
  vehicle_no: string;
  vehicle_type: 'bus' | 'van' | 'other';
  route_name?: string | null;
  status: 'active' | 'maintenance';
  shift_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  driver_photo?: string | null;
  stop_name?: string | null;
  pickup_time?: string | null;
  drop_time?: string | null;
}

/** GET /driver/routine — one student on a driver's shift (stop_no = 1, 2, 3 … in stop order). */
export interface RoutineStudent {
  student_id: number;
  full_name: string;
  photo_path?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  roll_no?: string | null;
  stop_no: number;
  stop_time?: string | null;
  stop_name?: string | null;
  address?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_phone?: string | null;
  student_phone?: string | null;
}

/** GET /driver/routine — one trip of the driver's vehicle (`id` null = the vehicle's old single shift). */
export interface RoutineShift {
  key: string;
  id: number | null;
  name: string;
  trip_type: 'pickup' | 'drop';
  start_time?: string | null;
  end_time?: string | null;
  weekdays: number[];
  is_active: boolean;
  vehicle: {
    id: number;
    vehicle_no: string;
    vehicle_type: 'bus' | 'van' | 'other';
    route_name?: string | null;
    status: 'active' | 'maintenance';
    capacity?: number | null;
  };
  student_count: number;
  students: RoutineStudent[];
}

/** GET /driver/routine?date= — the signed-in driver's day. */
export interface DriverRoutine {
  date: string;
  weekday: number;
  is_today: boolean;
  server_time: string;
  holiday?: string | null;
  vehicles: RoutineShift['vehicle'][];
  shifts: RoutineShift[];
}

/** GET /student/teachers */
export interface SubjectTeacher {
  id: number;
  full_name: string;
  email?: string | null;
  photo_path?: string | null;
  designation?: string | null;
  qualification?: string | null;
  subjects: string[];
  is_class_teacher: boolean;
}

export interface AttendanceSummary {
  percent: number | null;
  present: number;
  absent: number;
  on_leave: number;
}

export interface AttendanceRecord {
  date: string;
  status: string;
}

export interface AttendanceResponse {
  summary?: AttendanceSummary;
  records?: AttendanceRecord[];
}

export interface HomeworkItem extends AttachmentFields {
  id: number;
  created_at?: string;
  title: string;
  note?: string | null;
  due_date: string;
  assigned_by: string;
  status: string;
  subject?: string | null;
  /** class = assigned to the whole section; student = old per-student entry. */
  scope?: 'class' | 'student';
  homework_id?: number | null;
}

/** One subject's result in a published exam (backend migration 0015). */
export interface ExamSubjectResult {
  subject: string;
  marks: number | null;
  max_marks: number | null;
  grade?: string | null;
  remarks?: string | null;
}

export interface Exam {
  id: number;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  results_published?: boolean;
  /** Whole-exam marks; when only subject marks were entered, the server sends their total here. */
  marks?: number | null;
  /** Out of (null = not set). */
  max_marks?: number | null;
  grade?: string | null;
  remarks?: string | null;
  /** Subject-wise marks (older servers: missing). */
  subjects?: ExamSubjectResult[];
  /** Sum of the subject marks entered, and of their maximums (null when unknown). */
  total?: number | null;
  max_total?: number | null;
}

export interface ReportCard {
  id: number;
  term: string;
  created_at: string;
  issued_by: string;
  grades?: string | Record<string, string | number> | null;
  remarks?: string | null;
}

export interface Remark {
  id: number;
  remark: string;
  /** /student/remarks: who wrote it and how they teach the child's section */
  by_name?: string;
  by_designation?: string | null;
  by_class_teacher?: boolean;
  by_subjects?: string[];
  photo_path?: string | null;
  /** /students/{id}/remarks (staff): who wrote it — they (or managers) may edit / delete it. */
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

/* ---------------------------------- fees --------------------------------- */

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | null;

export interface FeeRecord {
  id: number;
  title: string;
  amount: number;
  status: string;
  due_date?: string | null;
  paid_date?: string | null;
  method?: string | null;
  claim_status?: ClaimStatus;
  claim_review_note?: string | null;
}

export interface FeesResponse {
  totals: { paid: number; pending: number };
  records: FeeRecord[];
}

/* -------------------------------- calendar ------------------------------- */

export interface Holiday {
  id: number;
  date: string;
  name: string;
  description?: string | null;
}

export interface CalendarEvent {
  id: number;
  title: string;
  category: 'holiday' | 'exam' | 'event';
  dates: string[];
}

export interface CalendarExam {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  class_name?: string | null;
}

export interface CalendarPayload {
  events: CalendarEvent[];
  exams: CalendarExam[];
  holidays: Holiday[];
}

/* ------------------------------- timetable ------------------------------- */

export interface TimetableSlot {
  id: number;
  day: number;
  period: number;
  class_id: number;
  section_id: number;
  class_name: string;
  section_name: string;
  subject?: string | null;
  teacher_name?: string;
}

export interface SectionInfo {
  id: number;
  name: string;
}

export interface ClassInfo {
  id: number;
  name: string;
  sections: SectionInfo[];
  subjects?: string[];
}

/* ---------------------------------- staff -------------------------------- */

/** /auth/me — the logged-in staff member's account. */
export interface AuthUser {
  id: number;
  full_name: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
  user_type: Role;
  photo_path?: string | null;
  designation?: string | null;
}

/** Staff account row (teachers directory, staff users list). */
export interface StaffUser {
  id: number;
  full_name: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
  photo_path?: string | null;
  user_type?: Role;
  subject?: string | null;
  qualification?: string | null;
  joining_date?: string | null;
  address?: string | null;
  designation?: string | null;
  lesson_plan_count?: number;
}

/** A teacher ↔ class-section assignment. */
export interface Assignment {
  id: number;
  class_id: number;
  section_id: number;
  class_name: string;
  section_name: string;
  subject?: string | null;
  role: 'class_teacher' | 'subject_teacher' | string;
  student_count?: number;
}

/** Section row in the admin classes list (adds counts to SectionInfo). */
export interface AdminSection extends SectionInfo {
  student_count?: number;
  class_teacher?: string | null;
}

/** Class row in the admin classes list. */
export interface AdminClass {
  id: number;
  name: string;
  fee_amount?: number | null;
  subjects?: string[];
  sections: AdminSection[];
}

export interface StudentListItem {
  id: number;
  full_name: string;
  class_id?: number | null;
  section_id?: number | null;
  photo_path?: string | null;
  roll_no?: string | number | null;
  class_name?: string | null;
  section_name?: string | null;
  guardian_phone?: string | null;
}

/* ------------------------------ staff: exams ------------------------------ */

export interface ExamClassSummary {
  id: number;
  name: string;
  student_count: number;
  subject_count: number;
  paper_count: number;
}

export interface AdminExam {
  id: number;
  name: string;
  status: string;
  class_name?: string | null;
  start_date: string;
  end_date: string;
  results_published?: boolean;
  paper_count?: number;
  classes?: ExamClassSummary[];
  sections?: ExamSectionSummary[];
}

export interface ExamSectionSummary {
  id: number;
  name: string;
  class_id: number;
  class_name: string;
  student_count: number;
}

/** GET /exams/{id}/results/sheet — every subject's marks for one section (Nov 2026). */
export interface ResultsSheet {
  exam: { id: number; name: string; status: string; results_published: boolean | number; max_marks: number | null };
  section: { id: number; class_id: number; class_name?: string; section_name?: string };
  subjects: { name: string; max_marks: number | null }[];
  students: {
    student_id: number;
    full_name: string;
    photo_path?: string | null;
    roll_no?: string | null;
    admission_no?: string | null;
    /** subject → marks, 'AB' (absent) or null (not entered) */
    marks: Record<string, number | 'AB' | null>;
    remarks?: string | null;
    total: number | null;
    max_total: number | null;
    percentage: number | null;
  }[];
  /** Class teacher of the section, or managers: may download the Excel template and upload it. */
  can_import: boolean;
}

export interface ResultsImportReport {
  saved: boolean;
  students: number;
  marks: number;
  absent: number;
  remarks: number;
  /** the maximum typed in the upload form */
  max_marks?: number;
  /** a successful upload publishes the exam's results */
  published?: boolean;
  subjects: string[];
}

/* ------------------------- performance report (Nov 2026) ------------------------- */

export interface PerfExam {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  obtained: number;
  max_total: number;
  percentage: number;
  grade: string | null;
  class_average: number | null;
  class_highest: number | null;
  rank: number | null;
  class_size: number;
}

export interface PerfSubjectExam {
  exam_id: number;
  exam: string;
  marks: number | null;
  max_marks: number;
  absent: boolean;
  percentage: number | null;
  grade: string | null;
  class_average: number | null;
}

export interface PerfSubject {
  subject: string;
  obtained: number;
  max_total: number;
  percentage: number | null;
  grade: string | null;
  class_average: number | null;
  class_highest: number | null;
  vs_class: number | null;
  rank: number | null;
  class_size: number;
  /** last exam % − first exam % (null with fewer than 2 exams) */
  trend: number | null;
  exams: PerfSubjectExam[];
}

export interface PerfInsight {
  kind: 'strongest' | 'focus' | 'above_average' | 'below_average' | 'improved' | 'trend_up' | 'trend_down' | string;
  title: string;
  text: string;
  subject?: string;
}

/** GET /student/performance */
export interface PerformanceReport {
  session: { label: string; start: string; end: string };
  grades: { min: number; grade: string }[];
  overall: {
    obtained: number;
    max_total: number;
    percentage: number | null;
    grade: string | null;
    rank: number | null;
    class_size: number;
    class_average: number | null;
    vs_class: number | null;
    exams_count: number;
    subjects_count: number;
  } | null;
  exams: PerfExam[];
  subjects: PerfSubject[];
  insights: PerfInsight[];
}

export interface ExamStats {
  upcoming: number;
  ongoing: number;
  completed: number;
}

export interface ExamPaper {
  id: number;
  subject: string;
  paper_name: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface ExamPapersResponse {
  exam?: { name: string };
  class?: { name: string };
  subjects: { subject: string; paper: ExamPaper | null }[];
}

/* ------------------------------ staff: fees ------------------------------- */

export interface FeeStats {
  total: number;
  collected: number;
  pending: number;
  overdue: number;
  collection_rate: number;
}

/** /dashboard/stats — school-wide counters for admin/principal. */
export interface DashboardStats {
  students: number;
  teachers: number;
}

/** /attendance/stats — today's marking progress. */
export interface AttendanceStats {
  present: number;
  marked: number;
}

export interface ClaimStats {
  pending: number;
  approved: number;
}

export interface AdminFee {
  id: number;
  student_name: string;
  title: string;
  class_name?: string | null;
  section_name?: string | null;
  amount: number;
  status: string;
  effective_status?: string;
  paid_date?: string | null;
}

export interface FeeClaim {
  id: number;
  student_name: string;
  photo_path?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  fee_title: string;
  amount?: number | null;
  fee_amount?: number | null;
  status: string;
  method: string;
  reference_no?: string | null;
  note?: string | null;
  screenshot_path?: string | null;
  reviewed_by_name?: string | null;
  review_note?: string | null;
  created_at: string;
}

/* --------------------------- staff: transactions -------------------------- */

export interface Transaction {
  id: number;
  reference: string;
  status: string;
  student_name?: string | null;
  fee_title?: string | null;
  amount: number;
  method: string;
  created_at: string;
}

export interface TransactionStats {
  today_collection: number;
  month_collection: number;
  total_transactions: number;
  success_rate: number;
}

/* ------------------------- staff: HR & operations ------------------------- */

export interface LeaveRequest {
  id: number;
  user_id?: number;
  full_name?: string;
  photo_path?: string | null;
  user_type?: Role;
  status: string;
  from_date: string;
  to_date: string;
  reason: string;
  reviewed_by_name?: string | null;
  review_note?: string | null;
  created_at?: string;
  /** Periods the teacher teaches during the leave and how many are covered. */
  coverage?: { periods: number; covered: number; pending: number } | null;
  /** Substitution requests linked to this leave (GET /leaves/{id}). */
  substitutions?: SubstitutionRequest[];
}

/* ------------------------------ substitution ------------------------------ */

export type SubstitutionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'withdrawn' | 'filled';

/** A request to one teacher to take one period on one date. */
export interface SubstitutionRequest {
  id: number;
  leave_id?: number | null;
  date: string;
  /** Weekday, Monday = 0 (same as timetable slots). */
  day?: number;
  period: number;
  start_time?: string | null;
  end_time?: string | null;
  class_id: number;
  section_id: number;
  class_name: string;
  section_name: string;
  subject?: string | null;
  requester_id: number;
  requester_name: string;
  requester_photo?: string | null;
  substitute_id: number;
  substitute_name: string;
  substitute_photo?: string | null;
  status: SubstitutionStatus;
  note?: string | null;
  response_note?: string | null;
  responded_at?: string | null;
  created_at?: string;
  /** Server says the substitute may still undo an accepted request. */
  can_withdraw?: boolean;
}

export interface AvailableTeacher {
  teacher_id: number;
  full_name: string;
  photo_path?: string | null;
  subject?: string | null;
}

/** One period the leaving teacher teaches on a date, with who could cover it. */
export interface AvailabilityPeriod {
  period: number;
  start_time?: string | null;
  end_time?: string | null;
  slot: { id: number; class_id: number; section_id: number; class_name: string; section_name: string; subject?: string | null };
  /** Requests already sent for this date + period (any status). */
  requests: SubstitutionRequest[];
  available: AvailableTeacher[];
}

export interface AvailabilityDay {
  date: string;
  day: number;
  /** Holiday name — nothing to cover that day. */
  holiday?: string | null;
  periods: AvailabilityPeriod[];
}

export interface SubstituteAvailability {
  days: AvailabilityDay[];
}

/* ------------------------------ school timings ---------------------------- */

export interface SchoolBreak {
  after_period: number;
  minutes: number;
  label?: string | null;
}

export interface PeriodTime {
  period: number;
  start: string;
  end: string;
}

/** GET/PUT /settings/school-timings. Times are 24h "HH:MM". */
export interface SchoolTimings {
  start_time: string;
  prayer_minutes: number;
  period_minutes: number;
  periods_per_day: number;
  breaks: SchoolBreak[];
  /** Computed by the server (read-only). */
  periods?: PeriodTime[];
  updated_at?: string | null;
  updated_by_name?: string | null;
}

/** GET /timetable/week — the weekly template plus date-specific changes. */
export interface WeekSubstitution {
  id: number;
  date: string;
  day: number;
  period: number;
  class_name: string;
  section_name: string;
  subject?: string | null;
  /** covering: I teach someone else's class · covered: someone teaches mine. */
  kind: 'covering' | 'covered';
  other_teacher_name: string;
  status: SubstitutionStatus;
}

export interface TimetableWeek {
  start: string;
  end: string;
  days: { date: string; day: number; holiday?: string | null; on_leave?: boolean }[];
  slots: TimetableSlot[];
  substitutions: WeekSubstitution[];
}

/* ------------------------------ notifications ----------------------------- */

export interface AppNotification {
  id: number;
  /** attendance | fee | notice | homework | leave | substitution_request | substitution_update */
  type: string;
  title: string;
  body?: string | null;
  /** Where tapping it goes: a route from routes.ts + its params. */
  data?: { route?: string; params?: Record<string, unknown> } | null;
  read_at?: string | null;
  created_at: string;
}

/* ------------------------------ class homework ---------------------------- */

export interface ClassHomework {
  id: number;
  class_id: number;
  section_id: number;
  class_name?: string;
  section_name?: string;
  subject?: string | null;
  title: string;
  note?: string | null;
  due_date?: string | null;
  assigned_by?: string | null;
  created_at?: string;
  counts?: { total: number; submitted: number; pending: number; late: number } | null;
}

export interface HomeworkSubmission {
  student_id: number;
  full_name: string;
  roll_no?: string | number | null;
  photo_path?: string | null;
  status: 'pending' | 'submitted' | 'late' | string;
}

export interface SalaryRecord {
  id: number;
  month: number;
  year: number;
  amount: number;
  status: string;
  note?: string | null;
  full_name?: string;
  user_type?: Role;
}

export interface StaffAttendanceRecord {
  id: number;
  date: string;
  in_time?: string | null;
  out_time?: string | null;
  full_name?: string;
  photo_path?: string | null;
  user_type?: Role;
}

export interface LessonPlan {
  id: number;
  heading: string;
  class_name: string;
  section_name?: string | null;
  teacher_name?: string;
  duration_start?: string | null;
  duration_end?: string | null;
  final_remark?: string | null;
  files?: unknown[];
}

export interface Vehicle {
  id: number;
  vehicle_no: string;
  driver_name: string;
  driver_phone?: string | null;
  route_name?: string | null;
  capacity?: number | null;
  status: string;
}

export interface VehicleStats {
  total: number;
  active: number;
  routes: number;
}

export interface Enquiry {
  id: number;
  student_name: string;
  parent_name: string;
  contact: string;
  class_interested?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
}

export interface EnquiryStats {
  today: number;
  pending: number;
  converted: number;
}

export interface SmsLog {
  id: number;
  recipient_group: string;
  message: string;
  status: string;
  recipients_count: number;
  created_at: string;
}

/** Row while marking a section's attendance. */
export interface MarkAttendanceRow {
  student_id: number;
  full_name: string;
  roll_no?: string | number | null;
  status: string;
}

/** A pickable class-section in the attendance marker. */
export interface SectionPick {
  classId: number;
  sectionId: number;
  label: string;
}

/* ---------------------------------- misc --------------------------------- */

/** Asset returned by react-native-image-picker. */
export interface PickedImage {
  uri?: string;
  fileName?: string | null;
  type?: string | null;
}

/** File returned by @react-native-documents/picker (trimmed to what we upload). */
export interface PickedDocument {
  uri: string;
  name?: string | null;
  type?: string | null;
}
