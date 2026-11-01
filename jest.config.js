module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // These libraries ship untranspiled ESM, so let Babel transform them too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-native-documents|react-native-image-picker|react-native-vector-icons|react-native-safe-area-context)/)',
  ],
};
