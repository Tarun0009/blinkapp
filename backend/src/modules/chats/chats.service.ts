import { prisma } from '../../config/prisma.js';
import { badRequest, forbidden, notFound } from '../../shared/http/errors.js';
import { getSocketServer } from '../../realtime/io.js';
import { SOCKET_EVENTS } from '../../realtime/events.js';
import { toApiChat } from './chats.mapper.js';

function isActiveMute(mutedUntil: Date | null | undefined) {
  if (!mutedUntil) return false;
  return mutedUntil.getTime() > Date.now();
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

export async function getUserChats(userId: string, { includeArchived = false } = {}) {
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

  const mapped = chats
    .map(chat => {
      const preference = chat.preferences[0] || null;
      return {
        chat,
        preference,
        api: toApiChat(chat, {
          isPinned: !!preference?.pinnedAt,
          pinnedAt: preference?.pinnedAt ?? null,
          isMuted: isActiveMute(preference?.mutedUntil),
          mutedUntil: preference?.mutedUntil ?? null,
          isArchived: !!preference?.archivedAt,
          clearedAt: preference?.clearedAt ?? null,
        }),
      };
    })
    .filter(entry => includeArchived || !entry.preference?.archivedAt);

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
        select: { userId: true },
      },
    },
  });

  if (!chat || !chat.isGroup) {
    throw notFound('Group chat not found');
  }

  const member = chat.members.find(entry => entry.userId === userId);
  if (!member) {
    throw forbidden('You are not a member of this group');
  }

  const isOwner = chat.members[0]?.userId === userId;
  if (!isOwner) {
    throw forbidden('Only group admins can manage this group');
  }

  return { chat, member };
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
  return toApiChat(chat, {
    isPinned: !!preference?.pinnedAt,
    pinnedAt: preference?.pinnedAt ?? null,
    isMuted: isActiveMute(preference?.mutedUntil),
    mutedUntil: preference?.mutedUntil ?? null,
    isArchived: !!preference?.archivedAt,
    clearedAt: preference?.clearedAt ?? null,
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
