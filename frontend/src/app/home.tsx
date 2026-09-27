import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CardToneCycle, Colors, Layout, Space } from '@/constants/theme';
import {
  RetroButton,
  RetroCard,
  RetroChip,
  RetroEmpty,
  RetroIcon,
  RetroLink,
  RetroMessage,
  RetroRow,
  RetroScreen,
  RetroSectionTitle,
  RetroSmallButton,
  RetroText,
} from '@/components/retro';
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
    <RetroScreen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <RetroLink title="Friends" onPress={() => router.push('/friends')} />
        <RetroLink title="Profile" onPress={() => router.push('/profile')} />
        <RetroLink title="Log out" onPress={logout} color={Colors.retro.danger} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.retro.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Colors.retro.primary}
              colors={[Colors.retro.primary]}
            />
          }
          ListHeaderComponent={
            <>
              <RetroText variant="display" style={styles.hello}>
                Hello,{'\n'}
                {events.length} {events.length === 1 ? 'room' : 'rooms'} live
              </RetroText>
              {error ? <RetroMessage type="error" text={error} /> : null}
              {invitations.length > 0 ? (
                <>
                  <RetroSectionTitle>Invitations</RetroSectionTitle>
                  {invitations.map((inv) => (
                    <RetroRow
                      key={inv.id}
                      title={inv.event_name}
                      subtitle={inv.invited_by_username ? `From ${inv.invited_by_username}` : undefined}
                      right={
                        <>
                          <RetroSmallButton title="Join" onPress={() => answerInvitation(inv, true)} />
                          <RetroSmallButton title="Decline" muted onPress={() => answerInvitation(inv, false)} />
                        </>
                      }
                    />
                  ))}
                </>
              ) : null}
              <RetroSectionTitle>Your rooms and public rooms</RetroSectionTitle>
            </>
          }
          ListEmptyComponent={<RetroEmpty>No room yet. Create one and invite your friends.</RetroEmpty>}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/room', params: { id: String(item.id) } })}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <RetroCard tone={CardToneCycle[index % CardToneCycle.length]} style={styles.card}>
                <View style={styles.cardTop}>
                  <RetroIcon name="musical-notes" size={22} />
                  <RetroText variant="heading" style={{ flex: 1 }} numberOfLines={2}>
                    {item.name}
                  </RetroText>
                </View>
                <RetroText variant="small" style={styles.host}>
                  {item.is_owner ? 'Hosted by you' : `Hosted by ${item.owner_username}`}
                </RetroText>
                <View style={styles.chips}>
                  <RetroChip label={item.is_private ? 'Private' : 'Public'} />
                  <RetroChip label={licenseLabel[item.vote_license]} />
                </View>
              </RetroCard>
            </Pressable>
          )}
        />
      )}

      <SafeAreaView edges={['bottom']} style={styles.fabArea}>
        <RetroButton title="+  Create a room" onPress={() => router.push('/create')} style={styles.fab} />
      </SafeAreaView>
    </RetroScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: Space.lg, paddingHorizontal: Layout.gutter, paddingVertical: Space.md },
  list: { paddingHorizontal: Layout.gutter, paddingBottom: 120, width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  hello: { marginTop: Space.xs },
  card: { marginBottom: Space.lg },
  pressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm + 2 },
  host: { marginTop: Space.xs, opacity: 0.9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.md },
  fabArea: { position: 'absolute', left: Layout.gutter, right: Layout.gutter, bottom: 0 },
  fab: { marginTop: 0, marginBottom: Space.lg },
});
