import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView } from 'react-native';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateWeb, setBirthDateWeb] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' });

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
      if (!email) newErrors.email = "Email requis";
      if (!password) newErrors.password = "Mot de passe requis";
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (!firstName) newErrors.firstName = "Prénom requis";
    if (!lastName) newErrors.lastName = "Nom requis";
    
    if (Platform.OS === 'web') {
      if (!birthDateWeb || birthDateWeb.length !== 10) newErrors.birthDate = "Date requise (JJ-MM-AAAA)";
    } else {
      if (!birthDate) newErrors.birthDate = "Date requise";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email requis";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Format d'email invalide";
    }

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!\%*?&]{8,}$/;
    if (!password) {
      newErrors.password = "Mot de passe requis";
    } else if (!passRegex.test(password)) {
      newErrors.password = "8 car. min, 1 maj, 1 min, 1 chiffre, 1 car. spécial";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirmation requise";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      setGlobalMessage({ type: 'error', text: 'Veuillez corriger les champs en rouge.' });
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
        finalBirthDate = birthDate.toISOString().split('T')[0];
      }
    }

    const payload = isLoginMode 
      ? { email, password }
      : { email, password, firstName, lastName, birthDate: finalBirthDate };

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
        setGlobalMessage({ type: 'error', text: data.error || "Une erreur est survenue." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Impossible de joindre le serveur." });
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrors({ email: "Veuillez saisir votre email" });
      setGlobalMessage({ type: 'error', text: "Renseignez votre email pour réinitialiser le mot de passe." });
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
        setGlobalMessage({ type: 'success', text: "Email de réinitialisation envoyé." });
      } else {
        setGlobalMessage({ type: 'error', text: data.error || "Erreur lors de la réinitialisation." });
      }
    } catch (error) {
      setGlobalMessage({ type: 'error', text: "Impossible de joindre le serveur." });
    }
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
          {isLoginMode ? "Connectez-vous pour rejoindre l'événement" : "Créez un profil complet et sécurisé"}
        </Text>

        {globalMessage.text ? (
          <Text style={[styles.globalMessage, globalMessage.type === 'error' ? styles.errorText : styles.successText]}>
            {globalMessage.text}
          </Text>
        ) : null}

        {!isLoginMode && (
          <>
            <View style={styles.row}>
              <View style={styles.halfInputContainer}>
                <TextInput 
                  style={[styles.input, errors.firstName ? styles.inputError : null]} 
                  placeholder="Prénom" 
                  placeholderTextColor={Colors.dark.textSecondary} 
                  value={firstName} 
                  onChangeText={(t) => { setFirstName(t); setErrors({...errors, firstName: ''}); }} 
                />
                {errors.firstName ? <Text style={styles.inlineError}>{errors.firstName}</Text> : null}
              </View>
              <View style={styles.halfInputContainer}>
                <TextInput 
                  style={[styles.input, errors.lastName ? styles.inputError : null]} 
                  placeholder="Nom" 
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
                  placeholder="Date de naissance (JJ-MM-AAAA)" 
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
                    {birthDate ? birthDate.toLocaleDateString('fr-FR') : "Date de naissance"}
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
            placeholder="Adresse Email" 
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
            placeholder="Mot de passe" 
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
              placeholder="Confirmer le mot de passe" 
              placeholderTextColor={Colors.dark.textSecondary} 
              value={confirmPassword} 
              onChangeText={(t) => { setConfirmPassword(t); setErrors({...errors, confirmPassword: ''}); }} 
              secureTextEntry 
            />
            {errors.confirmPassword ? <Text style={styles.inlineError}>{errors.confirmPassword}</Text> : null}
          </View>
        )}

        {isLoginMode && (
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordLink}>
            <Text style={styles.forgotPasswordTextBtn}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.loginButton} onPress={handleAuth}>
          <Text style={styles.loginButtonText}>{isLoginMode ? "SE CONNECTER" : "CRÉER MON COMPTE"}</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#DB4437'}]} onPress={() => promptAsyncG()}>
          <Text style={styles.socialButtonText}>
            {isLoginMode ? "Se connecter avec Google" : "S'inscrire avec Google"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#4267B2'}]} onPress={() => promptAsyncF()}>
          <Text style={styles.socialButtonText}>
            {isLoginMode ? "Se connecter avec Facebook" : "S'inscrire avec Facebook"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotPassword} onPress={() => { setIsLoginMode(!isLoginMode); setErrors({}); setGlobalMessage({ type: '', text: '' }); }}>
          <Text style={styles.forgotPasswordText}>
            {isLoginMode ? "Nouveau ici ? Créer un compte" : "Déjà un compte ? Se connecter"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
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
});