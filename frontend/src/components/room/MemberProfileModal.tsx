import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { roomStyles as styles } from './roomStyles';

type Props = {
  visible: boolean;
  profileData: any;
  addFriendMessage: string;
  onAddFriend: (username: string) => void;
  onClose: () => void;
};

export default function MemberProfileModal({ visible, profileData, addFriendMessage, onAddFriend, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {profileData ? (
            <>
              <Text style={styles.modalTitle}>{profileData.username}</Text>
              {profileData.first_name ? <Text style={styles.trackArtist}>First name: {profileData.first_name}</Text> : null}
              {profileData.last_name ? <Text style={styles.trackArtist}>Last name: {profileData.last_name}</Text> : null}
              {profileData.birth_date ? <Text style={styles.trackArtist}>Born: {profileData.birth_date}</Text> : null}
              {profileData.music_preferences && profileData.music_preferences.length > 0 ? (
                <Text style={styles.trackArtist}>Likes: {profileData.music_preferences.join(', ')}</Text>
              ) : null}
              {!profileData.isSelf && (
                profileData.isFriend ? (
                  <View style={styles.friendBadge}><Text style={styles.friendBadgeText}>✓ Friends</Text></View>
                ) : (
                  <TouchableOpacity style={styles.acceptButton} onPress={() => onAddFriend(profileData.username)}>
                    <Text style={styles.acceptButtonText}>Add friend</Text>
                  </TouchableOpacity>
                )
              )}
              {addFriendMessage ? <Text style={styles.message}>{addFriendMessage}</Text> : null}
            </>
          ) : (
            <Text style={styles.emptyQueueText}>Loading...</Text>
          )}
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.forgotPasswordTextBtn}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}