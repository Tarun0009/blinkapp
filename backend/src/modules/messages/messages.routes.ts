import { Router } from 'express';
import {
  MessageStatus,
  Prisma,
  type Chat,
  type ChatMember,
  type Message,
  type MessageReaction,
  type MessageReceipt,
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
import {
  assertChatMember,
  emitChatUpdatedToUsers,
  getChatForUser,
  getOnlineStatusForUserIds,
  getUnreadCountForChat,
  getUserChatPreference,
  toViewerPreference,
} from '../chats/chats.service.js';
import { isBlockedEitherWay } from '../users/users.service.js';
import { pushNewMessageNotification, senderDisplayName } from '../notifications/notifications.events.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🔥']);

const mediaPayloadSchema = z.object({
  url: z.string().url(),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive().max(5 * 1024 * 1024).optional(),
  fileName: z.string().trim().max(140).optional(),
});

const createMessageSchema = z.object({
  type: z.enum(['text', 'image']).default('text'),
  text: z.string().trim().max(1000).optional().default(''),
  media: mediaPayloadSchema.optional(),
  replyToMessageId: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'text' && !value.text.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Message text is required.', path: ['text'] });
  }
  if (value.type === 'image' && !value.media) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image media is required.', path: ['media'] });
  }
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
  receipts: {
    include: { user: true },
  },
} satisfies Prisma.MessageInclude;

export const messagesRouter = Router({ mergeParams: true });

type ApiMessageRecord = Message & {
  sender: User;
  replyTo?: (Message & { sender: User | null }) | null;
  reactions?: Array<MessageReaction & { user: User | null }>;
  receipts?: Array<MessageReceipt & { user: User | null }>;
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

async function syncLegacyMessageStatus(messageIds: string[]) {
  if (messageIds.length === 0) return;

  const messages = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    include: { receipts: true },
  });

  await Promise.all(
    messages.map(message => {
      if (message.receipts.length === 0) return null;

      const deliveredReceipts = message.receipts.filter(receipt => receipt.deliveredAt || receipt.readAt);
      const readReceipts = message.receipts.filter(receipt => receipt.readAt);
      const allDelivered = deliveredReceipts.length === message.receipts.length;
      const allRead = readReceipts.length === message.receipts.length;
      const deliveredAt = deliveredReceipts
        .map(receipt => receipt.deliveredAt || receipt.readAt)
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0] || null;
      const readAt = readReceipts
        .map(receipt => receipt.readAt)
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0] || null;

      return prisma.message.update({
        where: { id: message.id },
        data: {
          status: allRead ? MessageStatus.READ : allDelivered ? MessageStatus.DELIVERED : MessageStatus.SENT,
          deliveredAt: allDelivered || allRead ? deliveredAt : null,
          readAt: allRead ? readAt : null,
        },
      });
    }),
  );
}

async function findIncomingMessagesForReceipt(
  chatId: string,
  userId: string,
  messageIds: string[] | undefined,
  mode: 'delivered' | 'read',
) {
  return prisma.message.findMany({
    where: {
      chatId,
      senderId: { not: userId },
      ...(messageIds ? { id: { in: messageIds } } : {}),
      OR:
        mode === 'read'
          ? [
              { receipts: { none: { userId } } },
              { receipts: { some: { userId, readAt: null } } },
            ]
          : [
              { receipts: { none: { userId } } },
              { receipts: { some: { userId, deliveredAt: null, readAt: null } } },
            ],
    },
    include: {
      receipts: {
        where: { userId },
      },
    },
  });
}

async function markIncomingMessagesDelivered(
  chatId: string,
  userId: string,
  messageIds?: string[],
) {
  const pending = await findIncomingMessagesForReceipt(chatId, userId, messageIds, 'delivered');

  if (pending.length === 0) {
    return [];
  }

  const now = new Date();
  const ids = pending.map(message => message.id);

  await Promise.all(
    pending.map(message => prisma.messageReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: message.id,
          userId,
        },
      },
      update: {
        deliveredAt: message.receipts[0]?.deliveredAt ?? now,
      },
      create: {
        messageId: message.id,
        userId,
        deliveredAt: now,
      },
    })),
  );

  await syncLegacyMessageStatus(ids);

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
  const pending = await findIncomingMessagesForReceipt(chatId, userId, messageIds, 'read');

  if (pending.length === 0) {
    return [];
  }

  const now = new Date();
  const ids = pending.map(message => message.id);

  await Promise.all(
    pending.map(message => prisma.messageReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: message.id,
          userId,
        },
      },
      update: {
        deliveredAt: message.receipts[0]?.deliveredAt ?? now,
        readAt: now,
      },
      create: {
        messageId: message.id,
        userId,
        deliveredAt: now,
        readAt: now,
      },
    })),
  );

  await syncLegacyMessageStatus(ids);

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
    const { type, text, media, replyToMessageId } = createMessageSchema.parse(req.body);

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

    const receiptRecipients = blockingChat?.members
      .filter(member => member.userId !== req.auth!.user.id)
      .map(member => ({ userId: member.userId })) ?? [];

    let message = await prisma.message.create({
      data: {
        chatId,
        senderId: req.auth!.user.id,
        text: text.trim(),
        type,
        mediaUrl: media?.url ?? null,
        mediaMimeType: media?.mimeType ?? null,
        mediaSize: media?.size ?? null,
        mediaName: media?.fileName ?? null,
        replyToMessageId: replyToMessageId ?? null,
        receipts: {
          create: receiptRecipients,
        },
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
        preferences: true,
      },
    });

    if (await hasOnlineDirectRecipient(chat, req.auth!.user.id)) {
      const directRecipient = chat.members.find(member => member.userId !== req.auth!.user.id);
      if (directRecipient) {
        const [deliveredMessage] = await markIncomingMessagesDelivered(
          chatId,
          directRecipient.userId,
          [message.id],
        );
        if (deliveredMessage) {
          message = deliveredMessage;
        }
      }
    }

    const apiMessage = toApiMessage(message);
    const apiChatsByUserId = new Map<string, ReturnType<typeof toApiChat>>();
    const onlineByUserId = await getOnlineStatusForUserIds(
      chat.members.map(member => member.userId),
    );
    const io = getSocketServer();
    io?.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, { message: apiMessage });

    await Promise.all(
      chat.members.map(async member => {
        const preference = chat.preferences.find(entry => entry.userId === member.userId);
        const unreadCount = await getUnreadCountForChat(
          chat.id,
          member.userId,
          preference?.clearedAt ?? null,
        );
        const apiChat = toApiChat(chat, toViewerPreference(preference), {
          viewerUserId: member.userId,
          unreadCount,
          onlineByUserId,
        });
        apiChatsByUserId.set(member.userId, apiChat);
        io?.to(`user:${member.userId}`).emit(SOCKET_EVENTS.CHAT_UPDATED, { chat: apiChat });
      }),
    );

    res.status(201).json({
      message: apiMessage,
      chat: apiChatsByUserId.get(req.auth!.user.id),
    });

    // Fire-and-forget push fan-out. `pushNewMessageNotification` never throws.
    pushNewMessageNotification({
      messageId: message.id,
      text: message.text || (message.type === 'image' ? 'Photo' : ''),
      chat: { id: chat.id, isGroup: chat.isGroup, title: chat.title },
      senderId: req.auth!.user.id,
      senderDisplayName: senderDisplayName(message.sender),
      recipientIds: chat.members.map(member => member.userId),
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    await assertChatMember(chatId, req.auth!.user.id);

    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      throw badRequest('Search query must be at least 2 characters.');
    }

    const preference = await getUserChatPreference(chatId, req.auth!.user.id);
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        text: { contains: q, mode: 'insensitive' },
        ...(preference?.clearedAt ? { createdAt: { gt: preference.clearedAt } } : {}),
      },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json({ results: messages.map(message => ({ message: toApiMessage(message) })) });
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

    const chat = await getChatForUser(chatId, req.auth!.user.id);
    emitChatUpdatedToUsers([req.auth!.user.id], chat);

    res.json({
      messages: messages.map(toApiMessage),
      chat,
    });
  } catch (error) {
    next(error);
  }
});
