# Blink Backend

Express + Socket.IO backend for Blink.

## Responsibility

- Firebase Authentication verifies identity only.
- PostgreSQL stores users, friendships, chats, and messages.
- Socket.IO delivers realtime chat, typing, read receipts, and presence.
- Redis stores fast presence state and later supports multi-server scaling.

## First Setup

```powershell
cd backend
copy .env.example .env
npm install
docker compose up -d
npm run db:generate
npm run db:migrate:init
npm run dev
```

`npm run dev` uses Nodemon with `tsx`, so TypeScript files restart automatically
when backend code changes.

After the first migration, create future migrations with a clear feature name:

```powershell
npm run prisma -- migrate dev --name add_friend_requests
```

The API runs on:

```text
http://localhost:4000
```

Socket.IO runs on the same HTTP server:

```text
http://localhost:4000
```

For a physical Android/iOS device, use your laptop LAN IP instead of `localhost`.

Local development uses dedicated Docker host ports to avoid conflicts with other projects:

```text
PostgreSQL: localhost:5433
Redis: localhost:6380
```

## Firebase Admin

Download a Firebase Admin SDK service account JSON from:

```text
Firebase Console -> Project settings -> Service accounts -> Generate new private key
```

Save it as:

```text
backend/serviceAccountKey.json
```

This is not the Android `google-services.json`.
