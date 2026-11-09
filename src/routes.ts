// Central route registry. Navigation is GRID-ONLY (like the mockups):
// each role has a home screen with a tile grid; everything else is pushed
// on the stack via navigate(route, params).
import Attendance from './screens/Attendance';
import Exams from './screens/Exams';
import Fees from './screens/Fees';
import Holidays from './screens/Holidays';
import HomeStudent from './screens/HomeStudent';
import Homework from './screens/Homework';
import Notices from './screens/Notices';
import Notifications from './screens/Notifications';
import Profile from './screens/Profile';
// HIDDEN (Remarks switched off for students, Oct 2026) — uncomment to re-enable:
// import Remarks from './screens/Remarks';
// ReportCards route = the Performance Report (Nov 2026); the old list (screens/ReportCards.tsx) is kept for reference
import PerformanceReport from './screens/portal/PerformanceReport';
import StudentTimetable from './screens/StudentTimetable';
import ChangePassword from './screens/auth/ChangePassword';
import FileViewer from './screens/FileViewer';
import { themedScreen } from './screens/themed';
// student portal (screens/portal/): detail and new screens
import AttendanceMonth from './screens/portal/AttendanceMonth';
import Events from './screens/portal/Events';
import FullSyllabus from './screens/portal/FullSyllabus';
import HomeworkSubject from './screens/portal/HomeworkSubject';
import HomeworkSubjects from './screens/portal/HomeworkSubjects';
import MessageDetail from './screens/portal/MessageDetail';
import Messages from './screens/portal/Messages';
import MyTransport from './screens/portal/MyTransport';
import NoticeDetail from './screens/portal/NoticeDetail';
import SchoolInfo from './screens/portal/SchoolInfo';
import SubjectTeachers from './screens/portal/SubjectTeachers';
import Syllabus from './screens/portal/Syllabus';
import SyllabusSubject from './screens/portal/SyllabusSubject';
import TimetableFiles from './screens/portal/TimetableFiles';

import BulkSMS from './screens/staff/BulkSMS';
import ClassHomework from './screens/staff/ClassHomework';
import ExamPapers from './screens/staff/ExamPapers';
import ExamResultsSheet from './screens/staff/ExamResultsSheet';
import FeeClaims from './screens/staff/FeeClaims';
import FeesAdmin from './screens/staff/FeesAdmin';
import HomeStaff from './screens/staff/HomeStaff';
import HomeworkSubmissions from './screens/staff/HomeworkSubmissions';
import Leaves from './screens/staff/Leaves';
import LessonPlans from './screens/staff/LessonPlans';
import MarkAttendance from './screens/staff/MarkAttendance';
import MyClasses from './screens/staff/MyClasses';
import MyTimetable from './screens/staff/MyTimetable';
import Payments from './screens/staff/Payments';
import Reception from './screens/staff/Reception';
import Salary from './screens/staff/Salary';
import SchoolTimings from './screens/staff/SchoolTimings';
import SectionStudents from './screens/staff/SectionStudents';
import StaffAttendance from './screens/staff/StaffAttendance';
import StaffClasses from './screens/staff/StaffClasses';
import StaffExamDetail from './screens/staff/StaffExamDetail';
import StaffExams from './screens/staff/StaffExams';
import StaffNotices from './screens/staff/StaffNotices';
import StaffProfile from './screens/staff/StaffProfile';
import StaffSyllabus from './screens/staff/StaffSyllabus';
import StudentDetail from './screens/staff/StudentDetail';
import Substitutions from './screens/staff/Substitutions';
import Teachers from './screens/staff/Teachers';
import TeacherProfile from './screens/staff/TeacherProfile';
import Transport from './screens/staff/Transport';
import Users from './screens/staff/Users';
// driver
import MyRoutine from './screens/driver/MyRoutine';

import type { ComponentType } from 'react';
import type { ScreenTransition } from './components/ScreenStack';
import type { Role, ScreenProps } from './types';

export interface ScreenEntry {
  component: ComponentType<ScreenProps>;
  title?: string;
  titleKey?: string;
  /** Animate this screen in and back out (components/ScreenStack); omit to switch instantly. */
  transition?: ScreenTransition;
  /** The screen draws its own header (components/portal PortalHeader) — no app top bar. */
  ownHeader?: boolean;
}

// Student screens go through the UI-theme switcher (screens/themed.tsx,
// Profile → Theme): `themedScreen({ default, creative? })` renders the file for
// the active theme. HomeStudent's switcher lives in screens/HomeStudent.tsx
// (default + creative files in screens/home/). The rest only have their
// default file so far and fall back to it under the creative theme — add a
// `<Name>.creative.tsx` (+ a shared hook for its data) and list it here.
const Student = {
  Homework: themedScreen({ default: Homework }, 'Homework'),
  Attendance: themedScreen({ default: Attendance }, 'Attendance'),
  Exams: themedScreen({ default: Exams }, 'Exams'),
  ReportCards: themedScreen({ default: PerformanceReport }, 'ReportCards'),
  Fees: themedScreen({ default: Fees }, 'Fees'),
  // HIDDEN: Remarks: themedScreen({ default: Remarks }, 'Remarks'),
  Notices: themedScreen({ default: Notices }, 'Notices'),
  Profile: themedScreen({ default: Profile }, 'Profile'),
  StudentTimetable: themedScreen({ default: TimetableFiles }, 'StudentTimetable'),
  WeeklyTimetable: themedScreen({ default: StudentTimetable }, 'WeeklyTimetable'),
  Holidays: themedScreen({ default: Holidays }, 'Holidays'),
  Notifications: themedScreen({ default: Notifications }, 'Notifications'),
  AttendanceMonth: themedScreen({ default: AttendanceMonth }, 'AttendanceMonth'),
  HomeworkSubjects: themedScreen({ default: HomeworkSubjects }, 'HomeworkSubjects'),
  HomeworkSubject: themedScreen({ default: HomeworkSubject }, 'HomeworkSubject'),
  NoticeDetail: themedScreen({ default: NoticeDetail }, 'NoticeDetail'),
  Events: themedScreen({ default: Events }, 'Events'),
  Messages: themedScreen({ default: Messages }, 'Messages'),
  MessageDetail: themedScreen({ default: MessageDetail }, 'MessageDetail'),
  MyTransport: themedScreen({ default: MyTransport }, 'MyTransport'),
  SubjectTeachers: themedScreen({ default: SubjectTeachers }, 'SubjectTeachers'),
  Syllabus: themedScreen({ default: Syllabus }, 'Syllabus'),
  SyllabusSubject: themedScreen({ default: SyllabusSubject }, 'SyllabusSubject'),
  FullSyllabus: themedScreen({ default: FullSyllabus }, 'FullSyllabus'),
  SchoolInfo: themedScreen({ default: SchoolInfo }, 'SchoolInfo'),
};

// titleKey is looked up in src/i18n.ts; `title` is a plain string.
export const SCREENS = {
  // ---- home launchers ----
  HomeStudent: { component: HomeStudent, title: 'Home' },
  HomeStaff: { component: HomeStaff, title: 'Home' },

  // ---- student (parent) ----  (ownHeader: the screen draws the portal header itself)
  Homework: { component: Student.Homework, titleKey: 'title.Homework', ownHeader: true },
  HomeworkSubjects: { component: Student.HomeworkSubjects, title: 'Select Subject', ownHeader: true },
  HomeworkSubject: { component: Student.HomeworkSubject, title: 'Homework List', ownHeader: true },
  Attendance: { component: Student.Attendance, titleKey: 'title.Attendance', ownHeader: true },
  AttendanceMonth: { component: Student.AttendanceMonth, title: 'Monthly Attendance', ownHeader: true },
  Exams: { component: Student.Exams, titleKey: 'title.Exams' },
  ReportCards: { component: Student.ReportCards, titleKey: 'title.ReportCards', ownHeader: true },
  Fees: { component: Student.Fees, titleKey: 'title.Fees' },
  // HIDDEN: Remarks: { component: Student.Remarks, titleKey: 'title.Remarks' },
  Notices: { component: Student.Notices, titleKey: 'title.Notices', ownHeader: true },
  NoticeDetail: { component: Student.NoticeDetail, title: 'Notice Board', ownHeader: true },
  Profile: { component: Student.Profile, titleKey: 'title.Profile', transition: 'fadeScale' },
  StudentTimetable: { component: Student.StudentTimetable, title: 'Time Table', ownHeader: true },
  WeeklyTimetable: { component: Student.WeeklyTimetable, title: 'Class timetable' },
  Events: { component: Student.Events, title: 'Events', ownHeader: true },
  Messages: { component: Student.Messages, title: 'Messages', ownHeader: true },
  MessageDetail: { component: Student.MessageDetail, title: 'Message Details', ownHeader: true },
  MyTransport: { component: Student.MyTransport, title: 'Transport', ownHeader: true },
  SubjectTeachers: { component: Student.SubjectTeachers, title: 'Subject Teachers', ownHeader: true },
  Syllabus: { component: Student.Syllabus, title: 'Syllabus', ownHeader: true },
  SyllabusSubject: { component: Student.SyllabusSubject, title: 'Syllabus', ownHeader: true },
  FullSyllabus: { component: Student.FullSyllabus, title: 'Full Syllabus', ownHeader: true },
  SchoolInfo: { component: Student.SchoolInfo, title: 'School Info', ownHeader: true, transition: 'fadeScale' },

  // ---- shared ----
  Holidays: { component: Student.Holidays, title: 'Holidays', ownHeader: true },
  FileViewer: { component: FileViewer, title: 'View file', ownHeader: true },
  ChangePassword: { component: ChangePassword, title: 'Change password' },
  Notifications: { component: Student.Notifications, title: 'Notifications' },

  // ---- staff ----
  StaffClasses: { component: StaffClasses, title: 'Classes' },
  MyClasses: { component: MyClasses, title: 'My Classes' },
  SectionStudents: { component: SectionStudents, title: 'Students' },
  StudentDetail: { component: StudentDetail, title: 'Student' },
  MarkAttendance: { component: MarkAttendance, titleKey: 'title.Attendance' },
  StaffExams: { component: StaffExams, titleKey: 'title.Exams' },
  StaffExamDetail: { component: StaffExamDetail, title: 'Exam' },
  ExamPapers: { component: ExamPapers, title: 'Question papers' },
  ExamResultsSheet: { component: ExamResultsSheet, title: 'Results' },
  StaffSyllabus: { component: StaffSyllabus, title: 'Syllabus' },
  FeesAdmin: { component: FeesAdmin, titleKey: 'title.Fees' },
  FeeClaims: { component: FeeClaims, title: 'Fee claims' },
  LessonPlans: { component: LessonPlans, title: 'Lesson plans' },
  Transport: { component: Transport, title: 'Transport' },
  Payments: { component: Payments, title: 'Payments' },
  Users: { component: Users, title: 'Staff users' },
  Reception: { component: Reception, title: 'Reception' },
  BulkSMS: { component: BulkSMS, title: 'Bulk SMS' },
  StaffNotices: { component: StaffNotices, titleKey: 'title.Notices' },
  StaffProfile: { component: StaffProfile, titleKey: 'title.Profile', transition: 'fadeScale' },
  Teachers: { component: Teachers, title: 'Teachers' },
  TeacherProfile: { component: TeacherProfile, title: 'Teacher' },
  MyTimetable: { component: MyTimetable, title: 'My timetable' },
  Leaves: { component: Leaves, title: 'Leave requests' },
  Salary: { component: Salary, title: 'Salary' },
  StaffAttendance: { component: StaffAttendance, title: 'My attendance' },
  Substitutions: { component: Substitutions, title: 'Substitute requests' },
  SchoolTimings: { component: SchoolTimings, title: 'School timings' },
  ClassHomework: { component: ClassHomework, title: 'Class homework' },
  HomeworkSubmissions: { component: HomeworkSubmissions, title: 'Submissions' },

  // ---- driver ----
  MyRoutine: { component: MyRoutine, title: 'My Routine', ownHeader: true },
} satisfies Record<string, ScreenEntry>;

export type RouteName = keyof typeof SCREENS;

export { MANAGER_ROLES } from './roles';

export function homeForRole(role: Role): RouteName {
  return role === 'student' ? 'HomeStudent' : 'HomeStaff';
}
