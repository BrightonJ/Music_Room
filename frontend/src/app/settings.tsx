import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import { getDefaultServerUrl, getServerUrl, resetServerUrl, setServerUrl } from '@/lib/config';
import { normalizeServerUrl } from '@/lib/url';
import { storage } from '@/lib/storage';
import { RetroScreen } from '@/components/retro';

// The backend address is configurable from the app (subject V.5)
export default function SettingsScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [value, setValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getServerUrl().then((url) => {
      setCurrent(url);
      setValue(url);
    });
  }, []);

  const test = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${url}/api/health`, { signal: controller.signal });
      const data = await response.json();
      return response.ok && data?.service === 'music-room';
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const onTest = async () => {
    const url = normalizeServerUrl(value);
    if (!url) {
      setMessage({ type: 'error', text: 'Enter an address like 192.168.1.42:3000' });
      return;
    }
    setTesting(true);
    const ok = await test(url);
    setTesting(false);
    setMessage(ok ? { type: 'success', text: 'The server answers.' } : { type: 'error', text: `No Music Room server answers at ${url}.` });
  };

  const onSave = async () => {
    const url = normalizeServerUrl(value);
    if (!url) {
      setMessage({ type: 'error', text: 'Enter an address like 192.168.1.42:3000' });
      return;
    }
    await setServerUrl(url);
    setValue(url);
    if (url !== current) {
      // A session belongs to one server: log in again on the new one
      await storage.clearSession();
      router.replace('/');
      return;
    }
    setMessage({ type: 'success', text: 'Saved' });
  };

  const onReset = async () => {
    const url = await resetServerUrl();
    setValue(url);
    if (url !== current) {
      await storage.clearSession();
      router.replace('/');
      return;
    }
    setMessage({ type: 'success', text: 'Default address restored' });
  };

  return (
    <RetroScreen>
      <ScreenHeader title="Server settings" left={{ label: 'Back', onPress: () => router.back() }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
          <Text style={ui.helper}>
            Address of the Music Room backend. On a phone, use the IP of the computer running the server on the same Wi-Fi, not localhost.
          </Text>
          <Text style={ui.label}>Server address</Text>
          <TextInput
            style={ui.input}
            value={value}
            onChangeText={setValue}
            placeholder="http://192.168.1.42:3000"
            placeholderTextColor={Colors.retro.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={ui.helper}>Default: {getDefaultServerUrl()}</Text>

          {message ? <Text style={message.type === 'error' ? ui.messageError : ui.messageSuccess}>{message.text}</Text> : null}

          <TouchableOpacity style={[ui.secondaryButton, { marginTop: 24 }]} onPress={onTest} disabled={testing}>
            {testing ? <ActivityIndicator color={Colors.retro.text} /> : <Text style={ui.secondaryButtonText}>Test connection</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={ui.primaryButton} onPress={onSave}>
            <Text style={ui.primaryButtonText}>Save address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ui.secondaryButton} onPress={onReset}>
            <Text style={ui.secondaryButtonText}>Use the default address</Text>
          </TouchableOpacity>
          <Text style={[ui.helper, { marginTop: 16 }]}>Changing the server logs you out of this phone.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </RetroScreen>
  );
}
