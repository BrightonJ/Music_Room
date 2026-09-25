import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';

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

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.subtitle}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {globalMessage.text ? (
          <Text style={[styles.globalMessage, globalMessage.type === 'error' ? styles.errorText : styles.successText]}>
            {globalMessage.text}
          </Text>
        ) : null}

        <Text style={styles.readOnlyLabel}>Username</Text>
        <Text style={styles.readOnlyValue}>{username}</Text>

        <Text style={styles.readOnlyLabel}>Email</Text>
        <Text style={styles.readOnlyValue}>{email}</Text>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>First name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={Colors.dark.textSecondary} />
          </View>
          <TouchableOpacity style={styles.privacyPill} onPress={() => cyclePrivacy('first_name')}>
            <Text style={styles.privacyPillText}>{levelLabel[privacySettings.first_name]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Last name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor={Colors.dark.textSecondary} />
          </View>
          <TouchableOpacity style={styles.privacyPill} onPress={() => cyclePrivacy('last_name')}>
            <Text style={styles.privacyPillText}>{levelLabel[privacySettings.last_name]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date of birth</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.input}
                placeholder="DD-MM-YYYY"
                placeholderTextColor={Colors.dark.textSecondary}
                value={birthDateWeb}
                onChangeText={handleDateChangeWeb}
                maxLength={10}
                keyboardType="number-pad"
              />
            ) : (
              <>
                <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: birthDate ? Colors.dark.text : Colors.dark.textSecondary, fontSize: 16 }}>
                    {birthDate ? birthDate.toLocaleDateString('en-GB') : "Not set"}
                  </Text>
                </TouchableOpacity>
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
              </>
            )}
          </View>
          <TouchableOpacity style={styles.privacyPill} onPress={() => cyclePrivacy('birth_date')}>
            <Text style={styles.privacyPillText}>{levelLabel[privacySettings.birth_date]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Music preferences</Text>
            <TextInput
              style={styles.input}
              placeholder="rock, Daft Punk, jazz"
              placeholderTextColor={Colors.dark.textSecondary}
              value={musicPreferencesText}
              onChangeText={setMusicPreferencesText}
            />
          </View>
          <TouchableOpacity style={styles.privacyPill} onPress={() => cyclePrivacy('music_preferences')}>
            <Text style={styles.privacyPillText}>{levelLabel[privacySettings.music_preferences]}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  cancelText: { color: Colors.dark.textSecondary, fontSize: 16 },
  content: { padding: 20 },
  subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', marginTop: 40 },
  readOnlyLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginBottom: 2, marginTop: 8 },
  readOnlyValue: { color: Colors.dark.text, fontSize: 16, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16 },
  label: { color: Colors.dark.text, fontSize: 14, marginBottom: 6, fontWeight: 'bold' },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, fontSize: 16 },
  privacyPill: { backgroundColor: Colors.dark.backgroundSelected, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 8 },
  privacyPillText: { color: Colors.dark.primary, fontSize: 12, fontWeight: 'bold' },
  globalMessage: { fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: 'bold', padding: 10, borderRadius: 8 },
  errorText: { color: Colors.dark.danger, backgroundColor: 'rgba(255, 68, 68, 0.1)' },
  successText: { color: Colors.dark.primary, backgroundColor: 'rgba(29, 185, 84, 0.1)' },
  saveButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 12 },
  saveButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
});