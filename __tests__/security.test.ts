/**
 * Data at rest + sign-in hardening (Oct 2026 review):
 *  - the refresh token lives in the phone's secure storage (keychain), moved
 *    there from plain AsyncStorage without signing anyone out
 *  - the offline cache keeps personal responses (driver routine: addresses,
 *    phone numbers…) only encrypted; school-wide ones stay plain
 *  - every request carries this install's X-Device-Id; 428 CAPTCHA errors
 *  - the bell is not polled in the background, and less often with push
 */
export {};

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown };

let handler: Handler;
const calls: { url: string; init: RequestInit }[] = [];

function installFetch() {
  calls.length = 0;
  (globalThis as any).fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status, body = {} } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      headers: { get: () => null },
    };
  });
}

const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, '');
/** Node's Buffer (the tests run in Node; the app itself never uses it). */
const NodeBuffer = (globalThis as any).Buffer;
const keychain = () => (globalThis as any).__keychain as Map<string, { password: string }>;
const storage = () => require('@react-native-async-storage/async-storage').default;

const LOGIN = {
  access_token: 'access-1',
  refresh_token: 'rt1.0123456789abcdef0123456789abcdef.1.mac-value-here',
  expires_in: 900,
  user_id: 7,
  user_type: 'driver',
  full_name: 'Ravi',
  must_change_password: false,
};
const ROUTINE = { shifts: [{ students: [{ full_name: 'Aarav', address: '12 Hidden Lane', parent_phone: '9876543210' }] }] };
const NOTICES = [{ id: 1, title: 'Holiday tomorrow' }];

const routes: Handler = (url) => {
  const p = path(url);
  if (p === '/auth/login') return { status: 200, body: LOGIN };
  if (p === '/auth/refresh') return { status: 200, body: { ...LOGIN, access_token: 'access-2' } };
  if (p === '/driver/routine') return { status: 200, body: ROUTINE };
  if (p === '/notices?limit=1') return { status: 200, body: NOTICES };
  return { status: 200, body: {} };
};

async function dump(): Promise<Record<string, string | null>> {
  return storage().getMany(await storage().getAllKeys());
}

/** Fresh modules with the same device storage (AsyncStorage copied, keychain kept). */
async function relaunch(): Promise<typeof import('../src/api')> {
  await require('../src/cache').flushCache(); // like going to the background first
  const saved = await dump();
  jest.resetModules();
  const s = require('@react-native-async-storage/async-storage').default;
  await s.clear();
  await s.setMany(Object.fromEntries(Object.entries(saved).filter(([, v]) => v != null)) as Record<string, string>);
  installFetch();
  return require('../src/api');
}

let api: typeof import('../src/api');

beforeEach(async () => {
  jest.resetModules();
  (globalThis as any).__keychainFail = false;
  keychain().clear();
  await storage().clear();
  handler = routes;
  installFetch();
  api = require('../src/api');
});

afterEach(async () => {
  (globalThis as any).__keychainFail = false;
  await require('../src/session').endSession('logout');
});

/* --------------------------------- crypto ---------------------------------- */

describe('cryptoBox', () => {
  const box = () => require('../src/cryptoBox') as typeof import('../src/cryptoBox');

  it('round-trips UTF-8 (Hindi, emoji) and base64 like Buffer does', () => {
    const { utf8Encode, utf8Decode, toBase64, fromBase64 } = box();
    const text = 'नमस्ते Aarav 👋 ₹3,000 — "ok"';
    const bytes = utf8Encode(text);
    expect(NodeBuffer.from(bytes).toString('utf8')).toBe(text);
    expect(utf8Decode(bytes)).toBe(text);
    for (const n of [0, 1, 2, 3, 31, 1000]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256);
      expect(toBase64(b)).toBe(NodeBuffer.from(b).toString('base64'));
      expect(Array.from(fromBase64(toBase64(b)))).toEqual(Array.from(b));
    }
  });

  it('seals and opens; a changed byte or the wrong key gives null', () => {
    const { seal, open, newKey } = box();
    const key = newKey(null, 'driver:7')!;
    const other = newKey(null, 'driver:7')!;
    const sealed = seal(key, '{"phone":"9876543210"}');
    expect(sealed).toMatch(/^x1\./);
    expect(sealed).not.toContain('9876543210');
    expect(open(key, sealed)).toBe('{"phone":"9876543210"}');
    expect(open(other, sealed)).toBeNull();
    const flipped = sealed.slice(0, -6) + (sealed.slice(-6, -5) === 'A' ? 'B' : 'A') + sealed.slice(-5);
    expect(open(key, flipped)).toBeNull();
    expect(open(key, 'garbage')).toBeNull();
  });

  it('without a platform random source, keys come from the seed (and never from nothing)', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    try {
      const { newKey, seal, open } = box();
      expect(newKey(null, 'driver:7')).toBeNull();
      expect(newKey('short', 'driver:7')).toBeNull();
      const a = newKey(LOGIN.refresh_token, 'driver:7')!;
      const b = newKey(LOGIN.refresh_token, 'driver:7')!;
      expect(NodeBuffer.from(a, 'base64')).toHaveLength(32);
      expect(a).not.toBe(b); // clock + noise mixed in
      const s1 = seal(a, 'x');
      expect(seal(a, 'x')).not.toBe(s1); // unique nonces
      expect(open(a, s1)).toBe('x');
    } finally {
      if (desc) Object.defineProperty(globalThis, 'crypto', desc);
      else delete (globalThis as any).crypto;
    }
  });
});

/* ------------------------------ refresh token ------------------------------ */

describe('refresh token storage', () => {
  it('is kept in the keychain, not in AsyncStorage', async () => {
    await api.login('ravi', 'secret');
    const all = JSON.stringify(await dump());
    expect(all).not.toContain(LOGIN.refresh_token);
    expect(keychain().size).toBe(1);
    expect(JSON.stringify([...keychain().values()])).toContain(LOGIN.refresh_token);
  });

  it('an older build’s token in AsyncStorage is moved to the keychain without signing out', async () => {
    const s = storage();
    await s.setItem('sw_app_session', JSON.stringify({ user_id: 7, user_type: 'driver', full_name: 'Ravi' }));
    await s.setItem('sw_app_refresh_token', 'rt1.legacy-session.3.mac');
    await expect(api.loadSession()).resolves.toMatchObject({ user_id: 7 });
    expect(await s.getItem('sw_app_refresh_token')).toBeNull();
    expect(JSON.stringify([...keychain().values()])).toContain('rt1.legacy-session.3.mac');
    await api.api('/me'); // refreshes with the moved token
    const refresh = calls.find(c => path(c.url) === '/auth/refresh');
    expect(JSON.parse(String(refresh!.init.body))).toEqual({ refresh_token: 'rt1.legacy-session.3.mac' });
  });

  it('a phone whose keystore fails keeps working the old way (stays signed in)', async () => {
    (globalThis as any).__keychainFail = true;
    await api.login('ravi', 'secret');
    expect(await storage().getItem('sw_app_refresh_token')).toBe(LOGIN.refresh_token);
    const fresh = await relaunch();
    await expect(fresh.loadSession()).resolves.toMatchObject({ user_id: 7 });
  });

  it('JS running on an older build without the keychain module: signs in at once, old storage', async () => {
    (globalThis as any).__keychainMissing = true;
    try {
      const started = Date.now();
      await api.login('ravi', 'secret');
      expect(Date.now() - started).toBeLessThan(100); // no keystore retry wait
      expect(await storage().getItem('sw_app_refresh_token')).toBe(LOGIN.refresh_token);
      const fresh = await relaunch();
      await expect(fresh.loadSession()).resolves.toMatchObject({ user_id: 7 });
    } finally {
      (globalThis as any).__keychainMissing = false;
    }
  });

  it('sign-out removes the token and the cache key from the keychain', async () => {
    await api.login('ravi', 'secret');
    await api.api('/driver/routine');
    await require('../src/cache').flushCache();
    expect(JSON.parse([...keychain().values()][0].password)).toHaveProperty('cache_key');
    await api.logout();
    expect(keychain().size).toBe(0);
    const left = await dump();
    expect(Object.keys(left).filter(k => k.startsWith('sw_app_cache'))).toEqual([]);
  });
});

/* ------------------------------- offline cache ----------------------------- */

describe('offline cache at rest', () => {
  it('classifies school-wide vs personal responses', () => {
    const { isSchoolWide } = require('../src/cache');
    for (const p of ['/notices?limit=1', '/student/timetable', '/timetable/week?start=2026-10-26', '/holidays?year=2026',
      '/exams/stats', '/classes', '/settings/school-timings', '/updates', '/student/documents?kind=timetable']) {
      expect([p, isSchoolWide(p)]).toEqual([p, true]);
    }
    for (const p of ['/driver/routine', '/students?class_id=1', '/students/4', '/users/teachers', '/auth/me',
      '/student/dashboard', '/student/fees', '/vehicles', '/salaries', '/enquiries', '/exams/3', '/notifications',
      '/student/messages', '/notices-private']) {
      expect([p, isSchoolWide(p)]).toEqual([p, false]);
    }
  });

  it('personal data is only on disk encrypted; both kinds come back after a relaunch', async () => {
    await api.login('ravi', 'secret');
    await api.api('/driver/routine');
    await api.api('/notices?limit=1');
    await require('../src/cache').flushCache();

    const all = await dump();
    const blob = JSON.stringify(all);
    expect(blob).not.toContain('9876543210');
    expect(blob).not.toContain('Hidden Lane');
    expect(all.sw_app_cache_v2).toContain('Holiday tomorrow');
    expect(all.sw_app_cache_secure_v1).toMatch(/^x1\./);

    const fresh = await relaunch();
    await fresh.loadSession();
    expect(fresh.peek('/driver/routine')).toEqual(ROUTINE);
    expect(fresh.peek('/notices?limit=1')).toEqual(NOTICES);
  });

  it('an older build’s plain-text cache is still used, then re-saved encrypted', async () => {
    const s = storage();
    await s.setItem('sw_app_session', JSON.stringify({ user_id: 7, user_type: 'driver', full_name: 'Ravi' }));
    await s.setItem('sw_app_refresh_token', 'rt1.legacy-session.3.mac');
    const at = Date.now() - 60_000;
    await s.setItem('sw_app_cache_v1', JSON.stringify({
      owner: 'driver:7',
      entries: [['/driver/routine', { data: ROUTINE, at, size: 120 }], ['/notices?limit=1', { data: NOTICES, at, size: 40 }]],
    }));

    await api.loadSession();
    expect(api.peek('/driver/routine')).toEqual(ROUTINE); // instant open still works
    await require('../src/cache').flushCache();
    const all = await dump();
    expect(all.sw_app_cache_v1).toBeUndefined();
    expect(JSON.stringify(all)).not.toContain('9876543210');

    const fresh = await relaunch();
    await fresh.loadSession();
    expect(fresh.peek('/driver/routine')).toEqual(ROUTINE);
    expect(fresh.peek('/notices?limit=1')).toEqual(NOTICES);
  });

  it('without secure storage, personal responses stay in memory only', async () => {
    (globalThis as any).__keychainFail = true;
    await api.login('ravi', 'secret');
    await api.api('/driver/routine');
    await api.api('/notices?limit=1');
    expect(api.peek('/driver/routine')).toEqual(ROUTINE); // still instant while the app runs
    await require('../src/cache').flushCache();
    const all = await dump();
    expect(JSON.stringify(all)).not.toContain('9876543210');
    expect(all.sw_app_cache_secure_v1).toBeUndefined();
    expect(all.sw_app_cache_v2).toContain('Holiday tomorrow');
  });

  it('another user signing in on the phone cannot read the previous cache', async () => {
    await api.login('ravi', 'secret');
    await api.api('/driver/routine');
    await require('../src/cache').flushCache();
    const sealed = (await dump()).sw_app_cache_secure_v1;
    await api.logout();
    handler = (url, init) =>
      path(url) === '/auth/login' ? { status: 200, body: { ...LOGIN, user_id: 8, full_name: 'Other' } } : routes(url, init);
    await api.login('other', 'secret');
    expect(api.peek('/driver/routine')).toBeNull();
    await storage().setItem('sw_app_cache_secure_v1', sealed!); // even if the old blob were still there
    const fresh = await relaunch();
    await fresh.loadSession();
    expect(fresh.peek('/driver/routine')).toBeNull();
  });
});

/* --------------------------------- sign-in --------------------------------- */

describe('sign-in hardening', () => {
  it('sends a stable X-Device-Id on every request (kept across launches)', async () => {
    await api.login('ravi', 'secret');
    await api.api('/notices?limit=1');
    const ids = calls.map(c => (c.init.headers as Record<string, string>)['X-Device-Id']);
    expect(ids[0]).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(new Set(ids).size).toBe(1);
    const fresh = await relaunch();
    await fresh.loadSession();
    await fresh.api('/notices?limit=1');
    expect((calls[calls.length - 1].init.headers as Record<string, string>)['X-Device-Id']).toBe(ids[0]);
  });

  it('login asks for the picture only when the server says so (428 + code)', async () => {
    let body: any = null;
    handler = (url, init) => {
      if (path(url) === '/auth/captcha') return { status: 200, body: { captcha_id: 'c1', image: 'data:image/png;base64,AA==', expires_in: 300, length: 5 } };
      body = JSON.parse(String(init.body));
      return body.captcha_id
        ? { status: 200, body: LOGIN }
        : { status: 428, body: { detail: 'Type the characters in the picture to continue.', code: 'captcha_required' } };
    };
    const err = await api.login('ravi', 'wrong').catch(e => e);
    expect(body).toMatchObject({ username: 'ravi', captcha_supported: true });
    expect(api.needsCaptcha(err)).toBe(true);
    expect(err.code).toBe('captcha_required');
    const pic = await api.getCaptcha();
    await api.login('ravi', 'secret', 'DEFAULT', { id: pic.captcha_id, answer: 'ABCDE' });
    expect(body).toMatchObject({ org_code: 'DEFAULT', captcha_id: 'c1', captcha_answer: 'ABCDE', captcha_supported: true });
    expect(api.needsCaptcha(new api.ApiError('x', { status: 401 }))).toBe(false);
  });
});

/* ------------------------------ bell polling ------------------------------- */

describe('unread-count polling', () => {
  it('pauses in the background, catches up on resume, slows down with push', async () => {
    jest.resetModules();
    jest.useFakeTimers();
    let fg = true;
    const bg: (() => void)[] = [];
    const resume: ((ms: number) => void)[] = [];
    let polls = 0;
    jest.doMock('../src/api', () => ({
      api: jest.fn(async () => {
        polls++;
        return { count: 2 };
      }),
    }));
    jest.doMock('../src/appEvents', () => ({
      isAppInForeground: () => fg,
      onAppBackground: (fn: () => void) => {
        bg.push(fn);
        return () => {};
      },
      onAppResume: (fn: (ms: number) => void) => {
        resume.push(fn);
        return () => {};
      },
    }));
    const n = require('../src/notifications') as typeof import('../src/notifications');
    try {
      const stop = n.startUnreadPolling();
      await jest.advanceTimersByTimeAsync(0);
      expect(polls).toBe(1);
      await jest.advanceTimersByTimeAsync(n.POLL_MS);
      expect(polls).toBe(2);

      fg = false;
      bg.forEach(fn => fn());
      await jest.advanceTimersByTimeAsync(10 * n.POLL_MS);
      expect(polls).toBe(2); // nothing while in the background

      fg = true;
      resume.forEach(fn => fn(10 * n.POLL_MS));
      await jest.advanceTimersByTimeAsync(0);
      expect(polls).toBe(3); // at once on return

      n.setPushActive(true);
      await jest.advanceTimersByTimeAsync(2 * n.POLL_MS);
      expect(polls).toBe(3);
      await jest.advanceTimersByTimeAsync(n.POLL_WITH_PUSH_MS);
      expect(polls).toBe(4);

      stop();
      await jest.advanceTimersByTimeAsync(10 * n.POLL_WITH_PUSH_MS);
      expect(polls).toBe(4);
    } finally {
      jest.useRealTimers();
      jest.dontMock('../src/api');
      jest.dontMock('../src/appEvents');
    }
  });
});
