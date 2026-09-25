// Back-end address, configurable via frontend/.env (see .env.example)
export const SERVER_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const API_URL = `${SERVER_URL}/api`;

// Social login IDs, read from frontend/.env. The placeholders only keep the auth hooks from
// crashing on startup: Google/Facebook login stays non-functional until real IDs are provided.
const PLACEHOLDER = 'missing-client-id';
export const GOOGLE_CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || PLACEHOLDER,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || PLACEHOLDER,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || PLACEHOLDER,
};
export const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || PLACEHOLDER;
