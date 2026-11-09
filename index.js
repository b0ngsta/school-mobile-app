import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { registerBackgroundPushHandler } from './src/push';

// Firebase pushes while the app is in the background / killed (no-op while push is off).
registerBackgroundPushHandler();

AppRegistry.registerComponent(appName, () => App);
