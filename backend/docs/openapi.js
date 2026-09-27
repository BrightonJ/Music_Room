// OpenAPI 3 description of the REST API, served at /api-docs (Swagger UI)
// and /api-docs.json. The real-time protocol is described in the introduction
// and in docs/SOCKETS.md.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const error = (description) => json(ref('Error'), description);
const message = (description = 'OK') => json(ref('Message'), description);
const body = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const pathId = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'integer', minimum: 1 } });
const clientHeaders = ['XPlatform', 'XDevice', 'XAppVersion'].map((p) => ({ $ref: `#/components/parameters/${p}` }));

function op({ tag, summary, description, auth = true, params = [], requestBody, responses }) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    security: auth ? [{ bearerAuth: [] }] : [],
    parameters: [...params, ...clientHeaders],
    ...(requestBody ? { requestBody } : {}),
    responses: {
      ...responses,
      ...(auth ? { 401: error('Missing, expired or revoked session') } : {}),
      429: error('Too many requests'),
      500: error('Server error'),
    },
  };
}

const SOCKET_DOC = `
## Authentication
Every protected call needs \`Authorization: Bearer <token>\`. A token is bound to ONE device:
logging out, removing the device or resetting the password revokes it immediately (401).

The app sends \`X-Platform\`, \`X-Device\` and \`X-App-Version\` on every call (activity logs),
and \`X-Device-Id\` (stable random id of the installation) on \`POST /login\`.

## Real-time protocol (Socket.IO, same host and port)
Connect with \`io(SERVER_URL, { transports: ['websocket'], auth: { token, appVersion } })\`.
Every client event takes an acknowledgement callback answering \`{ ok: true, ... }\` or \`{ ok: false, error }\`.

| Client → server | Payload | Ack |
|---|---|---|
| \`join_room\` | \`{ roomId }\` | \`{ eventId, deviceId, isOwner }\` + snapshot events |
| \`leave_room\` | \`{}\` | |
| \`add_track\` | \`{ roomId, deezerId }\` | \`{ trackId }\` |
| \`vote_track\` | \`{ roomId, trackId, value: 1 \\| -1 \\| 0, lat?, lng? }\` | \`{ trackId, value }\` |
| \`control_playback\` | \`{ roomId, action: 'play' \\| 'pause' \\| 'next' }\` | |
| \`control_volume\` | \`{ roomId, volume: 0..1 }\` | \`{ volume }\` |

| Server → client | Payload |
|---|---|
| \`queue_update\` | \`{ eventId, tracks: QueueTrack[] }\` (sorted by votes) |
| \`playback_update\` | \`{ eventId, nowPlaying: { track, durationMs, positionMs } \\| null, isPlaying, volume }\` |
| \`my_votes\` | \`{ eventId, votes: { [trackId]: 1 \\| -1 } }\` |
| \`room_members\` | \`{ eventId, members: Member[] }\` (one entry per connected device) |
| \`room_closed\` | \`{ eventId }\` |

See backend/docs/SOCKETS.md for details.
`;

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Music Room API',
    version: '1.0.0',
    description: SOCKET_DOC,
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth' },
    { name: 'Profile' },
    { name: 'Friends' },
    { name: 'Events', description: 'Music Track Vote rooms' },
    { name: 'Delegation', description: 'Music Control Delegation (per device)' },
    { name: 'Invitations' },
    { name: 'Devices' },
    { name: 'Search' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    parameters: {
      XDeviceId: { name: 'X-Device-Id', in: 'header', required: true, description: 'Stable id of this app installation (8-64 chars: letters, digits, dashes)', schema: { type: 'string' } },
      XPlatform: { name: 'X-Platform', in: 'header', required: false, description: 'ios / android', schema: { type: 'string' } },
      XDevice: { name: 'X-Device', in: 'header', required: false, description: 'Device model, e.g. "iPhone 15 (iOS 19.0)"', schema: { type: 'string' } },
      XAppVersion: { name: 'X-App-Version', in: 'header', required: false, description: 'App version', schema: { type: 'string' } },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } }, required: ['error'] },
      Message: { type: 'object', properties: { message: { type: 'string' } } },
      PrivacyLevel: { type: 'string', enum: ['public', 'friends', 'private'] },
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          birth_date: { type: 'string', format: 'date', nullable: true },
          music_preferences: { type: 'array', items: { type: 'string' } },
          privacy_settings: { type: 'object', additionalProperties: ref('PrivacyLevel') },
          has_password: { type: 'boolean' },
          google_linked: { type: 'boolean' },
          facebook_linked: { type: 'boolean' },
        },
      },
      PublicProfile: {
        type: 'object',
        description: 'Only the fields the viewer is allowed to see are present',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          birth_date: { type: 'string', format: 'date' },
          music_preferences: { type: 'array', items: { type: 'string' } },
          isSelf: { type: 'boolean' },
          isFriend: { type: 'boolean' },
        },
      },
      UserSummary: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' } } },
      EventInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          isPrivate: { type: 'boolean', default: false, description: 'Visibility: private rooms are only visible to invited guests' },
          voteLicense: { type: 'string', enum: ['everyone', 'invited', 'location'], default: 'everyone' },
          locationLat: { type: 'number', description: 'Required when voteLicense = location' },
          locationLng: { type: 'number', description: 'Required when voteLicense = location' },
          locationRadiusM: { type: 'integer', minimum: 20, maximum: 5000, default: 100 },
          voteStartsAt: { type: 'string', format: 'date-time', description: 'Required when voteLicense = location' },
          voteEndsAt: { type: 'string', format: 'date-time', description: 'Required when voteLicense = location (max 7 days after start)' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          owner_id: { type: 'integer' },
          owner_username: { type: 'string' },
          name: { type: 'string' },
          is_private: { type: 'boolean' },
          vote_license: { type: 'string', enum: ['everyone', 'invited', 'location'] },
          location_lat: { type: 'number', nullable: true },
          location_lng: { type: 'number', nullable: true },
          location_radius_m: { type: 'integer', nullable: true },
          vote_starts_at: { type: 'string', format: 'date-time', nullable: true },
          vote_ends_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          isOwner: { type: 'boolean' },
          hasControl: { type: 'boolean', description: 'This device may control playback' },
          isInvited: { type: 'boolean' },
        },
      },
      Track: {
        type: 'object',
        properties: {
          deezerId: { type: 'integer' },
          title: { type: 'string' },
          artist: { type: 'string' },
          coverUrl: { type: 'string', nullable: true },
          durationMs: { type: 'integer', description: 'Preview length (max 30000)' },
        },
      },
      Device: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          platform: { type: 'string' },
          device_name: { type: 'string' },
          last_seen_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          signed_in: { type: 'boolean' },
          is_current: { type: 'boolean' },
        },
      },
      DelegationCandidate: {
        type: 'object',
        properties: {
          device_id: { type: 'integer' },
          device_name: { type: 'string' },
          platform: { type: 'string' },
          last_seen_at: { type: 'string', format: 'date-time' },
          user_id: { type: 'integer' },
          username: { type: 'string' },
          has_control: { type: 'boolean' },
          in_room: { type: 'boolean' },
        },
      },
      Delegation: {
        type: 'object',
        properties: {
          device_id: { type: 'integer' },
          device_name: { type: 'string' },
          platform: { type: 'string' },
          user_id: { type: 'integer' },
          username: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Invitation: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          event_id: { type: 'integer' },
          event_name: { type: 'string' },
          invited_by_username: { type: 'string' },
        },
      },
      FriendRequest: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          requester_id: { type: 'integer' },
          requester_username: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': { get: op({ tag: 'Auth', summary: 'Server availability', auth: false, responses: { 200: message() } }) },
    '/register': {
      post: op({
        tag: 'Auth',
        summary: 'Create an account (an activation email is sent)',
        auth: false,
        requestBody: body({
          type: 'object',
          required: ['email', 'password', 'username', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', description: '8-128 chars, upper, lower, digit, special character' },
            username: { type: 'string', pattern: '^[A-Za-z0-9_]{3,20}$' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
          },
        }),
        responses: { 201: message('Created'), 400: error('Invalid data'), 409: error('Email or username already used') },
      }),
    },
    '/verify/{token}': {
      get: op({ tag: 'Auth', summary: 'Activation link (HTML page)', auth: false, params: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML page' }, 400: { description: 'HTML page (invalid link)' } } }),
    },
    '/resend-verification': {
      post: op({ tag: 'Auth', summary: 'Send a new activation email', auth: false, requestBody: body({ type: 'object', properties: { email: { type: 'string' } } }), responses: { 200: message() } }),
    },
    '/login': {
      post: op({
        tag: 'Auth',
        summary: 'Log in on this device',
        auth: false,
        params: [{ $ref: '#/components/parameters/XDeviceId' }],
        requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }),
        responses: {
          200: json({ type: 'object', properties: { token: { type: 'string' }, deviceId: { type: 'integer' }, user: ref('UserSummary') } }),
          400: error('Missing X-Device-Id'),
          401: error('Invalid credentials'),
          403: error('Account not activated (code EMAIL_NOT_VERIFIED)'),
        },
      }),
    },
    '/logout': { post: op({ tag: 'Auth', summary: 'Revoke the session of this device', responses: { 200: message() } }) },
    '/forgot-password': {
      post: op({ tag: 'Auth', summary: 'Send a password reset email', auth: false, requestBody: body({ type: 'object', properties: { email: { type: 'string' } } }), responses: { 200: message() } }),
    },
    '/reset-password/{token}': {
      get: op({ tag: 'Auth', summary: 'Password reset page (HTML)', auth: false, params: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'HTML page' } } }),
      post: op({
        tag: 'Auth',
        summary: 'Set a new password (single use link, logs out every device)',
        auth: false,
        params: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: body({ type: 'object', required: ['newPassword'], properties: { newPassword: { type: 'string' } } }),
        responses: { 200: message(), 400: error('Invalid or expired link / weak password') },
      }),
    },
    '/profile': {
      get: op({ tag: 'Profile', summary: 'My profile', responses: { 200: json(ref('Profile')) } }),
      put: op({
        tag: 'Profile',
        summary: 'Update my profile (only the fields sent are changed)',
        requestBody: body({
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            birthDate: { type: 'string', format: 'date', nullable: true },
            musicPreferences: { type: 'array', items: { type: 'string' }, maxItems: 30 },
            privacySettings: { type: 'object', additionalProperties: ref('PrivacyLevel') },
          },
        }),
        responses: { 200: json(ref('Profile')), 400: error('Invalid data') },
      }),
    },
    '/users/{username}/profile': {
      get: op({ tag: 'Profile', summary: 'Profile of a user, filtered by his privacy settings', params: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: json(ref('PublicProfile')), 404: error('Not found') } }),
    },
    '/users/search': {
      get: op({ tag: 'Friends', summary: 'Search users by username', params: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } }], responses: { 200: json({ type: 'array', items: ref('UserSummary') }) } }),
    },
    '/friends': { get: op({ tag: 'Friends', summary: 'My friends', responses: { 200: json({ type: 'array', items: ref('UserSummary') }) } }) },
    '/friends/{userId}': {
      delete: op({ tag: 'Friends', summary: 'Remove a friend (and the delegations between us)', params: [pathId('userId', 'Friend user id')], responses: { 200: message(), 404: error('Not a friend') } }),
    },
    '/friends/requests': {
      get: op({ tag: 'Friends', summary: 'Friend requests I received', responses: { 200: json({ type: 'array', items: ref('FriendRequest') }) } }),
      post: op({ tag: 'Friends', summary: 'Send a friend request (accepts theirs if they already asked)', requestBody: body({ type: 'object', required: ['username'], properties: { username: { type: 'string' } } }), responses: { 200: message('Accepted their pending request'), 201: message('Request sent'), 404: error('User not found'), 409: error('Already friends / already sent') } }),
    },
    '/friends/requests/{id}/accept': { post: op({ tag: 'Friends', summary: 'Accept a friend request', params: [pathId('id', 'Request id')], responses: { 200: message(), 404: error('Not found') } }) },
    '/friends/requests/{id}/decline': { post: op({ tag: 'Friends', summary: 'Decline a friend request', params: [pathId('id', 'Request id')], responses: { 200: message(), 404: error('Not found') } }) },
    '/events': {
      get: op({ tag: 'Events', summary: 'Rooms I can see (public, mine, invited)', responses: { 200: json({ type: 'array', items: ref('Event') }) } }),
      post: op({ tag: 'Events', summary: 'Create a room', requestBody: body(ref('EventInput')), responses: { 201: json({ type: 'object', properties: { event: ref('Event') } }), 400: error('Invalid data') } }),
    },
    '/events/{id}': {
      get: op({ tag: 'Events', summary: 'Room details and my rights on this device', params: [pathId('id', 'Event id')], responses: { 200: json(ref('Event')), 404: error('Not found or not visible') } }),
      delete: op({ tag: 'Events', summary: 'Delete a room (host only)', params: [pathId('id', 'Event id')], responses: { 200: message(), 403: error('Not the host'), 404: error('Not found') } }),
    },
    '/events/{id}/invite': {
      post: op({ tag: 'Events', summary: 'Invite a friend (host only)', params: [pathId('id', 'Event id')], requestBody: body({ type: 'object', required: ['username'], properties: { username: { type: 'string' } } }), responses: { 201: message(), 403: error('Not the host / not a friend'), 404: error('Not found') } }),
    },
    '/events/{id}/delegations': {
      get: op({ tag: 'Delegation', summary: 'Devices allowed to control this room', params: [pathId('id', 'Event id')], responses: { 200: json({ type: 'array', items: ref('Delegation') }) } }),
      post: op({ tag: 'Delegation', summary: "Give control to one of a friend's devices (host only)", params: [pathId('id', 'Event id')], requestBody: body({ type: 'object', required: ['deviceId'], properties: { deviceId: { type: 'integer' } } }), responses: { 201: message(), 403: error('Not the host / not a friend / friend cannot see the room') } }),
    },
    '/events/{id}/delegation-candidates': {
      get: op({ tag: 'Delegation', summary: "Every device of the host's friends (host only)", params: [pathId('id', 'Event id')], responses: { 200: json({ type: 'array', items: ref('DelegationCandidate') }) } }),
    },
    '/events/{id}/delegations/{deviceId}': {
      delete: op({ tag: 'Delegation', summary: 'Revoke control (host) or give it back (delegate)', params: [pathId('id', 'Event id'), pathId('deviceId', 'Device id')], responses: { 200: message(), 404: error('Not found') } }),
    },
    '/invitations': { get: op({ tag: 'Invitations', summary: 'Pending room invitations', responses: { 200: json({ type: 'array', items: ref('Invitation') }) } }) },
    '/invitations/{id}/accept': { post: op({ tag: 'Invitations', summary: 'Accept an invitation', params: [pathId('id', 'Invitation id')], responses: { 200: message(), 404: error('Not found') } }) },
    '/invitations/{id}/decline': { post: op({ tag: 'Invitations', summary: 'Decline an invitation', params: [pathId('id', 'Invitation id')], responses: { 200: message(), 404: error('Not found') } }) },
    '/devices': { get: op({ tag: 'Devices', summary: 'My devices', responses: { 200: json({ type: 'array', items: ref('Device') }) } }) },
    '/devices/{id}': {
      delete: op({ tag: 'Devices', summary: 'Remove a device and revoke its session', params: [pathId('id', 'Device id')], responses: { 200: json({ type: 'object', properties: { message: { type: 'string' }, wasCurrentDevice: { type: 'boolean' } } }), 404: error('Not found') } }),
    },
    '/search/tracks': {
      get: op({ tag: 'Search', summary: 'Search the Deezer catalog (tracks with a preview only)', params: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 100 } }], responses: { 200: json({ type: 'array', items: ref('Track') }), 502: error('Deezer unavailable') } }),
    },
  },
};
