import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import DateTimeField from '@/components/DateTimeField';
import { apiFetch, errorMessage } from '@/lib/api';
import { getFreshPosition } from '@/lib/location';
import type { VoteLicense } from '@/components/room/types';
import { RetroScreen, RetroSwitch } from '@/components/retro';

const LICENSES: { value: VoteLicense; label: string; help: string }[] = [
  { value: 'everyone', label: 'Everyone', help: 'Everyone who can see the room can vote.' },
  { value: 'invited', label: 'Guests', help: 'Only you and the friends who accepted your invitation can vote. Others can still listen and suggest tracks.' },
  { value: 'location', label: 'On site', help: 'Only people at this place during the time window can vote. Your current position is used as the place.' },
];
const RADIUSES = [50, 100, 250, 500];

export default function CreateRoomScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [license, setLicense] = useState<VoteLicense>('everyone');
  const [radius, setRadius] = useState(100);
  const [startsAt, setStartsAt] = useState<Date>(() => new Date());
  const [endsAt, setEndsAt] = useState<Date>(() => new Date(Date.now() + 4 * 60 * 60 * 1000));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setError('');
    if (!name.trim()) {
      setError('Give your room a name.');
      return;
    }
    const body: Record<string, unknown> = { name: name.trim(), isPrivate, voteLicense: license };
    if (license === 'location') {
      if (endsAt <= startsAt) {
        setError('The voting window must end after it starts.');
        return;
      }
      setCreating(true);
      const position = await getFreshPosition(30000);
      if (!position.ok) {
        setCreating(false);
        setError(position.error);
        return;
      }
      Object.assign(body, {
        locationLat: position.coords.lat,
        locationLng: position.coords.lng,
        locationRadiusM: radius,
        voteStartsAt: startsAt.toISOString(),
        voteEndsAt: endsAt.toISOString(),
      });
    }
    setCreating(true);
    try {
      const data = await apiFetch<{ event: { id: number } }>('/events', { method: 'POST', body });
      router.replace({ pathname: '/room', params: { id: String(data.event.id) } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <RetroScreen>
      <ScreenHeader title="New room" left={{ label: 'Cancel', onPress: () => router.back(), tone: 'muted' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
          <Text style={ui.label}>Room name</Text>
          <TextInput
            style={ui.input}
            value={name}
            onChangeText={setName}
            placeholder="Friday night at Jen's"
            placeholderTextColor={Colors.retro.textSecondary}
            maxLength={100}
          />

          <View style={[ui.row, { marginTop: 20 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={ui.rowTitle}>Private room</Text>
              <Text style={ui.rowSubtitle}>{isPrivate ? 'Only the friends you invite can find it.' : 'Anyone can find it in the rooms list.'}</Text>
            </View>
            <RetroSwitch value={isPrivate} onValueChange={setIsPrivate} />
          </View>

          <Text style={ui.label}>Who can vote</Text>
          <View style={ui.segment}>
            {LICENSES.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[ui.segmentItem, license === item.value && ui.segmentItemActive]}
                onPress={() => setLicense(item.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: license === item.value }}
              >
                <Text style={[ui.segmentText, license === item.value && ui.segmentTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={ui.helper}>{LICENSES.find((l) => l.value === license)?.help}</Text>

          {license === 'location' ? (
            <>
              <Text style={ui.label}>Voting opens</Text>
              <DateTimeField mode="datetime" value={startsAt} onChange={setStartsAt} />
              <Text style={ui.label}>Voting closes</Text>
              <DateTimeField mode="datetime" value={endsAt} onChange={setEndsAt} minimumDate={startsAt} />
              <Text style={ui.label}>Distance allowed around this place</Text>
              <View style={ui.segment}>
                {RADIUSES.map((r) => (
                  <TouchableOpacity key={r} style={[ui.segmentItem, radius === r && ui.segmentItemActive]} onPress={() => setRadius(r)}>
                    <Text style={[ui.segmentText, radius === r && ui.segmentTextActive]}>{r} m</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {error ? <Text style={ui.messageError}>{error}</Text> : null}
          <TouchableOpacity style={[ui.primaryButton, creating && ui.disabled]} onPress={create} disabled={creating}>
            {creating ? <ActivityIndicator color={Colors.retro.onPrimary} /> : <Text style={ui.primaryButtonText}>Create room</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </RetroScreen>
  );
}
