import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Colors } from '../constants/theme';

export default function RoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);

  // ⚠️ Remplace par 'localhost' ou ton IP actuelle (10.171.58.127)
  const SOCKET_URL = 'http://10.171.58.127:3000'; 

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', id);
    });

    newSocket.on('update_queue', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [id]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(text)}&media=music&entity=song&limit=5`);
      const data = await response.json();
      setSearchResults(data.results);
    } catch (error) {
      console.error("Erreur API iTunes :", error);
    }
  };

  const handleAddTrack = (track: any) => {
    const trackData = {
      roomId: id,
      title: track.trackName,
      artist: track.artistName,
      coverUrl: track.artworkUrl100,
    };
    socket?.emit('add_track', trackData);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleVote = (trackId: number, voteValue: number) => {
    socket?.emit('vote_track', { trackId, roomId: id, voteValue });
  };

  const renderSearchResult = ({ item }: { item: any }) => (
    <View style={styles.trackCard}>
      <Image source={{ uri: item.artworkUrl100 }} style={styles.albumCover} />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.trackName}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artistName}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => handleAddTrack(item)}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home' as any)}>
            <Text style={styles.backText}>← Quitter</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room #{id}</Text>
          <TouchableOpacity><Text style={styles.settingsText}>⚙️</Text></TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un titre..."
            placeholderTextColor={Colors.dark.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        <View style={styles.content}>
          {searchQuery.length >= 3 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.trackId.toString()}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>File d'attente</Text>
              {queue.length === 0 ? (
                <Text style={styles.emptyQueueText}>La playlist est vide. Cherchez un son !</Text>
              ) : (
                <FlatList
                  data={queue}
                  keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.trackCard}>
                      {item.cover_url && <Image source={{ uri: item.cover_url }} style={styles.albumCover} />}
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackTitle}>{item.title}</Text>
                        <Text style={styles.trackArtist}>{item.artist}</Text>
                      </View>
                      <View style={styles.voteContainer}>
                        <TouchableOpacity onPress={() => handleVote(item.id, 1)} style={styles.voteBtn}>
                          <Text style={styles.voteIcon}>👍</Text>
                        </TouchableOpacity>
                        <Text style={styles.voteCount}>{item.votes || 0}</Text>
                        <TouchableOpacity onPress={() => handleVote(item.id, -1)} style={styles.voteBtn}>
                          <Text style={styles.voteIcon}>👎</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.backgroundElement },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  backText: { color: Colors.dark.danger, fontSize: 16, fontWeight: 'bold' },
  settingsText: { fontSize: 20 },
  searchContainer: { padding: 15, backgroundColor: Colors.dark.background },
  searchInput: { backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, padding: 15, borderRadius: 12, fontSize: 16 },
  content: { flex: 1, paddingHorizontal: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 15 },
  trackCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.backgroundElement, padding: 10, borderRadius: 10, marginBottom: 10 },
  albumCover: { width: 50, height: 50, borderRadius: 8, marginRight: 15, backgroundColor: Colors.dark.backgroundSelected },
  trackInfo: { flex: 1 },
  trackTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  trackArtist: { color: Colors.dark.textSecondary, fontSize: 14 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  addButtonText: { color: Colors.dark.background, fontSize: 24, fontWeight: 'bold', lineHeight: 26 },
  emptyQueueText: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 },
  voteContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.background, borderRadius: 20, paddingHorizontal: 5 },
  voteBtn: { padding: 8 },
  voteIcon: { fontSize: 16 },
  voteCount: { color: Colors.dark.text, fontWeight: 'bold', fontSize: 16, marginHorizontal: 5, minWidth: 20, textAlign: 'center' },
});