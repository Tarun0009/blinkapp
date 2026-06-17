# Blink Documentation

Blink is a React Native chat app with a custom Express backend. Firebase is
used only for authentication; all app data is owned by the backend database.

## Architecture

```text
React Native App
  -> Firebase Auth for signup, login, logout, password reset
  -> Express REST API for users, friend requests, chats, messages
  -> Socket.IO for realtime presence, typing, chat/message updates
  -> PostgreSQL through Prisma for persistent app data
  -> Redis for presence state
```

## Tech Stack

- React Native CLI
- React Navigation
- Firebase Auth
- Express + TypeScript backend
- Socket.IO realtime transport
- PostgreSQL
- Prisma ORM
- Redis
- Jest for basic render testing

## Firebase Usage

Firebase is used only for:

- Email/password signup
- Email/password login
- Password reset email
- Client session persistence
- Backend ID-token verification with Firebase Admin

Firebase is not used for:

- Chat message storage
- User/friend/chat database storage
- Firestore realtime listeners
- Firebase Storage
- Firebase Cloud Messaging

## Local Backend

Run the backend:

```powershell
cd backend
docker compose up -d
npm run dev
```

Backend URLs:

```text
API: http://localhost:4000
Socket.IO: http://localhost:4000
PostgreSQL: localhost:5433
Redis: localhost:6380
```

For development builds, the mobile app derives the backend host from the Metro
bundle URL and automatically calls the same machine on port `4000`.

For a USB-connected Android physical device, run:

```powershell
npm run android:backend-reverse
```

This forwards device `localhost:4000` to your laptop backend.

The config lives in:

```text
src/config/backend.js
```

For production/release builds, replace `PRODUCTION_API_URL` in that file with
the deployed API URL.

## Database

Open Prisma Studio:

```powershell
cd backend
npm run db:studio
```

Main models:

- User
- FriendRequest
- Chat
- ChatMember
- Message

## Important Files

```text
src/api/firebase.js                 Firebase Auth export only
src/api/backendClient.js            Authenticated backend API client
src/config/backend.js               Mobile backend URL config
src/context/AuthContext.js          Firebase auth state and profile sync
src/context/RealtimeContext.js      Socket.IO connection lifecycle
src/realtime/socketClient.js        Socket.IO client wrapper
src/realtime/socketEvents.js        Frontend realtime event names
backend/src/app.ts                  Express app setup
backend/src/server.ts               HTTP + Socket.IO server startup
backend/prisma/schema.prisma        Database schema
```
