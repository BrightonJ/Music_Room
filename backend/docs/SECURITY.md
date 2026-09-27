# Music Room – security notes

## Implemented protections

**Accounts and sessions**
- Passwords hashed with bcrypt (cost 10); strong password policy.
- Activation and reset tokens: 256-bit random, only their SHA-256 is stored, with an expiry
  (24 h / 1 h). The reset link works once, even with concurrent clicks (single UPDATE).
- Login answers the same way and in the same time whether the email exists or not
  (dummy bcrypt comparison). The emails are sent in the background.
- A JWT is bound to one device session (`devices.session_id`). Logout, device removal and
  password reset revoke it immediately for the REST API and the sockets.
- `JWT_SECRET` must be at least 32 characters; the server refuses to start otherwise.

**Abuse**
- Rate limits: per IP (anti-flood), per account, failed logins per IP + email, registrations,
  emails per target and per IP, password resets; per-socket token bucket for real-time events.
- JSON bodies limited to 20 kB, socket messages to 100 kB, queues to 200 tracks.

**Authorization (the server is the source of truth)**
- Private rooms are only visible to the host and accepted guests (REST and sockets).
- A vote is only accepted for a track queued in the room it is sent to, after the vote license
  check (invited / on-site + time window).
- Playback control requires to be the host or to use a delegated device.
- Tracks are added by Deezer id: the server fetches metadata, duration and the audio URL itself,
  so a client cannot inject an arbitrary URL (tracking, malicious host) or a fake duration.
- Delegation only to devices of friends who can see the room; removing the friend or the
  device removes the delegation.
- Invitations only to friends. Profile fields filtered by their privacy level.

**Web surface**
- Helmet headers; the email pages use a strict nonce-based Content-Security-Policy.
- No CORS headers: the API is meant for the mobile app only.
- Every call is logged with user, platform, device and app version, including unauthenticated
  ones; email tokens are never logged (route patterns only).

## Known hazards and their mitigation

| Hazard | Status |
|---|---|
| GPS spoofing: a guest can fake his location to vote from home | Cannot be fully prevented from a phone. The time window limits the exposure; the host can use the "invited" license instead. |
| Copying the X-Device-Id of another device | Useless alone: sessions are bound to a secret random id inside the signed token. |
| HTTP in clear text on the local network (token sniffing) | Acceptable for development only. In production put the API behind HTTPS (reverse proxy + `TRUST_PROXY=1`). |
| Stolen phone | Remove the device from another device, or reset the password (logs out everywhere). |
| Email enumeration at registration | "Email already in use" is shown to help real users; registrations are rate limited. |
| Denial of service by a botnet (many IPs) | Out of scope of the app: needs an upstream protection (reverse proxy, provider). |
| Deezer unavailable | Search answers 502, adding fails with a clear message, unplayable tracks are skipped. |
