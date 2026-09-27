import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import DateTimeField from '@/components/DateTimeField';
import { apiFetch, errorMessage } from '@/lib/api';
import { fromIsoDate, toIsoDate } from '@/lib/dates';
import { RetroScreen } from '@/components/retro';

type PrivacyLevel = 'public' | 'friends' | 'private';
type PrivacyField = 'first_name' | 'last_name' | 'birth_date' | 'music_preferences';
type Profile = {
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  music_preferences: string[];
  privacy_settings: Partial<Record<PrivacyField, PrivacyLevel>>;
};

const LEVELS: PrivacyLevel[] = ['public', 'friends', 'private'];
const LEVEL_LABEL: Record<PrivacyLevel, string> = { public: 'Everyone', friends: 'Friends', private: 'Only me' };
const FIELD_LABEL: Record<PrivacyField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  birth_date: 'Date of birth',
  music_preferences: 'Music preferences',
};
const DEFAULT_PRIVACY: Record<PrivacyField, PrivacyLevel> = {
  first_name: 'public',
  last_name: 'public',
  birth_date: 'private',
  music_preferences: 'friends',
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [musicText, setMusicText] = useState('');
  const [privacy, setPrivacy] = useState<Record<PrivacyField, PrivacyLevel>>(DEFAULT_PRIVACY);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apply = (data: Profile) => {
    setUsername(data.username);
    setEmail(data.email);
    setFirstName(data.first_name ?? '');
    setLastName(data.last_name ?? '');
    setBirthDate(fromIsoDate(data.birth_date));
    setMusicText((data.music_preferences ?? []).join(', '));
    setPrivacy({ ...DEFAULT_PRIVACY, ...data.privacy_settings });
  };

  const load = useCallback(async () => {
    try {
      apply(await apiFetch<Profile>('/profile'));
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setMessage(null);
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ type: 'error', text: 'First and last name cannot be empty.' });
      return;
    }
    const musicPreferences = musicText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const data = await apiFetch<Profile>('/profile', {
        method: 'PUT',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate: birthDate ? toIsoDate(birthDate) : null,
          musicPreferences,
          privacySettings: privacy,
        },
      });
      apply(data);
      setMessage({ type: 'success', text: 'Profile saved' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const privacyPicker = (field: PrivacyField) => (
    <View style={{ marginTop: 8 }}>
      <View style={ui.segment}>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[ui.segmentItem, privacy[field] === level && ui.segmentItemActive]}
            onPress={() => setPrivacy((p) => ({ ...p, [field]: level }))}
            accessibilityRole="radio"
            accessibilityState={{ selected: privacy[field] === level }}
            accessibilityLabel={`${FIELD_LABEL[field]} visible to ${LEVEL_LABEL[level]}`}
          >
            <Text style={[ui.segmentText, privacy[field] === level && ui.segmentTextActive]}>{LEVEL_LABEL[level]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <RetroScreen>
      <ScreenHeader
        title="Profile"
        left={{ label: 'Back', onPress: () => router.back() }}
        right={{ label: 'Devices', onPress: () => router.push('/devices') }}
      />
      {loading ? (
        <ActivityIndicator color={Colors.retro.primary} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
            <Text style={ui.rowTitle}>{username}</Text>
            <Text style={ui.rowSubtitle}>{email}</Text>

            <Text style={ui.sectionTitle}>About you</Text>
            <Text style={ui.label}>First name</Text>
            <TextInput style={ui.input} value={firstName} onChangeText={setFirstName} maxLength={100} />
            {privacyPicker('first_name')}

            <Text style={ui.label}>Last name</Text>
            <TextInput style={ui.input} value={lastName} onChangeText={setLastName} maxLength={100} />
            {privacyPicker('last_name')}

            <Text style={ui.label}>Date of birth</Text>
            <DateTimeField
              mode="date"
              value={birthDate}
              onChange={setBirthDate}
              placeholder="Not set"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
            />
            {privacyPicker('birth_date')}

            <Text style={ui.label}>Music preferences</Text>
            <TextInput
              style={ui.input}
              value={musicText}
              onChangeText={setMusicText}
              placeholder="jazz, rock, electro"
              placeholderTextColor={Colors.retro.textSecondary}
              autoCapitalize="none"
            />
            <Text style={ui.helper}>Separate them with commas.</Text>
            {privacyPicker('music_preferences')}

            {message ? <Text style={message.type === 'error' ? ui.messageError : ui.messageSuccess}>{message.text}</Text> : null}
            <TouchableOpacity style={[ui.primaryButton, saving && ui.disabled]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.retro.onPrimary} /> : <Text style={ui.primaryButtonText}>Save profile</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ui.secondaryButton} onPress={() => router.push('/settings')}>
              <Text style={ui.secondaryButtonText}>Server settings</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </RetroScreen>
  );
}
