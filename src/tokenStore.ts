// Where the long-lived refresh token is kept between app launches.
//
// The access token is never written to disk (session.ts keeps it in memory).
// The refresh token lives in the phone's secure storage (secureStore.ts:
// Android Keystore via react-native-keychain).
//
// Builds before Oct 2026 kept it in plain AsyncStorage ('sw_app_refresh_token').
// That copy is moved into secure storage on the first read, so nobody is
// signed out by the update. The AsyncStorage key is still used as a fallback
// on a phone where the secure storage fails — the user then stays signed in
// exactly as before instead of having to sign in on every launch. A value
// there is therefore always the newest one (a successful secure write
// removes it), so it is read first.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStore } from './secureStore';

const LEGACY_KEY = 'sw_app_refresh_token';
const SECRET = 'refresh_token';

async function readLegacy(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

async function removeLegacy(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export const tokenStore = {
  async getRefreshToken(): Promise<string | null> {
    const legacy = await readLegacy();
    if (legacy) {
      // move it into secure storage (keeps the user signed in)
      if (await secureStore.set(SECRET, legacy)) await removeLegacy();
      return legacy;
    }
    return secureStore.get(SECRET);
  },

  async setRefreshToken(token: string | null): Promise<void> {
    if (!token) {
      await Promise.all([secureStore.set(SECRET, null), removeLegacy()]);
      return;
    }
    if (await secureStore.set(SECRET, token)) {
      await removeLegacy();
      return;
    }
    try {
      // Secure storage unavailable on this phone: keep the old behaviour.
      await AsyncStorage.setItem(LEGACY_KEY, token);
    } catch {
      // Storage failures only cost the user a re-login on next launch.
    }
  },

  /** Sign-out: the refresh token and every other secret (the cache key too). */
  async clear(): Promise<void> {
    await Promise.all([secureStore.clear(), removeLegacy()]);
  },
};
