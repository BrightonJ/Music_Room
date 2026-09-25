import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Reads the JWT saved at login (localStorage on web, SecureStore on devices). */
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}
