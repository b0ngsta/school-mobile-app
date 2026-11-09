#!/usr/bin/env node
/*
 * Creates this app's private release ("upload") key — once, on your computer.
 *
 *   npm run keystore
 *
 * Writes (both git-ignored, never commit them):
 *   android/app/upload.keystore   the key (PKCS12, RSA 2048, valid ~27 years)
 *   android/keystore.properties   where it is + its password, read by android/app/build.gradle
 *
 * BACK BOTH FILES UP somewhere safe (password manager / encrypted drive).
 * Every future update of the app must be signed with this same key. With
 * Google Play App Signing a lost upload key can be reset through Play
 * support; without it a lost key means a new app listing.
 *
 * Needs `keytool`, which comes with the JDK used for Android builds.
 * Refuses to overwrite an existing key.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const android = path.join(__dirname, '..', 'android');
const storeFile = path.join(android, 'app', 'upload.keystore');
const propsFile = path.join(android, 'keystore.properties');
const alias = 'upload';

function keytool() {
  const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
  const home = process.env.JAVA_HOME;
  if (home && fs.existsSync(path.join(home, 'bin', exe))) return path.join(home, 'bin', exe);
  return exe; // from PATH
}

if (fs.existsSync(storeFile) || fs.existsSync(propsFile)) {
  console.error(
    'An upload key already exists (android/app/upload.keystore or android/keystore.properties).\n' +
      'Not overwriting it: apps signed with it could no longer be updated.\n' +
      'If you really want a new key, move both files somewhere else first.',
  );
  process.exit(1);
}

// PKCS12 keystores use one password for the store and the key.
const password = crypto.randomBytes(24).toString('base64url');
const dname = process.env.SW_KEY_DNAME || 'CN=EduManage, OU=Mobile, O=EduManage';

try {
  execFileSync(
    keytool(),
    [
      '-genkeypair',
      '-storetype', 'PKCS12',
      '-keystore', storeFile,
      '-alias', alias,
      '-keyalg', 'RSA',
      '-keysize', '2048',
      '-validity', '10000',
      '-dname', dname,
      '-storepass:env', 'SW_KS_PASS',
      '-keypass:env', 'SW_KS_PASS',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, SW_KS_PASS: password } },
  );
} catch (e) {
  console.error(`\nkeytool failed (${e.message}). Is a JDK installed (JAVA_HOME / keytool on PATH)?`);
  process.exit(1);
}

fs.writeFileSync(
  propsFile,
  [
    '# Release signing for android/app/build.gradle — PRIVATE: never commit, back up with upload.keystore.',
    `# Created ${new Date().toISOString()} by npm run keystore`,
    'SW_UPLOAD_STORE_FILE=app/upload.keystore',
    `SW_UPLOAD_STORE_PASSWORD=${password}`,
    `SW_UPLOAD_KEY_ALIAS=${alias}`,
    `SW_UPLOAD_KEY_PASSWORD=${password}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
fs.chmodSync(storeFile, 0o600);

let fingerprint = '';
try {
  const out = execFileSync(keytool(), ['-list', '-v', '-keystore', storeFile, '-alias', alias, '-storepass:env', 'SW_KS_PASS'], {
    env: { ...process.env, SW_KS_PASS: password },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  fingerprint = (out.match(/SHA256:\s*([0-9A-F:]+)/i) || [])[1] || '';
} catch {}

console.log(`
Upload key created:
  android/app/upload.keystore
  android/keystore.properties   (holds the password)
${fingerprint ? `  SHA-256 fingerprint: ${fingerprint}\n` : ''}
Next:
  1. BACK UP both files now (password manager / encrypted drive). Never commit them.
  2. npm run aab   → android/app/build/outputs/bundle/release/app-release.aab (upload to Google Play)
     npm run apk   → android/app/build/outputs/apk/release/app-release.apk (install directly)
  Phones with the old debug-signed app must uninstall it once before installing this one.
`);
