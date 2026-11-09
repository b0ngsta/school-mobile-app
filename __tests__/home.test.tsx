/**
 * Night-sky "orbit" home screens: both homes still show their data, staff
 * check-in/out still calls the same endpoints, every checkpoint opens the
 * same route (and params) the old tile grid did, and the orbit path is a
 * mirror-symmetric rail → arc → rail loop that repeats the list forever.
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
  };
});

import HomeStudent from '../src/screens/HomeStudent';
import HomeStaff from '../src/screens/staff/HomeStaff';
import {
  hitTest,
  orbitLayout,
  pathPoint,
  pathTables,
  progressAt,
  slotItem,
  slotPoint,
  slotPos,
} from '../src/components/orbit/geometry';
import { TILT, northPole, project } from '../src/components/orbit/globe';
import type { ScreenProps, Session } from '../src/types';
import { setUiTheme } from '../src/uiTheme';

const teacher: Session = { user_id: 10, full_name: 'Nitesh Poonia', user_type: 'teacher' };
const admin: Session = { user_id: 1, full_name: 'Asha Admin', user_type: 'admin' };
const student: Session = { user_id: 7, full_name: 'Aarav Sharma', user_type: 'student' };

const props = (session: Session): ScreenProps => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  onLogout: jest.fn(),
  session,
});

type Tree = ReactTestRenderer.ReactTestRenderer;

const texts = (tree: Tree) =>
  tree.root
    .findAllByType(Text)
    .map(n => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join(' | ');

async function render(el: React.ReactElement) {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  await ReactTestRenderer.act(async () => {});
  return tree;
}

/** Lay the orbit out (it waits for its size before drawing the items). */
async function layoutOrbit(tree: Tree) {
  const orbit = tree.root.findAll(n => n.props.testID === 'orbit-menu' && typeof n.props.onLayout === 'function')[0];
  await ReactTestRenderer.act(async () => {
    orbit.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
  });
}

/** The checkpoint with this label, activated the way TalkBack does (on screen unless `anywhere`). */
async function activateItem(tree: Tree, label: string, anywhere = false) {
  const all = tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onAccessibilityAction === 'function');
  const item = all.find(n => n.props.accessible) || all[0];
  if (!anywhere) expect(item.props.accessible).toBe(true);
  await ReactTestRenderer.act(async () => {
    item.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
  });
}

const pressable = (tree: Tree, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

beforeEach(() => {
  setUiTheme('creative'); // the orbit is the creative theme's home (default = classic tiles)
  calls.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

describe('HomeStaff (orbit home)', () => {
  test('teacher: greeting, check-in/out and the orbit open the same screens', async () => {
    fixtures['/auth/me'] = { id: 10, full_name: 'Nitesh Poonia', user_type: 'teacher' };
    fixtures['/staff-attendance/today'] = null;
    fixtures['/notices'] = [{ id: 1, title: 'Sports day on Friday' }];
    const p = props(teacher);
    const tree = await render(<HomeStaff {...p} />);

    await layoutOrbit(tree);
    const all = texts(tree);
    expect(all).toContain('Nitesh Poonia');
    expect(all).toContain('EMP ID: 10');
    expect(all).toContain('Sports day on Friday'); // latest notice, on the Notice Board checkpoint
    expect(all).toContain('Not checked in yet');

    // Check in → same endpoint as before, then the button turns into Check out.
    fixtures['/staff-attendance/today'] = { id: 3, date: '2026-10-21', in_time: '09:02' };
    await ReactTestRenderer.act(async () => {
      pressable(tree, 'Check in').props.onPress();
    });
    expect(calls).toContainEqual({ path: '/staff-attendance/check-in', opts: { method: 'POST' } });
    expect(texts(tree)).toContain('9:02 AM');
    expect(pressable(tree, 'Check out')).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      pressable(tree, 'Check out').props.onPress();
    });
    expect(calls).toContainEqual({ path: '/staff-attendance/check-out', opts: { method: 'POST' } });

    // Orbit: the teacher's launcher entries, same routes as the old grid.
    await activateItem(tree, 'Mark Attendance');
    expect(p.navigate).toHaveBeenLastCalledWith('MarkAttendance', undefined);

    // Bell → Notifications; Profile and Notice Board are checkpoints on the loop now.
    pressable(tree, 'Notifications').props.onPress();
    expect(p.navigate).toHaveBeenLastCalledWith('Notifications');
    await activateItem(tree, 'Profile', true);
    expect(p.navigate).toHaveBeenLastCalledWith('StaffProfile', undefined);
    await activateItem(tree, 'Notice Board', true);
    expect(p.navigate).toHaveBeenLastCalledWith('StaffNotices', undefined);

    await ReactTestRenderer.act(async () => tree.unmount());
  });

  test('admin: overview figures ride on the checkpoints; route params survive', async () => {
    fixtures['/auth/me'] = { id: 1, full_name: 'Asha Admin', user_type: 'admin' };
    fixtures['/staff-attendance/today'] = { id: 9, date: '2026-10-21', in_time: '08:40', out_time: '15:10' };
    fixtures['/notices'] = [];
    fixtures['/fees/stats'] = { total: 500000, collected: 320000, pending: 150000, overdue: 30000 };
    fixtures['/transactions/stats'] = { today_collection: 12000 };
    fixtures['/dashboard/stats'] = { students: 640, teachers: 32 };
    fixtures['/attendance/stats'] = { present: 590, marked: 610 };
    const p = props(admin);
    const tree = await render(<HomeStaff {...p} />);
    await layoutOrbit(tree);

    const all = texts(tree);
    expect(all).toContain('640 students');
    expect(all).toContain('32 teachers');
    expect(all).toContain('590/610 present');
    expect(all).toContain('₹1,80,000 due');
    expect(all).toContain('Done for today');
    expect(pressable(tree, 'Done for today').props.disabled).toBe(true);
    for (const path of ['/fees/stats', '/transactions/stats', '/dashboard/stats', '/attendance/stats']) {
      expect(calls.map(c => c.path)).toContain(path);
    }

    await activateItem(tree, 'Time table');
    expect(p.navigate).toHaveBeenLastCalledWith('Teachers', { hint: 'timetable' });

    await ReactTestRenderer.act(async () => tree.unmount());
  });
});

describe('HomeStudent (orbit home)', () => {
  test('shows the student, attendance and fees; checkpoints + bell navigate', async () => {
    fixtures['/student/dashboard'] = {
      profile: { full_name: 'Aarav Sharma', class_name: 'Class 5', section_name: 'B', roll_no: 12 },
      attendance: { percent: 92 },
      latest_notices: [{ id: 4, title: 'PTM on Saturday' }],
    };
    fixtures['/student/fees'] = { totals: { paid: 12000, pending: 3000 } };
    const p = props(student);
    const tree = await render(<HomeStudent {...p} />);
    await layoutOrbit(tree);

    const all = texts(tree);
    expect(all).toContain('Aarav Sharma');
    expect(all).toContain('CLASS 5 · B');
    expect(all).toContain('92%');
    expect(all).toContain('PTM on Saturday');
    expect(all).toContain('92% present');
    expect(all).toMatch(/3,000 due/);

    pressable(tree, 'View').props.onPress();
    expect(p.navigate).toHaveBeenLastCalledWith('Attendance');

    await activateItem(tree, 'Homework');
    expect(p.navigate).toHaveBeenLastCalledWith('Homework', undefined);

    await activateItem(tree, 'Profile', true);
    expect(p.navigate).toHaveBeenLastCalledWith('Profile', undefined);
    await activateItem(tree, 'Notice Board', true);
    expect(p.navigate).toHaveBeenLastCalledWith('Notices', undefined);
    pressable(tree, 'Notifications').props.onPress();
    expect(p.navigate).toHaveBeenLastCalledWith('Notifications');

    await ReactTestRenderer.act(async () => tree.unmount());
  });
});

describe('orbit path geometry', () => {
  const W = 390;
  const H = 800;

  /** Items fully on screen, top of the path first. */
  const visible = (L: ReturnType<typeof orbitLayout>, progress: number) =>
    Array.from({ length: L.slots }, (_, j) => j)
      .filter(j => {
        const p = slotPoint(L, j, progress);
        return !!p && p.y >= L.node / 2 + 1 && p.y <= L.height - L.node / 2;
      })
      .sort((a, b) => slotPos(L, a, progress) - slotPos(L, b, progress))
      .map(j => slotItem(L, j));

  test('the lower half of the path mirrors the upper half', () => {
    const L = orbitLayout(W, H, 10);
    for (let k = 0; k <= 40; k++) {
      const s = (L.length * k) / 80;
      const a = pathPoint(L, s)!;
      const b = pathPoint(L, L.length - s)!;
      expect(b.x).toBeCloseTo(a.x, 4);
      expect(b.y).toBeCloseTo(2 * L.cy - a.y, 4);
    }
    // Left-most point: on the Earth's centre line, at the featured stop.
    const f = pathPoint(L, L.focus)!;
    expect(f.y).toBeCloseTo(L.cy, 3);
    expect(f.x).toBeCloseTo(L.cx - L.r, 3);
  });

  test('rails are straight, the curve has no kinks, both ends are off screen', () => {
    const L = orbitLayout(W, H, 10);
    expect(L.xs[0]).toBe(L.railX);
    expect(L.xs[1]).toBeCloseTo(L.railX, 6);
    expect(L.ys[0]).toBeLessThan(0);
    expect(L.ys[L.ys.length - 1]).toBeGreaterThan(H);
    let worst = 0;
    for (let i = 1; i < L.xs.length - 1; i++) {
      const a = Math.atan2(L.ys[i] - L.ys[i - 1], L.xs[i] - L.xs[i - 1]);
      const b = Math.atan2(L.ys[i + 1] - L.ys[i], L.xs[i + 1] - L.xs[i]);
      let d = Math.abs(b - a);
      if (d > Math.PI) d = 2 * Math.PI - d;
      worst = Math.max(worst, (d * 180) / Math.PI);
    }
    expect(worst).toBeLessThan(9); // ≤ one sample step (5° arc, 8° fillets): sub-pixel off the true curve
    // The path never crosses the Earth.
    for (let k = 0; k <= 200; k++) {
      const p = pathPoint(L, (L.length * k) / 200)!;
      expect(Math.hypot(p.x - L.cx, p.y - L.cy)).toBeGreaterThan(L.R + 10);
    }
  });

  test('the list starts at the top and loops endlessly as it moves', () => {
    const L = orbitLayout(W, H, 10);
    expect(L.cycle).toBeGreaterThanOrEqual(L.length - 1e-6);
    expect(L.slots % 10).toBe(0);
    const start = visible(L, L.home);
    expect(start[0]).toBe(0);
    expect(start.slice(0, 4)).toEqual([0, 1, 2, 3]);
    // Drag down one stop: the last item comes in at the top.
    expect(visible(L, L.home + L.step)[0]).toBe(9);
    // Drag up one stop: item 1 leads.
    expect(visible(L, L.home - L.step)[0]).toBe(1);
    // A whole pass of the list brings everything back.
    expect(visible(L, L.home + 10 * L.step)).toEqual(start);
    expect(visible(L, L.home - 30 * L.step)).toEqual(start);
    // Long lists keep going past what fits on screen.
    const big = orbitLayout(W, H, 20);
    expect(visible(big, big.home - 12 * big.step)[0]).toBe(12);
    expect(visible(big, big.home + 3 * big.step)[0]).toBe(17);
  });

  test('every screen is on the path at most once, and only a handful show at a time', () => {
    for (const count of [1, 3, 7, 10, 13, 20]) {
      const L = orbitLayout(W, H, count);
      expect(L.slots).toBe(count);
      expect(L.cycle).toBeGreaterThanOrEqual(L.length - 1e-6);
      for (let k = 0; k < 40; k++) {
        const p = L.home + k * L.step * 0.37;
        const onPath = Array.from({ length: L.slots }, (_, j) => j).filter(j => pathPoint(L, slotPos(L, j, p)));
        const shown = onPath.map(j => slotItem(L, j));
        expect(new Set(shown).size).toBe(shown.length);
        expect(visible(L, p).length).toBeLessThanOrEqual(9);
      }
    }
  });

  test('taps land on the checkpoint under the finger, the Earth, or nothing', () => {
    const L = orbitLayout(W, H, 10);
    const j = 2;
    const p = slotPoint(L, j, L.home)!;
    expect(hitTest(L, L.home, p.x, p.y, [])).toEqual({ kind: 'item', slot: j });
    expect(hitTest(L, L.home, p.x - L.node / 2 - L.gap - 40, p.y, new Array(L.slots).fill(100))).toEqual({ kind: 'item', slot: j });
    expect(hitTest(L, L.home, L.cx + L.R * 0.3, L.cy, [])).toEqual({ kind: 'earth' });
    expect(hitTest(L, L.home, 6, H / 2, [])).toBeNull();
  });

  test('the menu scroll drives the loop and snaps a checkpoint onto the featured stop', () => {
    const L = orbitLayout(W, H, 10);
    // At the start offset the list is home; scrolling up (finger down) moves it down the path.
    expect(progressAt(L, L.scrollStart)).toBeCloseTo(L.home, 6);
    expect(progressAt(L, L.scrollStart - L.step)).toBeCloseTo(L.home + L.step, 6);
    // Every snap point (a multiple of step) rests a checkpoint on the arc's left-most point.
    const offStop = (p: number) => (((p - L.focus) % L.step) + L.step) % L.step;
    for (const k of [0, 1, 7, 1234, 3999]) {
      const d = offStop(progressAt(L, k * L.step));
      expect(Math.min(d, L.step - d)).toBeCloseTo(0, 4);
    }
    expect(L.scrollHeight).toBeGreaterThan(2 * L.scrollStart);
  });

  test('checkpoints waiting on the hidden stretch are parked off screen', () => {
    const L = orbitLayout(W, H, 4);
    const t = pathTables(L);
    expect(t.input.length).toBe(t.x.length);
    for (let i = 1; i < t.input.length; i++) expect(t.input[i]).toBeGreaterThan(t.input[i - 1]);
    if (L.cycle > L.length + 0.5) expect(t.x[t.x.length - 1]).toBeGreaterThan(W);
    expect(t.input[t.input.length - 1]).toBeCloseTo(Math.max(L.cycle, L.length), 6);
  });

  test('cards and the header fit on a small phone', () => {
    const L = orbitLayout(360, 640, 13);
    expect(L.cardMax).toBeGreaterThanOrEqual(84);
    expect(L.cx - L.r - L.node / 2 - L.gap - L.cardMax).toBeGreaterThanOrEqual(0); // left-most card stays on screen
    expect(360 - L.headerGutter).toBeGreaterThanOrEqual(150);
    expect(L.cx + L.R).toBeGreaterThan(360); // the Earth still runs past the edge
  });

  test("the Earth's axis is tilted 23.44°", () => {
    const pole = northPole();
    expect((Math.atan2(pole.x, -pole.y) * 180) / Math.PI).toBeCloseTo(TILT, 6);
    // The Tropic of Cancer is a fixed ellipse north of the equator, at 23.44°.
    const eq = project(0, 0);
    const cancer = project(23.44, 0);
    expect(cancer.y).toBeLessThan(eq.y);
    expect(cancer.z).toBeGreaterThan(0);
  });
});
