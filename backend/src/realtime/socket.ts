import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { MessageStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import { env } from '../config/env.js';
import { SOCKET_EVENTS } from './events.js';
import { setSocketServer } from './io.js';
import { allowSocketEvent, SOCKET_LIMITS } from './rate-limit.js';
import { toApiMessage } from '../modules/chats/chats.mapper.js';
import { getFriendlyDisplayName, toApiUser } from '../modules/users/users.mapper.js';

const PRESENCE_TTL_SECONDS = 60;
const PRESENCE_HEARTBEAT_MS = 30_000;

async function markPendingDirectMessagesDelivered(
  io: Server,
  userId: string,
  chatIds: string[],
) {
  if (chatIds.length === 0) {
    return;
  }

  const pending = await prisma.message.findMany({
    where: {
      chatId: { in: chatIds },
      senderId: { not: userId },
      chat: { isGroup: false },
      OR: [
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

  if (pending.length === 0) {
    return;
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

  await prisma.message.updateMany({
    where: { id: { in: ids } },
    data: {
      status: MessageStatus.DELIVERED,
      deliveredAt: now,
    },
  });

  const messages = await prisma.message.findMany({
    where: { id: { in: ids } },
    include: {
      sender: true,
      receipts: {
        include: { user: true },
      },
    },
  });

  messages.forEach(message => {
    io.to(`chat:${message.chatId}`).emit(SOCKET_EVENTS.MESSAGE_STATUS_UPDATED, {
      message: toApiMessage(message),
    });
  });
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === 'string'
          ? socket.handshake.auth.token
          : undefined;
      const decodedToken = await verifyFirebaseToken(token);
      const tokenDisplayName =
        decodedToken.name && decodedToken.name !== decodedToken.email && !decodedToken.name.includes('@')
          ? decodedToken.name
          : undefined;
      const user = await prisma.user.upsert({
        where: { firebaseUid: decodedToken.uid },
        update: {
          email: decodedToken.email ?? undefined,
          ...(tokenDisplayName ? { displayName: tokenDisplayName } : {}),
          photoURL: decodedToken.picture ?? undefined,
        },
        create: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email ?? undefined,
          displayName: getFriendlyDisplayName(tokenDisplayName, decodedToken.email),
          photoURL: decodedToken.picture ?? undefined,
        },
      });

      socket.data.user = user;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Socket auth failed'));
    }
  });

  setSocketServer(io);

  io.on('connection', async socket => {
    const user = socket.data.user;
    const userRoom = `user:${user.id}`;
    const presenceKey = `presence:${user.id}`;
    socket.join(userRoom);
    await redis.set(presenceKey, 'online', 'EX', PRESENCE_TTL_SECONDS);

    const presenceHeartbeat = setInterval(() => {
      redis.set(presenceKey, 'online', 'EX', PRESENCE_TTL_SECONDS).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);

    const memberships = await prisma.chatMember.findMany({
      where: { userId: user.id },
      select: { chatId: true },
    });

    memberships.forEach(member => {
      socket.join(`chat:${member.chatId}`);
    });

    await markPendingDirectMessagesDelivered(
      io,
      user.id,
      memberships.map(member => member.chatId),
    );

    socket.emit(SOCKET_EVENTS.CONNECTION_READY, { user: toApiUser(user, true) });
    socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_ONLINE, {
      userId: user.firebaseUid,
      uid: user.firebaseUid,
      online: true,
    });

    const isValidChatId = (chatId: unknown): chatId is string =>
      typeof chatId === 'string' && chatId.length > 0 && chatId.length <= 64;

    socket.on('chat:join', async (payload: { chatId?: unknown } = {}) => {
      const { chatId } = payload;
      if (!isValidChatId(chatId)) return;
      if (!allowSocketEvent(user.id, 'chat:join', SOCKET_LIMITS.chatJoin)) return;

      const member = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: user.id,
          },
        },
      });

      if (member) {
        socket.join(`chat:${chatId}`);
      }
    });

    socket.on('chat:leave', (payload: { chatId?: unknown } = {}) => {
      const { chatId } = payload;
      if (!isValidChatId(chatId)) return;
      if (!allowSocketEvent(user.id, 'chat:leave', SOCKET_LIMITS.chatJoin)) return;
      socket.leave(`chat:${chatId}`);
    });

    socket.on(SOCKET_EVENTS.TYPING_START, (payload: { chatId?: unknown } = {}) => {
      const { chatId } = payload;
      if (!isValidChatId(chatId)) return;
      if (!allowSocketEvent(user.id, SOCKET_EVENTS.TYPING_START, SOCKET_LIMITS.typing)) return;

      socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_START, {
        chatId,
        userId: user.firebaseUid,
        user: {
          id: user.firebaseUid,
          displayName: getFriendlyDisplayName(user.displayName, user.email),
          email: user.email,
        },
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload: { chatId?: unknown } = {}) => {
      const { chatId } = payload;
      if (!isValidChatId(chatId)) return;
      if (!allowSocketEvent(user.id, SOCKET_EVENTS.TYPING_STOP, SOCKET_LIMITS.typing)) return;

      socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
        chatId,
        userId: user.firebaseUid,
      });
    });

    // Catch-all guard: any other event the client tries to emit is throttled
    // and dropped if oversized.
    socket.onAny((event: string, payload?: unknown) => {
      const known = ['chat:join', 'chat:leave', SOCKET_EVENTS.TYPING_START, SOCKET_EVENTS.TYPING_STOP];
      if (known.includes(event)) return;
      if (!allowSocketEvent(user.id, event, SOCKET_LIMITS.default)) {
        socket.disconnect(true);
        return;
      }
      // Reject oversized JSON payloads early.
      try {
        const serialized = JSON.stringify(payload ?? null);
        if (serialized.length > 8 * 1024) {
          socket.disconnect(true);
        }
      } catch {
        socket.disconnect(true);
      }
    });

    socket.on('disconnect', async () => {
      clearInterval(presenceHeartbeat);

      const remainingSockets = await io.in(userRoom).fetchSockets();
      if (remainingSockets.length > 0) {
        return;
      }

      await redis.del(presenceKey);
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
      socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_OFFLINE, {
        userId: user.firebaseUid,
        uid: user.firebaseUid,
        online: false,
        lastSeen: new Date().toISOString(),
      });
    });
  });

  return io;
}
