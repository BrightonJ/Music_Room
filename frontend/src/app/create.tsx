import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { RetroButton, RetroInput, RetroPage, RetroToggleRow } from '@/components/retro';
import { Space } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { getToken } from '@/lib/token';

export default function CreateEventScreen() {
  const router = useRouter();
  
  const [eventName, setEventName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLocationRestricted, setIsLocationRestricted] = useState(false);

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: eventName, 
          isPrivate: isPrivate, 
          isLocationRestricted: isLocationRestricted 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", data.message);
        // Replace the current screen with the room we just created
        router.replace({ pathname: '/room', params: { id: data.event.id } } as any);
      } else {
        Alert.alert("Error", data.error);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to reach the server");
    }
  };

  return (
    <RetroPage
      title="New room"
      left={{ label: 'Cancel', onPress: () => router.back() }}
      footer={<RetroButton label="Create room" onPress={handleCreate} disabled={!eventName} />}
    >
      <RetroInput
        label="Event name"
        placeholder="E.g. Brighton party"
        value={eventName}
        onChangeText={setEventName}
        containerStyle={{ marginBottom: Space.xxl }}
      />
      <RetroToggleRow style={{ marginBottom: Space.xl }} title="Private event" subtitle="Invitation only" value={isPrivate} onValueChange={setIsPrivate} />
      <RetroToggleRow
        title="License: proximity"
        subtitle="Must users be on site to vote?"
        value={isLocationRestricted}
        onValueChange={setIsLocationRestricted}
      />
    </RetroPage>
  );
}
