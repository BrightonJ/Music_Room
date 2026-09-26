import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { roomStyles as styles } from './roomStyles';
import { Member } from './types';

type Props = {
  visible: boolean;
  members: Member[];
  isOwner: boolean;
  onSelectMember: (username: string) => void;
  onGrantControl: (username: string) => void;
  onRevokeControl: (userId: number) => void;
  onClose: () => void;
};

export default function RoomMembersModal({ visible, members, isOwner, onSelectMember, onGrantControl, onRevokeControl, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>In this room ({members.length})</Text>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectMember(m.username)}>
                <Text style={styles.trackTitle}>
                  {m.username}{m.isOwner ? ' 👑' : ''}{m.hasControl && !m.isOwner ? ' 🎛️' : ''}
                </Text>
                {m.deviceName ? <Text style={styles.trackArtist}>{m.deviceName}</Text> : null}
              </TouchableOpacity>
              {isOwner && !m.isOwner && (
                m.hasControl ? (
                  <TouchableOpacity style={styles.declineButton} onPress={() => onRevokeControl(m.id)}>
                    <Text style={styles.declineButtonText}>Revoke</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.acceptButton} onPress={() => onGrantControl(m.username)}>
                    <Text style={styles.acceptButtonText}>Give control</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.forgotPasswordTextBtn}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}