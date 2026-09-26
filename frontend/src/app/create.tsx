import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';
import { buildAuthHeaders } from '@/utils/api';

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

function formatTime(date: Date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function CreateEventScreen() {
  const router = useRouter();

  const [eventName, setEventName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLocationRestricted, setIsLocationRestricted] = useState(false);
  const [message, setMessage] = useState('');

  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [voteWindowStart, setVoteWindowStart] = useState(new Date());
  const [voteWindowEnd, setVoteWindowEnd] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const captureLocation = async () => {
    setLocationStatus('Requesting location permission...');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationStatus('Location permission denied. Proximity license cannot be enabled.');
      setIsLocationRestricted(false);
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({});
      setLocationLat(position.coords.latitude);
      setLocationLng(position.coords.longitude);
      setLocationStatus(`Location captured (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`);
    } catch (e) {
      setLocationStatus('Unable to get your location.');
      setIsLocationRestricted(false);
    }
  };

  const handleCreate = async () => {
    setMessage('');

    if (isLocationRestricted && (locationLat == null || locationLng == null)) {
      setMessage('Location could not be captured. Try toggling the proximity license again.');
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({
          name: eventName,
          isPrivate: isPrivate,
          isLocationRestricted: isLocationRestricted,
          locationLat,
          locationLng,
          locationRadiusM: 100,
          voteWindowStart: isLocationRestricted ? formatTime(voteWindowStart) : null,
          voteWindowEnd: isLocationRestricted ? formatTime(voteWindowEnd) : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.replace({ pathname: '/room', params: { id: data.event.id } } as any);
      } else {
        setMessage(data.error || "Unable to create the room.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to reach the server.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Room</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Event name</Text>
        <TextInput
          style={styles.input}
          placeholder="E.g. Brighton party"
          placeholderTextColor={Colors.dark.textSecondary}
          value={eventName}
          onChangeText={setEventName}
        />

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Private event</Text>
            <Text style={styles.switchSubLabel}>Invitation only</Text>
          </View>
          <Switch
            trackColor={{ false: Colors.dark.backgroundSelected, true: Colors.dark.primary }}
            thumbColor={Colors.dark.text}
            onValueChange={setIsPrivate}
            value={isPrivate}
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>License: Proximity</Text>
            <Text style={styles.switchSubLabel}>Must users be on site to vote?</Text>
          </View>
          <Switch
            trackColor={{ false: Colors.dark.backgroundSelected, true: Colors.dark.primary }}
            thumbColor={Colors.dark.text}
            onValueChange={(value) => {
              setIsLocationRestricted(value);
              if (value) captureLocation();
              else setLocationStatus('');
            }}
            value={isLocationRestricted}
          />
        </View>

        {isLocationRestricted && (
          <View style={styles.locationBox}>
            <Text style={styles.locationStatusText}>{locationStatus}</Text>

            <Text style={styles.label}>Voting window</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowStartPicker(true)}>
                <Text style={{ color: Colors.dark.text }}>From {formatTime(voteWindowStart)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowEndPicker(true)}>
                <Text style={{ color: Colors.dark.text }}>To {formatTime(voteWindowEnd)}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={voteWindowStart}
                mode="time"
                display="spinner"
                onChange={(e, date) => {
                  setShowStartPicker(Platform.OS === 'ios');
                  if (date) setVoteWindowStart(date);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={voteWindowEnd}
                mode="time"
                display="spinner"
                onChange={(e, date) => {
                  setShowEndPicker(Platform.OS === 'ios');
                  if (date) setVoteWindowEnd(date);
                }}
              />
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.createButton, !eventName && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!eventName}
        >
          <Text style={styles.createButtonText}>CREATE ROOM</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  cancelText: { color: Colors.dark.textSecondary, fontSize: 16 },
  content: { padding: 20, flex: 1 },
  label: { color: Colors.dark.text, fontSize: 16, marginBottom: 8, fontWeight: 'bold' },
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, padding: 16, borderRadius: 8, marginBottom: 12, fontSize: 16 },
  errorMessage: { color: Colors.dark.danger, fontSize: 13, fontWeight: 'bold', marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: Colors.dark.backgroundElement, padding: 16, borderRadius: 8 },
  switchLabel: { color: Colors.dark.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  switchSubLabel: { color: Colors.dark.textSecondary, fontSize: 12 },
  locationBox: { backgroundColor: Colors.dark.backgroundElement, padding: 16, borderRadius: 8, marginBottom: 24 },
  locationStatusText: { color: Colors.dark.primary, fontSize: 12, marginBottom: 12 },
  createButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  createButtonDisabled: { backgroundColor: Colors.dark.backgroundSelected },
  createButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
});