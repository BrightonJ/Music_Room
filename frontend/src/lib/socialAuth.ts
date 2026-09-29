import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import { apiFetch } from './api';

export type SocialProvider = 'google' | 'facebook';

export type SocialSession = {
  token: string;
  deviceId: number;
  user: { id: number; email: string; username: string };
};

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('Google sign-in is not configured');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
}

async function loginWithGoogle(): Promise<SocialSession> {
  configureGoogle();
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

async function loginWithFacebook(): Promise<SocialSession> {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) throw new Error('Sign-in cancelled');

  const data = await AccessToken.getCurrentAccessToken();
  if (!data || !data.accessToken) {
    throw new Error('Facebook did not return an access_token');
  }

  return apiFetch<SocialSession>('/auth/facebook', {
    method: 'POST',
    auth: false,
    body: { accessToken: data.accessToken },
  });
}

export async function startSocialLogin(provider: SocialProvider): Promise<SocialSession> {
  return provider === 'google' ? loginWithGoogle() : loginWithFacebook();
}
