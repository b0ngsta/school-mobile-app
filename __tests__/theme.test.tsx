/**
 * UI theme (Profile → Theme, every role): saved on the device under
 * `sw_ui_theme`, DEFAULT when nothing is saved and again after sign-out
 * (resetUiTheme), switching re-renders themed screens at once, and the classic
 * (default) homes show the same data and open the same routes as the orbit.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const fixtures: Record<string, unknown> = {
  '/student/dashboard': {
    profile: { full_name: 'Dimpal', class_name: 'Class 5', section_name: 'A', roll_no: 608 },
    attendance: { percent: 92 },
    latest_notices: [{ id: 1, title: 'Half yearly exam starts 21-10-2026' }],
  },
  '/student/fees': { totals: { paid: 3000, pending: 1000 }, records: [] },
  '/student/me': { full_name: 'Dimpal', username: 'dimpal' },
  '/auth/me': { id: 10, full_name: 'Nitesh Poonia', user_type: 'teacher', username: 'nitesh' },
  '/notices': [{ id: 3, title: 'Staff meeting at 4' }],
};

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string) => {
      const key = Object.keys(fixtures).find(k => path.startsWith(k));
      return key ? fixtures[key] : {};
    }),
  };
});

import HomeStudent from '../src/screens/HomeStudent';
import Profile from '../src/screens/Profile';
import HomeStaff from '../src/screens/staff/HomeStaff';
import StaffProfile from '../src/screens/staff/StaffProfile';
import { DEFAULT_UI_THEME, UI_THEME_KEY, getUiTheme, homeIsOrbit, loadUiTheme, resetUiTheme, setUiTheme } from '../src/uiTheme';
import type { ScreenProps, Session } from '../src/types';

const student: Session = { user_id: 7, full_name: 'Dimpal', user_type: 'student', org_code: 'RAJCHU1354', org_name: 'TRM Public School' };
const teacher: Session = { user_id: 10, full_name: 'Nitesh Poonia', user_type: 'teacher', org_code: 'RAJCHU1354', org_name: 'TRM Public School' };
const props = (session: Session = student): ScreenProps => ({ navigate: jest.fn(), goBack: jest.fn(), onLogout: jest.fn(), session });

type Tree = ReactTestRenderer.ReactTestRenderer;
const texts = (tree: Tree) =>
  tree.root
    .findAllByType(Text)
    .map(n => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join(' | ');

const mounted: Tree[] = [];
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(tree => tree.unmount());
  });
});

async function render(el: React.ReactElement) {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  mounted.push(tree);
  await ReactTestRenderer.act(async () => {});
  return tree;
}

const hasOrbit = (tree: Tree) => tree.root.findAll(n => n.props.testID === 'orbit-menu').length > 0;

beforeEach(async () => {
  await AsyncStorage.clear();
  await loadUiTheme();
});

test('default when nothing is saved; saved choice is read back; junk falls back', async () => {
  expect(DEFAULT_UI_THEME).toBe('default');
  expect(await loadUiTheme()).toBe('default');
  await AsyncStorage.setItem(UI_THEME_KEY, 'creative');
  expect(await loadUiTheme()).toBe('creative');
  await AsyncStorage.setItem(UI_THEME_KEY, 'neon');
  expect(await loadUiTheme()).toBe('default');
});

test('setUiTheme saves to AsyncStorage; sign-out (resetUiTheme) forgets it', async () => {
  setUiTheme('creative');
  expect(getUiTheme()).toBe('creative');
  await new Promise<void>(r => setTimeout(r, 0));
  expect(await AsyncStorage.getItem(UI_THEME_KEY)).toBe('creative');

  resetUiTheme();
  expect(getUiTheme()).toBe('default');
  await new Promise<void>(r => setTimeout(r, 0));
  expect(await AsyncStorage.getItem(UI_THEME_KEY)).toBeNull();
  // the next login (app restart included) starts on the default theme
  expect(await loadUiTheme()).toBe('default');
});

test('every role: the home is the orbit only in the creative theme', () => {
  for (const role of ['student', 'teacher', 'driver', 'admin', 'principal', 'sub_admin', 'coordinator']) {
    expect(homeIsOrbit(role, 'default')).toBe(false);
    expect(homeIsOrbit(role, 'creative')).toBe(true);
  }
});

test('student home switches between orbit and classic at once', async () => {
  const p = props();
  const tree = await render(<HomeStudent {...p} />);
  expect(hasOrbit(tree)).toBe(false); // default theme = classic home
  const shown = texts(tree);
  expect(shown).toContain('TRM PUBLIC SCHOOL');
  expect(shown).toContain('DIMPAL');
  expect(shown).toContain('75% paid');
  expect(shown).toContain('92% present');
  expect(shown).toContain('Half yearly exam starts 21-10-2026');
  expect(shown).not.toContain('Quick Actions'); // heading removed
  // no School Info / Remarks launchers; the header opens School Info
  expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Remarks')).toHaveLength(0);
  const schoolTap = tree.root.findAll(n => n.props.accessibilityLabel === 'School Info' && typeof n.props.onPress === 'function');
  expect(schoolTap.length).toBeGreaterThan(0);
  expect(shown).not.toContain('School Info'); // the header has no such caption; no tile has it either
  await ReactTestRenderer.act(async () => schoolTap[0].props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('SchoolInfo');

  // Every launcher opens the same route the orbit does.
  const tile = tree.root.findAll(n => n.props.accessibilityLabel === 'Time table' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => tile.props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('StudentTimetable', undefined);

  await ReactTestRenderer.act(async () => setUiTheme('creative'));
  expect(hasOrbit(tree)).toBe(true);
});

test('Profile → Theme switches and marks the active theme', async () => {
  const tree = await render(<Profile {...props()} />);
  expect(texts(tree)).toContain('Theme');
  const card = (v: string) => tree.root.findAll(n => n.props.testID === `theme-${v}` && typeof n.props.onPress === 'function')[0];
  expect(card('default').props.accessibilityState).toEqual({ selected: true });
  await ReactTestRenderer.act(async () => card('creative').props.onPress());
  expect(getUiTheme()).toBe('creative');
  expect(card('creative').props.accessibilityState).toEqual({ selected: true });
});

test('staff: StaffProfile has the same theme picker and the staff home follows it', async () => {
  const profile = await render(<StaffProfile {...props(teacher)} />);
  expect(texts(profile)).toContain('Theme');
  const card = (v: string) => profile.root.findAll(n => n.props.testID === `theme-${v}` && typeof n.props.onPress === 'function')[0];
  expect(card('default').props.accessibilityState).toEqual({ selected: true });

  const p = props(teacher);
  const home = await render(<HomeStaff {...p} />);
  expect(hasOrbit(home)).toBe(false); // classic staff home by default
  const shown = texts(home);
  expect(shown).toContain('TRM PUBLIC SCHOOL');
  expect(shown).toContain('NITESH POONIA');
  expect(shown).toContain('Staff meeting at 4');
  const tile = home.root.findAll(n => n.props.accessibilityLabel === 'Mark Attendance' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => tile.props.onPress());
  expect(p.navigate).toHaveBeenCalledWith('MarkAttendance', undefined);

  await ReactTestRenderer.act(async () => card('creative').props.onPress());
  expect(hasOrbit(home)).toBe(true);
});
