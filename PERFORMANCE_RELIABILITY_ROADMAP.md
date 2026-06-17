# Blink Performance And Reliability Roadmap

This file tracks the production engineering work needed to make Blink behave like a real mobile chat app under poor network, background mode, offline usage, crashes, and scale.

Use this roadmap one topic at a time. For each topic, first understand the problem, then design the backend contract, mobile behavior, edge cases, and test plan before implementation.

## Important Mobile Reality

Mobile apps cannot keep a WebSocket alive forever in the background.

When the app goes to background, Android and iOS may pause JavaScript, close sockets, restrict timers, or kill the app to save battery. Real chat apps handle this with:

- WebSocket while app is active.
- Push notifications while app is backgrounded or killed.
- Local cache so screens open instantly.
- Sync on reconnect/resume.
- Retry queues for actions created during weak network.

## Current App Direction

Blink currently uses:

- React Native frontend
- Express backend
- Socket.IO realtime layer
- PostgreSQL with Prisma
- Redis for realtime/presence support
- Firebase Authentication only

The reliability goal is:

- No blank screens during slow network.
- Clear connection state.
- Cached chats/messages available quickly.
- Safe reconnect behavior.
- No duplicate messages during retry.
- Graceful crash and error handling.
- Backend ready for more users without loading everything at once.

## Priority Reliability List

### 1. App Lifecycle And Socket State

Problem:
The app must react correctly when it moves between foreground, background, locked screen, and killed state.

Why it matters:
If lifecycle is ignored, sockets can stay stale, presence becomes wrong, and messages may stop syncing after app resume.

Frontend work:
- Use React Native `AppState`.
- Disconnect or pause noisy realtime work when app backgrounds.
- Reconnect and resync when app becomes active.
- Show a small connection state banner when disconnected.
- Mark user as online only when app is active and socket is connected.

Backend work:
- Treat socket disconnect as temporary.
- Use Redis TTL/heartbeat for presence.
- Expire stale online state automatically.

Acceptance:
- App resumes from background and messages load again.
- Online status does not get stuck forever.
- User sees clear status when realtime is disconnected.

Recommended first files:
- `src/context/RealtimeContext.js`
- `src/hooks/usePresence.js`
- `src/realtime/socketClient.js`
- `backend/src/realtime/socket.ts`

### 2. Network Detection And Connection Banner

Problem:
Users need to know whether the app is online, offline, reconnecting, or backend unreachable.

Why it matters:
A real chat app should not silently fail when the network drops.

Frontend work:
- Add network state detection with `@react-native-community/netinfo`.
- Add a global connection banner.
- Distinguish internet offline from backend down.
- Retry failed API calls only when useful.

Backend work:
- Keep `/health` endpoint fast and reliable.
- Optionally expose `/health/realtime` later.

Acceptance:
- Turning off internet shows offline state.
- Backend down shows backend unreachable state.
- App recovers automatically when network returns.

Possible package:
- `@react-native-community/netinfo`

### 3. Local Cache For Chats And Messages

Problem:
Chat list and recent messages should open quickly even before the backend responds.

Why it matters:
Mobile users expect instant screen loads, especially after reopening the app.

Frontend work:
- Cache chat list locally.
- Cache latest messages per chat.
- Load cached data first, then refresh from backend.
- Show stale-but-usable data with sync state.

Storage options:
- First version: `AsyncStorage`.
- Better version: SQLite or MMKV.

Backend work:
- Provide cursor or timestamp based sync APIs.
- Return latest chat/message changes since a cursor.

Acceptance:
- Chat list opens with cached conversations.
- Recent messages appear before network completes.
- Fresh messages replace cache after sync.

### 4. Offline Send Queue

Problem:
Users may type and press send when network is weak or temporarily gone.

Why it matters:
Losing typed messages feels terrible.

Frontend work:
- Create local pending message records.
- Show pending state in message bubble.
- Retry pending messages when connection returns.
- Allow failed message retry or delete.
- Use client-generated message IDs to prevent duplicates.

Backend work:
- Accept idempotency key or client message ID.
- Ignore duplicate send retries safely.
- Return canonical server message after save.

Possible data changes:
- `Message.clientMessageId`
- Unique index on `(senderId, clientMessageId)`

Acceptance:
- Sending offline creates a pending message locally.
- Reconnect sends pending messages.
- Retry does not create duplicate messages.

### 5. Reconnect And Resync Strategy

Problem:
After reconnect, the app needs to know what changed while it was offline.

Why it matters:
Socket events can be missed while disconnected.

Frontend work:
- Store last sync cursor per chat and chat list.
- On socket reconnect, call sync endpoints.
- Merge remote changes into local state.

Backend work:
- Add sync endpoints for chats and messages.
- Return changes after timestamp/cursor.
- Support pagination for older history.

Acceptance:
- Messages sent while receiver was offline appear after reconnect.
- Chat list last message/unread count becomes correct after resume.

### 6. Push Notifications For Background And Killed App

Problem:
WebSocket is not enough when the app is backgrounded or killed.

Why it matters:
Without push notifications, users miss messages.

Frontend work:
- Request notification permission.
- Register device push token.
- Send token to backend.
- Navigate to correct chat when notification is tapped.

Backend work:
- Store device tokens.
- Send push for new messages/friend requests.
- Avoid push when user is currently active in the same chat.

Likely tool:
- Firebase Cloud Messaging for push only.

Acceptance:
- Message notification appears while app is backgrounded.
- Tapping notification opens the correct chat.

### 7. Error Boundaries And Global Error Handling

Problem:
Unexpected UI errors should not crash the whole app into a blank screen.

Why it matters:
Production apps fail gracefully and give users a recovery path.

Frontend work:
- Keep `ErrorBoundary` around navigation root.
- Add retry/reset UI.
- Normalize API/socket errors.
- Avoid raw technical error messages in UI.

Backend work:
- Use consistent error response format.
- Use stable error codes for frontend handling.

Acceptance:
- A screen-level render error shows recovery UI.
- API failures show clear retry states.

### 8. Crash Reporting And Performance Monitoring

Problem:
You need visibility into crashes, slow screens, and failed requests after users install the app.

Why it matters:
Without monitoring, production bugs stay invisible.

Frontend work:
- Add crash reporting.
- Track app startup time.
- Track slow API calls and socket reconnect counts.
- Track screen render performance where useful.

Backend work:
- Add structured request logs.
- Add request IDs.
- Track slow queries and errors.

Possible tools:
- Sentry for React Native and Node.
- Firebase Crashlytics for native crash reporting.
- OpenTelemetry later for deeper backend tracing.

Acceptance:
- Real crashes appear in dashboard with device/app version.
- Backend errors include request path, user ID where safe, and request ID.

### 9. Pagination And Memory Management

Problem:
Loading too many chats/messages/images into memory will slow or crash the app.

Why it matters:
Chat apps grow data quickly.

Frontend work:
- Paginate messages.
- Use FlatList carefully with stable keys.
- Avoid huge arrays in state.
- Avoid unnecessary re-renders in message bubbles.

Backend work:
- Cursor-based pagination for messages/chats.
- Proper database indexes.

Possible data/index work:
- Index `Message.chatId, createdAt`.
- Index `ChatMember.userId`.
- Index `Message.createdAt`.

Acceptance:
- Chat room opens fast with only latest messages.
- Older messages load when scrolling.
- Large chats do not freeze the app.

### 10. Image And Media Performance

Problem:
Large images can slow the UI, increase memory usage, and waste network.

Why it matters:
Media-heavy chats are common.

Frontend work:
- Compress images before upload.
- Show thumbnails in chat.
- Lazy load full media.
- Show upload progress.

Backend work:
- Store image metadata.
- Generate thumbnails.
- Limit upload size/type.

Acceptance:
- Large image upload does not freeze UI.
- Chat list and chat room stay smooth.

### 11. Backend Rate Limiting And Abuse Protection

Problem:
Users or bots can spam messages, requests, or expensive endpoints.

Why it matters:
Global apps need protection before scale.

Backend work:
- Rate limit API endpoints.
- Rate limit socket events.
- Validate every socket payload.
- Add payload size limits.

Frontend work:
- Show friendly rate-limit messages.
- Prevent repeated button taps while request is pending.

Acceptance:
- Message spam is blocked gracefully.
- Backend does not crash under repeated invalid events.

### 12. Database Performance And Index Audit

Problem:
Queries that work for ten users can become slow for thousands.

Why it matters:
Backend scale usually breaks first at the database layer.

Backend work:
- Review Prisma queries.
- Add missing indexes.
- Avoid N+1 query patterns.
- Add pagination everywhere data can grow.

Acceptance:
- Common endpoints remain fast with seeded large data.
- Query plans use indexes for chat/message lookups.

### 13. Backend Health, Readiness, And Graceful Shutdown

Problem:
Production servers need clean startup, shutdown, and health checks.

Why it matters:
Deployments and restarts should not corrupt connections or leave bad state.

Backend work:
- `/health` for basic server status.
- `/ready` for database/Redis readiness.
- Graceful shutdown for HTTP and Socket.IO.
- Close Prisma and Redis clients cleanly.

Acceptance:
- Server exits cleanly on shutdown.
- Health endpoint stays fast.
- Readiness fails when database/Redis is unavailable.

### 14. Release Build Performance

Problem:
Debug builds are slower than release builds, and app startup must be tested in release mode.

Why it matters:
Physical device performance problems should be measured realistically.

Frontend work:
- Test Android release APK.
- Enable Hermes if appropriate.
- Review startup screen and bundle size.
- Avoid expensive startup tasks before first screen.

Acceptance:
- Release build opens consistently without long black screen.
- Startup work is deferred until after initial render where possible.

### 15. Automated Reliability Testing

Problem:
Manual testing misses reconnect, offline, and resume bugs.

Why it matters:
These bugs often return unless tested.

Test work:
- Unit tests for sync merge logic.
- Unit tests for offline queue/idempotency.
- Backend tests for duplicate client message ID.
- Manual test checklist for network off/on, app background/resume, backend restart.

Acceptance:
- Core reliability logic has automated tests.
- Manual checklist is repeatable before releases.

## Recommended Implementation Order

1. App lifecycle and socket state
2. Network detection and connection banner
3. Local cache for chats/messages
4. Reconnect and resync strategy
5. Offline send queue
6. Push notifications
7. Error boundaries and global error handling
8. Pagination and memory management
9. Crash reporting and performance monitoring
10. Backend rate limiting and abuse protection
11. Database performance and index audit
12. Backend health/readiness/graceful shutdown
13. Release build performance
14. Image/media performance
15. Automated reliability testing

## How We Should Start Each Topic

For any selected topic, first write:

- Problem statement
- Current behavior in Blink
- Target production behavior
- Frontend changes
- Backend changes
- Data model changes if any
- Edge cases
- Test plan
- Rollback risk

Then implement in this order:

1. Shared config/constants
2. Backend contract if needed
3. Frontend service layer
4. UI state and feedback
5. Persistence/cache if needed
6. Tests
7. Manual device checklist

## Suggested First Topic

Start with **App Lifecycle And Socket State**.

Reason:
It teaches the core production idea behind mobile realtime apps: sockets are active-session tools, not permanent background infrastructure. Once lifecycle handling is correct, network banners, offline cache, push notifications, and sync become much easier to design.
