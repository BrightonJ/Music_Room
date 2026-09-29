import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import type { Friend, InvitationStatus } from './types';

type Props = {
  visible: boolean;
  friends: Friend[];
  /** Status per friend id; no entry: not invited (or declined, so they can be invited again) */
  invitations: Record<number, InvitationStatus>;
  message: string;
  onInvite: (friend: Friend) => void;
  onClose: () => void;
};

const statusLabel: Record<InvitationStatus, string> = { pending: 'Invited', accepted: 'Joined' };

export default function InviteFriendsModal({ visible, friends, invitations, message, onInvite, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Invite friends</Text>
          <Text style={styles.modalSubtitle}>Invited friends can see private rooms and vote when the room is for guests only.</Text>
          <ScrollView>
            {friends.length === 0 ? (
              <Text style={styles.modalSubtitle}>Add friends from the Friends screen to invite them here.</Text>
            ) : (
              friends.map((friend) => {
                const status = invitations[friend.id];
                return (
                  <View key={friend.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{friend.username}</Text>
                    <TouchableOpacity
                      style={status ? styles.declineButton : styles.acceptButton}
                      onPress={() => onInvite(friend)}
                      disabled={!!status}
                      accessibilityState={{ disabled: !!status }}
                    >
                      <Text style={status ? styles.declineButtonText : styles.acceptButtonText}>{status ? statusLabel[status] : 'Invite'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
