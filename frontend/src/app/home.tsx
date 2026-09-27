import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { apiFetch, errorMessage } from '@/lib/api';
import { storage } from '@/lib/storage';

type EventSummary = {
  id: number;
  name: string;
  is_private: boolean;
  vote_license: 'everyone' | 'invited' | 'location';
  owner_username: string;
  is_owner: boolean;
};
type Invitation = { id: number; event_id: number; event_name: string; invited_by_username: string | null };

const licenseLabel: Record<EventSummary['vote_license'], string> = {
  everyone: 'Everyone votes',
  invited: 'Guests vote',
  location: 'On-site voting',
};

export default function HomeScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [ev, inv] = await Promise.all([apiFetch<EventSummary[]>('/events'), apiFetch<Invitation[]>('/invitations')]);
      setEvents(ev);
      setInvitations(inv);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const answerInvitation = async (invitation: Invitation, accept: boolean) => {
    try {
      await apiFetch(`/invitations/${invitation.id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      if (accept) router.push({ pathname: '/room', params: { id: String(invitation.event_id) } });
      else load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/logout', { method: 'POST' });
    } catch {
      // Logged out locally anyway
    }
    await storage.clearSession();
    router.replace('/');
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rooms</Text>
        <View style={styles.headerLinks}>
          <TouchableOpacity onPress={() => router.push('/friends')} hitSlop={8}>
            <Text style={ui.linkText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} hitSlop={8}>
            <Text style={ui.linkText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} hitSlop={8}>
            <Text style={[ui.linkText, { color: Colors.dark.danger }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Colors.dark.primary}
              colors={[Colors.dark.primary]}
            />
          }
          ListHeaderComponent={
            <>
              {error ? <Text style={ui.messageError}>{error}</Text> : null}
              {invitations.length > 0 ? (
                <>
                  <Text style={ui.sectionTitle}>Invitations</Text>
                  {invitations.map((inv) => (
                    <View key={inv.id} style={ui.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={ui.rowTitle}>{inv.event_name}</Text>
                        {inv.invited_by_username ? <Text style={ui.rowSubtitle}>From {inv.invited_by_username}</Text> : null}
                      </View>
                      <TouchableOpacity style={ui.smallButton} onPress={() => answerInvitation(inv, true)}>
                        <Text style={ui.smallButtonText}>Join</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={ui.smallButtonMuted} onPress={() => answerInvitation(inv, false)}>
                        <Text style={ui.smallButtonMutedText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : null}
              <Text style={ui.sectionTitle}>Your rooms and public rooms</Text>
            </>
          }
          ListEmptyComponent={<Text style={ui.empty}>No room yet. Create one and invite your friends.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={ui.row} onPress={() => router.push({ pathname: '/room', params: { id: String(item.id) } })}>
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={ui.rowSubtitle}>
                  {item.is_owner ? 'Hosted by you' : `Hosted by ${item.owner_username}`}
                  {item.is_private ? ', private' : ''}
                </Text>
              </View>
              <Text style={styles.badge}>{licenseLabel[item.vote_license]}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <SafeAreaView edges={['bottom']} style={styles.fabArea}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/create')}>
          <Text style={styles.fabText}>Create a room</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.backgroundElement,
  },
  title: { fontSize: 24, fontWeight: '900', color: Colors.dark.text },
  headerLinks: { flexDirection: 'row', gap: 16 },
  badge: { color: Colors.dark.textSecondary, fontSize: 12, marginLeft: 8 },
  fabArea: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  fab: { backgroundColor: Colors.dark.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 50, marginBottom: 16 },
  fabText: { color: Colors.dark.background, fontSize: 16, fontWeight: 'bold' },
});
