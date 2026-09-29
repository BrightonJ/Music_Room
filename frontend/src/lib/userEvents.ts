import { io, Socket } from 'socket.io-client';
import { getServerUrl } from './config';
import { storage } from './storage';
import { APP_VERSION } from './device';

// App-wide Socket.IO connection, open while the user is logged in (the room
// screen keeps its own connection). The server puts it in the user's personal
// channel and pushes events that are not tied to a room: friends, invitations,
// rooms created or deleted.

export type FriendsChange = {
  reason: 'request' | 'accepted' | 'declined' | 'removed';
  /** Who did it (the sender of the request, the one who accepted...) */
  userId: number;
  username: string | null;
};
export type InvitationsChange = {
  reason: 'invited' | 'accepted' | 'declined';
  eventId: number;
  eventName: string;
  /** The host for 'invited', the guest for 'accepted' / 'declined' */
  username: string;
  /** The guest */
  userId: number;
};
export type EventsChange = { reason: 'created' | 'deleted'; eventId: number };

/** Events pushed on the user's personal channel (see backend/docs/SOCKETS.md). */
type UserEvents = {
  friends_changed: FriendsChange;
  invitations_changed: InvitationsChange;
  events_changed: EventsChange;
};
type UserEventName = keyof UserEvents;
const EVENT_NAMES: UserEventName[] = ['friends_changed', 'invitations_changed', 'events_changed'];

const listeners: { [K in UserEventName]: Set<(payload: UserEvents[K]) => void> } = {
  friends_changed: new Set(),
  invitations_changed: new Set(),
  events_changed: new Set(),
};
let socket: Socket | null = null;
let socketToken: string | null = null;
let starting: Promise<void> | null = null;

/** Opens the connection if a session exists (safe to call often). */
export function startUserEvents(): Promise<void> {
  if (starting) return starting;
  starting = (async () => {
    const [token, baseUrl] = await Promise.all([storage.getToken(), getServerUrl()]);
    if (!token) {
      stopUserEvents();
      return;
    }
    if (socket && socketToken === token) return; // already connected with this session
    stopUserEvents();
    socketToken = token;
    socket = io(baseUrl, { transports: ['websocket'], auth: { token, appVersion: APP_VERSION }, reconnectionDelayMax: 10000 });
    for (const name of EVENT_NAMES) {
      socket.on(name, (payload: UserEvents[typeof name]) =>
        (listeners[name] as Set<(p: typeof payload) => void>).forEach((listener) => listener(payload))
      );
    }
    // Revoked session: stop quietly, the REST calls redirect to the login screen
    socket.on('connect_error', (err) => {
      if (/revoked|expired|Authentication required/i.test(err.message)) stopUserEvents();
    });
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/** Closes the connection (logout, back on the login screen). */
export function stopUserEvents() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

/** Listen to a user event. Returns the unsubscribe function (usable as a useEffect cleanup). */
export function onUserEvent<K extends UserEventName>(name: K, listener: (payload: UserEvents[K]) => void): () => void {
  const set = listeners[name] as Set<(payload: UserEvents[K]) => void>;
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export const onFriendsChanged = (listener: (change: FriendsChange) => void) => onUserEvent('friends_changed', listener);
