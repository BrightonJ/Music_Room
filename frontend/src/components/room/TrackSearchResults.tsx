import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { roomStyles as styles } from './roomStyles';
import type { SearchResult } from './types';

type Props = {
  results: SearchResult[];
  loading: boolean;
  adding: number | null;
  onAdd: (track: SearchResult) => void;
};

export default function TrackSearchResults({ results, loading, adding, onAdd }: Props) {
  return (
    <FlatList
      data={results}
      keyExtractor={(item) => String(item.deezerId)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 90 }}
      ListHeaderComponent={<Text style={styles.sectionTitle}>Search results</Text>}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 30 }} />
        ) : (
          <Text style={styles.emptyQueueText}>No track found. Try another title or artist.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.trackCard}>
          {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.albumCover} /> : <View style={styles.albumCover} />}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, adding !== null && styles.addButtonDisabled]}
            onPress={() => onAdd(item)}
            disabled={adding !== null}
            accessibilityLabel={`Add ${item.title} to the queue`}
          >
            {adding === item.deezerId ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <Text style={styles.addButtonText}>+</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    />
  );
}
