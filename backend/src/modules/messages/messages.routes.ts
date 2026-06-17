import { Router } from 'express';
import {
  MessageStatus,
  Prisma,
  type Chat,
  type ChatMember,
  type Message,
  type MessageReaction,
  type User,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getSocketServer } from '../../realtime/io.js';
import { SOCKET_EVENTS } from '../../realtime/events.js';
import { badRequest, forbidden, notFound } from '../../shared/http/errors.js';
import { getRouteParam } from '../../shared/http/params.js';
import { toApiChat, toApiMessage } from '../chats/chats.mapper.js';
import { assertChatMember, getUserChatPreference } from '../chats/chats.service.js';
import { isBlockedEitherWay } from '../users/users.service.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🔥']);

const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  replyToMessageId: z.string().min(1).optional(),
});

const editMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

const receiptSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1).max(100).optional(),
});

const messageInclude = {
  sender: true,
  replyTo: {
    include: { sender: true },
  },
  reactions: {
    include: { user: true },
  },
} satisfies Prisma.MessageInclude;

export const messagesRouter = Router({ mergeParams: true });

type ApiMessageRecord = Message & {
  sender: User;
  replyTo?: (Message & { sender: User | null }) | null;
  reactions?: Array<MessageReaction & { user: User | null }>;
};
type ChatWithMembers = Chat & { members: ChatMember[] };

function emitStatusUpdates(messages: ApiMessageRecord[]) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  messages.forEach(message => {
    const apiMessage = toApiMessage(message);
    io.to(`chat:${message.chatId}`).emit(SOCKET_EVENTS.MESSAGE_STATUS_UPDATED, {
      message: apiMessage,
    });
  });
}

function emitMessageUpdated(message: ApiMessageRecord) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  io.to(`chat:${message.chatId}`).emit(SOCKET_EVENTS.MESSAGE_UPDATED, {
    message: toApiMessage(message),
  });
}

async function markIncomingMessagesDelivered(
  chatId: string,
  userId: string,
  messageIds?: string[],
) {
  const pending = await prisma.message.findMany({
    where: {
      chatId,
      senderId: { not: userId },
      status: MessageStatus.SENT,
      ...(messageIds ? { id: { in: messageIds } } : {}),
    },
    select: { id: true },
  });

  if (pending.length === 0) {
    return [];
  }

  const ids = pending.map(message => message.id);
  await prisma.message.updateMany({
    where: { id: { in: ids } },
    data: {
      status: MessageStatus.DELIVERED,
      deliveredAt: new Date(),
    },
  });

  return prisma.message.findMany({
    where: { id: { in: ids } },
    include: messageInclude,
  });
}

async function markIncomingMessagesRead(
  chatId: string,
  userId: string,
  messageIds?: string[],
) {
  const pending = await prisma.message.findMany({
    where: {
      chatId,
      senderId: { not: userId },
      status: { not: MessageStatus.READ },
      ...(messageIds ? { id: { in: messageIds } } : {}),
    },
    select: { id: true },
  });

  if (pending.length === 0) {
    return [];
  }

  const ids = pending.map(message => message.id);
  const now = new Date();

  await prisma.$transaction([
    prisma.message.updateMany({
      where: {
        id: { in: ids },
        deliveredAt: null,
      },
      data: { deliveredAt: now },
    }),
    prisma.message.updateMany({
      where: { id: { in: ids } },
      data: {
        status: MessageStatus.READ,
        readAt: now,
      },
    }),
  ]);

  return prisma.message.findMany({
    where: { id: { in: ids } },
    include: messageInclude,
  });
}

async function hasOnlineDirectRecipient(
  chat: ChatWithMembers,
  senderId: string,
) {
  if (chat.isGroup) {
    return false;
  }

  const io = getSocketServer();
  if (!io) {
    return false;
  }

  const recipients = chat.members.filter(member => member.userId !== senderId);
  if (recipients.length !== 1) {
    return false;
  }

  const sockets = await io.in(`user:${recipients[0].userId}`).fetchSockets();
  return sockets.length > 0;
}

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 30;

messagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    await assertChatMember(chatId, req.auth!.user.id);

    const preference = await getUserChatPreference(chatId, req.auth!.user.id);
    const rawLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length > 0
      ? req.query.cursor
      : null;

    let cursorMessage = null;
    if (cursor) {
      cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { id: true, chatId: true, createdAt: true },
      });
      if (!cursorMessage || cursorMessage.chatId !== chatId) {
        throw badRequest('Invalid pagination cursor.');
      }
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...(preference?.clearedAt ? { createdAt: { gt: preference.clearedAt } } : {}),
        ...(cursorMessage
          ? {
              OR: [
                { createdAt: { lt: cursorMessage.createdAt } },
                {
                  createdAt: cursorMessage.createdAt,
                  id: { lt: cursorMessage.id },
                },
              ],
            }
          : {}),
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const slice = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? slice[slice.length - 1].id : null;

    res.json({
      messages: slice.map(toApiMessage),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const { text, replyToMessageId } = createMessageSchema.parse(req.body);

    if (!text.trim()) {
      throw badRequest('Message text is required');
    }

    await assertChatMember(chatId, req.auth!.user.id);

    const blockingChat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        isGroup: true,
        members: {
          select: { userId: true },
        },
      },
    });

    if (blockingChat && !blockingChat.isGroup) {
      const other = blockingChat.members.find(member => member.userId !== req.auth!.user.id);
      if (other && (await isBlockedEitherWay(req.auth!.user.id, other.userId))) {
        throw forbidden('You cannot message this user.');
      }
    }

    if (replyToMessageId) {
      const parent = await prisma.message.findUnique({
        where: { id: replyToMessageId },
        select: { chatId: true, deletedAt: true },
      });
      if (!parent || parent.chatId !== chatId) {
        throw badRequest('Cannot reply to a message from a different chat.');
      }
      if (parent.deletedAt) {
        throw badRequest('Cannot reply to a deleted message.');
      }
    }

    let message = await prisma.message.create({
      data: {
        chatId,
        senderId: req.auth!.user.id,
        text,
        replyToMessageId: replyToMessageId ?? null,
      },
      include: messageInclude,
    });

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
      include: {
        members: {
          include: { user: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (await hasOnlineDirectRecipient(chat, req.auth!.user.id)) {
      message = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
        include: messageInclude,
      });
    }

    const apiMessage = toApiMessage(message);
    const apiChat = toApiChat(chat);
    const io = getSocketServer();
    io?.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { message: apiMessage });

    chat.members.forEach(member => {
      io?.to(`user:${member.userId}`).emit('chat:updated', { chat: apiChat });
    });

    res.status(201).json({
      message: apiMessage,
      chat: apiChat,
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.patch('/:messageId', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const messageId = getRouteParam(req.params.messageId, 'messageId');
    const { text } = editMessageSchema.parse(req.body);

    await assertChatMember(chatId, req.auth!.user.id);

    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        chatId: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    if (!existing || existing.chatId !== chatId) {
      throw notFound('Message not found.');
    }
    if (existing.senderId !== req.auth!.user.id) {
      throw forbidden('You can only edit your own messages.');
    }
    if (existing.deletedAt) {
      throw badRequest('Cannot edit a deleted message.');
    }
    if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw badRequest('The edit window has expired.');
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        text,
        editedAt: new Date(),
      },
      include: messageInclude,
    });

    emitMessageUpdated(updated);
    res.json({ message: toApiMessage(updated) });
  } catch (error) {
    next(error);
  }
});

messagesRouter.delete('/:messageId', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const messageId = getRouteParam(req.params.messageId, 'messageId');

    await assertChatMember(chatId, req.auth!.user.id);

    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, chatId: true, deletedAt: true },
    });

    if (!existing || existing.chatId !== chatId) {
      throw notFound('Message not found.');
    }
    if (existing.senderId !== req.auth!.user.id) {
      throw forbidden('You can only delete your own messages.');
    }
    if (existing.deletedAt) {
      res.json({ message: null });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: messageInclude,
    });

    emitMessageUpdated(updated);
    res.json({ message: toApiMessage(updated) });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/:messageId/reactions', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const messageId = getRouteParam(req.params.messageId, 'messageId');
    const { emoji } = reactionSchema.parse(req.body);

    if (!ALLOWED_REACTIONS.has(emoji)) {
      throw badRequest('That reaction is not supported.');
    }

    await assertChatMember(chatId, req.auth!.user.id);

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true, deletedAt: true },
    });
    if (!message || message.chatId !== chatId) {
      throw notFound('Message not found.');
    }
    if (message.deletedAt) {
      throw badRequest('Cannot react to a deleted message.');
    }

    const existing = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: req.auth!.user.id,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.messageReaction.create({
        data: {
          messageId,
          userId: req.auth!.user.id,
          emoji,
        },
      });
    }

    const updated = await prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!updated) {
      throw notFound('Message not found.');
    }

    emitMessageUpdated(updated);
    res.json({ message: toApiMessage(updated) });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/delivered', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const { messageIds } = receiptSchema.parse(req.body || {});

    await assertChatMember(chatId, req.auth!.user.id);

    const messages = await markIncomingMessagesDelivered(
      chatId,
      req.auth!.user.id,
      messageIds,
    );
    emitStatusUpdates(messages);

    res.json({
      messages: messages.map(toApiMessage),
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/read', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const { messageIds } = receiptSchema.parse(req.body || {});

    await assertChatMember(chatId, req.auth!.user.id);

    const messages = await markIncomingMessagesRead(chatId, req.auth!.user.id, messageIds);
    emitStatusUpdates(messages);

    res.json({
      messages: messages.map(toApiMessage),
    });
  } catch (error) {
    next(error);
  }
});
