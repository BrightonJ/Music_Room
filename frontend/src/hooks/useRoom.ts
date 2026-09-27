import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerUrl } from '@/lib/config';
import { storage } from '@/lib/storage';
import { APP_VERSION } from '@/lib/device';
import { triggerUnauthorized } from '@/lib/api';
import type { AckResult, Member, PlaybackState, QueueTrack } from '@/components/room/types';

const ACK_TIMEOUT_MS = 8000;

const initialPlayback: PlaybackState = { nowPlaying: null, isPlaying: false, volume: 1, receivedAt: 0 };

// One Socket.IO connection per open room. Every message carries its eventId and
// messages for another room are ignored.
export function useRoom(roomId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [myDeviceId, setMyDeviceId] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const [token, baseUrl] = await Promise.all([storage.getToken(), getServerUrl()]);
      if (cancelled) return;
      if (!token) {
        triggerUnauthorized();
        return;
      }
      socket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token, appVersion: APP_VERSION },
        reconnectionDelayMax: 5000,
      });
      socketRef.current = socket;

      // (Re)join on every connection, including automatic reconnections
      socket.on('connect', () => {
        setConnected(true);
        setConnectionError('');
        socket?.timeout(ACK_TIMEOUT_MS).emit('join_room', { roomId }, (err: Error | null, res?: AckResult) => {
          if (err || !res) {
            setConnectionError('Unable to join the room. Retrying…');
            return;
          }
          if (!res.ok) {
            setConnectionError(res.error || 'Unable to join the room');
            return;
          }
          setJoined(true);
          setMyDeviceId(Number(res.deviceId));
        });
      });

      socket.on('disconnect', (reason) => {
        setConnected(false);
        setJoined(false);
        // Only the server closes a socket on purpose: the session was revoked
        if (reason === 'io server disconnect') triggerUnauthorized();
      });

      socket.on('connect_error', (err) => {
        setConnected(false);
        if (/revoked|expired|Authentication required/i.test(err.message)) triggerUnauthorized();
        else setConnectionError('Connection lost. Reconnecting…');
      });

      socket.on('queue_update', (p: { eventId: number; tracks: QueueTrack[] }) => {
        if (p?.eventId === roomId) setQueue(p.tracks);
      });
      socket.on('playback_update', (p: Omit<PlaybackState, 'receivedAt'> & { eventId: number }) => {
        if (p?.eventId === roomId) {
          setPlayback({ nowPlaying: p.nowPlaying, isPlaying: p.isPlaying, volume: p.volume, receivedAt: Date.now() });
        }
      });
      socket.on('my_votes', (p: { eventId: number; votes: Record<number, number> }) => {
        if (p?.eventId === roomId) setMyVotes(p.votes || {});
      });
      socket.on('room_members', (p: { eventId: number; members: Member[] }) => {
        if (p?.eventId === roomId) setMembers(p.members || []);
      });
      socket.on('room_closed', (p: { eventId: number }) => {
        if (p?.eventId === roomId) setClosed(true);
      });
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId]);

  const emitAck = useCallback((event: string, payload: Record<string, unknown>): Promise<AckResult> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        resolve({ ok: false, error: 'Not connected to the room yet' });
        return;
      }
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err: Error | null, res?: AckResult) => {
        resolve(err || !res ? { ok: false, error: 'The server did not answer in time' } : res);
      });
    });
  }, []);

  const vote = useCallback(
    async (trackId: number, value: -1 | 0 | 1, position?: { lat: number; lng: number }) => {
      const res = await emitAck('vote_track', { roomId, trackId, value, lat: position?.lat, lng: position?.lng });
      if (res.ok) {
        setMyVotes((prev) => {
          const next = { ...prev };
          if (value === 0) delete next[trackId];
          else next[trackId] = value;
          return next;
        });
      }
      return res;
    },
    [emitAck, roomId]
  );

  const addTrack = useCallback((deezerId: number) => emitAck('add_track', { roomId, deezerId }), [emitAck, roomId]);
  const control = useCallback(
    (action: 'play' | 'pause' | 'next') => emitAck('control_playback', { roomId, action }),
    [emitAck, roomId]
  );
  const setVolume = useCallback((volume: number) => emitAck('control_volume', { roomId, volume }), [emitAck, roomId]);
  const leave = useCallback(() => emitAck('leave_room', {}), [emitAck]);

  return {
    connected,
    joined,
    connectionError,
    queue,
    playback,
    myVotes,
    members,
    myDeviceId,
    closed,
    vote,
    addTrack,
    control,
    setVolume,
    leave,
  };
}
