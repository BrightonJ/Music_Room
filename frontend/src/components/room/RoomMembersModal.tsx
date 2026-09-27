import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { roomStyles as styles } from './roomStyles';
import type { DelegationCandidate, Member } from './types';

type Props = {
  visible: boolean;
  members: Member[];
  myDeviceId: number | null;
  isOwner: boolean;
  candidates: DelegationCandidate[];
  loadingCandidates: boolean;
  busyDeviceId: number | null;
  onGrant: (deviceId: number) => void;
  onRevoke: (deviceId: number) => void;
  onSelectMember: (username: string) => void;
  onClose: () => void;
};

const platformLabel = (platform: string) => (platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : platform);

export default function RoomMembersModal({
  visible,
  members,
  myDeviceId,
  isOwner,
  candidates,
  loadingCandidates,
  busyDeviceId,
  onGrant,
  onRevoke,
  onSelectMember,
  onClose,
}: Props) {
  const renderControlButton = (deviceId: number, hasControl: boolean) =>
    busyDeviceId === deviceId ? (
      <ActivityIndicator color={Colors.retro.primary} />
    ) : hasControl ? (
      <TouchableOpacity style={styles.declineButton} onPress={() => onRevoke(deviceId)}>
        <Text style={styles.declineButtonText}>Take back control</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity style={styles.acceptButton} onPress={() => onGrant(deviceId)}>
        <Text style={styles.acceptButtonText}>Give control</Text>
      </TouchableOpacity>
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>In the room ({members.length})</Text>
          <ScrollView>
            {members.map((member) => (
              <View key={member.deviceId} style={styles.memberRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectMember(member.username)}>
                  <Text style={styles.memberName}>
                    {member.isOwner ? '👑 ' : ''}
                    {member.username}
                    {member.hasControl && !member.isOwner ? ' 🎛️' : ''}
                  </Text>
                  <Text style={styles.memberDevice}>
                    {member.deviceName}, {platformLabel(member.platform)}
                    {member.deviceId === myDeviceId ? ' (this phone)' : ''}
                  </Text>
                </TouchableOpacity>
                {isOwner && !member.isOwner ? renderControlButton(member.deviceId, member.hasControl) : null}
              </View>
            ))}

            {isOwner ? (
              <>
                <Text style={styles.modalSection}>Delegate control to a friend&apos;s device</Text>
                <Text style={styles.modalSubtitle}>
                  Control is given to one device. Your friend must be able to see the room (invite them first if it is private).
                </Text>
                {loadingCandidates ? (
                  <ActivityIndicator color={Colors.retro.primary} />
                ) : candidates.length === 0 ? (
                  <Text style={styles.modalSubtitle}>Your friends have no device yet. They appear here after their first login.</Text>
                ) : (
                  candidates.map((c) => (
                    <View key={c.device_id} style={styles.memberRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{c.username}</Text>
                        <Text style={styles.memberDevice}>
                          {c.device_name}, {platformLabel(c.platform)}
                          {c.in_room ? ' (in the room)' : ''}
                        </Text>
                      </View>
                      {renderControlButton(c.device_id, c.has_control)}
                    </View>
                  ))
                )}
              </>
            ) : null}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
