import { Alert } from 'react-native';

// Only Google is supported (the subject asks for Google OR Facebook)
export type SocialProvider = 'google';

// Entry point for the Google sign-in, integrated separately.
// The backend already has users.google_id.
// Note: native Google sign-in needs a development build (not Expo Go).
export async function startSocialLogin(provider: SocialProvider): Promise<void> {
  if (provider !== 'google') return;
  Alert.alert('Google sign-in', 'Google sign-in is not available yet. Use your email and password.');
}
