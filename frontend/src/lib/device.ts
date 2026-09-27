import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './storage';

let cachedId: string | null = null;

// Stable random id of this installation, sent as X-Device-Id at login
export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  let id = await storage.getDeviceId();
  if (!id) {
    id = Crypto.randomUUID();
    await storage.setDeviceId(id);
  }
  cachedId = id;
  return id;
}

// HTTP headers only accept printable ASCII
const ascii = (value: string) => value.replace(/[^\x20-\x7E]/g, '').trim();

export function getDeviceLabel(): string {
  const model = Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : 'Android device');
  const os = Device.osName ? `${Device.osName} ${Device.osVersion ?? ''}`.trim() : Platform.OS;
  return ascii(`${model} (${os})`).slice(0, 100) || Platform.OS;
}

export const APP_VERSION = Constants.expoConfig?.version ?? 'dev';
export const PLATFORM = Platform.OS;
