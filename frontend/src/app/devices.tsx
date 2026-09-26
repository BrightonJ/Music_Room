import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';
import { buildAuthHeaders } from '@/utils/api';
import { getDeviceId } from '@/constants/device';

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

export default function DevicesScreen() {
  const router = useRouter();

  const [devices, setDevices] = useState<any[]>([]);
  const [currentDeviceUid, setCurrentDeviceUid] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadDevices = async () => {
    const token = await getToken();
    if (!token) {
      router.replace('/' as any);
      return;
    }
    setCurrentDeviceUid(await getDeviceId());
    try {
      const response = await fetch(`${API_URL}/devices`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setDevices(data);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [])
  );

  const handleRevoke = async (deviceId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token, false),
      });
      if (response.ok) {
        setMessage('Device removed. Any room control it held has been revoked.');
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } else {
        setMessage('Unable to remove this device.');
      }
    } catch (error) {
      setMessage('Unable to reach the server.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Devices</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Devices that have connected to a room under your account. Removing a device also revokes
          any room control currently delegated to it.
        </Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {devices.length === 0 ? (
          <Text style={styles.emptyText}>No devices yet — join a room to register this one.</Text>
        ) : (
          devices.map((device) => (
            <View key={device.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {device.device_name || 'Unknown device'}
                  {device.device_uid === currentDeviceUid ? ' (this device)' : ''}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {device.platform || 'unknown'} • last seen {new Date(device.last_seen_at).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity style={styles.revokeButton} onPress={() => handleRevoke(device.id)}>
                <Text style={styles.revokeButtonText}>Remove</Text>
              </TouchableOpacity>
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
  hint: { color: Colors.dark.textSecondary, fontSize: 12, marginBottom: 16 },
  message: { color: Colors.dark.primary, fontSize: 13, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { color: Colors.dark.textSecondary, fontStyle: 'italic' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.dark.backgroundElement, padding: 16, borderRadius: 10, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: Colors.dark.textSecondary },
  revokeButton: { backgroundColor: Colors.dark.danger, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, marginLeft: 10 },
  revokeButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
});