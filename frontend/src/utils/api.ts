import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getDeviceLabel } from '@/constants/device';

export function buildAuthHeaders(token: string | null | undefined, json: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token || ''}`,
    'X-Platform': Platform.OS,
    'X-Device': getDeviceLabel(),
    'X-App-Version': (Constants.expoConfig && Constants.expoConfig.version) || 'dev',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}