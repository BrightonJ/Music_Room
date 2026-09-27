import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = { visible: boolean; onConfirm: () => void };

export default function RoomClosedModal({ visible, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onConfirm} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Room deleted</Text>
          <Text style={styles.modalSubtitle}>The host deleted this room.</Text>
          <TouchableOpacity style={styles.confirmLeaveButton} onPress={onConfirm}>
            <Text style={styles.confirmLeaveButtonText}>Back to rooms</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
