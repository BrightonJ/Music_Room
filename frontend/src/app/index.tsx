import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';

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

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotModalMessage, setForgotModalMessage] = useState('');

  const [requestG, responseG, promptAsyncG] = Google.useAuthRequest({
    webClientId: 'TON_GOOGLE_CLIENT_ID_WEB.apps.googleusercontent.com',
  });

  const [requestF, responseF, promptAsyncF] = Facebook.useAuthRequest({
    clientId: 'TON_FACEBOOK_APP_ID',
  });

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

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!password) {
      newErrors.password = "Password required";
    } else if (!passRegex.test(password)) {
      newErrors.password = "8 chars min, with uppercase, lowercase, a digit and a special character";
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
          if (Platform.OS === 'web') {
            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userId', String(data.user.id));
          } else {
            await SecureStore.setItemAsync('userToken', data.token);
            await SecureStore.setItemAsync('userId', String(data.user.id));
          }
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

  const handleForgotPasswordSubmit = async () => {
    if (!forgotEmail) {
      setForgotModalMessage("Please enter your email");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await response.json();
      setForgotModalMessage(data.message || "If this account is registered, you will receive an email to reset your password.");
    } catch (error) {
      setForgotModalMessage("Unable to reach the server.");
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotModalMessage('');
  };

  const handleDateChangeWeb = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '-' + cleaned.slice(4, 8);
    setBirthDateWeb(formatted);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>Music Room</Text>
        <Text style={styles.subtitle}>
          {isLoginMode ? "Log in to join the event" : "Create a complete and secure profile"}
        </Text>

        {globalMessage.text ? (
          <Text style={[styles.globalMessage, globalMessage.type === 'error' ? styles.errorText : styles.successText]}>
            {globalMessage.text}
          </Text>
        ) : null}

        {!isLoginMode && (
          <>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, errors.username ? styles.inputError : null]}
                placeholder="Username"
                placeholderTextColor={Colors.dark.textSecondary}
                value={username}
                onChangeText={(t) => { setUsername(t); setErrors({...errors, username: ''}); }}
                autoCapitalize="none"
              />
              {errors.username ? <Text style={styles.inlineError}>{errors.username}</Text> : null}
            </View>

            <View style={styles.row}>
              <View style={styles.halfInputContainer}>
                <TextInput
                  style={[styles.input, errors.firstName ? styles.inputError : null]}
                  placeholder="First name"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); setErrors({...errors, firstName: ''}); }}
                />
                {errors.firstName ? <Text style={styles.inlineError}>{errors.firstName}</Text> : null}
              </View>
              <View style={styles.halfInputContainer}>
                <TextInput
                  style={[styles.input, errors.lastName ? styles.inputError : null]}
                  placeholder="Last name"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); setErrors({...errors, lastName: ''}); }}
                />
                {errors.lastName ? <Text style={styles.inlineError}>{errors.lastName}</Text> : null}
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, errors.birthDate ? styles.inputError : null]}
                  placeholder="Date of birth (DD-MM-YYYY)"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={birthDateWeb}
                  onChangeText={(t) => { handleDateChangeWeb(t); setErrors({...errors, birthDate: ''}); }}
                  maxLength={10}
                  keyboardType="number-pad"
                />
                {errors.birthDate ? <Text style={styles.inlineError}>{errors.birthDate}</Text> : null}
              </View>
            ) : (
              <View style={styles.inputWrapper}>
                <TouchableOpacity
                  style={[styles.input, errors.birthDate ? styles.inputError : null, { justifyContent: 'center' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: birthDate ? Colors.dark.text : Colors.dark.textSecondary, fontSize: 16 }}>
                    {birthDate ? birthDate.toLocaleDateString('en-GB') : "Date of birth"}
                  </Text>
                </TouchableOpacity>
                {errors.birthDate ? <Text style={styles.inlineError}>{errors.birthDate}</Text> : null}

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
                        setErrors({...errors, birthDate: ''});
                      }
                    }}
                  />
                )}
              </View>
            )}
          </>
        )}

        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            placeholder="Email address"
            placeholderTextColor={Colors.dark.textSecondary}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors({...errors, email: ''}); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email ? <Text style={styles.inlineError}>{errors.email}</Text> : null}
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.password ? styles.inputError : null]}
            placeholder="Password"
            placeholderTextColor={Colors.dark.textSecondary}
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors({...errors, password: ''}); }}
            secureTextEntry
          />
          {errors.password ? <Text style={styles.inlineError}>{errors.password}</Text> : null}
        </View>

        {!isLoginMode && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Confirm password"
              placeholderTextColor={Colors.dark.textSecondary}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setErrors({...errors, confirmPassword: ''}); }}
              secureTextEntry
            />
            {errors.confirmPassword ? <Text style={styles.inlineError}>{errors.confirmPassword}</Text> : null}
          </View>
        )}

        {isLoginMode && (
          <TouchableOpacity onPress={() => setShowForgotModal(true)} style={styles.forgotPasswordLink}>
            <Text style={styles.forgotPasswordTextBtn}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.loginButton} onPress={handleAuth}>
          <Text style={styles.loginButtonText}>{isLoginMode ? "LOG IN" : "CREATE MY ACCOUNT"}</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#DB4437'}]} onPress={() => promptAsyncG()}>
          <Text style={styles.socialButtonText}>
            {isLoginMode ? "Log in with Google" : "Sign up with Google"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#4267B2'}]} onPress={() => promptAsyncF()}>
          <Text style={styles.socialButtonText}>
            {isLoginMode ? "Log in with Facebook" : "Sign up with Facebook"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotPassword} onPress={() => { setIsLoginMode(!isLoginMode); setErrors({}); setGlobalMessage({ type: '', text: '' }); }}>
          <Text style={styles.forgotPasswordText}>
            {isLoginMode ? "New here? Create an account" : "Already have an account? Log in"}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={showForgotModal} transparent animationType="fade" onRequestClose={closeForgotModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset your password</Text>
            <Text style={styles.modalSubtitle}>Enter the email associated with your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.dark.textSecondary}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {forgotModalMessage ? <Text style={styles.modalMessage}>{forgotModalMessage}</Text> : null}
            <TouchableOpacity style={styles.loginButton} onPress={handleForgotPasswordSubmit}>
              <Text style={styles.loginButtonText}>SEND RESET LINK</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeForgotModal}>
              <Text style={styles.forgotPasswordTextBtn}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 42, fontWeight: 'bold', color: Colors.dark.primary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
  halfInputContainer: { width: '48%' },
  inputWrapper: { marginBottom: 16, width: '100%' },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: 'transparent' },
  inputError: { borderColor: Colors.dark.danger },
  inlineError: { color: Colors.dark.danger, fontSize: 12, marginTop: 4, marginLeft: 4, fontWeight: 'bold' },
  globalMessage: { fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: 'bold', padding: 10, borderRadius: 8 },
  errorText: { color: Colors.dark.danger, backgroundColor: 'rgba(255, 68, 68, 0.1)' },
  successText: { color: Colors.dark.primary, backgroundColor: 'rgba(29, 185, 84, 0.1)' },
  forgotPasswordLink: { alignSelf: 'flex-end', marginBottom: 16 },
  forgotPasswordTextBtn: { color: Colors.dark.primary, fontSize: 14, fontWeight: 'bold' },
  loginButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  loginButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  forgotPassword: { marginTop: 24, alignItems: 'center' },
  forgotPasswordText: { color: Colors.dark.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.dark.backgroundElement },
  dividerText: { color: Colors.dark.textSecondary, paddingHorizontal: 10, fontSize: 12 },
  socialButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  socialButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.dark.background, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: Colors.dark.textSecondary, marginBottom: 16 },
  modalMessage: { fontSize: 13, color: Colors.dark.primary, marginBottom: 12, fontWeight: 'bold' },
  modalCloseButton: { marginTop: 16, alignItems: 'center' },
});