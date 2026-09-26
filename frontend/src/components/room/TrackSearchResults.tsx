import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  results: any[];
  onAddTrack: (track: any) => void;
};

export default function TrackSearchResults({ results, onAddTrack }: Props) {
  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.deezerId.toString()}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <View style={styles.trackCard}>
          {item.coverUrl && <Image source={{ uri: item.coverUrl }} style={styles.albumCover} />}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => onAddTrack(item)}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}