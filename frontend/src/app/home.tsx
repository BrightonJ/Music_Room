import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, RefreshControl, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';


export default function HomeScreen() {
  const router = useRouter();
  
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      if (response.ok) {
        setEvents(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const verifyAuth = async () => {
        let token = null;
        if (Platform.OS === 'web') {
          token = localStorage.getItem('userToken');
        } else {
          token = await SecureStore.getItemAsync('userToken');
        }

        if (!token) {
          router.replace('/' as any);
          return;
        }
        fetchEvents();
      };

      verifyAuth();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents().then(() => setRefreshing(false));
  }, []);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem('userToken');
    } else {
      await SecureStore.deleteItemAsync('userToken');
    }
    router.replace('/' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Événements</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />
        }
      >
        <Text style={styles.sectionTitle}>Autour de moi (Public)</Text>
        
        {events.length === 0 ? (
          <Text style={styles.emptyText}>Aucune Room active pour le moment. Créez-en une !</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.name}</Text>
              <Text style={styles.cardSubtitle}>
                {event.is_private ? '🔒 Privé' : '🌍 Public'} {event.location_restricted ? ' • 📍 Proximité requise' : ''}
              </Text>
              <TouchableOpacity style={styles.joinButton} onPress={() => router.push({ pathname: '/room', params: { id: event.id } } as any)}>
                <Text style={styles.joinButtonText}>Rejoindre</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/create' as any)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.dark.text },
  logoutText: { color: Colors.dark.textSecondary, fontSize: 16 },
  content: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.primary, marginTop: 10, marginBottom: 15 },
  emptyText: { color: Colors.dark.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: Colors.dark.backgroundElement, padding: 20, borderRadius: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 15 },
  joinButton: { backgroundColor: Colors.dark.primary, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  joinButtonText: { color: Colors.dark.background, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: Colors.dark.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { fontSize: 30, color: Colors.dark.background, fontWeight: 'bold' }
});