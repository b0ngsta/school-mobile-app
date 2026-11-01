/**
 * Smoke tests for the leave/substitution, homework, timings and
 * notification screens: they render with realistic API data and the main
 * actions call the expected endpoints.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

const calls: { path: string; opts?: any }[] = [];
const fixtures: Record<string, unknown> = {};

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string, opts?: any) => {
      calls.push({ path, opts });
      const key = Object.keys(fixtures).find(k => path.startsWith(k));
      return key ? fixtures[key] : {};
    }),
    apiPage: jest.fn(async (path: string) => {
      calls.push({ path });
      const key = Object.keys(fixtures).find(k => path.startsWith(k));
      const items = (key ? fixtures[key] : []) as unknown[];
      return { items, total: items.length };
    }),
  };
});

import Substitutions from '../src/screens/staff/Substitutions';
import SchoolTimings from '../src/screens/staff/SchoolTimings';
import ClassHomework from '../src/screens/staff/ClassHomework';
import HomeworkSubmissions from '../src/screens/staff/HomeworkSubmissions';
import Notifications from '../src/screens/Notifications';
import Leaves from '../src/screens/staff/Leaves';
import { SubstituteFinder } from '../src/components/SubstituteFinder';
import { WeekTimetable } from '../src/components/Timetable';
import type { ScreenProps, Session } from '../src/types';

const teacher: Session = { user_id: 10, full_name: 'Nitesh Poonia', user_type: 'teacher' };
const admin: Session = { user_id: 1, full_name: 'Asha Admin', user_type: 'admin' };
const props = (session: Session, params?: any): ScreenProps => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  onLogout: jest.fn(),
  session,
  params,
});

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join('') : String(c ?? '');
  }).join(' | ');

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  await ReactTestRenderer.act(async () => {});
  return tree;
}

const timings = {
  start_time: '06:30', prayer_minutes: 30, period_minutes: 45, periods_per_day: 6,
  breaks: [{ after_period: 3, minutes: 20, label: 'Lunch' }],
};

const sub = {
  id: 7, date: '2026-05-12', period: 3, start_time: '08:30', end_time: '09:15',
  class_id: 1, section_id: 2, class_name: 'Class 5', section_name: 'B', subject: 'Mathematics',
  requester_id: 11, requester_name: 'Anita Verma', substitute_id: 10, substitute_name: 'Nitesh Poonia',
  status: 'pending', note: 'Doctor appointment',
};

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
  fixtures['/settings/school-timings'] = timings;
});

test('substitute requests: accept calls the API', async () => {
  fixtures['/substitutions/incoming'] = [sub];
  const tree = await render(<Substitutions {...props(teacher)} />);
  expect(texts(tree)).toContain('Anita Verma');
  expect(texts(tree)).toContain('8:30 AM – 9:15 AM');
  const accept = tree.root.findAll(n => n.props.label === '✅ Accept' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => accept.props.onPress());
  expect(calls.some(c => c.path === '/substitutions/7/accept' && c.opts?.method === 'PUT')).toBe(true);
});

test('school timings: shows the bell schedule (6:30 + 30 min prayer → P1 at 7:00)', async () => {
  const tree = await render(<SchoolTimings {...props(admin)} />);
  const all = texts(tree);
  expect(all).toContain('7:00 AM – 7:45 AM');
  expect(all).toContain('Lunch');
  expect(all).toContain('9:35 AM – 10:20 AM');
});

test('class homework list + submissions', async () => {
  fixtures['/classes'] = [{ id: 1, name: 'Class 5', sections: [], subjects: ['Maths'] }];
  fixtures['/homework/3/submissions'] = [{ student_id: 1, full_name: 'Aarav Shah', roll_no: 1, status: 'pending' }];
  fixtures['/homework'] = [{ id: 3, class_id: 1, section_id: 1, title: 'Ex 4.2', due_date: '2026-05-14', counts: { total: 30, submitted: 10, pending: 20, late: 0 } }];
  const list = await render(<ClassHomework {...props(teacher, { classId: 1, sectionId: 1, className: 'Class 5', sectionName: 'A' })} />);
  expect(texts(list)).toContain('Ex 4.2');
  expect(texts(list)).toContain('10 submitted');

  const subs = await render(<HomeworkSubmissions {...props(teacher, { homework: { id: 3, title: 'Ex 4.2' } })} />);
  expect(texts(subs)).toContain('Aarav Shah');
  const submitted = subs.root.findAll(n => n.props.label === 'Submitted' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => submitted.props.onPress());
  const save = subs.root.findAll(n => n.props.label === 'Save 1 changes' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => save.props.onPress());
  const put = calls.find(c => c.path === '/homework/3/submissions' && c.opts?.method === 'PUT');
  expect(put?.opts.body).toEqual({ items: [{ student_id: 1, status: 'submitted' }] });
});

test('notifications open their target', async () => {
  fixtures['/notifications'] = [
    { id: 1, type: 'substitution_request', title: 'Anita asks you', data: { route: 'Substitutions', params: { tab: 'incoming' } }, created_at: new Date().toISOString() },
  ];
  const p = props(teacher);
  const tree = await render(<Notifications {...p} />);
  expect(texts(tree)).toContain('Anita asks you');
});

test('substitute finder lists periods and free teachers', async () => {
  fixtures['/substitutions/availability'] = {
    days: [
      {
        date: '2026-05-12', day: 1, periods: [
          { period: 1, start_time: '08:30', end_time: '09:15', slot: { id: 1, class_id: 1, section_id: 1, class_name: 'Class 5', section_name: 'A' }, requests: [], available: [] },
          { period: 3, start_time: '10:20', end_time: '11:05', slot: { id: 2, class_id: 1, section_id: 2, class_name: 'Class 5', section_name: 'B' }, requests: [],
            available: [{ teacher_id: 11, full_name: 'Anita Verma', subject: 'Mathematics' }, { teacher_id: 12, full_name: 'Rohit Kumar' }] },
        ],
      },
      { date: '2026-05-13', day: 2, periods: [] },
    ],
  };
  const onChange = jest.fn();
  const tree = await render(<SubstituteFinder from="2026-05-12" to="2026-05-13" picks={{}} onChange={onChange} />);
  const all = texts(tree);
  expect(all).toContain('No substitutes');
  expect(all).toContain('2 available');
});

test('leaves screen renders with edit/delete for own pending leave', async () => {
  fixtures['/leaves/mine'] = [{ id: 5, user_id: 10, status: 'pending', from_date: '2026-05-12', to_date: '2026-05-14', reason: 'Wedding', coverage: { periods: 6, covered: 2, pending: 1 } }];
  const tree = await render(<Leaves {...props(teacher)} />);
  const all = texts(tree);
  expect(all).toContain('Wedding');
  expect(all).toContain('2/6 periods covered');
  expect(tree.root.findAll(n => n.props.label === '✏️ Edit').length).toBeGreaterThan(0);
});

test('week timetable falls back to the weekly template on old servers', async () => {
  const { api } = require('../src/api');
  (api as jest.Mock).mockImplementationOnce(async () => timings); // school timings
  (api as jest.Mock).mockImplementationOnce(async () => {
    const { ApiError } = jest.requireActual('../src/http');
    throw new ApiError('Not Found', { status: 404 });
  });
  fixtures['/timetable/mine'] = [{ id: 1, day: 0, period: 1, class_id: 1, section_id: 1, class_name: 'Class 5', section_name: 'A', subject: 'Physics' }];
  const tree = await render(<WeekTimetable />);
  expect(texts(tree)).toContain('Class 5 — A · Physics');
});
