// Small secrets kept in the phone's secure storage (Android Keystore / iOS
// Keychain) through react-native-keychain: the refresh token and the key that
// encrypts the offline cache (cache.ts). Not for anything big — every write
// re-encrypts the whole (tiny) record.
//
// All secrets live in ONE keychain item (a small JSON object), so a cold start
// costs one Keystore read. A copy is kept in memory after the first read.
//
// If the secure storage can't be used (native module missing — e.g. JS newer
// than the installed build — or a broken Keystore on some phones), `set`
// returns false and callers fall back to what they did before
// (tokenStore.ts → AsyncStorage; cache.ts → personal data stays in memory only).
import * as Keychain from 'react-native-keychain';

const SERVICE = 'edumanage.secure.v1';
const ACCOUNT = 'edumanage';

type Vault = Record<string, string>;

let vault: Vault | null = null;
let available = true;
let loading: Promise<void> | null = null;
/** Writes run one after another; each writes the latest state. */
let writing: Promise<boolean> = Promise.resolve(true);

function parse(raw: string): Vault {
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Vault = {};
    for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
    return out;
  } catch {
    return {};
  }
}

async function readOnce(): Promise<Vault> {
  const res = await Keychain.getGenericPassword({ service: SERVICE });
  return res ? parse(res.password) : {};
}

function load(): Promise<void> {
  if (vault) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        vault = await readOnce();
      } catch (e) {
        if (e instanceof TypeError) {
          // the native module isn't in this build (JS newer than the APK): no point retrying
          available = false;
          vault = {};
          return;
        }
        // one retry: a Keystore hiccup must not sign the user out
        try {
          await new Promise<void>(r => setTimeout(r, 150));
          vault = await readOnce();
        } catch {
          available = false;
          vault = {};
        }
      }
    })();
  }
  return loading;
}

async function persist(): Promise<boolean> {
  if (!available) return false;
  const snapshot = vault ?? {};
  try {
    if (Object.keys(snapshot).length === 0) {
      await Keychain.resetGenericPassword({ service: SERVICE });
    } else {
      const ok = await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(snapshot), {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      if (!ok) throw new Error('keychain write refused');
    }
    return true;
  } catch {
    available = false;
    return false;
  }
}

export const secureStore = {
  /** The stored value, or null (none, or secure storage unavailable). */
  async get(name: string): Promise<string | null> {
    await load();
    return available ? vault?.[name] ?? null : null;
  },

  /** Store (or with null, remove) a value. Resolves false when it could not be stored securely. */
  async set(name: string, value: string | null): Promise<boolean> {
    await load();
    if (!available) return false;
    const next: Vault = { ...(vault ?? {}) };
    if (value == null) delete next[name];
    else next[name] = value;
    vault = next;
    writing = writing.then(persist, persist);
    return writing;
  },

  /** Forget everything (sign-out). */
  async clear(): Promise<void> {
    await load();
    vault = {};
    if (!available) {
      // Best effort even when writes failed before: an item may still exist.
      try {
        await Keychain.resetGenericPassword({ service: SERVICE });
      } catch {}
      return;
    }
    writing = writing.then(persist, persist);
    await writing;
  },

  /** false once the secure storage failed on this phone (this run). */
  isAvailable(): boolean {
    return available;
  },
};
