import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import type { ChatPreference } from '@prisma/client';
import { badRequest, forbidden, notFound } from '../../shared/http/errors.js';
import { getSocketServer } from '../../realtime/io.js';
import { SOCKET_EVENTS } from '../../realtime/events.js';
import { toApiChat, type ViewerPreference } from './chats.mapper.js';

type ArchiveFilter = 'active' | 'archived';
type ChatPreferenceFields =
  | Pick<ChatPreference, 'pinnedAt' | 'mutedUntil' | 'archivedAt' | 'clearedAt'>
  | null
  | undefined;

function isActiveMute(mutedUntil: Date | null | undefined) {
  if (!mutedUntil) return false;
  return mutedUntil.getTime() > Date.now();
}
export function toViewerPreference(preference: ChatPreferenceFields): ViewerPreference {
  return {
    isPinned: !!preference?.pinnedAt,
    pinnedAt: preference?.pinnedAt ?? null,
    isMuted: isActiveMute(preference?.mutedUntil),
    mutedUntil: preference?.mutedUntil ?? null,
    isArchived: !!preference?.archivedAt,
    clearedAt: preference?.clearedAt ?? null,
  };
}

export async function getUnreadCountForChat(
  chatId: string,
  userId: string,
  clearedAt?: Date | null,
) {
  return prisma.message.count({
    where: {
      chatId,
      senderId: { not: userId },
      OR: [
        { receipts: { none: { userId } } },
        { receipts: { some: { userId, readAt: null } } },
      ],
      ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
    },
  });
}

export async function getOnlineStatusForUserIds(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  const statuses = new Map<string, boolean>();
  if (uniqueIds.length === 0) return statuses;

  const keys = await redis.mget(uniqueIds.map(userId => `presence:${userId}`));
  uniqueIds.forEach((userId, index) => {
    statuses.set(userId, keys[index] === 'online');
  });

  return statuses;
}

async function getBlockedStatesForChats(
  viewerUserId: string,
  chats: Array<{ id: string; isGroup: boolean; members: Array<{ userId: string }> }>,
) {
  const directChats = chats.filter(chat => !chat.isGroup && chat.members.length === 2);
  const states = new Map<string, { blockedByUserId: string | null }>();

  if (directChats.length === 0) {
    return states;
  }

  const userIds = [
    ...new Set(directChats.flatMap(chat => chat.members.map(member => member.userId))),
  ];

  const blocks = await prisma.blockedUser.findMany({
    where: {
      blockerId: { in: userIds },
      blockedId: { in: userIds },
    },
    select: {
      blockerId: true,
      blockedId: true,
    },
  });

  directChats.forEach(chat => {
    const memberIds = new Set(chat.members.map(member => member.userId));
    const matchingBlocks = blocks.filter(
      entry => memberIds.has(entry.blockerId) && memberIds.has(entry.blockedId),
    );
    const viewerBlock = matchingBlocks.find(entry => entry.blockerId === viewerUserId);
    const block = viewerBlock ?? matchingBlocks[0];
    states.set(chat.id, { blockedByUserId: block?.blockerId ?? null });
  });

  return states;
}

async function getUnreadCountsForChats(
  userId: string,
  chats: Array<{ id: string; preferences: ChatPreferenceFields[] }>,
) {
  const chatIds = chats.map(chat => chat.id);
  const counts = new Map<string, number>();
  if (chatIds.length === 0) return counts;

  const clearedAtByChat = new Map(
    chats.map(chat => [chat.id, chat.preferences[0]?.clearedAt ?? null] as const),
  );

  const unreadMessages = await prisma.message.findMany({
    where: {
      chatId: { in: chatIds },
      senderId: { not: userId },
      OR: [
        { receipts: { none: { userId } } },
        { receipts: { some: { userId, readAt: null } } },
      ],
    },
    select: { chatId: true, createdAt: true },
  });

  unreadMessages.forEach(message => {
    const clearedAt = clearedAtByChat.get(message.chatId);
    if (clearedAt && message.createdAt <= clearedAt) return;
    counts.set(message.chatId, (counts.get(message.chatId) ?? 0) + 1);
  });

  return counts;
}

function sortChats(chats: Array<{ pinnedAt?: Date | null; lastMessageAt: Date }>) {
  return [...chats].sort((a, b) => {
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    if (a.pinnedAt && b.pinnedAt) {
      return b.pinnedAt.getTime() - a.pinnedAt.getTime();
    }
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });
}

export async function getUserChats(
  userId: string,
  { archiveFilter = 'active' }: { archiveFilter?: ArchiveFilter } = {},
) {
  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      preferences: {
        where: { userId },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const [unreadCounts, onlineByUserId, blockedStates] = await Promise.all([
    getUnreadCountsForChats(userId, chats),
    getOnlineStatusForUserIds(chats.flatMap(chat => chat.members.map(member => member.userId))),
    getBlockedStatesForChats(userId, chats),
  ]);

  const mapped = chats
    .map(chat => {
      const preference = chat.preferences[0] || null;
      return {
        chat,
        preference,
        api: toApiChat(chat, toViewerPreference(preference), {
          viewerUserId: userId,
          unreadCount: unreadCounts.get(chat.id) ?? 0,
          onlineByUserId,
          blockedByUserId: blockedStates.get(chat.id)?.blockedByUserId ?? null,
        }),
      };
    })
    .filter(entry =>
      archiveFilter === 'archived'
        ? !!entry.preference?.archivedAt
        : !entry.preference?.archivedAt,
    );

  return sortChats(
    mapped.map(entry => ({
      ...entry.api,
      pinnedAt: entry.preference?.pinnedAt ?? null,
      lastMessageAt: new Date(entry.api.lastMessageAt),
    })),
  );
}

export async function assertChatMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });

  if (!member) {
    throw forbidden('You are not a member of this chat');
  }
}

export async function getChatMember(chatId: string, userId: string) {
  return prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  });
}

export async function assertGroupManager(chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      isGroup: true,
      members: {
        orderBy: { joinedAt: 'asc' },
        select: { userId: true, role: true },
      },
    },
  });

  if (!chat || !chat.isGroup) {
    throw notFound('Group chat not found');
  }

  const fallbackOwnerId = chat.members[0]?.userId;
  const member = chat.members.find(entry => entry.userId === userId);
  if (!member) {
    throw forbidden('You are not a member of this group');
  }

  const role = member.role || (member.userId === fallbackOwnerId ? 'OWNER' : 'MEMBER');
  if (!['OWNER', 'ADMIN'].includes(role)) {
    throw forbidden('Only group admins can manage this group');
  }

  return { chat, member: { ...member, role } };
}

export async function assertGroupOwner(chatId: string, userId: string) {
  const result = await assertGroupManager(chatId, userId);
  if (result.member.role !== 'OWNER') {
    throw forbidden('Only the group owner can change admin roles');
  }

  return result;
}

export async function getChatForUser(chatId: string, userId: string) {
  await assertChatMember(chatId, userId);

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        include: { user: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      preferences: {
        where: { userId },
      },
    },
  });

  if (!chat) {
    throw notFound('Chat not found');
  }

  const preference = chat.preferences[0] || null;
  const [unreadCount, onlineByUserId, blockedStates] = await Promise.all([
    getUnreadCountForChat(chat.id, userId, preference?.clearedAt ?? null),
    getOnlineStatusForUserIds(chat.members.map(member => member.userId)),
    getBlockedStatesForChats(userId, [chat]),
  ]);

  return toApiChat(chat, toViewerPreference(preference), {
    viewerUserId: userId,
    unreadCount,
    onlineByUserId,
    blockedByUserId: blockedStates.get(chat.id)?.blockedByUserId ?? null,
  });
}

export async function findDirectChat(userAId: string, userBId: string) {
  const chats = await prisma.chat.findMany({
    where: {
      isGroup: false,
      members: {
        some: { userId: userAId },
      },
    },
    include: {
      members: true,
    },
  });

  return chats.find(chat => {
    const memberIds = chat.members.map(member => member.userId).sort();
    return memberIds.length === 2 && memberIds.join(':') === [userAId, userBId].sort().join(':');
  });
}

export async function assertUsersAreConnectedToOwner(ownerId: string, targetUserIds: string[]) {
  const uniqueIds = [...new Set(targetUserIds)].filter(id => id !== ownerId);
  if (uniqueIds.length === 0) {
    throw badRequest('Add at least one other member.');
  }

  const directChats = await prisma.chat.findMany({
    where: {
      isGroup: false,
      members: {
        some: { userId: ownerId },
      },
    },
    include: { members: true },
  });

  const connectedIds = new Set<string>();
  directChats.forEach(chat => {
    const memberIds = chat.members.map(member => member.userId);
    if (memberIds.length !== 2 || !memberIds.includes(ownerId)) {
      return;
    }

    const otherId = memberIds.find(id => id !== ownerId);
    if (otherId) {
      connectedIds.add(otherId);
    }
  });

  const missing = uniqueIds.filter(id => !connectedIds.has(id));
  if (missing.length > 0) {
    throw forbidden('You can only add connected people to a group.');
  }
}

export async function assertNoBlockedPairs(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length < 2) {
    return;
  }

  const blocked = await prisma.blockedUser.findFirst({
    where: {
      blockerId: { in: uniqueIds },
      blockedId: { in: uniqueIds },
    },
    select: { id: true },
  });

  if (blocked) {
    throw forbidden('A blocked user cannot be added to this group.');
  }
}

export async function getChatMemberIds(chatId: string) {
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    orderBy: { joinedAt: 'asc' },
    select: { userId: true },
  });

  return members.map(member => member.userId);
}

export function joinSocketsToChat(userIds: string[], chatId: string) {
  const io = getSocketServer();
  userIds.forEach(userId => {
    io?.in(`user:${userId}`).socketsJoin(`chat:${chatId}`);
  });
}

export function emitChatUpdatedToUsers(userIds: string[], chat: unknown) {
  const io = getSocketServer();
  userIds.forEach(userId => {
    io?.to(`user:${userId}`).emit(SOCKET_EVENTS.CHAT_UPDATED, { chat });
  });
}

export async function emitViewerChatsUpdated(chatId: string, userIds: string[]) {
  const io = getSocketServer();
  if (!io) return;

  await Promise.all(
    [...new Set(userIds)].map(async userId => {
      const chat = await getChatForUser(chatId, userId);
      io.to(`user:${userId}`).emit(SOCKET_EVENTS.CHAT_UPDATED, { chat });
    }),
  );
}

export function emitChatRemovedToUsers(userIds: string[], chatId: string) {
  const io = getSocketServer();
  userIds.forEach(userId => {
    io?.to(`user:${userId}`).emit(SOCKET_EVENTS.CHAT_REMOVED, { chatId });
    io?.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
  });
}

export async function getUserChatPreference(chatId: string, userId: string) {
  return prisma.chatPreference.findUnique({
    where: {
      chatId_userId: { chatId, userId },
    },
  });
}

