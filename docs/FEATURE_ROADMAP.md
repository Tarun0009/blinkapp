# Blink Feature Roadmap

Last updated: 2026-06-26

Blink is a realtime chat app with Firebase Authentication, Express, Socket.IO, PostgreSQL, Prisma, and Redis. Firebase should stay responsible for authentication only; app data, chat state, realtime events, and notifications should stay backend-owned.

## Current Baseline

- Email/password authentication with Firebase Auth.
- Backend user profile sync in PostgreSQL.
- Direct chats after connection request acceptance.
- Friend request send, accept, reject, and request badge count.
- Realtime text messaging through Socket.IO.
- Message edit, delete, reply, reactions, delivered/read status.
- Chat list unread highlighting and viewer unread counts.
- Online, offline, last seen, and typing indicators.
- Archive, pin, mute, and clear chat preferences.
- Basic group creation, add members, remove members, and leave group.
- Push token registration and backend FCM fan-out.
- Block, unblock, and report user flows.
- Feature-based frontend folders and module-based backend folders.

## Recommended Next Features

### 1. Direct Notification Deep Links

Status: Implemented on 2026-06-26.

Problem: notification taps previously landed on the chat list, so the user needed an extra tap to open the exact conversation.

What to build:
- Add `GET /api/chats/:chatId` to fetch a single chat for the current viewer.
- Update notification tap handler to navigate to `ChatRoom` with hydrated chat params.
- Handle deleted/removed chat fallback by opening `ChatList`.
- Add notification payload validation for `message`, `friend_request`, and `group_invite`.

Why next: high user value, small scope, and builds on the existing notification system.

### 2. Blocked Chat Banner

Status: Implemented on 2026-06-26.

Problem: if users already had a direct chat and one blocks the other, sending is blocked, but the chat screen does not clearly explain why.

What to build:
- Add `isBlocked` and `blockedByMe` flags to backend chat mapper for direct chats.
- Show a banner in `ChatRoom` and `ChatSettings`.
- Disable message input when blocked.
- Add unblock shortcut when current user blocked the other person.

Why next: improves safety UX and removes confusion from existing chats.

### 3. Per-User Message Receipts

Problem: message status is currently global. In group chats, one member reading a message can make it look read for everyone.

What to build:
- Add `MessageReceipt` table with `messageId`, `userId`, `deliveredAt`, and `readAt`.
- Keep direct chat UI simple while making group receipts accurate.
- Update unread count queries to use viewer-specific receipts.
- Add small read summary in message details later.

Why next: important for serious realtime chat correctness, especially before expanding group chat.

### 4. Media Messages

Problem: image sharing is visible as a coming-soon action, but there is no backend storage pipeline yet.

What to build:
- Use S3-compatible object storage or Cloudinary, not Firebase Storage, to keep Firebase auth-only.
- Add signed upload endpoint or upload token endpoint.
- Add `Message.type`, `mediaUrl`, `mediaMimeType`, `mediaSize`, and thumbnail metadata.
- Add image preview, upload progress, retry, and delete cleanup.

Why next: strong resume feature and expected in chat apps.

### 5. Offline Send Queue

Problem: if the user sends while network/socket is unstable, messages can fail without a polished retry flow.

What to build:
- Store pending outbound messages locally with a client temp id.
- Show pending, failed, and retry states in message bubbles.
- Reconcile temp id with backend message id after success.
- Retry automatically when network and auth are back.

Why next: makes the app feel production-grade on real devices.

### 6. Foreground Notifications And Android Channels

Problem: backend sends FCM payloads, but foreground display and category channels need a complete mobile-side flow.

What to build:
- Create Android channels for messages, friend requests, and groups.
- Show local notifications for foreground messages when user is outside that chat.
- Suppress notification when user is already viewing the active chat.
- Add sound/vibration preferences per category.

Why next: makes notification behavior predictable during testing.

### 7. Message Search

Problem: users cannot find old conversation content.

What to build:
- Add backend search endpoint scoped to user membership.
- Support chat-level search and global message search.
- Highlight matched text in results.
- Respect cleared chats and block rules.

Why next: useful, database-focused, and good for resume discussion.

### 8. Group Chat Upgrade

Problem: group chat exists, but it is still basic.

What to build:
- Admin role table or explicit member roles.
- Promote/demote admin.
- Group photo support.
- Group rename audit/system messages.
- Member added/removed system messages.
- Per-viewer group read receipts.

Why next: bigger scope, best after receipt correctness.

### 9. Privacy Controls

Problem: presence is currently visible to connected users without user-level privacy settings.

What to build:
- Last seen visibility: everyone, connections, nobody.
- Online visibility toggle.
- Read receipt toggle for direct chats.
- Profile visibility rules for public directory.

Why next: important for trust and safety.

### 10. Production Hardening

Problem: app works locally, but production behavior needs operational safety.

What to build:
- Request logging with request ids in frontend error reports.
- Backend health checks for Postgres, Redis, and Firebase Admin.
- Socket.IO Redis adapter for multi-instance scaling.
- Seed scripts for test accounts and demo data.
- E2E tests for auth, request, message, archive, group, block, and notification flows.

Why next: makes the project easier to demo and maintain.

## Suggested Build Order

1. Direct notification deep links.
2. Blocked chat banner.
3. Foreground notifications and Android channels.
4. Media messages with external storage.
5. Per-user message receipts.
6. Offline send queue.
7. Message search.
8. Group chat upgrade.
9. Privacy controls.
10. Production hardening and E2E coverage.

## Feature Acceptance Template

Use this checklist before marking any feature complete:

- Backend API is implemented with auth, validation, and public-safe errors.
- Database migration is included when schema changes are required.
- Socket event is emitted only to users who should receive it.
- Frontend service is feature-local unless truly shared.
- UI handles loading, empty, success, error, and retry states.
- Physical-device test path is documented.
- `npm run lint`, `npm run backend:build`, `npm test -- --runInBand`, and Android bundle pass.
