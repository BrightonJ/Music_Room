import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { RetroIcon } from '@/components/retro';
import { roomStyles as styles } from './roomStyles';
import type { QueueTrack } from './types';

type Props = {
  queue: QueueTrack[];
  myVotes: Record<number, number>;
  canVote: boolean;
  onVote: (trackId: number, pressed: 1 | -1) => void;
};

export default function QueueList({ queue, myVotes, canVote, onVote }: Props) {
  return (
    <FlatList
      data={queue}
      keyExtractor={(item) => String(item.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 90 }}
      ListHeaderComponent={<Text style={styles.sectionTitle}>Up next</Text>}
      ListEmptyComponent={<Text style={styles.emptyQueueText}>The queue is empty. Search a track above to add it.</Text>}
      renderItem={({ item }) => {
        const myVote = myVotes[item.id] ?? 0;
        return (
          <View style={styles.trackCard}>
            {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.albumCover} /> : <View style={styles.albumCover} />}
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {item.artist}
              </Text>
              {item.addedBy ? <Text style={styles.trackMeta}>Added by {item.addedBy}</Text> : null}
            </View>
            <View style={[styles.voteContainer, !canVote && { opacity: 0.5 }]}>
              <TouchableOpacity
                style={[styles.voteBtn, myVote === 1 && styles.voteBtnUpActive]}
                onPress={() => onVote(item.id, 1)}
                accessibilityLabel="Vote up"
                accessibilityState={{ selected: myVote === 1 }}
              >
                <RetroIcon name="arrow-up" size={16} />
              </TouchableOpacity>
              <Text style={styles.voteCount}>{item.votes}</Text>
              <TouchableOpacity
                style={[styles.voteBtn, myVote === -1 && styles.voteBtnDownActive]}
                onPress={() => onVote(item.id, -1)}
                accessibilityLabel="Vote down"
                accessibilityState={{ selected: myVote === -1 }}
              >
                <RetroIcon name="arrow-down" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}
