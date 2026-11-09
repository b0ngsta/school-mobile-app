/**
 * Red "new" dots (src/updates.ts + GET /updates): a launcher shows a dot while
 * its section has something newer than when it was last opened on this device
 * (per account, kept across sign-outs); opening the screen clears it; a
 * section never opened counts only the last 7 days; servers without
 * /updates show no dots. Plus the dots on the classic tiles and the orbit,
 * and the bigger orbit checkpoint cards.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockUpdates: unknown = null;
let mockUpdatesError: { status: number } | null = null;
const mockFixtures: Record<string, unknown> = {
  '/student/dashboard': { profile: { full_name: 'Dimpal', class_name: 'Class 5' }, attendance: { percent: 92 }, latest_notices: [] },
  '/student/fees': { totals: { paid: 0, pending: 0 }, records: [] },
};

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string) => {
      if (path === '/updates') {
        if (mockUpdatesError) throw mockUpdatesError;
        return mockUpdates;
      }
      const key = Object.keys(mockFixtures).find(k => path.startsWith(k));
      return key ? mockFixtures[key] : {};
    }),
  };
});

import HomeStudent from '../src/screens/HomeStudent';
import { orbitLayout } from '../src/components/orbit/geometry';
import type { ScreenProps, Session } from '../src/types';
import { setUiTheme } from '../src/uiTheme';
import { NEW_WINDOW_DAYS, SEEN_KEY_PREFIX, hasNew, markSeen, refreshUpdates, startUpdates } from '../src/updates';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function serve(sections: Record<string, number | null>, now = Date.now()) {
  mockUpdates = {
    server_time: iso(now),
    sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, { latest_at: v == null ? null : iso(v) }])),
  };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));
let stop: (() => void) | null = null;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUpdates = null;
  mockUpdatesError = null;
});
afterEach(() => {
  stop?.();
  stop = null;
});

test('new content lights the section; opening it clears the dot and remembers that', async () => {
  const now = Date.now();
  serve({ homework: now - 60_000, notices: now - 30 * DAY, events: null, remarks: now - 2 * DAY });
  stop = startUpdates('DEFAULT:student:7');
  await refreshUpdates();

  expect(hasNew('Homework')).toBe(true); // a minute ago, never opened
  expect(hasNew('Remarks')).toBe(true); // inside the first-run window
  expect(hasNew('Notices')).toBe(false); // older than NEW_WINDOW_DAYS on a first run
  expect(NEW_WINDOW_DAYS).toBe(7);
  expect(hasNew('Events')).toBe(false); // empty
  expect(hasNew('Profile')).toBe(false); // no section

  markSeen('Homework');
  expect(hasNew('Homework')).toBe(false);
  await flush();
  const saved = JSON.parse((await AsyncStorage.getItem(`${SEEN_KEY_PREFIX}DEFAULT:student:7`)) || '{}');
  expect(saved.homework).toBeGreaterThanOrEqual(now - 60_000);

  // sign out and back in: what was opened stays seen
  stop();
  stop = startUpdates('DEFAULT:student:7');
  await refreshUpdates();
  expect(hasNew('Homework')).toBe(false);
  expect(hasNew('Remarks')).toBe(true);

  // a teacher adds homework later → the dot is back
  serve({ homework: Date.now() + 5_000, notices: now - 30 * DAY, events: null, remarks: now - 2 * DAY }, Date.now() + 6_000);
  await refreshUpdates();
  expect(hasNew('Homework')).toBe(true);
});

test('seen state is per account; staff routes map to their sections', async () => {
  const now = Date.now();
  serve({ notices: now - 1000, leaves: now - 1000, substitutions: null, timetable: now - 1000, salary: null });
  stop = startUpdates('DEFAULT:teacher:10');
  await refreshUpdates();
  expect(hasNew('StaffNotices')).toBe(true);
  expect(hasNew('Leaves')).toBe(true);
  expect(hasNew('MyTimetable')).toBe(true);
  expect(hasNew('Substitutions')).toBe(false);
  markSeen('StaffNotices');
  expect(hasNew('StaffNotices')).toBe(false);
  stop();

  stop = startUpdates('DEFAULT:teacher:11'); // another teacher on the same phone
  await refreshUpdates();
  expect(hasNew('StaffNotices')).toBe(true);
});

test('a server without /updates shows no dots and keeps quiet', async () => {
  mockUpdatesError = { status: 404 };
  stop = startUpdates('DEFAULT:student:7');
  await expect(refreshUpdates()).resolves.toBeUndefined();
  expect(hasNew('Homework')).toBe(false);
});

// ---------------------------------------------------------------- the dots on screen

const student: Session = { user_id: 7, full_name: 'Dimpal', user_type: 'student', org_code: 'DEFAULT', org_name: 'TRM' };
const props = (): ScreenProps => ({ navigate: jest.fn(), goBack: jest.fn(), onLogout: jest.fn(), session: student });

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  await ReactTestRenderer.act(async () => {});
  return tree;
}

const dotsOn = (tree: ReactTestRenderer.ReactTestRenderer, id: string) => tree.root.findAll(n => n.props.testID === id && typeof n.type === 'string').length;

test('classic and orbit homes draw a dot where something is new, and drop it once seen', async () => {
  const now = Date.now();
  serve({ homework: now - 1000, notices: null, remarks: null, timetable: null, syllabus: null, events: null });
  stop = startUpdates('DEFAULT:student:7');
  await refreshUpdates();

  setUiTheme('default');
  const tree = await render(<HomeStudent {...props()} />);
  expect(dotsOn(tree, 'tile-new-dot')).toBe(1);
  const homework = tree.root.findAll(n => n.props.accessibilityLabel === 'Homework' && n.props.accessibilityValue)[0];
  expect(homework.props.accessibilityValue).toEqual({ text: 'New' });

  await ReactTestRenderer.act(async () => setUiTheme('creative'));
  const orbit = tree.root.findAll(n => n.props.testID === 'orbit-menu' && typeof n.props.onLayout === 'function')[0];
  await ReactTestRenderer.act(async () => {
    orbit.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
  });
  expect(dotsOn(tree, 'orbit-new-dot')).toBe(1);

  await ReactTestRenderer.act(async () => markSeen('Homework'));
  expect(dotsOn(tree, 'orbit-new-dot')).toBe(0);
  await ReactTestRenderer.act(async () => {
    tree.unmount();
  });
  setUiTheme('default');
});

test('orbit checkpoints are bigger and every label card gets a real width', () => {
  for (const [w, h] of [[390, 800], [372, 800], [360, 740]]) {
    const L = orbitLayout(w, h, 15);
    expect(L.node).toBeGreaterThanOrEqual(Math.round(52 * Math.min(1, Math.min(w / 390, h / 760))));
    expect(L.cardMax).toBeGreaterThanOrEqual(100);
    // the card still fits left of the arc's left-most checkpoint, inside the screen
    expect(L.cx - L.r - L.node / 2 - L.gap - L.cardMax).toBeGreaterThanOrEqual(0);
  }
});
