import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  // Fonction pour se déconnecter (retour au login)
  const handleLogout = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Événements</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Section Événements Privés (Invitations) */}
        <Text style={styles.sectionTitle}>Mes Invitations (Privé)</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎵 Soirée de Brighton</Text>
          <Text style={styles.cardSubtitle}>Hôte : BrightonJ</Text>
          <TouchableOpacity style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Rejoindre</Text>
          </TouchableOpacity>
        </View>

        {/* Section Événements Publics (Géolocalisés) */}
        <Text style={styles.sectionTitle}>Autour de moi (Public)</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎸 Open Mic 42</Text>
          <Text style={styles.cardSubtitle}>À 50 mètres</Text>
          <TouchableOpacity style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Rejoindre</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bouton flottant pour créer un événement */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#282828' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  logoutText: { color: '#B3B3B3', fontSize: 16 },
  content: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1DB954', marginTop: 20, marginBottom: 15 },
  card: { backgroundColor: '#282828', padding: 20, borderRadius: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: '#B3B3B3', marginBottom: 15 },
  joinButton: { backgroundColor: '#1DB954', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  joinButtonText: { color: '#121212', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#1DB954', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { fontSize: 30, color: '#121212', fontWeight: 'bold' }
});