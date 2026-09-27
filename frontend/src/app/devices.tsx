import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import { apiFetch, errorMessage } from '@/lib/api';
import { storage } from '@/lib/storage';
import { formatDateTime } from '@/lib/dates';
import { RetroScreen } from '@/components/retro';

type Device = {
  id: number;
  platform: string;
  device_name: string;
  last_seen_at: string;
  signed_in: boolean;
  is_current: boolean;
};

export default function DevicesScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setDevices(await apiFetch<Device[]>('/devices'));
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = (device: Device) => {
    Alert.alert(
      'Remove device',
      device.is_current
        ? 'This phone will be logged out.'
        : `${device.device_name} will be logged out immediately and loses the room controls given to it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const data = await apiFetch<{ wasCurrentDevice: boolean }>(`/devices/${device.id}`, { method: 'DELETE' });
              if (data.wasCurrentDevice) {
                await storage.clearSession();
                router.replace('/');
              } else {
                load();
              }
            } catch (err) {
              setError(errorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <RetroScreen>
      <ScreenHeader title="Devices" left={{ label: 'Back', onPress: () => router.back() }} />
      {loading ? (
        <ActivityIndicator color={Colors.retro.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={ui.scroll}
          ListHeaderComponent={
            <>
              <Text style={ui.helper}>
                Every phone where you logged in. Removing a device logs it out at once. Control of a room is given to one device, not to your
                whole account.
              </Text>
              {error ? <Text style={ui.messageError}>{error}</Text> : null}
              <View style={{ height: 16 }} />
            </>
          }
          renderItem={({ item }) => (
            <View style={ui.row}>
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>
                  {item.device_name}
                  {item.is_current ? ' (this phone)' : ''}
                </Text>
                <Text style={ui.rowSubtitle}>
                  {item.platform}, {item.signed_in ? 'signed in' : 'signed out'}, last seen {formatDateTime(new Date(item.last_seen_at))}
                </Text>
              </View>
              <TouchableOpacity style={ui.smallButtonMuted} onPress={() => remove(item)}>
                <Text style={[ui.smallButtonMutedText, { color: Colors.retro.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </RetroScreen>
  );
}
