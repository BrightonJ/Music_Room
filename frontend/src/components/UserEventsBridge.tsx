import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Space } from '@/constants/theme';
import { RetroCard, RetroIcon, RetroText } from '@/components/retro';
import { onUserEvent, startUserEvents, stopUserEvents, type FriendsChange, type InvitationsChange } from '@/lib/userEvents';
import { storage } from '@/lib/storage';
import type { Href } from 'expo-router';

// Screens reachable while logged out: the app-wide connection is closed there
const LOGGED_OUT_PATHS = ['/', '/settings'];
const TOAST_MS = 4000;

type Toast = { text: string; icon: 'person-add' | 'mail' | 'musical-notes'; target: Href };

// Both users receive the event: only the one who did NOT act is notified
const friendsToast = (change: FriendsChange, myUserId: number | null): Toast | null => {
  if (change.userId === myUserId) return null;
  if (change.reason === 'request') return { text: `${change.username ?? 'Someone'} sent you a friend request`, icon: 'person-add', target: '/friends' };
  if (change.reason === 'accepted') return { text: `${change.username ?? 'Someone'} is now your friend`, icon: 'person-add', target: '/friends' };
  return null; // declined / removed: the lists refresh silently
};

// The same event reaches the host and the guest: each one gets their own message
const invitationToast = (change: InvitationsChange, myUserId: number | null): Toast | null => {
  const iAmTheGuest = change.userId === myUserId;
  if (change.reason === 'invited' && iAmTheGuest) {
    return { text: `${change.username} invited you to ${change.eventName}`, icon: 'mail', target: '/home' };
  }
  if (change.reason === 'accepted' && !iAmTheGuest) {
    return {
      text: `${change.username} accepted your invitation to ${change.eventName}`,
      icon: 'musical-notes',
      target: { pathname: '/room', params: { id: String(change.eventId) } },
    };
  }
  return null; // declined, or my own action on another device: the lists refresh silently
};

/**
 * Mounted once in the root layout: keeps the real-time connection open while
 * logged in and shows a notification (on any screen) for friend requests,
 * accepted friends and room invitations. Tapping it opens the related screen.
 */
export default function UserEventsBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect after login, disconnect on the login screen (logout, expired session)
  useEffect(() => {
    if (LOGGED_OUT_PATHS.includes(pathname)) stopUserEvents();
    else startUserEvents();
  }, [pathname]);

  useEffect(() => {
    const show = (next: Toast | null) => {
      if (!next) return;
      setToast(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    };
    const offFriends = onUserEvent('friends_changed', async (change) => show(friendsToast(change, await storage.getUserId())));
    const offInvitations = onUserEvent('invitations_changed', async (change) => show(invitationToast(change, await storage.getUserId())));
    return () => {
      offFriends();
      offInvitations();
    };
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!toast) return null;
  return (
    <Pressable
      style={[styles.wrapper, { top: insets.top + Space.sm }]}
      onPress={() => {
        setToast(null);
        router.push(toast.target);
      }}
      accessibilityRole="alert"
      accessibilityHint="Opens the related screen"
    >
      <RetroCard tone="yellow" style={styles.card}>
        <RetroIcon name={toast.icon} size={20} />
        <RetroText variant="label" style={{ flex: 1 }}>
          {toast.text}
        </RetroText>
      </RetroCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: Layout.gutter, right: Layout.gutter, zIndex: 100 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md },
});
