import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Fonctions factices pour l'instant
  const handleLogin = () => {
  console.log("Connexion avec :", email);
  // Redirection vers la page home
  router.replace('/home' as any); 
  };
  const handleSocialLogin = (network: string) => console.log("Connexion via", network);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Titre de l'application */}
        <Text style={styles.title}>Music Room</Text>
        <Text style={styles.subtitle}>Connectez-vous pour rejoindre l'événement</Text>

        {/* Formulaire classique */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Bouton de connexion manuel */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>SE CONNECTER</Text>
        </TouchableOpacity>

        {/* Mot de passe oublié */}
        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Boutons réseaux sociaux */}
        <TouchableOpacity 
          style={[styles.socialButton, { backgroundColor: '#DB4437' }]} 
          onPress={() => handleSocialLogin('Google')}
        >
          <Text style={styles.socialButtonText}>Continuer avec Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, { backgroundColor: '#4267B2' }]} 
          onPress={() => handleSocialLogin('Facebook')}
        >
          <Text style={styles.socialButtonText}>Continuer avec Facebook</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

// Les styles de la page (façon CSS)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Fond sombre
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1DB954', // Vert style Spotify
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#282828',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  forgotPassword: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#282828',
    marginVertical: 32,
  },
  socialButton: {
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 16,
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});