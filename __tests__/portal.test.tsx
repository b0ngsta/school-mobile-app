/**
 * Student portal screens (School Info, Attendance, Homework, Time Table,
 * Notice Board, Events, Messages, Transport, Holidays, Subject Teachers,
 * Syllabus, FileViewer, launch popup): they render realistic API data, call
 * the right endpoints and open the common FileViewer for attachments.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text } from 'react-native';

const calls: { path: string; opts?: any }[] = [];
const fixtures: Record<string, unknown> = {};
/** Longest matching fixture prefix wins ('/student/homework/subjects' over '/student/homework'). */
const fixtureFor = (path: string) => {
  const key = Object.keys(fixtures).filter(k => path.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return key ? fixtures[key] : undefined;
};

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string, opts?: any) => {
      calls.push({ path, opts });
      const v = fixtureFor(path);
      return v === undefined ? {} : v;
    }),
    apiPage: jest.fn(async (path: string) => {
      calls.push({ path });
      const items = (fixtureFor(path) ?? []) as unknown[];
      return { items, total: items.length };
    }),
    logout: jest.fn(async () => {}),
  };
});

import { ProgressRing } from '../src/components/portal';
import LaunchPopup, { resetLaunchPopup } from '../src/components/LaunchPopup';
import { fileKind, openFile } from '../src/components/files';
import Attendance from '../src/screens/Attendance';
import FileViewer from '../src/screens/FileViewer';
import Holidays from '../src/screens/Holidays';
import Homework from '../src/screens/Homework';
import Notices from '../src/screens/Notices';
import AttendanceMonth from '../src/screens/portal/AttendanceMonth';
import Events from '../src/screens/portal/Events';
import HomeworkSubjects from '../src/screens/portal/HomeworkSubjects';
import HomeworkSubject from '../src/screens/portal/HomeworkSubject';
import Remarks from '../src/screens/Remarks';
import MyTransport from '../src/screens/portal/MyTransport';
import NoticeDetail from '../src/screens/portal/NoticeDetail';
import SchoolInfo from '../src/screens/portal/SchoolInfo';
import SubjectTeachers from '../src/screens/portal/SubjectTeachers';
import Syllabus from '../src/screens/portal/Syllabus';
import TimetableFiles from '../src/screens/portal/TimetableFiles';
import { SCREENS } from '../src/routes';
import type { ScreenEntry } from '../src/routes';
import type { ScreenProps, Session } from '../src/types';

const student: Session = { user_id: 5, full_name: 'Dimpal', user_type: 'student', org_code: 'RAJCHU1354',
  org_name: 'TRM Public School Binasar' };
const props = (params?: any): ScreenProps => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  onLogout: jest.fn(),
  session: student,
  params,
});

type Tree = ReactTestRenderer.ReactTestRenderer;
const texts = (tree: Tree) =>
  tree.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join('') : String(c ?? '');
  }).join(' | ');
const pressable = (tree: Tree, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

async function render(el: React.ReactElement) {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  await ReactTestRenderer.act(async () => {});
  return tree;
}

const PDF = 'uploads/documents/abc.pdf?exp=1&sig=x';
const PNG = 'uploads/notices/abc.png?exp=1&sig=x';

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

test('every portal screen draws its own header (no app top bar)', () => {
  for (const name of ['Attendance', 'AttendanceMonth', 'Homework', 'HomeworkSubjects', 'HomeworkSubject', 'StudentTimetable',
    'Notices', 'NoticeDetail', 'Events', 'Remarks', 'MyTransport', 'Holidays', 'SubjectTeachers',
    'Syllabus', 'SyllabusSubject', 'SchoolInfo', 'FileViewer'] as const) {
    expect((SCREENS[name] as ScreenEntry).ownHeader).toBe(true);
  }
  expect((SCREENS.WeeklyTimetable as ScreenEntry).ownHeader).toBeUndefined(); // the old weekly timetable keeps the top bar
});

test('files: kind from type or extension; openFile pushes the viewer', () => {
  expect(fileKind(PDF)).toBe('pdf');
  expect(fileKind(PNG)).toBe('image');
  expect(fileKind(PNG, 'pdf')).toBe('pdf');
  const navigate = jest.fn();
  openFile(navigate, { path: PDF, name: 'tt.pdf' });
  expect(navigate).toHaveBeenCalledWith('FileViewer', { path: PDF, type: 'pdf', name: 'tt.pdf' });
});

test('progress ring: 34% fills 34% (right half only), 75% uses both halves', async () => {
  const rot = (tree: Tree) => tree.root.findAll(n => typeof n.type === 'string' && n.props.style && n.props.style.transform)
    .map(n => n.props.style.transform[0].rotate);
  const a = await render(<ProgressRing percent={34} />);
  expect(texts(a)).toContain('34%');
  expect(rot(a)).toEqual([`${34 * 3.6 - 135}deg`]);
  const b = await render(<ProgressRing percent={75} />);
  expect(rot(b)).toEqual(['45deg', `${75 * 3.6 - 135}deg`]);
});

test('school info: details, contacts and logout', async () => {
  fixtures['/school'] = {
    code: 'RAJCHU1354', name: 'TRM Public School Binasar', director_name: 'Rajveer Singh Dhayal', principal_name: 'Awatar Singh',
    affiliation_no: '1730786', phone: '9950367365', tel: '9783440101', email: 'trmpublic2012@gmail.com',
    website: 'www.trmschool.in', address: 'Ratangarh Road, Binasar Churu', session_start_month: 4,
    session: { label: '2026-2027', start: '2026-04-01', end: '2027-03-31' }, logo_path: null,
  };
  const tree = await render(<SchoolInfo {...props()} />);
  const all = texts(tree);
  for (const s of ['TRM PUBLIC SCHOOL BINASAR', 'Director: Rajveer Singh Dhayal', 'Session 2026-2027', '1730786', 'Awatar Singh',
    '9783440101', 'trmpublic2012@gmail.com', 'www.trmschool.in']) {
    expect(all).toContain(s);
  }
});

test('attendance: ring, yearly summary and monthly breakdown → month calendar', async () => {
  fixtures['/student/attendance/overview'] = {
    session: { label: '2026-2027', start: '2026-04-01', end: '2027-03-31' },
    totals: { working_days: 288, present: 99, absent: 34, half_day: 0, leave: 0, holidays: 46, percent: 34.4 },
    months: [
      { year: 2026, month: 9, days: 30, sundays: 4, holidays: 1, working_days: 25, present: 23, absent: 2, half_day: 0, leave: 0, percent: 92 },
      { year: 2026, month: 10, days: 31, sundays: 4, holidays: 2, working_days: 25, present: 16, absent: 3, half_day: 0, leave: 0, percent: 64 },
    ],
  };
  const p = props();
  const tree = await render(<Attendance {...p} />);
  const all = texts(tree);
  expect(all).toContain('34%');
  expect(all).toContain('99 present out of 288 working days');
  expect(all).toContain('Yearly Summary');
  expect(all).toContain('64% attendance');
  expect(all.indexOf('October 2026')).toBeLessThan(all.indexOf('September 2026')); // newest first
  await ReactTestRenderer.act(async () => pressable(tree, 'October 2026').props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('AttendanceMonth', { year: 2026, month: 10 });
});

test('attendance month: calendar statuses and summary', async () => {
  const days = Array.from({ length: 31 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    status: i === 6 ? 'absent' : i === 18 ? 'holiday' : 'present',
    holiday: i === 18 ? 'Durgashtami' : null,
  }));
  fixtures['/student/attendance/month'] = {
    year: 2026, month: 10, days, working_days: 25, percent: 64,
    summary: { present: 16, half_day: 0, absent: 3, leave: 0, holiday: 2, not_marked: 6 },
  };
  const tree = await render(<AttendanceMonth {...props({ year: 2026, month: 10 })} />);
  expect(calls.some(c => c.path === '/student/attendance/month?year=2026&month=10')).toBe(true);
  const all = texts(tree);
  expect(all).toContain('October 2026');
  expect(all).toContain('Month Summary');
  expect(all).toContain('Not Marked');
  expect(tree.root.findAll(n => n.props.accessibilityLabel === '19: Holiday (Durgashtami)').length).toBeGreaterThan(0);
  fixtures['/student/attendance/month?year=2026&month=9'] = {
    year: 2026, month: 9, days: [], working_days: 25, percent: 92,
    summary: { present: 23, half_day: 0, absent: 2, leave: 0, holiday: 1, not_marked: 0 },
  };
  await ReactTestRenderer.act(async () => pressable(tree, 'Previous month').props.onPress());
  expect(calls.some(c => c.path === '/student/attendance/month?year=2026&month=9')).toBe(true);
  expect(texts(tree)).toContain('September 2026');
});

test('homework: today first, By Subject, sheets open in the viewer', async () => {
  fixtures['/student/homework'] = [{
    id: 3, scope: 'class', title: 'HomeWork', note: 'Summer vacation homework', subject: 'Hindi', status: 'pending',
    assigned_by: 'Parwati Sharma', due_date: null, created_at: '2026-05-16T10:00:00', attachment_path: PDF,
    attachment_name: '1778949112057.pdf', attachment_type: 'pdf',
  }];
  const p = props();
  const tree = await render(<Homework {...p} />);
  expect(calls[0].path).toMatch(/^\/student\/homework\?date=\d{4}-\d{2}-\d{2}$/);
  const all = texts(tree);
  expect(all).toContain("Today's Homework");
  expect(all).toContain('1 homeworks assigned');
  expect(all).toContain('1778949112057.pdf');
  await ReactTestRenderer.act(async () => pressable(tree, 'Open PDF').props.onPress());
  expect(p.navigate).toHaveBeenLastCalledWith('FileViewer', { path: PDF, type: 'pdf', name: '1778949112057.pdf' });
  await ReactTestRenderer.act(async () => pressable(tree, 'By Subject').props.onPress());
  expect(p.navigate).toHaveBeenLastCalledWith('HomeworkSubjects');
});

test('homework subjects grid → subject list', async () => {
  fixtures['/student/homework/subjects'] = [
    { subject: 'Hindi', count: 1, last_given: '2026-05-14T09:00:00' },
    { subject: 'Maths', count: 0, last_given: null },
  ];
  const p = props();
  const tree = await render(<HomeworkSubjects {...p} />);
  const all = texts(tree);
  expect(all).toContain('2 subjects available');
  expect(all).toContain('HINDI');
  expect(all).toContain('14 May 2026');
  expect(all).toContain('No homework yet');
  await ReactTestRenderer.act(async () => pressable(tree, 'Hindi').props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('HomeworkSubject', { subject: 'Hindi' });

  fixtures['/student/homework?subject='] = [{ id: 3, scope: 'class', title: 'HomeWork', status: 'pending', assigned_by: 'x',
    due_date: null, created_at: '2026-05-16T10:00:00' }];
  const list = await render(<HomeworkSubject {...props({ subject: 'Hindi' })} />);
  expect(calls.some(c => c.path === '/student/homework?subject=Hindi')).toBe(true);
  expect(texts(list)).toContain('HINDI  •  1 item');
});

test('time table: shared files grouped by day + the weekly timetable', async () => {
  fixtures['/student/documents?kind=timetable'] = [{
    id: 1, kind: 'timetable', title: 'PA-1', note: 'Time table', created_at: '2026-07-23T11:00:00',
    attachment_path: PDF, attachment_name: '1784806660148.pdf', attachment_type: 'pdf',
  }];
  const p = props();
  const tree = await render(<TimetableFiles {...p} />);
  const all = texts(tree);
  expect(all).toContain('1 time table shared');
  expect(all).toContain('Thursday, 23 Jul 2026');
  expect(all).toContain('PA-1');
  await ReactTestRenderer.act(async () => pressable(tree, 'Weekly class timetable').props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('WeeklyTimetable');
});

test('notice board: numbered, attachment chip, detail with preview', async () => {
  const notices = [
    { id: 4, title: 'Time table', body: 'Half Yearly Exam. 2026', posted_by: 'Admin', created_at: '2026-10-06T15:08:00',
      attachment_path: PDF, attachment_type: 'pdf' },
    { id: 3, title: 'PTM', body: 'PTM on 27-8-26', posted_by: 'Admin', created_at: '2026-08-25T12:54:00',
      attachment_path: PNG, attachment_type: 'image' },
  ];
  fixtures['/student/notices'] = notices;
  const p = props();
  const tree = await render(<Notices {...p} />);
  const all = texts(tree);
  expect(all).toContain('2 notices');
  expect(all).toContain('#2');
  expect(all).toContain('Posted: 06 Oct 2026, 3:08 PM');
  expect(all).toContain('PDF attached');
  expect(all).toContain('Image attached');
  await ReactTestRenderer.act(async () => pressable(tree, 'Time table').props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('NoticeDetail', { id: 4, notice: notices[0] });

  fixtures['/student/notices/4'] = notices[0];
  const detail = await render(<NoticeDetail {...props({ id: 4 })} />);
  expect(texts(detail)).toContain('Tuesday, 06 Oct 2026');
  expect(detail.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'pdf-view').length).toBe(1);
});

test('events: upcoming / completed tabs with photos and videos', async () => {
  fixtures['/events?status=upcoming'] = [{ id: 1, title: 'Annual Day', start_date: '2026-11-02', end_date: '2026-11-02',
    start_time: '10:00', end_time: '13:00', venue: 'School hall', status: 'upcoming', media: [] }];
  fixtures['/events?status=completed'] = [{ id: 2, title: 'Sports Day', start_date: '2026-09-10', end_date: '2026-09-11',
    status: 'completed', media: [{ id: 9, kind: 'image', media_path: PNG }, { id: 10, kind: 'video', url: 'https://youtu.be/x' }] }];
  const tree = await render(<Events {...props()} />);
  expect(texts(tree)).toContain('Annual Day');
  expect(texts(tree)).toContain('10:00 AM – 1:00 PM');
  const completed = tree.root.findAll(n => n.props.testID === 'events-tab-completed' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => completed.props.onPress());
  await ReactTestRenderer.act(async () => {});
  expect(texts(tree)).toContain('Sports Day');
  expect(texts(tree)).toContain('Watch video');
  expect(tree.root.findAllByType(Image).length).toBe(1);
});

test('teacher remarks: who wrote it (class teacher / subject), filter by teacher', async () => {
  fixtures['/student/remarks'] = [
    { id: 2, remark: 'Practise tables daily', created_at: '2026-10-30T10:00:00', by_name: 'Meena Rao',
      by_subjects: ['Maths'], by_class_teacher: false, by_designation: 'TGT', photo_path: null },
    { id: 1, remark: 'Very polite and helpful', created_at: '2026-10-20T10:00:00', by_name: 'Asha Verma',
      by_subjects: [], by_class_teacher: true, by_designation: 'PRT', photo_path: null },
  ];
  const tree = await render(<Remarks {...props()} />);
  expect(calls[0].path).toBe('/student/remarks');
  let all = texts(tree);
  expect(all).toContain('Teacher Remarks');
  expect(all).toContain('2 remarks');
  expect(all).toContain('Maths');
  expect(all).toContain('Class teacher');
  expect(all).toContain('Very polite and helpful');
  const chip = tree.root.findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button' &&
    n.findAll(c => c.type === Text && c.props.children === 'Meena Rao').length > 0)[0];
  await ReactTestRenderer.act(async () => chip.props.onPress());
  all = texts(tree);
  expect(all).toContain('Practise tables daily');
  expect(all).not.toContain('Very polite and helpful');
});

test('transport: vehicle, driver, stop and times; none → hint', async () => {
  fixtures['/student/transport'] = { vehicle_id: 1, vehicle_no: 'RJ10PA6350', vehicle_type: 'bus', route_name: 'BINASAR',
    status: 'active', shift_name: 'Morning', shift_start: '13:00', shift_end: '19:00', driver_name: 'Sonu Swami',
    driver_phone: '9351729724', driver_photo: null, stop_name: 'Binasar rte', pickup_time: null, drop_time: '13:40' };
  const tree = await render(<MyTransport {...props()} />);
  const all = texts(tree);
  for (const s of ['Bus RJ10PA6350', 'Bus Driver', 'Sonu Swami', 'Binasar rte', 'Route: BINASAR', 'N/A', '1:40 PM',
    'Morning  •  1:00 PM – 7:00 PM', 'TRM PUBLIC SCHOOL BINASAR']) {
    expect(all).toContain(s);
  }
  expect(all).not.toContain('Live');

  fixtures['/student/transport'] = null;
  const none = await render(<MyTransport {...props()} />);
  expect(texts(none)).toContain('not on school transport');
});

test('subject teachers: list and search', async () => {
  fixtures['/student/teachers'] = [
    { id: 1, full_name: 'Manoj kumar Binwal', designation: 'TGT', email: 'mk@gmail.com', subjects: ['Social Science'], is_class_teacher: true },
    { id: 2, full_name: 'Shri Ram Lata', designation: 'TGT', email: null, subjects: ['Maths'], is_class_teacher: false },
  ];
  const tree = await render(<SubjectTeachers {...props()} />);
  expect(texts(tree)).toContain('2 teachers for your class');
  expect(texts(tree)).toContain('SOCIAL SCIENCE');
  const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Search teacher or subject' && n.props.onChangeText)[0];
  await ReactTestRenderer.act(async () => input.props.onChangeText('math'));
  expect(texts(tree)).not.toContain('Manoj kumar Binwal');
  expect(texts(tree)).toContain('Shri Ram Lata');
});

test('syllabus: one file opens directly, several open the list', async () => {
  const doc = { id: 1, kind: 'syllabus', title: 'Maths', subject: 'Maths', created_at: '2026-04-10T10:00:00',
    attachment_path: PDF, attachment_type: 'pdf', attachment_name: 'maths.pdf' };
  fixtures['/student/syllabus'] = [
    { subject: 'Maths', documents: [doc] },
    { subject: 'Hindi', documents: [{ ...doc, id: 2 }, { ...doc, id: 3 }] },
  ];
  const p = props();
  const tree = await render(<Syllabus {...p} />);
  expect(texts(tree)).toContain('1 file');
  await ReactTestRenderer.act(async () => pressable(tree, 'Maths').props.onPress());
  expect(p.navigate).toHaveBeenLastCalledWith('FileViewer', { path: PDF, type: 'pdf', name: 'maths.pdf' });
  await ReactTestRenderer.act(async () => pressable(tree, 'Hindi').props.onPress());
  expect(p.navigate).toHaveBeenLastCalledWith('SyllabusSubject', expect.objectContaining({ subject: 'Hindi' }));
});

test('holidays: month switcher in the header, holiday list with status', async () => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  fixtures['/student/holidays'] = [{ id: 1, date: `${ym}-01`, name: 'Founders Day' }];
  fixtures['/student/calendar'] = { events: [], exams: [], holidays: [] };
  const tree = await render(<Holidays {...props()} />);
  const all = texts(tree);
  expect(all).toContain('1 holiday this month');
  expect(all).toContain('Holiday List');
  expect(all).toContain('1 day');
  await ReactTestRenderer.act(async () => pressable(tree, 'Next month').props.onPress());
  expect(texts(tree)).toContain('0 holidays this month');
});

test('file viewer: PDF in the app, photo in the zoom view', async () => {
  const pdf = await render(<FileViewer {...props({ path: PDF, type: 'pdf', name: 'tt.pdf' })} />);
  expect(texts(pdf)).toContain('View PDF');
  expect(pdf.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'pdf-view').length).toBe(1);
  const img = await render(<FileViewer {...props({ path: PNG, type: 'image' })} />);
  expect(texts(img)).toContain('View photo');
  expect(img.root.findAllByType(Image).length).toBe(1);
});

test('launch popup: shows active announcements once per app start; ✕ closes', async () => {
  resetLaunchPopup();
  fixtures['/student/announcements'] = [{ id: 1, title: 'School timing changed', body: 'From Monday 8:00', created_at: '2026-10-20',
    images: [{ id: 1, image_path: PNG }] }];
  const tree = await render(<LaunchPopup userKey="student:5" />);
  expect(texts(tree)).toContain('School timing changed');
  const close = tree.root.findAll(n => n.props.testID === 'launch-popup-close' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => close.props.onPress());
  expect(texts(tree)).not.toContain('School timing changed');

  const again = await render(<LaunchPopup userKey="student:5" />); // same app process: not again
  expect(texts(again)).not.toContain('School timing changed');
  expect(calls.filter(c => c.path === '/student/announcements').length).toBe(1);

  fixtures['/student/announcements'] = [];
  const empty = await render(<LaunchPopup userKey="student:6" />);
  expect(texts(empty)).toBe('');
});
