/* eslint-env jest */
// Native modules don't exist under Jest — swap in mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// react-native-keychain (secureStore.ts): an in-memory keychain that, like the
// real one, survives jest.resetModules() ("relaunch"); global.__keychain.clear()
// wipes it. Tests can make it fail with global.__keychainFail = true (broken
// keystore) or global.__keychainMissing = true (native module not in the build).
global.__keychain = global.__keychain || new Map();
jest.mock('react-native-keychain', () => {
  const items = global.__keychain;
  const guard = () => {
    // __keychainMissing: like a build without the native module (TypeError on the undefined module)
    if (global.__keychainMissing) throw new TypeError("Cannot read property 'getGenericPasswordForOptions' of undefined");
    if (global.__keychainFail) throw new Error('keystore unavailable');
  };
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
    setGenericPassword: jest.fn(async (username, password, opts = {}) => {
      guard();
      items.set(opts.service || 'default', { username, password, service: opts.service || 'default' });
      return { service: opts.service || 'default', storage: 'KeystoreAESGCM_NoAuth' };
    }),
    getGenericPassword: jest.fn(async (opts = {}) => {
      guard();
      return items.get(opts.service || 'default') || false;
    }),
    resetGenericPassword: jest.fn(async (opts = {}) => {
      guard();
      return items.delete(opts.service || 'default') || true;
    }),
    __items: items,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: { pdf: 'application/pdf', images: 'image/*', csv: ['text/csv', 'text/comma-separated-values'], plainText: 'text/plain', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: e => !!e && typeof e === 'object' && 'code' in e,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, edges, ...rest }) => React.createElement(View, rest, children),
    useSafeAreaInsets: () => insets,
  };
});

// react-native-pdf renders through a native view (FileViewer, NoticeDetail).
jest.mock('react-native-pdf', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function Pdf(props) {
    return React.createElement(View, { testID: 'pdf-view', source: props.source });
  };
});

// Firebase messaging (push.ts) is native-only; PUSH_ENABLED is true, so stub it.
jest.mock('@react-native-firebase/messaging', () => {
  const off = () => () => {};
  return {
    getMessaging: jest.fn(() => ({})),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    deleteToken: jest.fn(() => Promise.resolve()),
    onTokenRefresh: jest.fn(off),
    onMessage: jest.fn(off),
    onNotificationOpenedApp: jest.fn(off),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
  };
}, { virtual: true });
