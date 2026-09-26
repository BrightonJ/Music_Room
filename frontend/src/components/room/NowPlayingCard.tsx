import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import { NowPlaying } from './types';

type Props = {
  nowPlaying: NowPlaying;
  progress: number;
  hasControl: boolean;
  playbackControlState: { isPlaying: boolean; volume: number };
  onTogglePlayback: () => void;
  onVolumeChange: (delta: number) => void;
};

export default function NowPlayingCard({ nowPlaying, progress, hasControl, playbackControlState, onTogglePlayback, onVolumeChange }: Props) {
  if (!nowPlaying) return null;

  return (
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
      {hasControl && nowPlaying.track.previewUrl && (
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity style={styles.playPauseButton} onPress={onTogglePlayback}>
            <Text style={styles.playPauseIcon}>{playbackControlState.isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 10 }}>
            <TouchableOpacity onPress={() => onVolumeChange(-0.1)}>
              <Text style={styles.volumeBtn}>🔉</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onVolumeChange(0.1)}>
              <Text style={styles.volumeBtn}>🔊</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}