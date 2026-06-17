# Blink Feature Roadmap

This file tracks the next production-level features for Blink. Use it as the planning source before implementing any feature. When we pick one feature, we should expand that section into a detailed task plan, database changes, API contracts, socket events, frontend screens, and test cases.

For app performance, offline handling, background behavior, crash handling, and scale planning, use `PERFORMANCE_RELIABILITY_ROADMAP.md`.

## Current Product Direction

Blink is a real-time chat app with:

- React Native mobile frontend
- Express backend
- Socket.IO realtime layer
- PostgreSQL with Prisma
- Redis for realtime/presence support
- Firebase Authentication only

The goal is to make Blink feel like a real industry chat product, not a demo app.

## Priority Feature List

### 1. Message Delivery And Read Receipts

Purpose:
Show whether a message is sent, delivered, or read.

Why it matters:
This is one of the most expected features in any real chat app.

Backend work:
- Add message status transitions.
- Track delivered/read timestamps per recipient.
- Add APIs or socket events for marking messages delivered/read.

Frontend work:
- Show single/double check style indicators.
- Update message bubble status in real time.
- Mark messages as read when opening a chat.

Possible data changes:
- `Message.status`
- `Message.deliveredAt`
- `Message.readAt`
- Later: per-user read table for group chats.

Socket events:
- `message:delivered`
- `message:read`
- `message:status-updated`

Acceptance:
- Sender sees status update without refreshing.
- Receiver opening chat marks unread messages as read.

### 2. Offline Message Sync

Purpose:
Let users see recent conversations even when backend connection is weak or temporarily offline.

Why it matters:
Real mobile apps must handle poor network conditions.

Backend work:
- Provide paginated message history.
- Provide sync APIs using timestamps or cursors.

Frontend work:
- Store recent chats/messages locally.
- Show cached chats immediately.
- Sync new changes when network/backend returns.

Possible storage:
- AsyncStorage for simple first version.
- Later: SQLite/MMKV for better performance.

Acceptance:
- Chat list opens with cached data.
- Sending while offline is either queued or clearly blocked.
- App syncs when backend reconnects.

### 3. Push Notifications

Purpose:
Notify users about new messages and friend requests when the app is closed or backgrounded.

Why it matters:
Without push notifications, a chat app is not practically usable.

Backend work:
- Store device push tokens.
- Send notifications on new messages/friend requests.
- Avoid notifying the active sender.

Frontend work:
- Request notification permission.
- Register device token.
- Handle notification tap navigation.

Likely tools:
- Firebase Cloud Messaging for Android/iOS push.
- Firebase still remains only for auth and notifications, not database chat.

Possible data changes:
- `DeviceToken`
- `NotificationPreference`

Acceptance:
- New message triggers push when receiver is not active in chat.
- Tapping notification opens correct chat.

### 4. Media Messages

Purpose:
Allow image/file sharing in chats.

Why it matters:
Modern chat apps are not text-only.

Backend work:
- Add upload endpoint.
- Store media metadata.
- Generate secure file URLs.

Frontend work:
- Pick image/file.
- Show upload progress.
- Render image/file message bubble.

Storage options:
- Local backend storage for dev.
- Cloudinary/S3-compatible storage for production.

Possible data changes:
- `Message.type`
- `Message.mediaUrl`
- `Message.mediaMimeType`
- `Message.mediaSize`

Acceptance:
- User can send an image.
- Receiver sees image in real time.
- Media survives app restart.

### 5. User Search And Username System

Purpose:
Let users discover others by username/name/email.

Why it matters:
Global audience apps need reliable identity and discovery.

Backend work:
- Add unique username validation.
- Improve search endpoint.
- Add profile update validation.

Frontend work:
- Username field in profile.
- Better search UI in New Chat.
- Show username under display name.

Possible data changes:
- `User.username` unique index.
- Optional `User.searchName`.

Acceptance:
- User can claim a username.
- Search returns matching users quickly.
- Duplicate username is rejected clearly.

### 6. Block And Report Users

Purpose:
Protect users from spam, abuse, and unwanted messages.

Why it matters:
Safety is mandatory for global chat products.

Backend work:
- Block relationship table.
- Prevent messages/friend requests from blocked users.
- Report endpoint for moderation records.

Frontend work:
- Block/report actions in profile/chat settings.
- Hide blocked users from search/chat options.

Possible data changes:
- `BlockedUser`
- `UserReport`

Acceptance:
- Blocked user cannot send messages or requests.
- User can unblock later.
- Reports are stored for admin/moderation review.

### 7. Chat Settings

Purpose:
Give users control over each conversation.

Feature ideas:
- Mute chat
- Pin chat
- Clear chat
- Delete conversation
- Archive chat

Backend work:
- Per-user chat preferences.
- Soft delete/clear state per user.

Frontend work:
- Chat settings screen.
- Pin/mute indicators in chat list.

Possible data changes:
- `ChatPreference`
- `mutedUntil`
- `pinnedAt`
- `archivedAt`
- `clearedAt`

Acceptance:
- User can mute/pin/archive without affecting other member.

### 8. Typing And Presence Improvements

Purpose:
Make realtime state more accurate and polished.

Current state:
Basic presence/typing exists, but can be improved.

Backend work:
- Presence heartbeat.
- Last seen timestamps.
- Expire stale online state.

Frontend work:
- Better online/last seen display.
- Better typing UI in chat room.
- Show connection status when realtime is disconnected.

Possible data changes:
- `User.lastSeenAt`
- Redis presence TTL improvements.

Acceptance:
- Online state does not get stuck.
- Last seen is shown when user is offline.

### 9. Group Chat

Purpose:
Support conversations with more than two users.

Why it matters:
Group chat is a major product milestone.

Backend work:
- Group creation.
- Add/remove members.
- Admin roles.
- Group metadata.

Frontend work:
- Create group screen.
- Member picker.
- Group info screen.
- Group chat avatar/name.

Possible data changes:
- `Chat.isGroup`
- `Chat.title`
- `Chat.photoURL`
- `ChatMember.role`

Socket events:
- `group:created`
- `group:member-added`
- `group:member-removed`

Acceptance:
- User can create group.
- Members receive realtime messages.
- Admin can manage members.

### 10. Message Actions

Purpose:
Support common message-level actions.

Feature ideas:
- Reply to message
- Copy message
- Edit message
- Delete for me
- Delete for everyone
- React with emoji

Backend work:
- Add message edit/delete rules.
- Add reply metadata.
- Add reactions table.

Frontend work:
- Long press message menu.
- Reply preview.
- Edited/deleted labels.
- Reaction display.

Possible data changes:
- `Message.editedAt`
- `Message.deletedAt`
- `Message.replyToMessageId`
- `MessageReaction`

Acceptance:
- Long pressing message opens action menu.
- Message edits/deletes update in realtime.

### 11. Pagination And Infinite Scroll

Purpose:
Load messages and chats efficiently.

Why it matters:
Apps slow down if all messages load at once.

Backend work:
- Cursor-based pagination for messages.
- Cursor-based pagination for chats.

Frontend work:
- Load older messages when scrolling up.
- Loading indicators.
- Preserve scroll position.

Acceptance:
- Chat room loads quickly with latest messages.
- Older messages load on demand.

### 12. Global Error And Empty States

Purpose:
Make failures understandable to users.

Backend work:
- Consistent error codes/messages.

Frontend work:
- Reusable retry components.
- Connection status banner.
- Better empty states.

Acceptance:
- Backend down shows clear message.
- User can retry without restarting app.

### 13. Account And Profile Enhancements

Purpose:
Make profiles feel real.

Feature ideas:
- Profile photo upload
- Bio/status
- Username
- Delete account
- Change password

Backend work:
- Profile update endpoints.
- Optional media upload.
- Account deletion cleanup.

Frontend work:
- Edit profile screen improvements.
- Avatar upload.
- Account settings screen.

Acceptance:
- User can update visible profile info.

### 14. Security And Rate Limiting

Purpose:
Protect the backend from abuse.

Backend work:
- Rate limit auth-required endpoints.
- Rate limit message sending.
- Validate socket payloads.
- Add request logging.

Frontend work:
- Friendly message when rate limited.

Acceptance:
- Spammy message sending gets blocked gracefully.

### 15. Admin Or Moderation Panel

Purpose:
Support real-world operations.

Feature ideas:
- View reports
- Ban users
- View user stats
- View system health

Backend work:
- Admin roles.
- Protected admin APIs.

Frontend work:
- Could be a separate web dashboard later.

Acceptance:
- Admin can review reported users.

## Recommended Implementation Order

1. Message delivery/read receipts
2. User search and username system
3. Push notifications
4. Media messages
5. Offline message sync
6. Block/report users
7. Chat settings
8. Group chat
9. Message actions
10. Pagination and infinite scroll

## How We Should Start Each Feature

Before implementing any feature, write a short feature plan with:

- Problem statement
- User flow
- Backend data model changes
- REST API changes
- Socket event changes
- Frontend screen/component changes
- Edge cases
- Test plan

Then implement in this order:

1. Database schema
2. Backend service/API/socket events
3. Frontend service layer
4. UI screens/components
5. Error/empty/loading states
6. Manual test flow
7. Automated tests where useful
