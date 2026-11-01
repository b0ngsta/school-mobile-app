// Token refresh: single-flight, retry, expiry and the forced password change.
type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown; headers?: Record<string, string> };

let handler: Handler;
const calls: { url: string; init: RequestInit }[] = [];

function installFetch() {
  calls.length = 0;
  (globalThis as any).fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    await new Promise<void>(r => setTimeout(r, 0)); // let parallel calls overlap
    const { status, body = {}, headers = {} } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      headers: { get: (n: string) => headers[n] ?? null },
    };
  });
}

const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, '');
const auth = (init: RequestInit) => (init.headers as Record<string, string>)?.Authorization;
const bodyOf = (init: RequestInit) => (init.body ? JSON.parse(String(init.body)) : {});

const LOGIN = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 900,
  user_id: 7,
  user_type: 'teacher',
  full_name: 'Asha',
  must_change_password: false,
};

let api: typeof import('../src/api');

beforeEach(async () => {
  jest.resetModules();
  const storage = require('@react-native-async-storage/async-storage').default;
  await storage.clear();
  installFetch();
  api = require('../src/api');
});

// Clears the cache's pending save timer so Jest can exit cleanly.
afterEach(async () => {
  await require('../src/session').endSession('logout');
});

it('refreshes once for parallel 401s, then retries each call', async () => {
  let refreshes = 0;
  handler = (url, init) => {
    const p = path(url);
    if (p === '/auth/login') return { status: 200, body: LOGIN };
    if (p === '/auth/refresh') {
      refreshes++;
      expect(bodyOf(init)).toEqual({ refresh_token: 'refresh-1' });
      return { status: 200, body: { access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 900 } };
    }
    return auth(init) === 'Bearer access-2' ? { status: 200, body: { ok: p } } : { status: 401, body: { detail: 'expired' } };
  };

  await api.login('asha', 'secret');
  const results = await Promise.all([api.api('/a'), api.api('/b'), api.api('/c')]);

  expect(results.map(r => r.ok)).toEqual(['/a', '/b', '/c']);
  expect(refreshes).toBe(1);
  // the rotated refresh token is the one stored
  const { tokenStore } = require('../src/tokenStore');
  await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-2');
});

it('ends the session when the refresh token is rejected', async () => {
  handler = (url) => {
    const p = path(url);
    if (p === '/auth/login') return { status: 200, body: LOGIN };
    return { status: 401, body: { detail: 'Invalid refresh token' } };
  };
  await api.login('asha', 'secret');
  const events: (string | undefined)[] = [];
  api.onSessionChange((s, reason) => !s && events.push(reason));

  await expect(api.api('/anything')).rejects.toMatchObject({ status: 401 });
  expect(api.getSession()).toBeNull();
  expect(events).toEqual(['expired']);
});

it('keeps the session when the refresh fails for network reasons', async () => {
  let offline = false;
  (globalThis as any).fetch = jest.fn(async (url: string) => {
    if (offline) throw new TypeError('Network request failed');
    if (path(url) === '/auth/login') return { ok: true, status: 200, json: async () => LOGIN, headers: { get: () => null } };
    return { ok: false, status: 401, json: async () => ({}), headers: { get: () => null } };
  });
  await api.login('asha', 'secret');
  offline = true;
  await expect(api.api('/x')).rejects.toMatchObject({ status: 0 });
  expect(api.getSession()).not.toBeNull();
});

it('flags the session when the server requires a password change', async () => {
  handler = (url) => {
    const p = path(url);
    if (p === '/auth/login') return { status: 200, body: LOGIN };
    return { status: 403, body: { detail: 'Password change required' } };
  };
  await api.login('asha', 'secret');
  await expect(api.api('/students')).rejects.toMatchObject({ status: 403 });
  expect(api.getSession()?.must_change_password).toBe(true);
});

it('restores the session on the next launch without persisting the access token', async () => {
  handler = () => ({ status: 200, body: LOGIN });
  await api.login('asha', 'secret');
  const storage = require('@react-native-async-storage/async-storage').default;
  const raw = await storage.getItem('sw_app_session');
  expect(raw).not.toContain('access-1');
  const saved = await storage.getMany(await storage.getAllKeys());

  // "Relaunch": fresh modules, same device storage.
  jest.resetModules();
  await require('@react-native-async-storage/async-storage').default.setMany(saved);
  installFetch();
  const fresh: typeof import('../src/api') = require('../src/api');
  handler = (url, init) =>
    path(url) === '/auth/refresh'
      ? { status: 200, body: { access_token: 'access-9', refresh_token: 'refresh-9', expires_in: 900 } }
      : { status: 200, body: { auth: auth(init) } };
  await expect(fresh.loadSession()).resolves.toMatchObject({ user_id: 7, full_name: 'Asha' });
  // no access token in memory yet → refreshed before the first request
  await expect(fresh.api('/me')).resolves.toEqual({ auth: 'Bearer access-9' });
});

it('logout revokes on the server and clears local state', async () => {
  handler = () => ({ status: 200, body: LOGIN });
  await api.login('asha', 'secret');
  await api.logout();
  const logoutCall = calls.find(c => path(c.url) === '/auth/logout');
  expect(logoutCall && bodyOf(logoutCall.init)).toEqual({ refresh_token: 'refresh-1' });
  expect(api.getSession()).toBeNull();
});
