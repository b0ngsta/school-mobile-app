/**
 * Nov 2026 "web parity" pass for the staff app: tab / button labels that lost
 * their words, attendance for class teachers only, Staff users without
 * teachers (+ teacher photo / details / class assignments), bulk student
 * import from Excel, a notification opening the announcement directly, the
 * school header → School Info for staff, and the tap-to-view profile photo.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

const calls: { path: string; opts?: any }[] = [];
const fixtures: Record<string, unknown> = {};
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
      return v === undefined ? { id: 99 } : v;
    }),
    apiPage: jest.fn(async (path: string) => {
      calls.push({ path });
      const items = (fixtureFor(path) ?? []) as unknown[];
      return { items, total: items.length };
    }),
  };
});

const picked = { uri: 'content://x/students.xlsx', name: 'students.xlsx', type: 'application/x' };
jest.mock('../src/components/excelFile', () => ({
  XLSX_MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pickExcel: jest.fn(async () => picked),
  saveExcel: jest.fn(async () => 'downloads'),
}));

import { splitLabel } from '../src/components/ui';
import PhotoAvatar from '../src/components/PhotoAvatar';
import { targetOf } from '../src/notifications';
import MarkAttendance from '../src/screens/staff/MarkAttendance';
import StudentImport from '../src/screens/staff/StudentImport';
import Users from '../src/screens/staff/Users';
import TeacherProfile from '../src/screens/staff/TeacherProfile';
import HomeStaffDefault from '../src/screens/staff/home/HomeStaff.default';
import { SCREENS } from '../src/routes';
import type { ScreenProps, Session } from '../src/types';

const session = (user_type: Session['user_type'], user_id = 5): Session =>
  ({ user_id, full_name: 'X', user_type, org_code: 'DEFAULT', org_name: 'School' }) as Session;
const props = (s: Session, params?: any): ScreenProps => ({
  navigate: jest.fn(), goBack: jest.fn(), onLogout: jest.fn(), session: s, params,
});

type Tree = ReactTestRenderer.ReactTestRenderer;
const texts = (tree: Tree) =>
  tree.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join('') : String(c ?? '');
  }).join(' | ');
async function render(el: React.ReactElement) {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(el); });
  await ReactTestRenderer.act(async () => {});
  return tree;
}
const byId = (tree: Tree, id: string) => tree.root.findAll(n => n.props.testID === id && n.props.onPress)[0];
const press = async (node: any) => ReactTestRenderer.act(async () => { await node.props.onPress(); });

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

test('labels: a leading emoji is split from the words so the words always show', () => {
  expect(splitLabel('📚 Homework')).toEqual({ emoji: '📚', text: 'Homework' });
  expect(splitLabel('✏️ Edit')).toEqual({ emoji: '✏️', text: 'Edit' });
  expect(splitLabel('🧑‍🏫 Teachers')).toEqual({ emoji: '🧑‍🏫', text: 'Teachers' });
  expect(splitLabel('⬇️ Download')).toEqual({ emoji: '⬇️', text: 'Download' });
  expect(splitLabel('+ Add remark')).toEqual({ emoji: null, text: '+ Add remark' });
  expect(splitLabel('Save')).toEqual({ emoji: null, text: 'Save' });
  expect(splitLabel('Class 2 📚')).toEqual({ emoji: null, text: 'Class 2 📚' });
});

test('a class-announcement notification opens the announcement itself (one screen, Back works)', () => {
  const known = () => true;
  expect(targetOf({ type: 'class_announcement', data: { route: 'ClassAnnouncements', params: { id: 7 } } } as any, true, known))
    .toEqual({ route: 'ClassAnnouncementDetail', params: { id: 7, kind: 'class' } });
  expect(targetOf({ type: 'class_announcement', data: { route: 'ClassAnnouncements' } } as any, true, known))
    .toEqual({ route: 'ClassAnnouncements', params: undefined });
  expect(targetOf({ type: 'notice', data: { route: 'Notices' } } as any, true, known)).toEqual({ route: 'Notices', params: undefined });
  expect(SCREENS.ClassAnnouncementDetail).toBeTruthy();
});

test('mark attendance: a teacher is offered only the section they are class teacher of', async () => {
  fixtures['/assignments/mine'] = [
    { id: 1, class_id: 2, section_id: 21, class_name: 'Class 2', section_name: 'A', role: 'subject_teacher', subject: 'Math' },
    { id: 2, class_id: 1, section_id: 14, class_name: '1', section_name: 'D', role: 'class_teacher' },
  ];
  fixtures['/attendance?section_id=14'] = [{ student_id: 5, full_name: 'Amar', roll_no: '1', status: null }];
  const tree = await render(<MarkAttendance {...props(session('teacher'))} />);
  expect(byId(tree, 'att-class-14')).toBeTruthy();
  expect(byId(tree, 'att-class-21')).toBeUndefined();
  expect(texts(tree)).toContain('Amar'); // the one section opens straight away

  // subject teacher only → nothing to mark, and says why
  fixtures['/assignments/mine'] = [{ id: 1, class_id: 2, section_id: 21, class_name: 'Class 2', section_name: 'A', role: 'subject_teacher' }];
  const tree2 = await render(<MarkAttendance {...props(session('teacher'))} />);
  expect(byId(tree2, 'att-class-21')).toBeUndefined();
  expect(texts(tree2)).toContain('Only the class teacher marks attendance');
});

test('staff users: teachers are left out (API filter + old-server fallback); the edit sheet has a photo button', async () => {
  fixtures['/users'] = [
    { id: 1, full_name: 'Coord One', username: 'c1', user_type: 'coordinator', email: 'c@x.in' },
    { id: 2, full_name: 'Teacher Two', username: 't2', user_type: 'teacher', email: 't@x.in' },
  ];
  const tree = await render(<Users {...props(session('admin'))} />);
  expect(calls.some(c => c.path.startsWith('/users?exclude_type=teacher'))).toBe(true);
  expect(texts(tree)).toContain('Coord One');
  expect(texts(tree)).not.toContain('Teacher Two');
  await press(tree.root.findAll(n => n.props.onPress && n.props.testID === undefined && n.props.accessibilityLabel === undefined)
    .find(n => n.findAll(c => c.type === Text && c.props.children === 'Coord One').length)!);
  expect(byId(tree, 'user-photo')).toBeTruthy(); // edit sheet offers the photo
});

test('teacher profile (manager): photo button, edit details, assign as class teacher', async () => {
  fixtures['/assignments?teacher_id=8'] = [];
  fixtures['/classes'] = [{ id: 1, name: '1', subjects: ['EVS'], sections: [{ id: 14, name: 'D' }] }];
  const teacher = { id: 8, full_name: 'Neha', username: 'neha', email: 'n@x.in', subject: 'EVS' };
  const tree = await render(<TeacherProfile {...props(session('principal'), { teacher })} />);
  expect(byId(tree, 'teacher-photo')).toBeTruthy();

  await press(byId(tree, 'teacher-edit'));
  await ReactTestRenderer.act(async () => {
    tree.root.findAll(n => n.props.label === 'Designation (e.g. TGT, PGT)' && n.props.onChangeText)[0].props.onChangeText('TGT');
  });
  await press(byId(tree, 'teacher-save'));
  expect(calls.find(c => c.path === '/users/teachers/8')?.opts.body).toEqual({ designation: 'TGT' });
  expect(calls.some(c => c.path === '/users/8')).toBe(false); // account fields unchanged → not sent

  await press(byId(tree, 'assign-add'));
  await ReactTestRenderer.act(async () => {});
  const chip = (label: string) => tree.root.findAll(n => n.props.onPress && n.props.label === label)[0];
  await press(chip('1')); // the class has one section → picked
  await press(byId(tree, 'assign-save'));
  expect(calls.find(c => c.path === '/assignments' && c.opts?.method === 'POST')?.opts.body)
    .toEqual({ teacher_id: 8, class_id: 1, section_id: 14, role: 'class_teacher', subject: null });
});

test('student import: template, preview (dry run), then save', async () => {
  fixtures['/imports/users/template'] = { filename: 'student_import_template.xlsx', content_base64: 'AAA=' };
  const report = (saved: boolean) => ({
    dry_run: !saved, saved,
    summary: { rows: 2, create: 1, update: 0, unchanged: 0, error: 1, warnings: 0 }, warnings: [],
    rows: [
      { row: 2, username: 'amar', full_name: 'Amar', action: 'create', changes: [], errors: [], warnings: [] },
      { row: 3, username: '', full_name: 'Bad', action: 'error', changes: [], errors: ['username is required'], warnings: [] },
    ],
  });
  fixtures['/imports/users'] = report(false);
  const params = { classId: 1, sectionId: 14, className: '1', sectionName: 'D' };
  const tree = await render(<StudentImport {...props(session('teacher'), params)} />);
  await press(byId(tree, 'import-template'));
  expect(calls.some(c => c.path === '/imports/users/template?user_type=student&format=json')).toBe(true);
  expect(texts(tree)).toContain('Downloads');

  await press(byId(tree, 'import-pick'));
  const preview = calls.filter(c => c.path === '/imports/users');
  expect(preview).toHaveLength(1);
  expect(texts(tree)).toContain('username is required');

  fixtures['/imports/users'] = report(true);
  await press(byId(tree, 'import-save'));
  expect(calls.filter(c => c.path === '/imports/users')).toHaveLength(2);
  expect(texts(tree)).toContain('Saved ✓ 1 new');
});

test('profile photo opens big and closes on a tap outside', async () => {
  const tree = await render(<PhotoAvatar name="Amar" uri="https://x/p.jpg" size={60} testID="pp" />);
  const modal = () => tree.root.findAll(n => n.props.visible !== undefined && n.props.onRequestClose)[0];
  expect(modal().props.visible).toBe(false);
  await press(byId(tree, 'pp'));
  expect(modal().props.visible).toBe(true);
  await press(byId(tree, 'pp-backdrop'));
  expect(modal().props.visible).toBe(false);
});

test('staff classic home: tapping the school opens School Info', async () => {
  const p = props(session('teacher'));
  const tree = await render(<HomeStaffDefault {...p} />);
  await press(byId(tree, 'home-school'));
  expect(p.navigate).toHaveBeenCalledWith('SchoolInfo');
});
