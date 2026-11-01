// Where the long-lived refresh token is kept between app launches.
//
// The access token is never written to disk (session.ts keeps it in memory).
// The refresh token should live in the OS keychain (iOS Keychain / Android
// Keystore). The project has no keychain library yet, so this falls back to
// AsyncStorage. To switch, install one (e.g. `react-native-keychain`), rebuild
// the native app, and replace the three functions below — nothing else in the
// app touches the storage directly.
import AsyncStorage from '@react-native-async-storage/async-storage';

const REFRESH_KEY = 'sw_app_refresh_token';

export const tokenStore = {
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string | null): Promise<void> {
    try {
      if (token) await AsyncStorage.setItem(REFRESH_KEY, token);
      else await AsyncStorage.removeItem(REFRESH_KEY);
    } catch {
      // Storage failures only cost the user a re-login on next launch.
    }
  },

  async clear(): Promise<void> {
    await this.setRefreshToken(null);
  },
};
