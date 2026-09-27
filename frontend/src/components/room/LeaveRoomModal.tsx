import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  visible: boolean;
  isOwner: boolean;
  onLeave: () => void;
  onDelete: () => void;
  onClose: () => void;
};

// Leaving never deletes the room: the host can come back, delegates keep control.
export default function LeaveRoomModal({ visible, isOwner, onLeave, onDelete, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Leave the room?</Text>
          <Text style={styles.modalSubtitle}>
            {isOwner
              ? 'The music keeps playing for your guests and you can come back later. Delete the room to end it for everyone.'
              : 'You can come back later from the rooms list.'}
          </Text>
          <TouchableOpacity style={styles.confirmLeaveButton} onPress={onLeave}>
            <Text style={styles.confirmLeaveButtonText}>Leave room</Text>
          </TouchableOpacity>
          {isOwner ? (
            <TouchableOpacity style={styles.deleteRoomButton} onPress={onDelete}>
              <Text style={styles.deleteRoomButtonText}>Delete room for everyone</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
