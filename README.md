Mobile + web collaborative music app. Backend = source of truth, mobile = remote control.

## Prerequisites

Tools you need on your machine (installed outside the project):

- Node.js 20+
- npm
- Docker (or Podman) with Compose
- `make`
- `openssl`

Everything else (backend + frontend dependencies, `eas-cli`, `cloudflared`, `@expo/ngrok`) is installed by `make install`.

## Quick start

```bash
git clone <repo-url> Music_Room
cd Music_Room

cp env.example .env
$EDITOR .env                    # fill in the OAuth credentials

make install env start
```

`make start` starts PostgreSQL, creates the schema, and opens the backend and the Expo dev server in two new Windows Terminal tabs.

Scan the Expo QR code with Expo Go (Android) or the Camera app (iOS).
