import { Alert } from 'react-native';

export type SocialProvider = 'google' | 'facebook';

// Entry point for the Google / Facebook sign-in, integrated separately.
// The backend already has users.google_id and users.facebook_id.
// Note: native Google sign-in needs a development build (not Expo Go).
export async function startSocialLogin(provider: SocialProvider): Promise<void> {
  const name = provider === 'google' ? 'Google' : 'Facebook';
  Alert.alert(`${name} sign-in`, `${name} sign-in is not available yet. Use your email and password.`);
}
