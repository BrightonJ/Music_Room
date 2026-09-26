import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  visible: boolean;
  isOwner: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LeaveRoomModal({ visible, isOwner, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{isOwner ? "Delete this room?" : "Leave room?"}</Text>
          <Text style={styles.modalSubtitle}>
            {isOwner
              ? "You are the host. Leaving will permanently delete this room and its queue for everyone."
              : "Are you sure you want to leave this room?"}
          </Text>
          <TouchableOpacity style={styles.confirmLeaveButton} onPress={onConfirm}>
            <Text style={styles.confirmLeaveButtonText}>{isOwner ? "DELETE ROOM" : "LEAVE"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onCancel}>
            <Text style={styles.forgotPasswordTextBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}