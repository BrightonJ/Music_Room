import Constants from 'expo-constants';
import { storage } from './storage';
import { normalizeServerUrl, serverUrlFromHostUri } from './url';

let cached: string | null = null;

// Default address: EXPO_PUBLIC_API_URL if set, otherwise the computer running
// "expo start" (the phone already reaches it on the local network).
export function getDefaultServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL ? normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL) : null;
  return fromEnv ?? serverUrlFromHostUri(Constants.expoConfig?.hostUri) ?? 'http://localhost:3000';
}

export async function getServerUrl(): Promise<string> {
  if (cached) return cached;
  const stored = await storage.getServerUrl();
  cached = (stored && normalizeServerUrl(stored)) || getDefaultServerUrl();
  return cached;
}

export async function setServerUrl(url: string): Promise<void> {
  await storage.setServerUrl(url);
  cached = url;
}

export async function resetServerUrl(): Promise<string> {
  await storage.clearServerUrl();
  cached = null;
  return getServerUrl();
}
