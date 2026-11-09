// Authenticated encryption for data kept on the phone (the offline cache in
// cache.ts): XChaCha20-Poly1305 from @noble/ciphers (audited, pure JS — no
// native module). The 32-byte key itself lives in secure storage
// (secureStore.ts); only ciphertext goes to AsyncStorage.
//
// Randomness: Hermes has no crypto.getRandomValues, so when it is missing a
// key is derived with HKDF-SHA256 from a high-entropy secret the caller
// passes (the server-issued refresh token) mixed with the clock — never from
// Math.random alone. Nonces only need to be unique, not secret: 24 bytes from
// the clock, a counter and Math.random.
/* eslint-disable no-bitwise -- byte encodings */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

const VERSION = 'x1.';
const INFO = 'edumanage offline cache v1';

/* ------------------------------- encodings -------------------------------- */

export function utf8Encode(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 3);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out[n++] = c;
    else if (c < 0x800) {
      out[n++] = 0xc0 | (c >> 6);
      out[n++] = 0x80 | (c & 63);
    } else if (c < 0x10000) {
      out[n++] = 0xe0 | (c >> 12);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    } else {
      out[n++] = 0xf0 | (c >> 18);
      out[n++] = 0x80 | ((c >> 12) & 63);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    }
  }
  return out.subarray(0, n);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  let chunk: number[] = [];
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    if (c >= 0x10000) {
      c -= 0x10000;
      chunk.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    } else chunk.push(c);
    if (chunk.length >= 4096) {
      s += String.fromCharCode.apply(null, chunk);
      chunk = [];
    }
  }
  return s + String.fromCharCode.apply(null, chunk);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function toBase64(b: Uint8Array): string {
  let s = '';
  let chunk: number[] = [];
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const v = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    chunk.push(B64.charCodeAt(v >> 18), B64.charCodeAt((v >> 12) & 63), B64.charCodeAt((v >> 6) & 63), B64.charCodeAt(v & 63));
    if (chunk.length >= 4096) {
      s += String.fromCharCode.apply(null, chunk);
      chunk = [];
    }
  }
  const rest = b.length - i;
  if (rest === 1) {
    const v = b[i] << 16;
    chunk.push(B64.charCodeAt(v >> 18), B64.charCodeAt((v >> 12) & 63), 61, 61);
  } else if (rest === 2) {
    const v = (b[i] << 16) | (b[i + 1] << 8);
    chunk.push(B64.charCodeAt(v >> 18), B64.charCodeAt((v >> 12) & 63), B64.charCodeAt((v >> 6) & 63), 61);
  }
  return s + String.fromCharCode.apply(null, chunk);
}

/** Decode base64 (throws on anything that isn't). */
export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[=]+$/, '');
  if (clean.length % 4 === 1) throw new Error('bad base64');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? B64_INDEX[code] : -1;
    if (v < 0) throw new Error('bad base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
    }
  }
  return out.subarray(0, n);
}

/* --------------------------------- keys ----------------------------------- */

type RandomSource = { getRandomValues?: (a: Uint8Array) => Uint8Array };
const webCrypto = (): RandomSource | undefined => (globalThis as { crypto?: RandomSource }).crypto;

let counter = 0;

function nonce(): Uint8Array {
  const n = new Uint8Array(24);
  const c = webCrypto();
  if (c?.getRandomValues) {
    c.getRandomValues(n);
    return n;
  }
  // unique, not secret: time + counter + noise, hashed together
  counter = (counter + 1) >>> 0;
  return sha256(utf8Encode(`${Date.now()}:${counter}:${Math.random()}:${Math.random()}`)).subarray(0, 24);
}

/**
 * A fresh 32-byte key (base64). Uses the platform's secure random generator
 * when there is one, else HKDF over `seed` — which must be a secret with
 * plenty of entropy (the server-issued refresh token) — plus the clock.
 * Returns null when neither is available.
 */
export function newKey(seed: string | null, salt: string): string | null {
  const c = webCrypto();
  if (c?.getRandomValues) return toBase64(c.getRandomValues(new Uint8Array(32)));
  if (!seed || seed.length < 16) return null;
  const ikm = utf8Encode(`${seed}|${Date.now()}|${Math.random()}|${Math.random()}`);
  // all inputs as bytes: noble would need TextEncoder for strings (older Hermes has none)
  return toBase64(hkdf(sha256, ikm, utf8Encode(salt), utf8Encode(INFO), 32));
}

/* ------------------------------ seal / open -------------------------------- */

/** Encrypt text with a base64 key → "x1.<base64(nonce | ciphertext+tag)>". */
export function seal(keyB64: string, text: string): string {
  const key = fromBase64(keyB64);
  const iv = nonce();
  const ct = xchacha20poly1305(key, iv).encrypt(utf8Encode(text));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return VERSION + toBase64(out);
}

/** Decrypt what seal() produced; null if the key is wrong or the data was changed. */
export function open(keyB64: string, sealed: string): string | null {
  try {
    if (!sealed.startsWith(VERSION)) return null;
    const raw = fromBase64(sealed.slice(VERSION.length));
    if (raw.length < 24 + 16) return null;
    const pt = xchacha20poly1305(fromBase64(keyB64), raw.subarray(0, 24)).decrypt(raw.subarray(24));
    return utf8Decode(pt);
  } catch {
    return null;
  }
}
