import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  visible: boolean;
  friends: any[];
  invitedUsernames: string[];
  onInvite: (username: string) => void;
  onClose: () => void;
};

export default function InviteFriendsModal({ visible, friends, invitedUsernames, onInvite, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Invite friends</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyQueueText}>You have no friends to invite yet.</Text>
          ) : (
            friends.map((friend) => {
              const invited = invitedUsernames.includes(friend.username);
              return (
                <View key={friend.id} style={styles.friendInviteRow}>
                  <Text style={styles.trackTitle}>{friend.username}</Text>
                  <TouchableOpacity
                    style={[styles.addButton, invited && styles.addButtonDisabled]}
                    onPress={() => !invited && onInvite(friend.username)}
                  >
                    <Text style={styles.addButtonText}>{invited ? '✓' : '+'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.forgotPasswordTextBtn}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}