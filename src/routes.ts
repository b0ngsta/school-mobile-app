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
import Remarks from './screens/Remarks';
import ReportCards from './screens/ReportCards';
import StudentTimetable from './screens/StudentTimetable';
import ChangePassword from './screens/auth/ChangePassword';

import BulkSMS from './screens/staff/BulkSMS';
import ClassHomework from './screens/staff/ClassHomework';
import ExamPapers from './screens/staff/ExamPapers';
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
import StudentDetail from './screens/staff/StudentDetail';
import Substitutions from './screens/staff/Substitutions';
import Teachers from './screens/staff/Teachers';
import TeacherProfile from './screens/staff/TeacherProfile';
import Transport from './screens/staff/Transport';
import Users from './screens/staff/Users';

import type { ComponentType } from 'react';
import type { ScreenTransition } from './components/ScreenStack';
import type { Role, ScreenProps } from './types';

export interface ScreenEntry {
  component: ComponentType<ScreenProps>;
  title?: string;
  titleKey?: string;
  /** Animate this screen in and back out (components/ScreenStack); omit to switch instantly. */
  transition?: ScreenTransition;
}

// titleKey is looked up in src/i18n.ts; `title` is a plain string.
export const SCREENS = {
  // ---- home launchers ----
  HomeStudent: { component: HomeStudent, title: 'Home' },
  HomeStaff: { component: HomeStaff, title: 'Home' },

  // ---- student (parent) ----
  Homework: { component: Homework, titleKey: 'title.Homework' },
  Attendance: { component: Attendance, titleKey: 'title.Attendance' },
  Exams: { component: Exams, titleKey: 'title.Exams' },
  ReportCards: { component: ReportCards, titleKey: 'title.ReportCards' },
  Fees: { component: Fees, titleKey: 'title.Fees' },
  Remarks: { component: Remarks, titleKey: 'title.Remarks' },
  Notices: { component: Notices, titleKey: 'title.Notices' },
  Profile: { component: Profile, titleKey: 'title.Profile', transition: 'fadeScale' },
  StudentTimetable: { component: StudentTimetable, title: 'Time table' },

  // ---- shared ----
  Holidays: { component: Holidays, title: 'Holidays' },
  ChangePassword: { component: ChangePassword, title: 'Change password' },
  Notifications: { component: Notifications, title: 'Notifications' },

  // ---- staff ----
  StaffClasses: { component: StaffClasses, title: 'Classes' },
  MyClasses: { component: MyClasses, title: 'My Classes' },
  SectionStudents: { component: SectionStudents, title: 'Students' },
  StudentDetail: { component: StudentDetail, title: 'Student' },
  MarkAttendance: { component: MarkAttendance, titleKey: 'title.Attendance' },
  StaffExams: { component: StaffExams, titleKey: 'title.Exams' },
  StaffExamDetail: { component: StaffExamDetail, title: 'Exam' },
  ExamPapers: { component: ExamPapers, title: 'Question papers' },
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
} satisfies Record<string, ScreenEntry>;

export type RouteName = keyof typeof SCREENS;

export { MANAGER_ROLES } from './roles';

export function homeForRole(role: Role): RouteName {
  return role === 'student' ? 'HomeStudent' : 'HomeStaff';
}
