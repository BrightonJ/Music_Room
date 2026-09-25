import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Space, type Tone } from '@/constants/theme';
import {
  RetroAvatar, RetroBanner, RetroButton, RetroCard, RetroInput, RetroPage, RetroTagButton, RetroText,
} from '@/components/retro';
import { API_URL } from '@/constants/config';
import { getToken } from '@/lib/token';

type PrivacyLevel = 'public' | 'friends' | 'private';

const nextLevel: Record<PrivacyLevel, PrivacyLevel> = {
  public: 'friends',
  friends: 'private',
  private: 'public',
};

const levelLabel: Record<PrivacyLevel, string> = {
  public: 'Public',
  friends: 'Friends',
  private: 'Private',
};

function parseIsoDate(value: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export default function ProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateWeb, setBirthDateWeb] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [musicPreferencesText, setMusicPreferencesText] = useState('');
  const [privacySettings, setPrivacySettings] = useState<Record<string, PrivacyLevel>>({
    first_name: 'public',
    last_name: 'public',
    birth_date: 'private',
    music_preferences: 'friends',
  });
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' });

  const loadProfile = async () => {
    const token = await getToken();
    if (!token) {
      router.replace('/' as any);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setUsername(data.username || '');
        setEmail(data.email || '');
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setMusicPreferencesText((data.music_preferences || []).join(', '));
        setPrivacySettings({
          first_name: data.privacy_settings?.first_name || 'public',
          last_name: data.privacy_settings?.last_name || 'public',
          birth_date: data.privacy_settings?.birth_date || 'private',
          music_preferences: data.privacy_settings?.music_preferences || 'friends',
        });

        const parsed = parseIsoDate(data.birth_date);
        if (parsed) {
          setBirthDate(new Date(parsed.y, parsed.m - 1, parsed.d));
          setBirthDateWeb(`${String(parsed.d).padStart(2, '0')}-${String(parsed.m).padStart(2, '0')}-${parsed.y}`);
        }
      } else {
        setGlobalMessage({ type: 'error', text: data.error || "Unable to load profile." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Unable to reach the server." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleDateChangeWeb = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '-' + cleaned.slice(4, 8);
    setBirthDateWeb(formatted);
  };

  const cyclePrivacy = (field: string) => {
    setPrivacySettings((prev) => ({
      ...prev,
      [field]: nextLevel[prev[field] || 'public'],
    }));
  };

  const handleSave = async () => {
    const token = await getToken();
    if (!token) {
      router.replace('/' as any);
      return;
    }

    let finalBirthDate: string | null = null;
    if (Platform.OS === 'web') {
      const parts = birthDateWeb.split('-');
      if (parts.length === 3) finalBirthDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (birthDate) {
      const y = birthDate.getFullYear();
      const m = String(birthDate.getMonth() + 1).padStart(2, '0');
      const d = String(birthDate.getDate()).padStart(2, '0');
      finalBirthDate = `${y}-${m}-${d}`;
    }

    const musicPreferences = musicPreferencesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          birthDate: finalBirthDate,
          privacySettings,
          musicPreferences,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGlobalMessage({ type: 'success', text: "Profile updated." });
      } else {
        setGlobalMessage({ type: 'error', text: data.error || "Unable to update profile." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Unable to reach the server." });
    }
  };

  const levelTone: Record<PrivacyLevel, Tone> = { public: 'green', friends: 'yellow', private: 'coral' };

  const privacyTag = (field: string) => (
    <RetroTagButton
      label={levelLabel[privacySettings[field]]}
      tone={levelTone[privacySettings[field]]}
      onPress={() => cyclePrivacy(field)}
    />
  );

  if (loading) {
    return (
      <RetroPage title="My profile" left={{ label: 'Back', onPress: () => router.back() }}>
        <RetroText variant="label" style={{ textAlign: 'center', marginTop: Space.xxxl * 2 }}>Loading...</RetroText>
      </RetroPage>
    );
  }

  return (
    <RetroPage title="My profile" left={{ label: 'Back', onPress: () => router.back() }}>
      {globalMessage.text ? <RetroBanner type={globalMessage.type} text={globalMessage.text} /> : null}

      <RetroCard tone="violet" style={{ marginBottom: Space.xxl }} contentStyle={styles.idCard}>
        <RetroAvatar label={(username || '?').charAt(0).toUpperCase()} />
        <View style={{ flex: 1 }}>
          <RetroText variant="heading" numberOfLines={1}>{username}</RetroText>
          <RetroText variant="small" numberOfLines={1}>{email}</RetroText>
        </View>
      </RetroCard>

      <View style={styles.form}>
        <View style={styles.fieldRow}>
          <RetroInput label="First name" containerStyle={styles.field} value={firstName} onChangeText={setFirstName} />
          {privacyTag('first_name')}
        </View>

        <View style={styles.fieldRow}>
          <RetroInput label="Last name" containerStyle={styles.field} value={lastName} onChangeText={setLastName} />
          {privacyTag('last_name')}
        </View>

        <View style={styles.fieldRow}>
          {Platform.OS === 'web' ? (
            <RetroInput
              label="Date of birth"
              containerStyle={styles.field}
              placeholder="DD-MM-YYYY"
              value={birthDateWeb}
              onChangeText={handleDateChangeWeb}
              maxLength={10}
              keyboardType="number-pad"
            />
          ) : (
            <View style={styles.field}>
              <RetroInput
                label="Date of birth"
                placeholder="Not set"
                value={birthDate ? birthDate.toLocaleDateString('en-GB') : ''}
                onPress={() => setShowDatePicker(true)}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={birthDate || new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(e, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setBirthDate(date);
                  }}
                />
              )}
            </View>
          )}
          {privacyTag('birth_date')}
        </View>

        <View style={styles.fieldRow}>
          <RetroInput
            label="Music preferences"
            containerStyle={styles.field}
            placeholder="rock, Daft Punk, jazz"
            value={musicPreferencesText}
            onChangeText={setMusicPreferencesText}
          />
          {privacyTag('music_preferences')}
        </View>

        <RetroText variant="small" color={Colors.retro.textSecondary}>
          Tap a tag to choose who can see a field: everyone, friends only, or just you.
        </RetroText>

        <RetroButton label="Save changes" onPress={handleSave} />
      </View>
    </RetroPage>
  );
}

const styles = StyleSheet.create({
  idCard: { flexDirection: 'row', alignItems: 'center', gap: Space.md + 2 },
  form: { gap: Space.xl },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.md },
  field: { flex: 1 },
});
