import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAudioModeAsync } from 'expo-audio';
import { setUnauthorizedHandler } from '@/lib/api';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const router = useRouter();

  // Any 401 (expired token, logout on another device, device removed) -> login screen
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/'));
    return () => setUnauthorizedHandler(null);
  }, [router]);

  // iOS: without this, previews are silent when the ring/silent switch is on
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
        }}
      />
    </SafeAreaProvider>
  );
}
