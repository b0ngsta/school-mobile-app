// A random id for this app install, sent as `X-Device-Id` on every request.
// The server uses it to throttle sign-in attempts per account AND phone, so
// many parents behind one school / mobile-network IP address don't lock each
// other out (backend services/login_throttle.py). Not a secret, not tied to
// the hardware; kept after sign-out, new after a reinstall.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sw_device_id';
/** What the server accepts: 8–64 letters, digits, `.`, `_`, `-`. */
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

let pending: Promise<string> | null = null;

function makeId(): string {
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(36).padStart(7, '0');
  return `a-${Date.now().toString(36)}-${rand()}${rand()}${rand()}`;
}

/** This install's id (created and saved on first use). */
export function getDeviceId(): Promise<string> {
  if (!pending) {
    pending = (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && VALID.test(saved)) return saved;
      } catch {}
      const id = makeId();
      try {
        await AsyncStorage.setItem(KEY, id);
      } catch {}
      return id;
    })();
  }
  return pending;
}
