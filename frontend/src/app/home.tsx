import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, RefreshControl, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';
import { buildAuthHeaders } from '@/utils/api';
import { Modal } from 'react-native';

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

export default function HomeScreen() {
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fetchEvents = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/events`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setEvents(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchInvitations = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/invitations`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setInvitations(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFriendRequestsCount = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/requests`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setFriendRequestsCount(data.length);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const verifyAuth = async () => {
        const token = await getToken();
        if (!token) {
          router.replace('/' as any);
          return;
        }
        fetchEvents(token);
        fetchInvitations(token);
        fetchFriendRequestsCount(token);
      };

      verifyAuth();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    (async () => {
      const token = await getToken();
      if (token) {
        await Promise.all([fetchEvents(token), fetchInvitations(token), fetchFriendRequestsCount(token)]);
      }
      setRefreshing(false);
    })();
  }, []);

  const handleAcceptInvitation = async (invitationId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: buildAuthHeaders(token, false),
      });
      if (response.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        fetchEvents(token);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeclineInvitation = async (invitationId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: buildAuthHeaders(token, false),
      });
      if (response.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    if (Platform.OS === 'web') {
      localStorage.removeItem('userToken');
      localStorage.removeItem('userId');
    } else {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
    }
    router.replace('/' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/friends' as any)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.logoutText}>Friends</Text>
            {friendRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{friendRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile' as any)}>
            <Text style={styles.logoutText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLogoutModal(true)}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />
        }
      >
        {invitations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Room invitations</Text>
            {invitations.map((inv) => (
              <View key={inv.id} style={styles.card}>
                <Text style={styles.cardTitle}>{inv.event_name}</Text>
                <Text style={styles.cardSubtitle}>Invited by {inv.invited_by_username}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={styles.joinButton} onPress={() => handleAcceptInvitation(inv.id)}>
                    <Text style={styles.joinButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineButton} onPress={() => handleDeclineInvitation(inv.id)}>
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Around me (Public)</Text>

        {events.length === 0 ? (
          <Text style={styles.emptyText}>No active room right now. Create one!</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.name}</Text>
              <Text style={styles.cardSubtitle}>
                {event.is_private ? '🔒 Private' : '🌍 Public'} {event.location_restricted ? ' • 📍 Proximity required' : ''}
              </Text>
              <TouchableOpacity style={styles.joinButton} onPress={() => router.push({ pathname: '/room', params: { id: event.id } } as any)}>
                <Text style={styles.joinButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/create' as any)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalSubtitle}>Are you sure you want to log out?</Text>
            <TouchableOpacity style={styles.confirmLogoutButton} onPress={confirmLogout}>
              <Text style={styles.confirmLogoutButtonText}>LOG OUT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowLogoutModal(false)}>
              <Text style={styles.logoutText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.dark.text },
  logoutText: { color: Colors.dark.textSecondary, fontSize: 16 },
  badge: { backgroundColor: Colors.dark.danger, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 5, paddingHorizontal: 4 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.primary, marginTop: 10, marginBottom: 15 },
  emptyText: { color: Colors.dark.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: Colors.dark.backgroundElement, padding: 20, borderRadius: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 15 },
  joinButton: { backgroundColor: Colors.dark.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },
  joinButtonText: { color: Colors.dark.background, fontWeight: 'bold' },
  declineButton: { backgroundColor: Colors.dark.backgroundSelected, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },
  declineButtonText: { color: Colors.dark.text, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: Colors.dark.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { fontSize: 30, color: Colors.dark.background, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.dark.background, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 20 },
  confirmLogoutButton: { backgroundColor: Colors.dark.danger, paddingVertical: 14, borderRadius: 50, alignItems: 'center' },
  confirmLogoutButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
  modalCloseButton: { marginTop: 14, alignItems: 'center' }
});