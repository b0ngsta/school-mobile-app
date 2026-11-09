// Per-school feature flags (backend migration 0019): HQ switches a module off
// for a school → its launchers disappear (every role, both themes build from
// these lists) and navigate() refuses its screens. No flags = everything on.
import { ROUTE_FEATURE, featureOfRoute, hasFeature, withFeatures } from '../src/features';
import { STUDENT_MENU, studentMenu } from '../src/screens/home/useStudentHome';
import { gridForRole } from '../src/screens/staff/home/useStaffHome';
import type { Session } from '../src/types';

const base: Session = { user_id: 1, full_name: 'A', user_type: 'admin' };
const off = (...keys: string[]): Session => ({
  ...base,
  features: { attendance: true, fees: true, transport: true, lesson_plans: true, salary: true,
    ...Object.fromEntries(keys.map(k => [k, false])) },
});

it('treats missing flags (older server) and missing keys as on', () => {
  expect(hasFeature(null, 'fees')).toBe(true);
  expect(hasFeature(base, 'fees')).toBe(true);
  expect(hasFeature({ ...base, features: {} }, 'fees')).toBe(true);
  expect(hasFeature(off('fees'), 'fees')).toBe(false);
  expect(hasFeature(off('fees'), undefined)).toBe(true);
  expect(studentMenu(null)).toBe(STUDENT_MENU); // unchanged without a session
});

it('hides the launchers of switched-off modules for every role', () => {
  for (const role of ['admin', 'teacher', 'driver']) {
    const all = gridForRole(role);
    expect(withFeatures(all, base)).toBe(all);
    for (const key of ['attendance', 'fees', 'transport', 'lesson_plans', 'salary']) {
      const shown = withFeatures(all, off(key));
      expect(shown.some(tile => featureOfRoute(tile.route) === key)).toBe(false);
      expect(shown.length).toBe(all.filter(tile => featureOfRoute(tile.route) !== key).length);
    }
  }
  const parent = studentMenu({ full_syllabus: 1 } as never, off('fees', 'transport', 'attendance'));
  expect(parent.map(m => m.route)).not.toEqual(expect.arrayContaining(['Fees']));
  expect(parent.some(m => ['Fees', 'MyTransport', 'Attendance'].includes(m.route))).toBe(false);
  expect(parent.some(m => m.route === 'FullSyllabus')).toBe(true);
});

it('knows which screens belong to a module', () => {
  expect(ROUTE_FEATURE.MyRoutine).toBe('transport');
  expect(featureOfRoute('LessonPlans')).toBe('lesson_plans');
  expect(featureOfRoute('Notices')).toBeUndefined();
});

describe('session', () => {
  const LOGIN = { access_token: 'a1', refresh_token: 'r1', expires_in: 900, user_id: 7, user_type: 'teacher',
    full_name: 'Asha', features: { fees: false, salary: true } };
  beforeEach(async () => {
    jest.resetModules();
    await require('@react-native-async-storage/async-storage').default.clear();
  });
  afterEach(async () => {
    await require('../src/session').endSession('logout');
  });

  it('keeps the flags from sign-in and refresh, and drops them for an older server', async () => {
    const session = require('../src/session');
    await session.applyAuthResponse(LOGIN, { fresh: true });
    expect(session.getSession().features).toEqual({ fees: false, salary: true });
    // a refresh without the field (older server mid-deploy) keeps the known map
    await session.applyAuthResponse({ access_token: 'a2', refresh_token: 'r2' }, { fresh: false });
    expect(session.getSession().features).toEqual({ fees: false, salary: true });
    // HQ switched fees back on: listeners hear about it
    const heard = jest.fn();
    session.onSessionChange(heard);
    await session.applyAuthResponse({ access_token: 'a3', refresh_token: 'r3', features: { fees: true, salary: true } },
      { fresh: false });
    expect(heard).toHaveBeenCalled();
    expect(hasFeature(session.getSession(), 'fees')).toBe(true);
    // a fresh sign-in on an older server: no flags = everything on
    await session.applyAuthResponse({ ...LOGIN, features: undefined }, { fresh: true });
    expect(session.getSession().features).toBeUndefined();
  });
});
