import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch } from './api';

// Required so the browser popup can hand control back to the app
WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google' | 'facebook';

export type SocialSession = {
  token: string;
  deviceId: number;
  user: { id: number; email: string; username: string };
};

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const FACEBOOK_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
};

// On a dev build this resolves to musicroom://oauthredirect
// (matches the "scheme" set in app.json).
function buildRedirectUri() {
  return AuthSession.makeRedirectUri({ scheme: 'musicroom', path: 'oauthredirect' });
}

async function loginWithGoogle(): Promise<SocialSession> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not configured');
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    redirectUri: buildRedirectUri(),
    extraParams: { nonce, prompt: 'select_account' },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new Error('Sign-in cancelled');
  if (result.type !== 'success') throw new Error('Google sign-in failed');

  const idToken = result.params.id_token;
  if (!idToken) throw new Error('Google did not return an id_token');

  return apiFetch<SocialSession>('/auth/google', {
    method: 'POST',
    auth: false,
    body: { idToken },
  });
}

async function loginWithFacebook(): Promise<SocialSession> {
  if (!FACEBOOK_APP_ID) throw new Error('Facebook sign-in is not configured');

  const request = new AuthSession.AuthRequest({
    clientId: FACEBOOK_APP_ID,
    scopes: ['public_profile', 'email'],
    responseType: AuthSession.ResponseType.Token,
    redirectUri: buildRedirectUri(),
  });

  const result = await request.promptAsync(FACEBOOK_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new Error('Sign-in cancelled');
  if (result.type !== 'success') throw new Error('Facebook sign-in failed');

  const accessToken = result.params.access_token;
  if (!accessToken) throw new Error('Facebook did not return an access_token');

  return apiFetch<SocialSession>('/auth/facebook', {
    method: 'POST',
    auth: false,
    body: { accessToken },
  });
}

export async function startSocialLogin(provider: SocialProvider): Promise<SocialSession> {
  return provider === 'google' ? loginWithGoogle() : loginWithFacebook();
}
