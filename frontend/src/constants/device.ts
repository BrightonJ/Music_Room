import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'musicRoomDeviceId';

async function getStoredDeviceId(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(DEVICE_ID_KEY);
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

async function storeDeviceId(id: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } else {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
}

export async function getDeviceId(): Promise<string> {
  let id = await getStoredDeviceId();
  if (!id) {
    id = Crypto.randomUUID();
    await storeDeviceId(id);
  }
  return id;
}

export function getDeviceLabel(): string {
  if (Platform.OS === 'web') return 'Web browser';
  const model = Device.modelName || 'Unknown device';
  const os = Device.osName ? `${Device.osName} ${Device.osVersion || ''}`.trim() : Platform.OS;
  return `${model} (${os})`;
}