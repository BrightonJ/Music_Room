import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';

export default function RoomScreen() {
  const router = useRouter();
  
  const [isHost, setIsHost] = useState(true);
  const [queue, setQueue] = useState([
    { id: '1', title: 'Bohemian Rhapsody', artist: 'Queen', votes: 12 },
    { id: '2', title: 'Daft Punk', artist: 'Get Lucky', votes: 8 },
    { id: '3', title: 'Blinding Lights', artist: 'The Weeknd', votes: 3 },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.leaveText}>Quitter</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎵 Soirée de Brighton</Text>
        {isHost ? (
          <TouchableOpacity>
            <Text style={styles.delegateText}>Droits</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <View style={styles.nowPlaying}>
        <View style={styles.albumArtPlaceholder}>
          <Text style={styles.albumArtText}>CD</Text>
        </View>
        <Text style={styles.trackTitle}>Shape of You</Text>
        <Text style={styles.trackArtist}>Ed Sheeran</Text>

        {isHost && (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton}>
              <Text style={styles.controlText}>⏸ Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Text style={styles.controlText}>⏭ Suivant</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.queueSection}>
        <Text style={styles.queueTitle}>Prochains morceaux</Text>
        
        <ScrollView style={styles.queueList}>
          {queue.map((track) => (
            <View key={track.id} style={styles.trackItem}>
              <View style={styles.trackInfo}>
                <Text style={styles.trackName}>{track.title}</Text>
                <Text style={styles.trackArtistSmall}>{track.artist}</Text>
              </View>
              
              <View style={styles.voteSection}>
                <Text style={styles.voteCount}>{track.votes}</Text>
                <TouchableOpacity style={styles.voteButton}>
                  <Text style={styles.voteButtonText}>▲</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.addTrackButton}>
        <Text style={styles.addTrackText}>+ PROPOSER UN MORCEAU</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.text },
  leaveText: { color: Colors.dark.danger, fontSize: 16 },
  delegateText: { color: Colors.dark.primary, fontSize: 16, fontWeight: 'bold' },
  
  nowPlaying: { alignItems: 'center', padding: 30, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  albumArtPlaceholder: { width: 150, height: 150, backgroundColor: Colors.dark.backgroundElement, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  albumArtText: { color: Colors.dark.textSecondary, fontSize: 40, fontWeight: 'bold' },
  trackTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 5 },
  trackArtist: { fontSize: 18, color: Colors.dark.textSecondary, marginBottom: 20 },
  
  controls: { flexDirection: 'row', gap: 20 },
  controlButton: { backgroundColor: Colors.dark.text, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 50 },
  controlText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16 },
  
  queueSection: { flex: 1, padding: 20 },
  queueTitle: { color: Colors.dark.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  queueList: { flex: 1 },
  trackItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.dark.backgroundElement, padding: 15, borderRadius: 8, marginBottom: 10 },
  trackInfo: { flex: 1 },
  trackName: { color: Colors.dark.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  trackArtistSmall: { color: Colors.dark.textSecondary, fontSize: 14 },
  
  voteSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  voteCount: { color: Colors.dark.primary, fontSize: 18, fontWeight: 'bold' },
  voteButton: { backgroundColor: Colors.dark.backgroundSelected, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  voteButtonText: { color: Colors.dark.primary, fontSize: 18 },
  
  addTrackButton: { backgroundColor: Colors.dark.primary, margin: 20, paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  addTrackText: { color: Colors.dark.background, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
});