import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Space } from '@/constants/theme';
import { ui } from '@/constants/styles';
import DateTimeField from '@/components/DateTimeField';
import { RetroButton, RetroCard, RetroInput, RetroLink, RetroMessage, RetroScreen, RetroText } from '@/components/retro';
import { apiFetch, errorMessage } from '@/lib/api';
import { storage } from '@/lib/storage';
import { fromIsoDate, toIsoDate } from '@/lib/dates';

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

type Profile = { username: string; first_name: string | null; last_name: string | null; birth_date: string | null };

// Shown after the first Google sign-in: Google gave no username (one was
// generated) and no date of birth. The user must fill this before the rooms.
export default function CompleteProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Profile>('/profile')
      .then((p) => {
        setUsername(p.username);
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setBirthDate(fromIsoDate(p.birth_date));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!USERNAME.test(username)) next.username = '3-20 characters: letters, digits, underscore';
    if (!firstName.trim()) next.firstName = 'First name required';
    if (!lastName.trim()) next.lastName = 'Last name required';
    if (!birthDate) next.birthDate = 'Date of birth required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    setError('');
    if (!validate() || !birthDate) return;
    setSaving(true);
    try {
      await apiFetch('/profile/complete', {
        method: 'POST',
        body: { username, firstName: firstName.trim(), lastName: lastName.trim(), birthDate: toIsoDate(birthDate) },
      });
      router.replace('/home');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/logout', { method: 'POST' });
    } catch {
      // Logged out locally anyway
    }
    await storage.clearSession();
    router.replace('/');
  };

  if (loading) {
    return (
      <RetroScreen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.retro.primary} />
      </RetroScreen>
    );
  }

  return (
    <RetroScreen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'flex-end' }}>
            <RetroLink title="Log out" onPress={logout} color={Colors.retro.danger} />
          </View>

          <RetroText variant="display" style={{ marginTop: Space.lg }}>
            Almost there!
          </RetroText>
          <RetroCard tone="yellow" style={{ marginTop: Space.lg }}>
            <RetroText>Choose how your friends will find you, and check the details we got from your Google account.</RetroText>
          </RetroCard>

          <RetroInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            error={errors.username}
          />
          <RetroText style={ui.helper}>This is what your friends search for. You can pick your own.</RetroText>
          <RetroInput label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" error={errors.firstName} />
          <RetroInput label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" textContentType="familyName" error={errors.lastName} />

          <RetroText style={ui.label}>Date of birth</RetroText>
          <DateTimeField
            mode="date"
            value={birthDate}
            onChange={setBirthDate}
            placeholder="Select your date of birth"
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            hasError={!!errors.birthDate}
          />
          {errors.birthDate ? <RetroText style={ui.fieldError}>{errors.birthDate}</RetroText> : null}

          {error ? <RetroMessage type="error" text={error} /> : null}
          <RetroButton title="Continue" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </RetroScreen>
  );
}
