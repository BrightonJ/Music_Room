import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { Space } from '@/constants/theme';
import { RetroBanner, RetroBrand, RetroButton, RetroDivider, RetroInput, RetroLink, RetroPage } from '@/components/retro';
import { API_URL, GOOGLE_CLIENT_IDS, FACEBOOK_APP_ID } from '@/constants/config';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateWeb, setBirthDateWeb] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' });

  const [requestG, responseG, promptAsyncG] = Google.useAuthRequest(GOOGLE_CLIENT_IDS);

  const [requestF, responseF, promptAsyncF] = Facebook.useAuthRequest({ clientId: FACEBOOK_APP_ID });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    setGlobalMessage({ type: '', text: '' });

    if (isLoginMode) {
      if (!email) newErrors.email = "Email required";
      if (!password) newErrors.password = "Password required";
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (!firstName) newErrors.firstName = "First name required";
    if (!lastName) newErrors.lastName = "Last name required";

    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    if (!username) {
      newErrors.username = "Username required";
    } else if (!usernameRegex.test(username)) {
      newErrors.username = "3-20 characters: letters, digits, underscore";
    }

    if (Platform.OS === 'web') {
      if (!birthDateWeb || birthDateWeb.length !== 10) newErrors.birthDate = "Date required (DD-MM-YYYY)";
    } else {
      if (!birthDate) newErrors.birthDate = "Date required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Invalid email format";
    }

    const passRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!password) {
      newErrors.password = "Password required";
    } else if (!passRegex.test(password)) {
      newErrors.password = "8 characters minimum, at least 1 letter and 1 digit";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirmation required";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setGlobalMessage({ type: 'error', text: 'Please fix the fields highlighted in red.' });
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    const endpoint = isLoginMode ? '/login' : '/register';

    let finalBirthDate = null;
    if (!isLoginMode) {
      if (Platform.OS === 'web') {
        const parts = birthDateWeb.split('-');
        if (parts.length === 3) finalBirthDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else if (birthDate) {
        const y = birthDate.getFullYear();
        const m = String(birthDate.getMonth() + 1).padStart(2, '0');
        const d = String(birthDate.getDate()).padStart(2, '0');
        finalBirthDate = `${y}-${m}-${d}`;
      }
    }

    const payload = isLoginMode
      ? { email, password }
      : { email, password, username, firstName, lastName, birthDate: finalBirthDate };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLoginMode) {
          if (Platform.OS === 'web') localStorage.setItem('userToken', data.token);
          else await SecureStore.setItemAsync('userToken', data.token);
          router.replace('/home' as any);
        } else {
          setGlobalMessage({ type: 'success', text: data.message });
          setIsLoginMode(true);
          setErrors({});
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        setGlobalMessage({ type: 'error', text: data.error || "An error occurred." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Unable to reach the server." });
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrors({ email: "Please enter your email" });
      setGlobalMessage({ type: 'error', text: "Enter your email to reset your password." });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setGlobalMessage({ type: 'success', text: "Password reset email sent." });
      } else {
        setGlobalMessage({ type: 'error', text: data.error || "Error while resetting the password." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Unable to reach the server." });
    }
  };

  const handleDateChangeWeb = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '-' + cleaned.slice(4, 8);
    setBirthDateWeb(formatted);
  };

  const clearError = (field: string) => setErrors({ ...errors, [field]: '' });

  return (
    <RetroPage centered>
      <RetroBrand subtitle={isLoginMode ? 'Log in to join the event' : 'Create a complete and secure profile'} />

      <View style={styles.form}>
        {globalMessage.text ? <RetroBanner type={globalMessage.type} text={globalMessage.text} /> : null}

        {!isLoginMode && (
          <>
            <RetroInput
              error={errors.username}
              placeholder="Username"
              value={username}
              onChangeText={(t) => { setUsername(t); clearError('username'); }}
              autoCapitalize="none"
            />

            <View style={styles.row}>
              <RetroInput
                containerStyle={styles.half}
                error={errors.firstName}
                placeholder="First name"
                value={firstName}
                onChangeText={(t) => { setFirstName(t); clearError('firstName'); }}
              />
              <RetroInput
                containerStyle={styles.half}
                error={errors.lastName}
                placeholder="Last name"
                value={lastName}
                onChangeText={(t) => { setLastName(t); clearError('lastName'); }}
              />
            </View>

            {Platform.OS === 'web' ? (
              <RetroInput
                error={errors.birthDate}
                placeholder="Date of birth (DD-MM-YYYY)"
                value={birthDateWeb}
                onChangeText={(t) => { handleDateChangeWeb(t); clearError('birthDate'); }}
                maxLength={10}
                keyboardType="number-pad"
              />
            ) : (
              <View>
                <RetroInput
                  error={errors.birthDate}
                  placeholder="Date of birth"
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
                      if (date) {
                        setBirthDate(date);
                        clearError('birthDate');
                      }
                    }}
                  />
                )}
              </View>
            )}
          </>
        )}

        <RetroInput
          error={errors.email}
          placeholder="Email address"
          value={email}
          onChangeText={(t) => { setEmail(t); clearError('email'); }}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <RetroInput
          error={errors.password}
          placeholder="Password"
          value={password}
          onChangeText={(t) => { setPassword(t); clearError('password'); }}
          secureTextEntry
        />

        {!isLoginMode && (
          <RetroInput
            error={errors.confirmPassword}
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
            secureTextEntry
          />
        )}

        {isLoginMode && <RetroLink label="Forgot password?" onPress={handleForgotPassword} style={styles.forgot} />}

        <RetroButton label={isLoginMode ? 'Log in' : 'Create my account'} onPress={handleAuth} />

        <RetroDivider label="or" />

        <RetroButton variant="ghost" label={isLoginMode ? 'Log in with Google' : 'Sign up with Google'} onPress={() => promptAsyncG()} />
        <RetroButton variant="ghost" label={isLoginMode ? 'Log in with Facebook' : 'Sign up with Facebook'} onPress={() => promptAsyncF()} />

        <RetroLink
          tone="muted"
          label={isLoginMode ? 'New here? Create an account' : 'Already have an account? Log in'}
          onPress={() => { setIsLoginMode(!isLoginMode); setErrors({}); setGlobalMessage({ type: '', text: '' }); }}
          style={styles.switchMode}
        />
      </View>
    </RetroPage>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: Space.xxl, gap: Space.lg },
  row: { flexDirection: 'row', gap: Space.md },
  half: { flex: 1 },
  forgot: { alignSelf: 'flex-end' },
  switchMode: { alignSelf: 'center', marginTop: Space.lg },
});
