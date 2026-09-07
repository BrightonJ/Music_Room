import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';

export default function AuthScreen() {
  const router = useRouter();
  
  // États basiques
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Nouveaux états pour l'inscription
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState(''); // Format YYYY-MM-DD
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const API_URL = 'http://10.171.57.163:3000/api'; // ⚠️ TON IP

  useEffect(() => {
    const checkToken = async () => {
      let token = null;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('userToken');
      } else {
        token = await SecureStore.getItemAsync('userToken');
      }
      if (token) router.replace('/home' as any);
    };
    checkToken();
  }, []);

  const handleAuth = async () => {
    const endpoint = isLoginMode ? '/login' : '/register';
    
    // On prépare les données selon le mode
    const payload = isLoginMode 
      ? { email, password }
      : { email, password, firstName, lastName, birthDate };

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
          } else {
            await SecureStore.setItemAsync('userToken', data.token);
          }
          router.replace('/home' as any);
        } else {
          // Si inscription réussie, on affiche le message pour l'email
          Alert.alert("Bravo !", data.message);
          setIsLoginMode(true); // On rebascule sur le login
        }
      } else {
        Alert.alert("Erreur", data.error);
      }
    } catch (error) {
      Alert.alert("Erreur réseau", "Impossible de joindre le serveur.");
    }
  };

  const handleSocialAuth = (provider: string) => {
    Alert.alert("En développement", `L'authentification avec ${provider} nécessite la configuration des clés d'API (OAuth) sur le portail développeur.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.title}>Music Room</Text>
        <Text style={styles.subtitle}>
          {isLoginMode ? "Connectez-vous pour rejoindre l'événement" : "Créez un profil complet et sécurisé"}
        </Text>

        {/* CHAMPS DYNAMIQUES : Affichés seulement si Inscription */}
        {!isLoginMode && (
          <>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <TextInput style={[styles.input, {flex: 0.48}]} placeholder="Prénom" placeholderTextColor={Colors.dark.textSecondary} value={firstName} onChangeText={setFirstName} />
              <TextInput style={[styles.input, {flex: 0.48}]} placeholder="Nom" placeholderTextColor={Colors.dark.textSecondary} value={lastName} onChangeText={setLastName} />
            </View>
            <TextInput style={styles.input} placeholder="Date de naissance (AAAA-MM-JJ)" placeholderTextColor={Colors.dark.textSecondary} value={birthDate} onChangeText={setBirthDate} />
          </>
        )}

        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.dark.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor={Colors.dark.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.loginButton} onPress={handleAuth}>
          <Text style={styles.loginButtonText}>{isLoginMode ? "SE CONNECTER" : "CRÉER MON COMPTE"}</Text>
        </TouchableOpacity>

        {/* SECTION OAUTH : Google & Facebook */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#DB4437'}]} onPress={() => handleSocialAuth('Google')}>
          <Text style={styles.socialButtonText}>Continuer avec Google</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.socialButton, {backgroundColor: '#4267B2'}]} onPress={() => handleSocialAuth('Facebook')}>
          <Text style={styles.socialButtonText}>Continuer avec Facebook</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotPassword} onPress={() => setIsLoginMode(!isLoginMode)}>
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
  subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, marginBottom: 16, fontSize: 16 },
  loginButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 8 },
  loginButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  forgotPassword: { marginTop: 24, alignItems: 'center' },
  forgotPasswordText: { color: Colors.dark.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.dark.backgroundElement },
  dividerText: { color: Colors.dark.textSecondary, paddingHorizontal: 10, fontSize: 12 },
  socialButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  socialButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});