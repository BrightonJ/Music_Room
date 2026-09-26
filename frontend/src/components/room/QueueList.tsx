import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import { Track } from './types';

type Props = {
  queue: Track[];
  myVotes: Record<number, number>;
  onVote: (trackId: number, value: 1 | -1) => void;
};

export default function QueueList({ queue, myVotes, onVote }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Up next</Text>
      {queue.length === 0 ? (
        <Text style={styles.emptyQueueText}>The playlist is empty. Search for a track!</Text>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const myVote = myVotes[item.id] || 0;
            return (
              <View style={styles.trackCard}>
                {item.cover_url && <Image source={{ uri: item.cover_url }} style={styles.albumCover} />}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle}>{item.title}</Text>
                  <Text style={styles.trackArtist}>{item.artist}</Text>
                </View>
                <View style={styles.voteContainer}>
                  <TouchableOpacity onPress={() => onVote(item.id, 1)} style={styles.voteBtn}>
                    <Text style={[styles.voteIcon, myVote === 1 && styles.voteIconActive]}>👍</Text>
                  </TouchableOpacity>
                  <Text style={styles.voteCount}>{item.votes}</Text>
                  <TouchableOpacity onPress={() => onVote(item.id, -1)} style={styles.voteBtn}>
                    <Text style={[styles.voteIcon, myVote === -1 && styles.voteIconActive]}>👎</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}