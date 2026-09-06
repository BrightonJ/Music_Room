import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true); // Bascule entre Inscription et Connexion

  const API_URL = 'http://10.171.57.163:3000/api';

  const handleAuth = async () => {
    // 1. On choisit la bonne route selon le mode
    const endpoint = isLoginMode ? '/login' : '/register';

    try {
      // 2. On envoie la requête au Back-end
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // 3. On gère la réponse
      if (response.ok) {
        Alert.alert("Succès", data.message);
        // Si c'est un login réussi, on va sur la Home !
        if (isLoginMode) {
          router.replace('/home' as any);
        } else {
          // Si c'est une inscription, on bascule sur le mode connexion
          setIsLoginMode(true);
        }
      } else {
        // Erreur renvoyée par le serveur (ex: mot de passe incorrect)
        Alert.alert("Erreur", data.error);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur réseau", "Impossible de joindre le serveur. L'IP est-elle correcte ?");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        <Text style={styles.title}>Music Room</Text>
        <Text style={styles.subtitle}>
          {isLoginMode ? "Connectez-vous pour rejoindre l'événement" : "Créez un compte pour commencer"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.dark.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor={Colors.dark.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Bouton principal dynamique */}
        <TouchableOpacity style={styles.loginButton} onPress={handleAuth}>
          <Text style={styles.loginButtonText}>
            {isLoginMode ? "SE CONNECTER" : "S'INSCRIRE"}
          </Text>
        </TouchableOpacity>

        {/* Bouton pour basculer de mode */}
        <TouchableOpacity style={styles.forgotPassword} onPress={() => setIsLoginMode(!isLoginMode)}>
          <Text style={styles.forgotPasswordText}>
            {isLoginMode ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 42, fontWeight: 'bold', color: Colors.dark.primary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, marginBottom: 16, fontSize: 16 },
  loginButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 8 },
  loginButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  forgotPassword: { marginTop: 16, alignItems: 'center' },
  forgotPasswordText: { color: Colors.dark.textSecondary, fontSize: 14 },
});