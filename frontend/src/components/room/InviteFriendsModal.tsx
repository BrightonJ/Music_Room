import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import type { Friend } from './types';

type Props = {
  visible: boolean;
  friends: Friend[];
  invited: string[];
  message: string;
  onInvite: (username: string) => void;
  onClose: () => void;
};

export default function InviteFriendsModal({ visible, friends, invited, message, onInvite, onClose }: Props) {
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
                const done = invited.includes(friend.username);
                return (
                  <View key={friend.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{friend.username}</Text>
                    <TouchableOpacity
                      style={done ? styles.declineButton : styles.acceptButton}
                      onPress={() => onInvite(friend.username)}
                      disabled={done}
                    >
                      <Text style={done ? styles.declineButtonText : styles.acceptButtonText}>{done ? 'Invited' : 'Invite'}</Text>
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
