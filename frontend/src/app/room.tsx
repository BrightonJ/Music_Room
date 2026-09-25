import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Colors, Layout, Space } from '@/constants/theme';
import {
  RetroAvatar, RetroCard, RetroCover, RetroEmptyState, RetroIconButton, RetroInput, RetroListItem, RetroPage, RetroProgress, RetroText,
} from '@/components/retro';
import { SERVER_URL } from '@/constants/config';
import { getToken } from '@/lib/token';

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

const C = Colors.retro;

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
    <RetroListItem
      style={styles.item}
      leading={<RetroCover uri={item.coverUrl} />}
      title={item.title}
      subtitle={item.artist}
      trailing={<RetroIconButton icon="add" onPress={() => handleAddTrack(item)} />}
    />
  );

  const progress = nowPlaying ? Math.min(elapsedMs / nowPlaying.durationMs, 1) : 0;

  return (
    <RetroPage
      scroll={false}
      keyboardAvoiding
      title={`Room #${id}`}
      left={{ label: 'Leave', onPress: () => router.replace('/home' as any), color: C.danger }}
      right={{ label: 'Profile', onPress: () => router.push('/profile' as any) }}
      contentStyle={styles.page}
    >
      {roomError ? (
        <RetroText variant="small" color={C.danger} style={styles.roomError}>{roomError}</RetroText>
      ) : null}

      {nowPlaying && (
        <RetroCard tone="violet" style={styles.nowPlaying} contentStyle={styles.nowPlayingContent}>
          <RetroCover uri={nowPlaying.track.coverUrl} size={64} />
          <View style={{ flex: 1 }}>
            <RetroText variant="small" color={C.accent}>NOW PLAYING</RetroText>
            <RetroText variant="label" numberOfLines={1}>{nowPlaying.track.title}</RetroText>
            <RetroText variant="small" numberOfLines={1} style={styles.nowPlayingArtist}>{nowPlaying.track.artist}</RetroText>
            <RetroProgress progress={progress} />
          </View>
        </RetroCard>
      )}

      <RetroInput
        containerStyle={styles.search}
        placeholder="Search for a track..."
        value={searchQuery}
        onChangeText={handleSearch}
      />

      <View style={{ flex: 1 }}>
        {searchQuery.length >= 3 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => (item.trackId ?? item.deezerId ?? index).toString()}
            renderItem={renderSearchResult}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={{ flex: 1 }}>
            <RetroText variant="heading" style={styles.sectionTitle}>Up next</RetroText>
            {queue.length === 0 ? (
              <RetroEmptyState icon="musical-notes" message={'The playlist is empty.\nSearch for a track!'} />
            ) : (
              <FlatList
                data={queue}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => {
                  const myVote = myVotes[item.id] || 0;
                  return (
                    <RetroListItem
                      style={styles.item}
                      leading={
                        <>
                          <RetroAvatar label={String(index + 1)} size={24} />
                          <RetroCover uri={item.cover_url} />
                        </>
                      }
                      title={item.title}
                      subtitle={item.artist}
                      trailing={
                        <View style={styles.votes}>
                          <RetroIconButton size="sm" icon="arrow-up" active={myVote === 1} activeColor={C.success} onPress={() => handleVote(item.id, 1)} />
                          <RetroText variant="label" style={styles.voteCount}>{item.votes}</RetroText>
                          <RetroIconButton size="sm" icon="arrow-down" active={myVote === -1} activeColor={C.primary} onPress={() => handleVote(item.id, -1)} />
                        </View>
                      }
                    />
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    </RetroPage>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Layout.gutter },
  roomError: { textAlign: 'center', paddingVertical: Space.sm },
  nowPlaying: { marginBottom: Space.lg },
  nowPlayingContent: { flexDirection: 'row', alignItems: 'center', gap: Space.md + 2 },
  nowPlayingArtist: { opacity: 0.85, marginBottom: Space.sm + 2 },
  search: { marginBottom: Space.lg },
  sectionTitle: { marginBottom: Space.md + 2 },
  item: { marginBottom: Space.md + 2 },
  votes: { alignItems: 'center', gap: Space.xs },
  voteCount: { minWidth: 24, textAlign: 'center' },
});
