import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Which API server the app talks to, picked at run time:
// 1. EXPO_PUBLIC_API_URL, if set when the bundle is built (CI builds can point an APK at any server).
// 2. Release builds (APKs, store builds): the production server.
// 3. Development (npx expo start): the local backend on the computer running Expo, port 4000.
//    Its address comes from the Expo dev server, so Expo Go on a phone on the same Wi-Fi and
//    emulators both work without edits. Android emulators fall back to 10.0.2.2 (the host machine).
export const PROD_API = 'https://jaathiya-vaartalu-studio-app.onrender.com';
const LOCAL_PORT = 4000;

function devApi() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:${LOCAL_PORT}`;
  return `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${LOCAL_PORT}`;
}

const override = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
export const API_BASE = override || (__DEV__ ? devApi() : PROD_API);
