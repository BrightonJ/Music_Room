import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, RefreshControl, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { CardToneCycle, Colors, Space } from '@/constants/theme';
import {
  RetroButton, RetroCard, RetroChip, RetroEmptyState, RetroIcon, RetroPage, RetroSection, RetroText, RetroVinyl,
} from '@/components/retro';
import { API_URL } from '@/constants/config';
import { getToken } from '@/lib/token';


export default function HomeScreen() {
  const router = useRouter();
  
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/events`, { headers: { Authorization: `Bearer ${token}` } });
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

  const C = Colors.retro;

  return (
    <RetroPage
      title="Events"
      left={{ label: 'Log out', onPress: handleLogout, color: C.danger }}
      right={{ label: 'Profile', onPress: () => router.push('/profile' as any) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      footer={<RetroButton label="+  New room" onPress={() => router.push('/create' as any)} />}
    >
      <RetroText variant="title" style={styles.hello}>
        Hello,{'\n'}{events.length} {events.length === 1 ? 'room' : 'rooms'} live
      </RetroText>

      <RetroSection title="Around me (public)">
        {events.length === 0 ? (
          <RetroEmptyState illustration={<RetroVinyl size={130} />} message={'No active room right now.\nCreate one!'} />
        ) : (
          events.map((event, index) => (
            <RetroCard key={event.id} tone={CardToneCycle[index % CardToneCycle.length]} style={styles.card}>
              <View style={styles.cardTop}>
                <RetroIcon name="musical-notes" size={24} />
                <RetroText variant="heading" style={{ flex: 1 }} numberOfLines={2}>{event.name}</RetroText>
              </View>
              <View style={styles.chips}>
                <RetroChip tone="default" label={event.is_private ? 'Private' : 'Public'} />
                {event.location_restricted ? <RetroChip tone="default" label="Proximity" /> : null}
              </View>
              <RetroButton
                variant="ghost"
                label="Join"
                small
                onPress={() => router.push({ pathname: '/room', params: { id: event.id } } as any)}
              />
            </RetroCard>
          ))
        )}
      </RetroSection>
    </RetroPage>
  );
}

const styles = StyleSheet.create({
  hello: { marginBottom: Space.xxl },
  card: { marginBottom: Space.xl },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm + 2, marginBottom: Space.md },
  chips: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.lg, flexWrap: 'wrap' },
});
