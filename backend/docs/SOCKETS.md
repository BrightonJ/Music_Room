# Music Room – real-time protocol (Socket.IO)

The Socket.IO server listens on the same host and port as the REST API.
The REST reference is served by the backend at `/api-docs` (Swagger UI) and `/api-docs.json`.

## Connection

```js
import { io } from 'socket.io-client';
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  auth: { token, appVersion: '1.0.0' },
});
```

The token is checked exactly like on the REST API: a device that logged out, was removed
from the "Devices" screen, or whose owner reset his password is refused
(`connect_error` with message `Session expired or revoked`) and its open sockets are closed
by the server (`disconnect` with reason `io server disconnect`).

Each connection may emit about 10 events per second (burst 20). Beyond that the
acknowledgement answers `{ ok: false, error: 'Too many actions, slow down' }`.

## Client → server

Every event takes an acknowledgement callback. The answer is always
`{ ok: true, ...data }` or `{ ok: false, error: string }`.

| Event | Payload | Answer data | Rules |
|---|---|---|---|
| `join_room` | `{ roomId }` | `{ eventId, deviceId, isOwner }` | Room visible to the user. The server then sends `queue_update`, `playback_update` and `my_votes` to this socket, and `room_members` to the room. |
| `leave_room` | `{}` | | |
| `add_track` | `{ roomId, deezerId }` | `{ trackId }` | Metadata, duration and preview URL are fetched from Deezer by the server. A track is only once in a queue. Max 200 queued tracks. Starts playback if the room was idle. |
| `vote_track` | `{ roomId, trackId, value, lat?, lng? }` | `{ trackId, value }` | `value`: `1`, `-1`, or `0` (remove my vote). The track must be queued in THIS room. Vote license checked (see below). |
| `control_playback` | `{ roomId, action }` | | `action`: `play`, `pause`, `next`. Host (any device) or delegated device only. |
| `control_volume` | `{ roomId, volume }` | `{ volume }` | `0..1`. Host or delegated device only. |

### Vote license
- `everyone`: every user who can see the room.
- `invited`: the host and the users who accepted an invitation.
- `location`: users within `location_radius_m` of the room location, between
  `vote_starts_at` and `vote_ends_at`. `lat` / `lng` must be sent with the vote.
- The host can always vote in his own room.

## Server → client

Every payload contains `eventId`: a client ignores messages for another room.

| Event | Payload |
|---|---|
| `queue_update` | `{ eventId, tracks: [{ id, deezerId, title, artist, coverUrl, durationMs, votes, addedBy }] }` sorted by votes then age. The playing track is not in it. |
| `playback_update` | `{ eventId, nowPlaying: null \| { track: { id, deezerId, title, artist, coverUrl, previewUrl }, durationMs, positionMs }, isPlaying, volume }` |
| `my_votes` | `{ eventId, votes: { [trackId]: 1 \| -1 } }` |
| `room_members` | `{ eventId, members: [{ userId, username, deviceId, deviceName, platform, isOwner, hasControl }] }` one entry per connected device |
| `room_closed` | `{ eventId }` the host deleted the room |

`positionMs` is computed by the server when the message is sent: the client adds the time
elapsed since reception, so the phones do not need a synchronized clock.

## Ordering and concurrency

All the mutations of a room (join snapshot, additions, votes, playback changes, member list)
run one after the other under a per-room lock, so broadcasts always leave in the order of
the changes. Vote bursts are coalesced into at most one `queue_update` every 100 ms, always
built from the latest state.

Playback is driven by the server: it chooses the next track, owns the timer, and persists the
state in `event_playback`. After a restart, rooms that were playing resume where they were.
