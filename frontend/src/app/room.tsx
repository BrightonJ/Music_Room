import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import NowPlayingCard from '@/components/room/NowPlayingCard';
import QueueList from '@/components/room/QueueList';
import TrackSearchResults from '@/components/room/TrackSearchResults';
import RoomMembersModal from '@/components/room/RoomMembersModal';
import InviteFriendsModal from '@/components/room/InviteFriendsModal';
import MemberProfileModal from '@/components/room/MemberProfileModal';
import LeaveRoomModal from '@/components/room/LeaveRoomModal';
import RoomClosedModal from '@/components/room/RoomClosedModal';
import { roomStyles } from '@/components/room/roomStyles';
import type { DelegationCandidate, Friend, PublicProfile, RoomEvent, SearchResult } from '@/components/room/types';
import { useRoom } from '@/hooks/useRoom';
import { useRoomAudio } from '@/hooks/useRoomAudio';
import { apiFetch, errorMessage } from '@/lib/api';
import { clampVolume, currentPositionMs, nextVoteValue } from '@/lib/playback';
import { getFreshPosition } from '@/lib/location';
import { formatDateTime } from '@/lib/dates';
import { RetroScreen } from '@/components/retro';

export default function RoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = Number(params.id) > 0 ? Number(params.id) : null;
  const room = useRoom(roomId);

  const [event, setEvent] = useState<RoomEvent | null>(null);
  const [listening, setListening] = useState<boolean | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const searchRequest = useRef(0);

  const [showMembers, setShowMembers] = useState(false);
  const [candidates, setCandidates] = useState<DelegationCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [profileVisible, setProfileVisible] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [showLeave, setShowLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const loadEvent = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await apiFetch<RoomEvent>(`/events/${roomId}`);
      setEvent(data);
      // The host hears the music by default; guests choose to play it on their phone
      setListening((current) => (current === null ? data.isOwner : current));
    } catch (err) {
      showToast(errorMessage(err));
    }
  }, [roomId, showToast]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const isOwner = event?.isOwner ?? false;
  const me = room.members.find((m) => m.deviceId === room.myDeviceId);
  const hasControl = isOwner || !!me?.hasControl;
  const isDelegate = !isOwner && !!me?.hasControl;
  const canVote = !event || isOwner || event.vote_license !== 'invited' || event.isInvited;

  useRoomAudio(room.playback, listening === true);

  // Progress bar refresh while playing
  const nowPlaying = room.playback.nowPlaying;
  useEffect(() => {
    if (!nowPlaying || !room.playback.isPlaying) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [nowPlaying, room.playback.isPlaying]);
  const positionMs = nowPlaying
    ? currentPositionMs(
        {
          positionMs: nowPlaying.positionMs,
          durationMs: nowPlaying.durationMs,
          isPlaying: room.playback.isPlaying,
          receivedAt: room.playback.receivedAt,
        },
        now
      )
    : 0;

  // Debounced search; an older answer never replaces a newer one
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const requestId = ++searchRequest.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<SearchResult[]>(`/search/tracks?q=${encodeURIComponent(query)}`);
        if (requestId === searchRequest.current) setResults(data);
      } catch (err) {
        if (requestId === searchRequest.current) showToast(errorMessage(err));
      } finally {
        if (requestId === searchRequest.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, showToast]);

  const handleAdd = async (track: SearchResult) => {
    setAdding(track.deezerId);
    const res = await room.addTrack(track.deezerId);
    setAdding(null);
    if (res.ok) {
      setSearch('');
      setResults([]);
      showToast(`${track.title} added to the queue`);
    } else {
      showToast(res.error || 'Could not add this track');
    }
  };

  const handleVote = async (trackId: number, pressed: 1 | -1) => {
    if (!canVote) {
      showToast('Only invited guests can vote in this room');
      return;
    }
    const value = nextVoteValue(room.myVotes[trackId], pressed);
    let position: { lat: number; lng: number } | undefined;
    if (value !== 0 && event?.vote_license === 'location' && !isOwner) {
      const result = await getFreshPosition();
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      position = result.coords;
    }
    const res = await room.vote(trackId, value, position);
    if (!res.ok) showToast(res.error || 'Vote refused');
  };

  const handleTogglePlayback = async () => {
    const res = await room.control(room.playback.isPlaying ? 'pause' : 'play');
    if (!res.ok) showToast(res.error || 'Action refused');
  };
  const handleNext = async () => {
    const res = await room.control('next');
    if (!res.ok) showToast(res.error || 'Action refused');
  };
  const handleVolume = async (delta: number) => {
    const res = await room.setVolume(clampVolume(room.playback.volume + delta));
    if (!res.ok) showToast(res.error || 'Action refused');
  };

  // ---------- delegation ----------
  const loadCandidates = useCallback(async () => {
    if (!roomId) return;
    setLoadingCandidates(true);
    try {
      setCandidates(await apiFetch<DelegationCandidate[]>(`/events/${roomId}/delegation-candidates`));
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setLoadingCandidates(false);
    }
  }, [roomId, showToast]);

  const openMembers = () => {
    setShowMembers(true);
    if (isOwner) loadCandidates();
  };

  const grantControl = async (deviceId: number) => {
    setBusyDeviceId(deviceId);
    try {
      await apiFetch(`/events/${roomId}/delegations`, { method: 'POST', body: { deviceId } });
      await loadCandidates();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusyDeviceId(null);
    }
  };

  const revokeControl = async (deviceId: number) => {
    setBusyDeviceId(deviceId);
    try {
      await apiFetch(`/events/${roomId}/delegations/${deviceId}`, { method: 'DELETE' });
      if (isOwner) await loadCandidates();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusyDeviceId(null);
    }
  };

  const releaseControl = async () => {
    if (!room.myDeviceId) return;
    await revokeControl(room.myDeviceId);
    showToast('You gave control back to the host');
  };

  // ---------- invitations & profiles ----------
  const openInvite = async () => {
    setInviteMessage('');
    setShowInvite(true);
    try {
      setFriends(await apiFetch<Friend[]>('/friends'));
    } catch (err) {
      setInviteMessage(errorMessage(err));
    }
  };

  const invite = async (username: string) => {
    try {
      await apiFetch(`/events/${roomId}/invite`, { method: 'POST', body: { username } });
      setInvited((list) => [...list, username]);
      setInviteMessage(`${username} is invited`);
    } catch (err) {
      setInviteMessage(errorMessage(err));
    }
  };

  const openProfile = async (username: string) => {
    setProfile(null);
    setProfileError('');
    setProfileVisible(true);
    try {
      setProfile(await apiFetch<PublicProfile>(`/users/${encodeURIComponent(username)}/profile`));
    } catch (err) {
      setProfileError(errorMessage(err));
    }
  };

  // ---------- leaving ----------
  const leave = async () => {
    setShowLeave(false);
    await room.leave();
    router.replace('/home');
  };

  const deleteRoom = async () => {
    setShowLeave(false);
    try {
      await apiFetch(`/events/${roomId}`, { method: 'DELETE' });
      router.replace('/home');
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const licenseText = () => {
    if (!event) return '';
    if (event.vote_license === 'invited') {
      return canVote ? 'Only invited guests vote in this room.' : 'Only invited guests vote here. You can still listen and suggest tracks.';
    }
    if (event.vote_license === 'location' && event.vote_starts_at && event.vote_ends_at) {
      return `On-site voting within ${event.location_radius_m} m, from ${formatDateTime(new Date(event.vote_starts_at))} to ${formatDateTime(new Date(event.vote_ends_at))}.`;
    }
    return '';
  };

  if (!roomId) {
    return (
      <RetroScreen>
        <ScreenHeader title="Room" left={{ label: 'Back', onPress: () => router.replace('/home') }} />
        <Text style={ui.empty}>This room does not exist.</Text>
      </RetroScreen>
    );
  }

  const status = room.connectionError || (!room.joined ? 'Connecting to the room…' : '');

  return (
    <RetroScreen edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={event?.name ?? 'Room'}
        left={{ label: 'Leave', onPress: () => setShowLeave(true), tone: 'danger' }}
        right={isOwner ? { label: 'Invite', onPress: openInvite } : undefined}
      />
      <View style={roomStyles.subHeaderRow}>
        <TouchableOpacity onPress={openMembers} hitSlop={8}>
          <Text style={roomStyles.subHeaderLink}>
            {room.members.length} {room.members.length === 1 ? 'device' : 'devices'} in the room
          </Text>
        </TouchableOpacity>
        {event ? <Text style={roomStyles.statusText}>{event.is_private ? 'Private room' : 'Public room'}</Text> : null}
      </View>
      {licenseText() ? <Text style={roomStyles.licenseBanner}>{licenseText()}</Text> : null}
      {status ? <Text style={roomStyles.statusText}>{status}</Text> : null}

      <NowPlayingCard
        playback={room.playback}
        positionMs={positionMs}
        hasControl={hasControl}
        isDelegate={isDelegate}
        listening={listening === true}
        onToggleListening={() => setListening((v) => !v)}
        onTogglePlayback={handleTogglePlayback}
        onNext={handleNext}
        onVolume={handleVolume}
        onReleaseControl={releaseControl}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={roomStyles.searchContainer}>
          <TextInput
            style={roomStyles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search a track to add"
            placeholderTextColor={Colors.retro.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <View style={roomStyles.content}>
          {search.trim().length >= 2 ? (
            <TrackSearchResults results={results} loading={searching} adding={adding} onAdd={handleAdd} />
          ) : (
            <QueueList queue={room.queue} myVotes={room.myVotes} canVote={canVote} onVote={handleVote} />
          )}
        </View>
      </KeyboardAvoidingView>

      {toast ? (
        <View style={roomStyles.toast} pointerEvents="none">
          <Text style={roomStyles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <RoomMembersModal
        visible={showMembers}
        members={room.members}
        myDeviceId={room.myDeviceId}
        isOwner={isOwner}
        candidates={candidates}
        loadingCandidates={loadingCandidates}
        busyDeviceId={busyDeviceId}
        onGrant={grantControl}
        onRevoke={revokeControl}
        onSelectMember={(username) => {
          setShowMembers(false);
          openProfile(username);
        }}
        onClose={() => setShowMembers(false)}
      />
      <InviteFriendsModal
        visible={showInvite}
        friends={friends}
        invited={invited}
        message={inviteMessage}
        onInvite={invite}
        onClose={() => setShowInvite(false)}
      />
      <MemberProfileModal visible={profileVisible} profile={profile} error={profileError} onClose={() => setProfileVisible(false)} />
      <LeaveRoomModal visible={showLeave} isOwner={isOwner} onLeave={leave} onDelete={deleteRoom} onClose={() => setShowLeave(false)} />
      <RoomClosedModal visible={room.closed} onConfirm={() => router.replace('/home')} />
    </RetroScreen>
  );
}

