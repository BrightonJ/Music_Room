import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';
import { buildAuthHeaders } from '@/utils/api';

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

export default function FriendsScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  const loadData = async () => {
    const token = await getToken();
    if (!token) {
      router.replace('/' as any);
      return;
    }
    try {
      const [requestsRes, friendsRes] = await Promise.all([
        fetch(`${API_URL}/friends/requests`, { headers: buildAuthHeaders(token, false) }),
        fetch(`${API_URL}/friends`, { headers: buildAuthHeaders(token, false) }),
      ]);
      const requestsData = await requestsRes.json();
      const friendsData = await friendsRes.json();
      if (requestsRes.ok) setRequests(requestsData);
      if (friendsRes.ok) setFriends(friendsData);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleAddFriend = async () => {
    if (!username) return;
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/requests`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Friend request sent.');
        setUsername('');
      } else {
        setMessage(data.error || 'Unable to send request.');
      }
    } catch (error) {
      setMessage('Unable to reach the server.');
    }
  };

  const handleAccept = async (requestId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: buildAuthHeaders(token, false),
      });
      if (response.ok) loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDecline = async (requestId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/requests/${requestId}/decline`, {
        method: 'POST',
        headers: buildAuthHeaders(token, false),
      });
      if (response.ok) loadData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Add a friend</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Username"
            placeholderTextColor={Colors.dark.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.sectionTitle}>Friend requests</Text>
        {requests.length === 0 ? (
          <Text style={styles.emptyText}>No pending requests.</Text>
        ) : (
          requests.map((req) => (
            <View key={req.id} style={styles.card}>
              <Text style={styles.cardTitle}>{req.requester_username}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(req.id)}>
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(req.id)}>
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>My friends</Text>
        {friends.length === 0 ? (
          <Text style={styles.emptyText}>No friends yet.</Text>
        ) : (
          friends.map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <Text style={styles.cardTitle}>{friend.username}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  cancelText: { color: Colors.dark.textSecondary, fontSize: 16 },
  content: { padding: 20 },
  label: { color: Colors.dark.text, fontSize: 14, marginBottom: 8, fontWeight: 'bold' },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, fontSize: 16 },
  addButton: { backgroundColor: Colors.dark.primary, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: Colors.dark.background, fontWeight: 'bold' },
  message: { color: Colors.dark.primary, fontSize: 13, fontWeight: 'bold', marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.primary, marginTop: 24, marginBottom: 12 },
  emptyText: { color: Colors.dark.textSecondary, fontStyle: 'italic' },
  card: { backgroundColor: Colors.dark.backgroundElement, padding: 16, borderRadius: 10, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.dark.text },
  friendRow: { backgroundColor: Colors.dark.backgroundElement, padding: 14, borderRadius: 10, marginBottom: 8 },
  acceptButton: { backgroundColor: Colors.dark.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  acceptButtonText: { color: Colors.dark.background, fontWeight: 'bold' },
  declineButton: { backgroundColor: Colors.dark.backgroundSelected, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  declineButtonText: { color: Colors.dark.text, fontWeight: 'bold' },
});