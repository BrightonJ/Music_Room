import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { getDeviceId, getDeviceLabel } from '@/constants/device';
import { buildAuthHeaders } from '@/utils/api';
import { Colors } from '../constants/theme';
import { SERVER_URL, API_URL } from '@/constants/config';
import { roomStyles as styles } from '../components/room/roomStyles';
import { Track, NowPlaying, Member } from '../components/room/types';
import NowPlayingCard from '../components/room/NowPlayingCard';
import TrackSearchResults from '../components/room/TrackSearchResults';
import QueueList from '../components/room/QueueList';
import InviteFriendsModal from '../components/room/InviteFriendsModal';
import RoomMembersModal from '../components/room/RoomMembersModal';
import MemberProfileModal from '../components/room/MemberProfileModal';
import LeaveRoomModal from '../components/room/LeaveRoomModal';
import RoomClosedModal from '../components/room/RoomClosedModal';



async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return SecureStore.getItemAsync('userToken');
}

async function getUserId() {
  if (Platform.OS === 'web') return localStorage.getItem('userId');
  return SecureStore.getItemAsync('userId');
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
  const [isOwner, setIsOwner] = useState(false);
  const [hasControl, setHasControl] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [playbackControlState, setPlaybackControlState] = useState({ isPlaying: true, volume: 1 });

  const [locationRestricted, setLocationRestricted] = useState(false);
  const [voteWindow, setVoteWindow] = useState<{ start: string; end: string } | null>(null);
  const [myPosition, setMyPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitedUsernames, setInvitedUsernames] = useState<string[]>([]);

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [profileModalUsername, setProfileModalUsername] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [addFriendMessage, setAddFriendMessage] = useState('');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer(null);

  useEffect(() => {
    let activeSocket: Socket | null = null;

    (async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const userId = await getUserId();
      setMyUserId(userId);

      try {
        const response = await fetch(`${API_URL}/events/${id}`, {
          headers: buildAuthHeaders(token, false),
        });
        const data = await response.json();
        if (response.ok) {
          setIsOwner(String(data.owner_id) === String(userId));
          setHasControl(!!data.hasControl);

          if (data.location_restricted) {
            setLocationRestricted(true);
            setVoteWindow({ start: data.vote_window_start, end: data.vote_window_end });
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              setLocationMessage('Location permission denied — you will not be able to vote in this room.');
            } else {
              try {
                const position = await Location.getCurrentPositionAsync({});
                setMyPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
              } catch (locErr) {
                setLocationMessage('Unable to get your location.');
              }
            }
          }
        }
      } catch (e) {}

      const deviceId = await getDeviceId();
      activeSocket = io(SERVER_URL, {
        auth: {
          token,
          deviceId,
          platform: Platform.OS,
          deviceName: getDeviceLabel(),
          appVersion: (Constants.expoConfig && Constants.expoConfig.version) || 'dev',
        },
      });
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

      activeSocket.on('playback_control_update', (state: { isPlaying: boolean; volume: number }) => {
        setPlaybackControlState(state);
      });

      activeSocket.on('room_members', (updatedMembers: Member[]) => {
        setMembers(updatedMembers);
      });

      activeSocket.on('room_error', (message: string) => {
        setRoomError(message);
        setTimeout(() => setRoomError(''), 3000);
      });

      activeSocket.on('room_closed', () => {
        setShowClosedModal(true);
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
    if (!myUserId) return;
    const me = members.find((m) => String(m.id) === String(myUserId));
    if (me) setHasControl(me.hasControl);
  }, [members, myUserId]);

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

  useEffect(() => {
    if (!nowPlaying?.track.previewUrl) {
      try { player.pause(); } catch (e) {}
      return;
    }
    try {
      player.replace({ uri: nowPlaying.track.previewUrl });
      player.volume = playbackControlState.volume;
      if (playbackControlState.isPlaying) player.play();
    } catch (e) {
      console.warn('Audio playback error (ignored):', e);
    }
  }, [nowPlaying?.track.id]);

  useEffect(() => {
    try {
      player.volume = playbackControlState.volume;
      if (playbackControlState.isPlaying) player.play();
      else player.pause();
    } catch (e) {}
  }, [playbackControlState.isPlaying, playbackControlState.volume]);

  const stopAudioSafely = () => {
    try { player.pause(); } catch (e) {}
  };

  const handleTogglePlayback = () => {
    socket?.emit('control_playback', { roomId: id, action: playbackControlState.isPlaying ? 'pause' : 'play' });
  };

  const handleVolumeChange = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, playbackControlState.volume + delta));
    socket?.emit('control_volume', { roomId: id, volume: newVolume });
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${SERVER_URL}/api/search/tracks?q=${encodeURIComponent(text)}`, {
          headers: buildAuthHeaders(token, false),
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
    }, 400);
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
    socket?.emit('vote_track', {
      trackId,
      roomId: id,
      value: nextValue,
      lat: myPosition?.lat,
      lng: myPosition?.lng,
    });
    setMyVotes((prev) => ({ ...prev, [trackId]: nextValue }));
  };

  const openInviteModal = async () => {
    setShowInviteModal(true);
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setFriendsList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleInviteFriend = async (friendUsername: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/events/${id}/invite`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ username: friendUsername }),
      });
      if (response.ok) {
        setInvitedUsernames((prev) => [...prev, friendUsername]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openMemberProfile = async (username: string) => {
    setProfileModalUsername(username);
    setProfileData(null);
    setAddFriendMessage('');
    const token = await getToken();
    try {
      const response = await fetch(`${API_URL}/users/${username}/profile`, {
        headers: buildAuthHeaders(token, false),
      });
      const data = await response.json();
      if (response.ok) setProfileData(data);
    } catch (e) {}
  };

  const handleAddFriendFromRoom = async (username: string) => {
    const token = await getToken();
    try {
      const response = await fetch(`${API_URL}/friends/requests`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      setAddFriendMessage(response.ok ? 'Friend request sent.' : (data.error || 'Unable to send request.'));
    } catch (e) {
      setAddFriendMessage('Unable to reach the server.');
    }
  };

  const handleGrantControl = async (username: string) => {
    const token = await getToken();
    try {
      await fetch(`${API_URL}/events/${id}/delegations`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ username }),
      });
    } catch (e) {}
  };

  const handleRevokeControl = async (userId: number) => {
    const token = await getToken();
    try {
      await fetch(`${API_URL}/events/${id}/delegations/${userId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token, false),
      });
    } catch (e) {}
  };

  const confirmDeleteAndLeave = async () => {
    const token = await getToken();
    try {
      await fetch(`${API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token, false),
      });
    } catch (error) {
      console.error(error);
    }
    router.replace('/home' as any);
  };

  const confirmLeave = async () => {
    setShowLeaveModal(false);
    stopAudioSafely();
    if (isOwner) {
      await confirmDeleteAndLeave();
    } else {
      router.replace('/home' as any);
    }
  };

  const progress = nowPlaying ? Math.min(elapsedMs / nowPlaying.durationMs, 1) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowLeaveModal(true)}>
            <Text style={styles.backText}>← Leave</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room #{id}</Text>
          <TouchableOpacity onPress={() => router.push('/profile' as any)}><Text style={styles.settingsText}>⚙️</Text></TouchableOpacity>
        </View>

        <View style={styles.subHeaderRow}>
          <TouchableOpacity onPress={() => setShowMembersModal(true)}>
            <Text style={styles.subHeaderLink}>👥 {members.length} in room</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={openInviteModal}>
              <Text style={styles.subHeaderLink}>+ Invite friends</Text>
            </TouchableOpacity>
          )}
        </View>

        {locationRestricted && voteWindow && (
          <Text style={styles.locationBanner}>
            📍 Voting only allowed on-site, {voteWindow.start}–{voteWindow.end}
          </Text>
        )}
        {locationMessage ? <Text style={styles.roomErrorText}>{locationMessage}</Text> : null}
        {roomError ? <Text style={styles.roomErrorText}>{roomError}</Text> : null}

        <NowPlayingCard
          nowPlaying={nowPlaying}
          progress={progress}
          hasControl={hasControl}
          playbackControlState={playbackControlState}
          onTogglePlayback={handleTogglePlayback}
          onVolumeChange={handleVolumeChange}
        />

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
            <TrackSearchResults results={searchResults} onAddTrack={handleAddTrack} />
          ) : (
            <QueueList queue={queue} myVotes={myVotes} onVote={handleVote} />
          )}
        </View>
      </KeyboardAvoidingView>

      <InviteFriendsModal
        visible={showInviteModal}
        friends={friendsList}
        invitedUsernames={invitedUsernames}
        onInvite={handleInviteFriend}
        onClose={() => setShowInviteModal(false)}
      />

      <RoomMembersModal
        visible={showMembersModal}
        members={members}
        isOwner={isOwner}
        onSelectMember={openMemberProfile}
        onGrantControl={handleGrantControl}
        onRevokeControl={handleRevokeControl}
        onClose={() => setShowMembersModal(false)}
      />

      <MemberProfileModal
        visible={!!profileModalUsername}
        profileData={profileData}
        addFriendMessage={addFriendMessage}
        onAddFriend={handleAddFriendFromRoom}
        onClose={() => setProfileModalUsername(null)}
      />

      <LeaveRoomModal
        visible={showLeaveModal}
        isOwner={isOwner}
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveModal(false)}
      />

      <RoomClosedModal
        visible={showClosedModal}
        onBackHome={() => { stopAudioSafely(); router.replace('/home' as any); }}
      />
    </SafeAreaView>
  );
}