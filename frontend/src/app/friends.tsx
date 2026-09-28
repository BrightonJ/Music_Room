import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import ScreenHeader from '@/components/ScreenHeader';
import { goBack } from '@/lib/navigation';
import { apiFetch, errorMessage } from '@/lib/api';
import { RetroScreen } from '@/components/retro';

type User = { id: number; username: string };
type FriendRequest = { id: number; requester_id: number; requester_username: string };

export default function FriendsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchRequest = useRef(0);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([apiFetch<User[]>('/friends'), apiFetch<FriendRequest[]>('/friends/requests')]);
      setFriends(f);
      setRequests(r);
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const requestId = ++searchRequest.current;
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<User[]>(`/users/search?q=${encodeURIComponent(q)}`);
        if (requestId === searchRequest.current) setResults(data);
      } catch (err) {
        if (requestId === searchRequest.current) setMessage({ type: 'error', text: errorMessage(err) });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sendRequest = async (username: string) => {
    try {
      const data = await apiFetch<{ autoAccepted?: boolean }>('/friends/requests', { method: 'POST', body: { username } });
      setMessage({ type: 'success', text: data.autoAccepted ? `You are now friends with ${username}` : `Request sent to ${username}` });
      setQuery('');
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  };

  const answer = async (request: FriendRequest, accept: boolean) => {
    try {
      await apiFetch(`/friends/requests/${request.id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  };

  const remove = (friend: User) => {
    Alert.alert('Remove friend', `Remove ${friend.username} from your friends? Control of your rooms given to them is removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/friends/${friend.id}`, { method: 'DELETE' });
            load();
          } catch (err) {
            setMessage({ type: 'error', text: errorMessage(err) });
          }
        },
      },
    ]);
  };

  const friendIds = new Set(friends.map((f) => f.id));

  return (
    <RetroScreen>
      <ScreenHeader title="Friends" left={{ label: 'Back', onPress: () => goBack(router) }} />
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          style={ui.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Find people by username"
          placeholderTextColor={Colors.retro.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {message ? <Text style={message.type === 'error' ? ui.messageError : ui.messageSuccess}>{message.text}</Text> : null}

        {results.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {results.map((user) => (
              <View key={user.id} style={ui.row}>
                <Text style={ui.rowTitle}>{user.username}</Text>
                {friendIds.has(user.id) ? (
                  <Text style={ui.rowSubtitle}>Friend</Text>
                ) : (
                  <TouchableOpacity style={ui.smallButton} onPress={() => sendRequest(user.username)}>
                    <Text style={ui.smallButtonText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {requests.length > 0 ? (
          <>
            <Text style={ui.sectionTitle}>Friend requests</Text>
            {requests.map((request) => (
              <View key={request.id} style={ui.row}>
                <Text style={[ui.rowTitle, { flex: 1 }]}>{request.requester_username}</Text>
                <TouchableOpacity style={ui.smallButton} onPress={() => answer(request, true)}>
                  <Text style={ui.smallButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ui.smallButtonMuted} onPress={() => answer(request, false)}>
                  <Text style={ui.smallButtonMutedText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}

        <Text style={ui.sectionTitle}>Your friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <Text style={ui.empty}>Search a username above to add your first friend.</Text>
        ) : (
          friends.map((friend) => (
            <View key={friend.id} style={ui.row}>
              <Text style={ui.rowTitle}>{friend.username}</Text>
              <TouchableOpacity style={ui.smallButtonMuted} onPress={() => remove(friend)}>
                <Text style={ui.smallButtonMutedText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </RetroScreen>
  );
}
