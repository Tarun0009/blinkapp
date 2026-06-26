import type { DevicePlatform } from '@prisma/client';
import { firebaseMessaging } from '../../config/firebase.js';
import { prisma } from '../../config/prisma.js';

export type NotificationCategory = 'messages' | 'friendRequests' | 'groupInvites';

export interface NotificationPayload {
  title: string;
  body: string;
  category: NotificationCategory;
  data: Record<string, string>;
  /** Used to coalesce duplicate notifications for the same conversation. */
  collapseKey?: string;
}

const PREF_FIELD_FOR_CATEGORY: Record<NotificationCategory, 'messagesEnabled' | 'friendRequestsEnabled' | 'groupInvitesEnabled'> = {
  messages: 'messagesEnabled',
  friendRequests: 'friendRequestsEnabled',
  groupInvites: 'groupInvitesEnabled',
};

const ANDROID_CHANNEL_FOR_CATEGORY: Record<NotificationCategory, string> = {
  messages: 'messages',
  friendRequests: 'friend_requests',
  groupInvites: 'groups',
};

const ANDROID_PRIORITY_FOR_CATEGORY: Record<NotificationCategory, 'high' | 'normal'> = {
  messages: 'high',
  friendRequests: 'normal',
  groupInvites: 'normal',
};

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const FCM_BATCH_LIMIT = 500;

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: DevicePlatform,
  appVersion?: string,
) {
  return prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId,
      platform,
      appVersion: appVersion ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      userId,
      token,
      platform,
      appVersion: appVersion ?? null,
    },
  });
}

export async function unregisterDeviceToken(token: string, userId?: string) {
  const where = userId ? { token, userId } : { token };
  await prisma.deviceToken.deleteMany({ where });
}

export async function unregisterAllTokensForUser(userId: string) {
  await prisma.deviceToken.deleteMany({ where: { userId } });
}

export async function getNotificationPreferences(userId: string) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.notificationPreference.create({ data: { userId } });
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<{
    messagesEnabled: boolean;
    friendRequestsEnabled: boolean;
    groupInvitesEnabled: boolean;
  }>,
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: updates,
    create: { userId, ...updates },
  });
}

async function filterUsersByCategory(
  userIds: string[],
  category: NotificationCategory,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const field = PREF_FIELD_FOR_CATEGORY[category];

  // Users without a NotificationPreference row default to enabled, so we only
  // exclude users who have explicitly disabled this category.
  const disabled = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, [field]: false },
    select: { userId: true },
  });
  const disabledIds = new Set(disabled.map(row => row.userId));
  return userIds.filter(id => !disabledIds.has(id));
}

async function getTokensForUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true, userId: true, platform: true },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

interface SendResult {
  attempted: number;
  succeeded: number;
  failed: number;
  invalidated: number;
}

/**
 * Fan-out a notification to one or more users. Respects per-user category
 * preferences, batches FCM calls, and prunes invalid tokens.
 *
 * This function NEVER throws — push failures should not break the caller
 * (e.g. message send) so all errors are logged and swallowed.
 */
export async function sendToUsers(
  userIds: string[],
  payload: NotificationPayload,
): Promise<SendResult> {
  const result: SendResult = { attempted: 0, succeeded: 0, failed: 0, invalidated: 0 };

  try {
    const allowed = await filterUsersByCategory(userIds, payload.category);
    if (allowed.length === 0) return result;

    const tokens = await getTokensForUsers(allowed);
    if (tokens.length === 0) return result;
    result.attempted = tokens.length;

    const channelId = ANDROID_CHANNEL_FOR_CATEGORY[payload.category];
    const priority = ANDROID_PRIORITY_FOR_CATEGORY[payload.category];

    for (const batch of chunk(tokens, FCM_BATCH_LIMIT)) {
      const response = await firebaseMessaging.sendEachForMulticast({
        tokens: batch.map(t => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority,
          collapseKey: payload.collapseKey,
          notification: {
            channelId,
            tag: payload.collapseKey,
          },
        },
        apns: {
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5',
            ...(payload.collapseKey ? { 'apns-collapse-id': payload.collapseKey } : {}),
          },
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: 'default',
              'mutable-content': 1,
            },
          },
        },
      });

      const invalidTokens: string[] = [];
      response.responses.forEach((res, index) => {
        const tokenRecord = batch[index];
        if (res.success) {
          result.succeeded += 1;
          return;
        }
        result.failed += 1;
        const code = res.error?.code;
        if (code && INVALID_TOKEN_ERROR_CODES.has(code)) {
          invalidTokens.push(tokenRecord.token);
        } else {
          console.warn('FCM send failure', { code, messageId: res.messageId, userId: tokenRecord.userId });
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
        result.invalidated += invalidTokens.length;
      }
    }
  } catch (error) {
    console.error('sendToUsers failed', error);
  }

  return result;
}

export function sendToUser(userId: string, payload: NotificationPayload) {
  return sendToUsers([userId], payload);
}
