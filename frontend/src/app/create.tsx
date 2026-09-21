import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { API_URL } from '@/constants/config';

export default function CreateEventScreen() {
  const router = useRouter();
  
  const [eventName, setEventName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLocationRestricted, setIsLocationRestricted] = useState(false);

  const handleCreate = async () => {
    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: eventName, 
          isPrivate: isPrivate, 
          isLocationRestricted: isLocationRestricted 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Succès", data.message);
        // On remplace l'écran actuel par celui de la Room qu'on vient de créer
        router.replace({ pathname: '/room', params: { id: data.event.id } } as any);
      } else {
        Alert.alert("Erreur", data.error);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de joindre le serveur");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle Room</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Nom de l'événement</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Soirée de Brighton"
          placeholderTextColor={Colors.dark.textSecondary}
          value={eventName}
          onChangeText={setEventName}
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Événement Privé</Text>
            <Text style={styles.switchSubLabel}>Sur invitation uniquement</Text>
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
            <Text style={styles.switchLabel}>Licence : Proximité</Text>
            <Text style={styles.switchSubLabel}>Faut-il être sur place pour voter ?</Text>
          </View>
          <Switch
            trackColor={{ false: Colors.dark.backgroundSelected, true: Colors.dark.primary }}
            thumbColor={Colors.dark.text}
            onValueChange={setIsLocationRestricted}
            value={isLocationRestricted}
          />
        </View>

        <TouchableOpacity 
          style={[styles.createButton, !eventName && styles.createButtonDisabled]} 
          onPress={handleCreate}
          disabled={!eventName}
        >
          <Text style={styles.createButtonText}>CRÉER LA ROOM</Text>
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
  input: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: Colors.dark.backgroundElement, padding: 16, borderRadius: 8 },
  switchLabel: { color: Colors.dark.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  switchSubLabel: { color: Colors.dark.textSecondary, fontSize: 12 },
  createButton: { backgroundColor: Colors.dark.primary, paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  createButtonDisabled: { backgroundColor: Colors.dark.backgroundSelected },
  createButtonText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
});