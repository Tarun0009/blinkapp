import type { User } from '@prisma/client';

export function getFriendlyDisplayName(displayName?: string | null, email?: string | null) {
  const trimmedName = displayName?.trim();
  const trimmedEmail = email?.trim();

  if (trimmedName && trimmedName !== trimmedEmail && !trimmedName.includes('@')) {
    return trimmedName;
  }

  if (trimmedEmail?.includes('@')) {
    return trimmedEmail.split('@')[0] || 'Blink User';
  }

  return trimmedName || trimmedEmail || 'Blink User';
}

export function toApiUser(user: User, online = false) {
  return {
    id: user.firebaseUid,
    uid: user.firebaseUid,
    backendId: user.id,
    displayName: getFriendlyDisplayName(user.displayName, user.email),
    username: user.username,
    email: user.email,
    photoURL: user.photoURL,
    bio: user.bio,
    online,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toPublicApiUser(user: User, online = false) {
  return {
    id: user.firebaseUid,
    uid: user.firebaseUid,
    backendId: user.id,
    displayName: getFriendlyDisplayName(user.displayName, user.email),
    username: user.username,
    photoURL: user.photoURL,
    bio: user.bio,
    online,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
