/**
 * Notices for chosen classes + class announcements (backend 0018):
 * parents see class announcements (list, detail, push → detail), the notice
 * board marks class-only notices, managers post a notice to some classes,
 * teachers post an announcement to the sections they teach.
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

import Notices from '../src/screens/Notices';
import ClassAnnouncements from '../src/screens/portal/ClassAnnouncements';
import NoticeDetail from '../src/screens/portal/NoticeDetail';
import StaffClassAnnouncements, { groupTargets } from '../src/screens/staff/StaffClassAnnouncements';
import StaffNotices from '../src/screens/staff/StaffNotices';
import { SCREENS } from '../src/routes';
import type { ScreenEntry } from '../src/routes';
import { STUDENT_MENU } from '../src/screens/home/useStudentHome';
import { GRIDS } from '../src/screens/staff/home/useStaffHome';
import { SECTION_OF_ROUTE } from '../src/updates';
import type { AnnouncementTarget, ScreenProps, Session } from '../src/types';

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
const press = async (node: any) => ReactTestRenderer.act(async () => { await node.props.onPress(); });
/** The innermost pressable whose subtree shows `label`. */
const byText = (tree: Tree, label: string) => {
  const hits = tree.root.findAll(n => typeof n.props.onPress === 'function' &&
    n.findAll(c => c.type === Text && [].concat(c.props.children).join('') === label).length > 0);
  return hits[hits.length - 1];
};
const input = (tree: Tree, label: string) => tree.root.findAll(n => n.props.label === label && n.props.onChangeText)[0];
const type = (tree: Tree, label: string, value: string) =>
  ReactTestRenderer.act(async () => { input(tree, label).props.onChangeText(value); });

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

test('launchers, routes and red dots are wired', () => {
  expect(STUDENT_MENU.map(m => m.route)).toContain('ClassAnnouncements');
  expect(GRIDS.teacher.map(m => m.route)).toContain('StaffClassAnnouncements');
  expect(GRIDS.manager.map(m => m.route)).toContain('StaffClassAnnouncements');
  expect(GRIDS.driver.map(m => m.route)).not.toContain('StaffClassAnnouncements');
  expect((SCREENS.ClassAnnouncements as ScreenEntry).ownHeader).toBe(true);
  expect((SCREENS.ClassAnnouncementDetail as ScreenEntry).ownHeader).toBe(true);
  expect(SECTION_OF_ROUTE.ClassAnnouncements).toBe('class_announcements');
});

test('parent: class announcements list, detail and push', async () => {
  fixtures['/student/class-announcements'] = [{
    id: 7, title: 'Maths test', body: 'Chapter 4 on Monday', posted_by: 'Teacher 2', created_at: '2026-11-01T10:00:00+05:30',
    audience_label: 'Class 1 — A', attachment_path: 'uploads/class_announcements/a.pdf?sig=x', attachment_type: 'pdf',
  }];
  const p = props(session('student'));
  const tree = await render(<ClassAnnouncements {...p} />);
  expect(calls[0].path).toContain('/student/class-announcements');
  const all = texts(tree);
  expect(all).toContain('Class Announcements');
  expect(all).toContain('Maths test');
  expect(all).toContain('For Class 1 — A');
  expect(all).toContain('PDF attached');
  expect(all).toContain('1 announcement');
  await press(tree.root.findAll(n => n.props.accessibilityLabel === 'Maths test' && n.props.onPress)[0]);
  expect(p.navigate).toHaveBeenCalledWith('ClassAnnouncementDetail', expect.objectContaining({ id: 7, kind: 'class' }));

  // a push opens the announcement straight away
  const pushed = props(session('student'), { id: 7 });
  await render(<ClassAnnouncements {...pushed} />);
  expect(pushed.navigate).toHaveBeenCalledWith('ClassAnnouncementDetail', { id: 7, kind: 'class' });

  fixtures['/student/class-announcements/7'] = { ...(fixtures['/student/class-announcements'] as any[])[0] };
  const detail = await render(<NoticeDetail {...props(session('student'), { id: 7, kind: 'class' })} />);
  expect(calls.some(c => c.path === '/student/class-announcements/7')).toBe(true);
  expect(texts(detail)).toContain('Class Announcements');
  expect(texts(detail)).toContain('Chapter 4 on Monday');
});

test('parent notice board marks class-only notices', async () => {
  fixtures['/student/notices'] = [
    { id: 2, title: 'PTM', body: 'Saturday', posted_by: 'Admin', created_at: '2026-11-01T10:00:00+05:30',
      audience: 'classes', audience_label: 'Class 1' },
    { id: 1, title: 'Holiday', body: 'Friday', posted_by: 'Admin', created_at: '2026-10-30T10:00:00+05:30',
      audience: 'school', audience_label: 'Whole school' },
  ];
  const tree = await render(<Notices {...props(session('student'))} />);
  const all = texts(tree);
  expect(all).toContain('For Class 1');
  expect(all).not.toContain('For Whole school');
});

test('manager posts a notice to selected classes with a file option', async () => {
  fixtures['/notices'] = [{ id: 1, title: 'Trip', body: 'Zoo', posted_by: 'Coord', created_at: '2026-11-01T10:00:00+05:30',
    audience: 'classes', audience_label: 'Class 1, Class 2', class_ids: [1, 2] }];
  fixtures['/classes'] = [{ id: 1, name: 'Class 1', sections: [] }, { id: 2, name: 'Class 2', sections: [] }];
  const tree = await render(<StaffNotices {...props(session('coordinator'))} />); // any manager posts now
  expect(texts(tree)).toContain('For Class 1, Class 2');
  await press(tree.root.findAll(n => n.props.icon === '📢' && n.props.onPress)[0]);
  await type(tree, 'Title', 'PTM');
  await type(tree, 'Body', 'Saturday 10 am');
  await press(byText(tree, 'Selected classes')); // the emoji is its own element since Nov 2026 (ui.tsx LabelText)
  await ReactTestRenderer.act(async () => {});
  // no class chosen yet → refused locally
  await press(tree.root.findAll(n => n.props.testID === 'notice-post' && n.props.onPress)[0]);
  expect(calls.some(c => c.opts?.method === 'POST')).toBe(false);
  expect(texts(tree)).toContain('Choose at least one class');
  await press(byText(tree, 'Class 2'));
  await press(tree.root.findAll(n => n.props.testID === 'notice-post' && n.props.onPress)[0]);
  const posted = calls.find(c => c.path === '/notices' && c.opts?.method === 'POST');
  expect(posted?.opts.body).toEqual({ title: 'PTM', body: 'Saturday 10 am', class_ids: [2] });
});

test('teacher posts a class announcement to the sections they teach', async () => {
  const targets: AnnouncementTarget[] = [
    { class_id: 1, class_name: 'Class 1', section_id: 11, section_name: 'A', subjects: null, class_teacher: true, label: 'Class 1 — A' },
    { class_id: 1, class_name: 'Class 1', section_id: 12, section_name: 'B', subjects: 'Math', class_teacher: false, label: 'Class 1 — B' },
    { class_id: 2, class_name: 'Class 2', section_id: 21, section_name: 'A', subjects: 'Math', class_teacher: false, label: 'Class 2 — A' },
  ];
  expect(groupTargets(targets).map(g => [g.class_name, g.sections.length])).toEqual([['Class 1', 2], ['Class 2', 1]]);
  fixtures['/class-announcements/targets'] = targets;
  fixtures['/class-announcements'] = [];
  const tree = await render(<StaffClassAnnouncements {...props(session('teacher'))} />);
  expect(texts(tree)).toContain('No announcements yet');
  await press(tree.root.findAll(n => n.props.icon === '📣' && n.props.onPress)[0]);
  await press(byText(tree, 'Class 1 · All'));
  await press(byText(tree, 'Class 2'));
  await type(tree, 'Heading', 'Sports day');
  await type(tree, 'Message', 'Wear white');
  await press(tree.root.findAll(n => n.props.testID === 'class-announcement-save' && n.props.onPress)[0]);
  const posted = calls.find(c => c.path === '/class-announcements' && c.opts?.method === 'POST');
  expect(posted?.opts.body).toEqual({ title: 'Sports day', body: 'Wear white', section_ids: [11, 12, 21] });
});

import MarkAttendance, { cardsFromAssignments } from '../src/screens/staff/MarkAttendance';

test('mark attendance: class cards, all present / absent shortcuts, save', async () => {
  const mine = [
    { id: 1, class_id: 2, section_id: 21, class_name: 'Class 2', section_name: 'A', role: 'subject_teacher', subject: 'Math' },
    { id: 2, class_id: 1, section_id: 11, class_name: 'Class 1', section_name: 'A', role: 'class_teacher' },
    { id: 3, class_id: 1, section_id: 11, class_name: 'Class 1', section_name: 'A', role: 'subject_teacher', subject: 'EVS' },
  ];
  const cards = cardsFromAssignments(mine as any);
  expect(cards.map(c => [c.sectionId, c.classTeacher, c.subjects])).toEqual([[11, true, ['EVS']], [21, false, ['Math']]]);

  fixtures['/assignments/mine'] = mine;
  fixtures['/attendance?section_id=11'] = [
    { student_id: 5, full_name: 'Aarav', roll_no: '1', status: null },
    { student_id: 6, full_name: 'Diya', roll_no: '2', status: null },
  ];
  const tree = await render(<MarkAttendance {...props(session('teacher'))} />);
  expect(texts(tree)).toContain('Class teacher');
  await press(tree.root.findAll(n => n.props.testID === 'att-class-11' && n.props.onPress)[0]);
  await ReactTestRenderer.act(async () => {});
  expect(texts(tree)).toContain('Aarav');
  expect(texts(tree)).toContain('100%'); // unmarked start as present
  await press(tree.root.findAll(n => n.props.testID === 'att-all-absent' && n.props.onPress)[0]);
  await press(tree.root.findAll(n => n.props.testID === 'att-6-P' && n.props.onPress)[0]);
  await press(tree.root.findAll(n => n.props.testID === 'att-save' && n.props.onPress)[0]);
  const saved = calls.find(c => c.path === '/attendance' && c.opts?.method === 'POST');
  expect(saved?.opts.body.records).toEqual([{ student_id: 5, status: 'absent' }, { student_id: 6, status: 'present' }]);
  expect(texts(tree)).toContain('Attendance saved');
});
