import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  visible: boolean;
  onBackHome: () => void;
};

export default function RoomClosedModal({ visible, onBackHome }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Room closed</Text>
          <Text style={styles.modalSubtitle}>The host has closed this room.</Text>
          <TouchableOpacity style={styles.confirmLeaveButton} onPress={onBackHome}>
            <Text style={styles.confirmLeaveButtonText}>BACK TO HOME</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}