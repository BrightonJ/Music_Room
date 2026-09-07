import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Colors } from '../constants/theme';

export default function RoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const SOCKET_URL = 'http://10.171.57.163:3000'; // ⚠️ Ton adresse IP

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Quand on se connecte, on dit au serveur qu'on rejoint CETTE room
    newSocket.on('connect', () => {
      newSocket.emit('join_room', id);
    });

    // Quand on quitte la page, on coupe la connexion pour économiser la batterie
    return () => {
      newSocket.disconnect();
    };
  }, [id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Room #{id}</Text>
        <TouchableOpacity>
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingLabel}>EN COURS DE LECTURE</Text>
          <Text style={styles.nowPlayingTitle}>Waiting for tracks...</Text>
        </View>

        <TouchableOpacity style={styles.proposeButton}>
          <Text style={styles.proposeButtonText}>+ PROPOSER UN TITRE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  backText: { color: Colors.dark.primary, fontSize: 16 },
  settingsText: { fontSize: 20 },
  content: { padding: 20, flex: 1 },
  nowPlaying: { backgroundColor: Colors.dark.backgroundElement, padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  nowPlayingLabel: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  nowPlayingTitle: { color: Colors.dark.primary, fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  proposeButton: { backgroundColor: Colors.dark.backgroundSelected, padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.primary, borderStyle: 'dashed' },
  proposeButtonText: { color: Colors.dark.primary, fontWeight: 'bold' },
});