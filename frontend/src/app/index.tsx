import { useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Space, Type } from '@/constants/theme';
import { ui } from '@/constants/styles';
import DateTimeField from '@/components/DateTimeField';
import { ApiError, apiFetch, errorMessage } from '@/lib/api';
import { storage } from '@/lib/storage';
import { toIsoDate } from '@/lib/dates';
import { startSocialLogin } from '@/lib/socialAuth';
import { RetroBrand, RetroScreen } from '@/components/retro';

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

type Message = { type: 'success' | 'error'; text: string } | null;

export default function AuthScreen() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Already logged in: go straight to the rooms (an invalid token is caught by the 401 handler)
  useEffect(() => {
    storage.getToken().then((token) => {
      if (token) router.replace('/home');
      else setCheckingSession(false);
    });
  }, [router]);

  const switchMode = () => {
    setIsLoginMode((v) => !v);
    setErrors({});
    setMessage(null);
    setNeedsActivation(false);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = isLoginMode ? 'Email or username required' : 'Email required';
    else if (!isLoginMode && !EMAIL.test(email.trim())) next.email = 'Invalid email format';
    if (!password) next.password = 'Password required';
    if (!isLoginMode) {
      if (!firstName.trim()) next.firstName = 'First name required';
      if (!lastName.trim()) next.lastName = 'Last name required';
      if (!username) next.username = 'Username required';
      else if (!USERNAME.test(username)) next.username = '3-20 characters: letters, digits, underscore';
      if (!birthDate) next.birthDate = 'Date of birth required';
      if (password && !PASSWORD.test(password)) next.password = '8 characters minimum, with an uppercase letter, a lowercase letter, a digit and a special character';
      if (!confirmPassword) next.confirmPassword = 'Confirmation required';
      else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) setMessage({ type: 'error', text: 'Fix the fields highlighted in red.' });
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setMessage(null);
    setNeedsActivation(false);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isLoginMode) {
        const data = await apiFetch<{ token: string; user: { id: number } }>('/login', {
          method: 'POST',
          auth: false,
          body: { identifier: email.trim(), password },
        });
        await storage.saveSession(data.token, data.user.id);
        router.replace('/home');
      } else {
        const data = await apiFetch<{ message: string }>('/register', {
          method: 'POST',
          auth: false,
          body: {
            email: email.trim(),
            password,
            username,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            birthDate: birthDate ? toIsoDate(birthDate) : null,
          },
        });
        setMessage({ type: 'success', text: data.message });
        setIsLoginMode(true);
        setPassword('');
        setConfirmPassword('');
        setErrors({});
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setNeedsActivation(true);
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const resendActivation = async () => {
    try {
      const data = await apiFetch<{ message: string }>('/resend-verification', { method: 'POST', auth: false, body: { identifier: email.trim() } });
      setMessage({ type: 'success', text: data.message });
      setNeedsActivation(false);
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  };

  const sendForgot = async () => {
    if (!EMAIL.test(forgotEmail.trim())) {
      setForgotMessage('Enter the email of your account.');
      return;
    }
    try {
      const data = await apiFetch<{ message: string }>('/forgot-password', { method: 'POST', auth: false, body: { email: forgotEmail.trim() } });
      setForgotMessage(data.message);
    } catch (err) {
      setForgotMessage(errorMessage(err));
    }
  };

  const field = (
    key: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    props: Partial<ComponentProps<typeof TextInput>> = {}
  ) => (
    <View>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        style={[ui.input, errors[key] && ui.inputError]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Colors.retro.textSecondary}
        autoCorrect={false}
        {...props}
      />
      {errors[key] ? <Text style={ui.fieldError}>{errors[key]}</Text> : null}
    </View>
  );

  if (checkingSession) {
    return (
      <RetroScreen style={styles.center}>
        <ActivityIndicator color={Colors.retro.primary} />
      </RetroScreen>
    );
  }

  return (
    <RetroScreen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={12}>
              <Text style={styles.settingsLink}>Server settings</Text>
            </TouchableOpacity>
          </View>

          <RetroBrand subtitle={isLoginMode ? 'Log in to join the party' : 'Create your account'} />

          {!isLoginMode && (
            <>
              {field('firstName', 'First name', firstName, setFirstName, { autoCapitalize: 'words', textContentType: 'givenName' })}
              {field('lastName', 'Last name', lastName, setLastName, { autoCapitalize: 'words', textContentType: 'familyName' })}
              {field('username', 'Username', username, setUsername, { autoCapitalize: 'none', textContentType: 'username' })}
              <Text style={ui.label}>Date of birth</Text>
              <DateTimeField
                mode="date"
                value={birthDate}
                onChange={setBirthDate}
                placeholder="Select your date of birth"
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                hasError={!!errors.birthDate}
              />
              {errors.birthDate ? <Text style={ui.fieldError}>{errors.birthDate}</Text> : null}
            </>
          )}

          {isLoginMode
            ? field('email', 'Email or username', email, setEmail, { autoCapitalize: 'none', textContentType: 'username' })
            : field('email', 'Email', email, setEmail, { autoCapitalize: 'none', keyboardType: 'email-address', textContentType: 'emailAddress' })}
          {field('password', 'Password', password, setPassword, {
            secureTextEntry: true,
            autoCapitalize: 'none',
            textContentType: isLoginMode ? 'password' : 'newPassword',
          })}
          {!isLoginMode &&
            field('confirmPassword', 'Confirm password', confirmPassword, setConfirmPassword, {
              secureTextEntry: true,
              autoCapitalize: 'none',
              textContentType: 'newPassword',
            })}

          {isLoginMode && (
            <TouchableOpacity
              style={styles.forgot}
              onPress={() => {
                setForgotEmail(email.includes('@') ? email : '');
                setForgotMessage('');
                setShowForgot(true);
              }}
            >
              <Text style={ui.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {message ? <Text style={message.type === 'error' ? ui.messageError : ui.messageSuccess}>{message.text}</Text> : null}
          {needsActivation ? (
            <TouchableOpacity style={ui.secondaryButton} onPress={resendActivation}>
              <Text style={ui.secondaryButtonText}>Send the activation email again</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={[ui.primaryButton, submitting && ui.disabled]} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={Colors.retro.onPrimary} />
            ) : (
              <Text style={ui.primaryButtonText}>{isLoginMode ? 'Log in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>
          <TouchableOpacity style={ui.secondaryButton} onPress={() => startSocialLogin('google')}>
            <Text style={ui.secondaryButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchMode} onPress={switchMode}>
            <Text style={styles.switchText}>
              {isLoginMode ? 'No account yet? ' : 'Already have an account? '}
              <Text style={ui.linkText}>{isLoginMode ? 'Sign up' : 'Log in'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showForgot} transparent animationType="slide" onRequestClose={() => setShowForgot(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={ui.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={ui.modalCard}>
            <Text style={ui.modalTitle}>Reset your password</Text>
            <Text style={ui.helper}>We will email you a link to choose a new password.</Text>
            <TextInput
              style={[ui.input, { marginTop: 16 }]}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="Email"
              placeholderTextColor={Colors.retro.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {forgotMessage ? <Text style={ui.messageSuccess}>{forgotMessage}</Text> : null}
            <TouchableOpacity style={ui.primaryButton} onPress={sendForgot}>
              <Text style={ui.primaryButtonText}>Send the link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowForgot(false)}>
              <Text style={ui.linkText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </RetroScreen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  topBar: { alignItems: 'flex-end' },
  settingsLink: { ...Type.small, color: Colors.retro.textSecondary, textDecorationLine: 'underline' },
  forgot: { alignSelf: 'flex-end', marginTop: Space.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.xxl },
  divider: { flex: 1, height: 2, backgroundColor: Colors.retro.ink, opacity: 0.15 },
  dividerText: { ...Type.small, color: Colors.retro.textSecondary, marginHorizontal: Space.md },
  switchMode: { marginTop: Space.xxl, alignItems: 'center' },
  switchText: { ...Type.body, fontSize: 14, color: Colors.retro.textSecondary },
  modalClose: { alignItems: 'center', marginTop: Space.lg, paddingVertical: Space.sm },
});
