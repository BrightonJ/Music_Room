import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { formatIsoDate } from '@/lib/dates';
import { roomStyles as styles } from './roomStyles';
import type { PublicProfile } from './types';

type Props = { visible: boolean; profile: PublicProfile | null; error: string; onClose: () => void };

export default function MemberProfileModal({ visible, profile, error, onClose }: Props) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {error ? (
            <Text style={styles.modalSubtitle}>{error}</Text>
          ) : !profile ? (
            <ActivityIndicator color={Colors.retro.primary} />
          ) : (
            <>
              <Text style={styles.modalTitle}>{profile.username}</Text>
              {profile.isFriend ? (
                <View style={styles.friendBadge}>
                  <Text style={styles.friendBadgeText}>Friend</Text>
                </View>
              ) : null}
              <View style={{ marginTop: 16 }}>
                {fullName ? <Text style={styles.profileLine}>Name: {fullName}</Text> : null}
                {profile.birth_date ? <Text style={styles.profileLine}>Birthday: {formatIsoDate(profile.birth_date)}</Text> : null}
                {profile.music_preferences && profile.music_preferences.length > 0 ? (
                  <Text style={styles.profileLine}>Likes: {profile.music_preferences.join(', ')}</Text>
                ) : null}
                {!fullName && !profile.birth_date && !profile.music_preferences?.length ? (
                  <Text style={styles.profileLine}>This profile is private.</Text>
                ) : null}
              </View>
            </>
          )}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
