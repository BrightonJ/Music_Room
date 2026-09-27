import { Image, Text, TouchableOpacity, View } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import type { PlaybackState } from './types';

type Props = {
  playback: PlaybackState;
  positionMs: number;
  hasControl: boolean;
  isDelegate: boolean;
  listening: boolean;
  onToggleListening: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  onVolume: (delta: number) => void;
  onReleaseControl: () => void;
};

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function NowPlayingCard({
  playback,
  positionMs,
  hasControl,
  isDelegate,
  listening,
  onToggleListening,
  onTogglePlayback,
  onNext,
  onVolume,
  onReleaseControl,
}: Props) {
  const nowPlaying = playback.nowPlaying;
  const progress = nowPlaying && nowPlaying.durationMs > 0 ? Math.min(1, positionMs / nowPlaying.durationMs) : 0;

  return (
    <View style={styles.nowPlayingCard}>
      {nowPlaying ? (
        <View style={styles.nowPlayingRow}>
          {nowPlaying.track.coverUrl ? (
            <Image source={{ uri: nowPlaying.track.coverUrl }} style={styles.nowPlayingCover} />
          ) : (
            <View style={styles.nowPlayingCover} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.nowPlayingLabel}>{playback.isPlaying ? 'Now playing' : 'Paused'}</Text>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>
              {nowPlaying.track.title}
            </Text>
            <Text style={styles.nowPlayingArtist} numberOfLines={1}>
              {nowPlaying.track.artist}
            </Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
              <Text style={styles.timeText}>{formatTime(nowPlaying.durationMs)}</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.nowPlayingIdle}>Nothing is playing. Add a track to start the music.</Text>
      )}

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.listenButton, listening && styles.listenButtonActive]}
          onPress={onToggleListening}
          accessibilityRole="switch"
          accessibilityState={{ checked: listening }}
        >
          <Text style={[styles.listenText, listening && styles.listenTextActive]}>
            {listening ? '🔊 Playing on this phone' : '🔇 Play on this phone'}
          </Text>
        </TouchableOpacity>

        {hasControl ? (
          <View style={styles.controlsGroup}>
            <TouchableOpacity style={styles.roundButton} onPress={() => onVolume(-0.1)} accessibilityLabel="Volume down">
              <Text style={styles.roundButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.volumeText}>{Math.round(playback.volume * 100)}%</Text>
            <TouchableOpacity style={styles.roundButton} onPress={() => onVolume(0.1)} accessibilityLabel="Volume up">
              <Text style={styles.roundButtonText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={onTogglePlayback}
              accessibilityLabel={playback.isPlaying ? 'Pause' : 'Play'}
            >
              {playback.isPlaying ? (
                <View style={styles.pauseIconRow}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playTriangle} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundButton} onPress={onNext} accessibilityLabel="Next track">
              <View style={styles.nextIconRow}>
                <View style={styles.nextTriangle} />
                <View style={styles.nextBar} />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {isDelegate ? (
        <TouchableOpacity onPress={onReleaseControl}>
          <Text style={styles.delegateNote}>The host gave you control on this device. Tap to give it back.</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
