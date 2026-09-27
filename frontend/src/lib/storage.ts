import * as SecureStore from 'expo-secure-store';

const KEYS = {
  token: 'userToken',
  userId: 'userId',
  serverUrl: 'serverUrl',
  deviceId: 'musicRoomDeviceId',
} as const;

export const storage = {
  getToken: () => SecureStore.getItemAsync(KEYS.token),
  getUserId: async (): Promise<number | null> => {
    const value = await SecureStore.getItemAsync(KEYS.userId);
    return value ? Number(value) : null;
  },
  async saveSession(token: string, userId: number) {
    await SecureStore.setItemAsync(KEYS.token, token);
    await SecureStore.setItemAsync(KEYS.userId, String(userId));
  },
  async clearSession() {
    await SecureStore.deleteItemAsync(KEYS.token);
    await SecureStore.deleteItemAsync(KEYS.userId);
  },
  getServerUrl: () => SecureStore.getItemAsync(KEYS.serverUrl),
  setServerUrl: (url: string) => SecureStore.setItemAsync(KEYS.serverUrl, url),
  clearServerUrl: () => SecureStore.deleteItemAsync(KEYS.serverUrl),
  getDeviceId: () => SecureStore.getItemAsync(KEYS.deviceId),
  setDeviceId: (id: string) => SecureStore.setItemAsync(KEYS.deviceId, id),
};
