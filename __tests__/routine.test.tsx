/**
 * Driver "My Routine": the pure helpers (current / next shift, phone numbers,
 * maps link) and the screen (shift chips, students in stop order, the detail
 * sheet with Call / Navigate, empty / holiday / error states). Only drivers
 * get the launcher.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Linking, Text } from 'react-native';

let mockResponse: unknown = null;
let mockFailure: unknown = null;
const mockCalls: string[] = [];

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string) => {
      mockCalls.push(path);
      if (mockFailure) throw mockFailure;
      return mockResponse;
    }),
  };
});

import { ApiError } from '../src/http';
import { SCREENS } from '../src/routes';
import MyRoutine from '../src/screens/driver/MyRoutine';
import {
  contactsOf,
  defaultShiftKey,
  dialable,
  mapsUrl,
  periodOf,
  shiftRange,
  shiftStates,
  shortPlace,
  telUrl,
} from '../src/screens/driver/routine';
import { GRIDS, gridForRole } from '../src/screens/staff/home/useStaffHome';
import type { DriverRoutine, RoutineShift, RoutineStudent, ScreenProps, Session } from '../src/types';

const driver: Session = { user_id: 9, full_name: 'Ramesh', user_type: 'driver', org_code: 'TRM1',
  org_name: 'TRM Public School' };
const props = (): ScreenProps => ({ navigate: jest.fn(), goBack: jest.fn(), onLogout: jest.fn(), session: driver });

const kid = (id: number, stop: number, extra: Partial<RoutineStudent> = {}): RoutineStudent => ({
  student_id: id, full_name: `Kid ${id}`, class_name: 'Class 5', section_name: 'A', roll_no: String(id),
  stop_no: stop, stop_time: '07:10', stop_name: null, address: `House ${id}, Civil Lines, Jaipur`, landmark: null,
  latitude: null, longitude: null, notes: null, father_name: `Father ${id}`, mother_name: null,
  guardian_phone: '98765 43210', student_phone: null, photo_path: null, ...extra,
});
const vehicle = { id: 1, vehicle_no: 'RJ14 AB 1001', vehicle_type: 'van' as const, route_name: 'Civil Lines',
  status: 'active' as const, capacity: 25 };
const shift = (key: string, name: string, trip: 'pickup' | 'drop', start: string, end: string,
  students: RoutineStudent[] = []): RoutineShift => ({
  key, id: Number(key.slice(1)), name, trip_type: trip, start_time: start, end_time: end, weekdays: [0, 1, 2, 3, 4, 5],
  is_active: true, vehicle, student_count: students.length, students,
});
const SHIFTS = [
  shift('s1', 'Morning Shift 1', 'pickup', '07:00', '08:30', [
    kid(11, 1, { stop_name: 'Gate 2', latitude: 26.912434, longitude: 75.787271, landmark: 'Near temple',
      notes: 'Peanut allergy', student_phone: '+91 91234 56789' }),
    kid(12, 2, { guardian_phone: 'abc' }),
  ]),
  shift('s2', 'Morning Shift 2', 'pickup', '09:00', '10:30', [kid(13, 1)]),
  shift('s3', 'Evening Shift 1', 'drop', '14:00', '15:30'),
];
const day = (extra: Partial<DriverRoutine> = {}): DriverRoutine => ({
  date: '2026-10-26', weekday: 0, is_today: false, server_time: '2026-10-26T06:30:00+05:30', holiday: null,
  vehicles: [vehicle], shifts: SHIFTS, ...extra,
});

type Tree = ReactTestRenderer.ReactTestRenderer;
const texts = (tree: Tree) =>
  tree.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join('') : String(c ?? '');
  }).join(' | ');
const byLabel = (tree: Tree, label: string | RegExp) =>
  tree.root.findAll(n => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string' &&
    (typeof label === 'string' ? n.props.accessibilityLabel === label : label.test(n.props.accessibilityLabel)))[0];
const button = (tree: Tree, text: string) =>
  tree.root.findAll(n => typeof n.props.onPress === 'function' &&
    n.findAllByType(Text).some(t => t.props.children === text))[0];

const mounted: Tree[] = [];
async function render() {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<MyRoutine {...props()} />);
  });
  mounted.push(tree);
  await ReactTestRenderer.act(async () => {});
  return tree;
}

beforeEach(() => {
  mockResponse = null;
  mockFailure = null;
  mockCalls.length = 0;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(async () => {
  // unmount: stops the clock (useNow) and the list's timers
  await ReactTestRenderer.act(async () => mounted.splice(0).forEach(tree => tree.unmount()));
  jest.restoreAllMocks();
});

/* ------------------------------------------------------------- helpers */

test('running shift opens first, else the next one; not today → the first', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  expect(shiftStates(SHIFTS, at(7, 30), true)).toEqual({ s1: 'now', s2: 'next', s3: 'later' });
  expect(defaultShiftKey(SHIFTS, at(7, 30), true)).toBe('s1');
  expect(defaultShiftKey(SHIFTS, at(8, 45), true)).toBe('s2'); // between shifts → the next
  expect(shiftStates(SHIFTS, at(8, 45), true)).toEqual({ s1: 'done', s2: 'next', s3: 'later' });
  expect(defaultShiftKey(SHIFTS, at(18), true)).toBe('s3'); // all done → the last
  expect(defaultShiftKey(SHIFTS, at(6), true)).toBe('s1');
  expect(defaultShiftKey(SHIFTS, at(14, 30), false)).toBe('s1');
  expect(shiftStates(SHIFTS, at(7), false)).toEqual({});
  expect(defaultShiftKey([], at(7), true)).toBeNull();
  // overlapping shifts: both running
  const overlap = [shift('s1', 'A', 'pickup', '07:00', '08:30'), shift('s2', 'B', 'pickup', '08:00', '09:00')];
  expect(shiftStates(overlap, at(8, 15), true)).toEqual({ s1: 'now', s2: 'now' });
});

test('chip text, phone numbers, maps link and short place', () => {
  expect(shiftRange(SHIFTS[0])).toBe('7:00 AM – 8:30 AM');
  expect(shiftRange({ start_time: null, end_time: null })).toBe('');
  expect([periodOf(SHIFTS[0]), periodOf(SHIFTS[2])]).toEqual(['Morning', 'Evening']);

  expect(dialable('98765 43210')).toBe('9876543210');
  expect(dialable('+91 (987) 654-3210')).toBe('+919876543210');
  for (const bad of [null, '', '12345', 'abc', 'call me', '1234567890123456']) expect(dialable(bad)).toBeNull();
  expect(telUrl('+91 98765-43210')).toBe('tel:+919876543210');
  expect(telUrl('n/a')).toBeNull();

  const first = SHIFTS[0].students[0];
  expect(contactsOf(first).map(c => [c.label, c.dial])).toEqual([
    ['Parent / Guardian', '9876543210'], ['Student', '+919123456789']]);
  expect(contactsOf(kid(1, 1, { guardian_phone: null }))[0].dial).toBeNull();

  expect(mapsUrl(first)).toBe('https://www.google.com/maps/dir/?api=1&destination=26.912434,75.787271&travelmode=driving');
  expect(mapsUrl(kid(1, 1))).toBeNull();
  expect(mapsUrl({ latitude: 95, longitude: 10 })).toBeNull();
  expect(shortPlace(first)).toBe('Gate 2');
  expect(shortPlace(kid(1, 1))).toBe('House 1, Civil Lines');
  expect(shortPlace({ stop_name: null, address: null, landmark: 'Temple' })).toBe('Temple');
});

/* -------------------------------------------------------------- screen */

test('shows the shifts as chips, the selected shift’s students in stop order, and switches on tap', async () => {
  mockResponse = day();
  const tree = await render();
  expect(mockCalls).toEqual(['/driver/routine']);
  const all = texts(tree);
  expect(all).toContain('My Routine');
  expect(all).toContain('TRM PUBLIC SCHOOL  ·  TRM1'); // school details stay in the header
  expect(all).toContain('7:00 AM – 8:30 AM');
  expect(all).toContain('9:00 AM – 10:30 AM');
  expect(all).toContain('2:00 PM – 3:30 PM');
  expect(all.indexOf('Kid 11')).toBeLessThan(all.indexOf('Kid 12'));
  expect(all).not.toContain('Kid 13');
  expect(all).toContain('Gate 2'); // stop name
  expect(all).toContain('House 12, Civil Lines'); // short address

  await ReactTestRenderer.act(async () => byLabel(tree, /Morning Shift 2/).props.onPress());
  expect(texts(tree)).toContain('Kid 13');
  expect(texts(tree)).not.toContain('Kid 11');

  await ReactTestRenderer.act(async () => byLabel(tree, /Evening Shift 1/).props.onPress());
  expect(texts(tree)).toContain('No students on this shift');
});

test('student sheet: Call opens the dialer with the number, Navigate opens maps; bad number → disabled', async () => {
  mockResponse = day();
  const tree = await render();
  await ReactTestRenderer.act(async () => byLabel(tree, '1. Kid 11').props.onPress());
  const sheet = texts(tree);
  expect(sheet).toContain('House 11, Civil Lines, Jaipur');
  expect(sheet).toContain('Landmark: Near temple');
  expect(sheet).toContain('Peanut allergy');
  expect(sheet).toContain('Father 11');

  await ReactTestRenderer.act(async () => button(tree, 'Call Parent / Guardian').props.onPress());
  expect(Linking.openURL).toHaveBeenLastCalledWith('tel:9876543210');
  await ReactTestRenderer.act(async () => button(tree, 'Call Student').props.onPress());
  expect(Linking.openURL).toHaveBeenLastCalledWith('tel:+919123456789');
  await ReactTestRenderer.act(async () => button(tree, 'Navigate').props.onPress());
  expect(Linking.openURL).toHaveBeenLastCalledWith(expect.stringContaining('destination=26.912434,75.787271'));

  // the second student: no pin (no Navigate), guardian number unusable (Call disabled)
  await ReactTestRenderer.act(async () => byLabel(tree, '2. Kid 12').props.onPress());
  expect(texts(tree)).toContain('This number looks wrong — check with the office.');
  expect(button(tree, 'Navigate')).toBeUndefined();
  const call = tree.root.findAll(n => n.props.disabled === true && typeof n.props.onPress === 'function');
  expect(call.length).toBeGreaterThan(0);
});

test('no shift today, holiday, no vehicle and a network error with retry', async () => {
  mockResponse = day({ shifts: [] });
  expect(texts(await render())).toContain('No shift today');

  mockResponse = day({ shifts: [], holiday: 'Diwali' });
  expect(texts(await render())).toContain('Holiday today: Diwali. No shifts.');

  mockResponse = day({ shifts: [], vehicles: [] });
  expect(texts(await render())).toContain('No vehicle is assigned to you yet');

  mockFailure = new ApiError('Could not reach the server. Check your internet connection.', { status: 0 });
  const tree = await render();
  expect(texts(tree)).toContain('Retry');
  mockFailure = null;
  mockResponse = day();
  await ReactTestRenderer.act(async () => button(tree, 'Retry').props.onPress());
  await ReactTestRenderer.act(async () => {});
  expect(texts(tree)).toContain('Kid 11');
});

test('only the driver home has the My Routine launcher; the route draws its own header', () => {
  expect(gridForRole('driver')[0]).toMatchObject({ label: 'My Routine', route: 'MyRoutine' });
  for (const role of ['teacher', 'admin', 'principal', 'coordinator', 'sub_admin']) {
    expect(gridForRole(role).some(i => i.route === 'MyRoutine')).toBe(false);
  }
  expect(GRIDS.manager.concat(GRIDS.teacher).some(i => i.route === 'MyRoutine')).toBe(false);
  expect(SCREENS.MyRoutine).toMatchObject({ title: 'My Routine', ownHeader: true });
});
