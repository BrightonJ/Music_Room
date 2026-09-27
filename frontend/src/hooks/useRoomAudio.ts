import { useEffect, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { currentPositionMs } from '@/lib/playback';
import type { PlaybackState } from '@/components/room/types';

const MAX_DRIFT_S = 1.5;

// Plays the room's current preview on THIS phone when "listening" is on, and
// keeps it aligned with the server position (play / pause / seek / volume).
export function useRoomAudio(playback: PlaybackState, listening: boolean) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const loadedKey = useRef<string | null>(null);

  const nowPlaying = playback.nowPlaying;
  const previewUrl = nowPlaying?.track.previewUrl ?? null;
  const sourceKey = nowPlaying && previewUrl ? `${nowPlaying.track.id}|${previewUrl}` : null;

  // 1. Load the right source (a new track, or a refreshed preview URL)
  useEffect(() => {
    try {
      if (!listening || !sourceKey || !previewUrl) {
        if (player.playing) player.pause();
        if (!sourceKey) loadedKey.current = null;
        return;
      }
      if (loadedKey.current !== sourceKey) {
        loadedKey.current = sourceKey;
        player.replace({ uri: previewUrl });
      }
    } catch (err) {
      console.warn('Audio source error', err);
    }
  }, [listening, sourceKey, previewUrl, player]);

  // 2. Follow the server state: position, play / pause, volume
  useEffect(() => {
    if (!listening || !nowPlaying || !status.isLoaded || loadedKey.current !== sourceKey) return;
    try {
      player.volume = playback.volume;
      const expected =
        currentPositionMs({
          positionMs: nowPlaying.positionMs,
          durationMs: nowPlaying.durationMs,
          isPlaying: playback.isPlaying,
          receivedAt: playback.receivedAt,
        }) / 1000;
      if (Math.abs(status.currentTime - expected) > MAX_DRIFT_S) player.seekTo(expected);
      if (playback.isPlaying && !player.playing) player.play();
      if (!playback.isPlaying && player.playing) player.pause();
    } catch (err) {
      console.warn('Audio sync error', err);
    }
    // status.currentTime is read, not watched: re-syncing on every tick would stutter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, sourceKey, status.isLoaded, playback.isPlaying, playback.volume, playback.receivedAt]);
}
