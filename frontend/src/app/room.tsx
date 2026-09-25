import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { Colors } from '../constants/theme';
import { SERVER_URL } from '@/constants/config';

type Track = {
  id: number;
  title: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  votes: number;
};

type NowPlaying = {
  track: { id: number; title: string; artist: string; coverUrl: string | null; previewUrl: string | null };
  startedAt: string;
  durationMs: number;
} | null;

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

export default function RoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  const [roomError, setRoomError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let activeSocket: Socket | null = null;

    (async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      activeSocket = io(SERVER_URL, { auth: { token } });
      setSocket(activeSocket);

      activeSocket.on('connect', () => {
        activeSocket?.emit('join_room', id);
      });

      activeSocket.on('update_queue', (updatedQueue: Track[]) => {
        setQueue(updatedQueue);
      });

      activeSocket.on('now_playing', (playback: NowPlaying) => {
        setNowPlaying(playback);
        setMyVotes({});
      });

      activeSocket.on('room_error', (message: string) => {
        setRoomError(message);
        setTimeout(() => setRoomError(''), 3000);
      });

      activeSocket.on('connect_error', () => {
        setRoomError('Unable to connect to the room');
      });
    })();

    return () => {
      activeSocket?.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!nowPlaying) {
      setElapsedMs(0);
      return;
    }

    const started = new Date(nowPlaying.startedAt).getTime();
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [nowPlaying]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`${SERVER_URL}/api/search/tracks?q=${encodeURIComponent(text)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }
  };

  const handleAddTrack = (track: any) => {
    const trackData = {
      roomId: id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl,
      previewUrl: track.previewUrl,
      durationMs: track.durationMs,
    };
    socket?.emit('add_track', trackData);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleVote = (trackId: number, value: 1 | -1) => {
    const current = myVotes[trackId] || 0;
    const nextValue = current === value ? 0 : value;
    socket?.emit('vote_track', { trackId, roomId: id, value: nextValue });
    setMyVotes((prev) => ({ ...prev, [trackId]: nextValue }));
  };

  const renderSearchResult = ({ item }: { item: any }) => (
    <View style={styles.trackCard}>
      {item.coverUrl && <Image source={{ uri: item.coverUrl }} style={styles.albumCover} />}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => handleAddTrack(item)}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  const progress = nowPlaying ? Math.min(elapsedMs / nowPlaying.durationMs, 1) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home' as any)}>
            <Text style={styles.backText}>← Leave</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room #{id}</Text>
          <TouchableOpacity onPress={() => router.push('/profile' as any)}><Text style={styles.settingsText}>⚙️</Text></TouchableOpacity>
        </View>

        {roomError ? <Text style={styles.roomErrorText}>{roomError}</Text> : null}

        {nowPlaying && (
          <View style={styles.nowPlayingCard}>
            {nowPlaying.track.coverUrl && <Image source={{ uri: nowPlaying.track.coverUrl }} style={styles.nowPlayingCover} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.nowPlayingLabel}>Now playing</Text>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>{nowPlaying.track.title}</Text>
              <Text style={styles.nowPlayingArtist} numberOfLines={1}>{nowPlaying.track.artist}</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a track..."
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
              <Text style={styles.sectionTitle}>Up next</Text>
              {queue.length === 0 ? (
                <Text style={styles.emptyQueueText}>The playlist is empty. Search for a track!</Text>
              ) : (
                <FlatList
                  data={queue}
                  keyExtractor={(item) => item.deezerId.toString()}
                  renderItem={({ item }) => {
                    const myVote = myVotes[item.id] || 0;
                    return (
                      <View style={styles.trackCard}>
                        {item.cover_url && <Image source={{ uri: item.cover_url }} style={styles.albumCover} />}
                        <View style={styles.trackInfo}>
                          <Text style={styles.trackTitle}>{item.title}</Text>
                          <Text style={styles.trackArtist}>{item.artist}</Text>
                        </View>
                        <View style={styles.voteContainer}>
                          <TouchableOpacity onPress={() => handleVote(item.id, 1)} style={styles.voteBtn}>
                            <Text style={[styles.voteIcon, myVote === 1 && styles.voteIconActive]}>👍</Text>
                          </TouchableOpacity>
                          <Text style={styles.voteCount}>{item.votes}</Text>
                          <TouchableOpacity onPress={() => handleVote(item.id, -1)} style={styles.voteBtn}>
                            <Text style={[styles.voteIcon, myVote === -1 && styles.voteIconActive]}>👎</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
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
  roomErrorText: { color: Colors.dark.danger, textAlign: 'center', paddingVertical: 8, fontSize: 13, fontWeight: 'bold' },
  nowPlayingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.backgroundElement, margin: 15, marginBottom: 0, padding: 12, borderRadius: 12 },
  nowPlayingCover: { width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: Colors.dark.backgroundSelected },
  nowPlayingLabel: { color: Colors.dark.primary, fontSize: 11, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' },
  nowPlayingTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: 'bold' },
  nowPlayingArtist: { color: Colors.dark.textSecondary, fontSize: 13, marginBottom: 6 },
  progressBarTrack: { height: 3, backgroundColor: Colors.dark.backgroundSelected, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: 3, backgroundColor: Colors.dark.primary },
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
  voteIcon: { fontSize: 16, opacity: 0.4 },
  voteIconActive: { opacity: 1 },
  voteCount: { color: Colors.dark.text, fontWeight: 'bold', fontSize: 16, marginHorizontal: 5, minWidth: 20, textAlign: 'center' },
});