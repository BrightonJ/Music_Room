import Constants, { ExecutionEnvironment } from 'expo-constants';
import { apiFetch } from './api';

// The Google Sign-In SDK is a native module: they exist in the app builds
// (EAS / expo run) but NOT in Expo Go. They are loaded only when a button is
// pressed, so the rest of the app keeps working in Expo Go.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function requireNative<T>(load: () => T, provider: string): T {
  if (IN_EXPO_GO) {
    throw new Error(`${provider} sign-in needs the Music Room app build, it does not work in Expo Go. Use your email and password here.`);
  }
  return load();
}

const googleSdk = () =>
  requireNative(
    () => require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin'),
    'Google'
  );

// Only Google is supported (the subject asks for Google OR Facebook)
export type SocialProvider = 'google';

export type SocialSession = {
  token: string;
  deviceId: number;
  user: { id: number; email: string; username: string };
  /** First Google sign-in: username and date of birth still to be chosen */
  profileIncomplete?: boolean;
};

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleConfigured = false;
function configureGoogle() {
  const { GoogleSignin } = googleSdk();
  if (googleConfigured) return GoogleSignin;
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('Google sign-in is not configured');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
  return GoogleSignin;
}

async function loginWithGoogle(): Promise<SocialSession> {
  const GoogleSignin = configureGoogle();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  // SDK 13+: response is { type: 'success', data: { idToken, user } } | { type: 'cancelled' }
  // SDK <=12: response is { idToken, user } directly
  const idToken =
    (response as any).data?.idToken ?? (response as any).idToken;
  if (!idToken) throw new Error('Google did not return an id_token');

  return apiFetch<SocialSession>('/auth/google', {
    method: 'POST',
    auth: false,
    body: { idToken },
  });
}

export async function startSocialLogin(provider: SocialProvider): Promise<SocialSession> {
  if (provider !== 'google') throw new Error('Unsupported sign-in provider');
  return loginWithGoogle();
}
