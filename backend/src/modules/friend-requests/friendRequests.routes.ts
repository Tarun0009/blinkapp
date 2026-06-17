import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getSocketServer } from '../../realtime/io.js';
import { badRequest, forbidden, notFound } from '../../shared/http/errors.js';
import { getRouteParam } from '../../shared/http/params.js';
import { findDirectChat, getChatForUser } from '../chats/chats.service.js';
import { isBlockedEitherWay } from '../users/users.service.js';
import { toApiFriendRequest } from './friendRequests.mapper.js';

const sendRequestSchema = z.object({
  receiverId: z.string().min(1),
});

async function getRequest(requestId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: {
      sender: true,
      receiver: true,
    },
  });

  if (!request) {
    throw notFound('Friend request not found');
  }

  return request;
}

export const friendRequestsRouter = Router();

friendRequestsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.user.id;
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: { sender: true, receiver: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId },
        include: { sender: true, receiver: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      incoming: incoming.map(toApiFriendRequest),
      outgoing: outgoing.map(toApiFriendRequest),
    });
  } catch (error) {
    next(error);
  }
});

friendRequestsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { receiverId } = sendRequestSchema.parse(req.body);
    const sender = req.auth!.user;
    const receiver = await prisma.user.findUnique({
      where: { firebaseUid: receiverId },
    });

    if (!receiver) {
      throw notFound('Receiver not found');
    }

    if (receiver.id === sender.id) {
      throw badRequest('You cannot send a request to yourself');
    }

    if (await isBlockedEitherWay(sender.id, receiver.id)) {
      throw forbidden('You cannot send a request to this user.');
    }

    const existingDirectChat = await findDirectChat(sender.id, receiver.id);
    if (existingDirectChat) {
      throw badRequest('You are already connected with this user');
    }

    const existingRequest = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: sender.id,
          receiverId: receiver.id,
        },
      },
    });

    if (existingRequest?.status === 'PENDING') {
      throw badRequest('Request already sent');
    }

    if (existingRequest?.status === 'ACCEPTED') {
      throw badRequest('You are already connected with this user');
    }

    const existingReverseRequest = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiver.id,
          receiverId: sender.id,
        },
      },
    });

    if (existingReverseRequest?.status === 'PENDING') {
      throw badRequest('This user already sent you a request');
    }

    if (existingReverseRequest?.status === 'ACCEPTED') {
      throw badRequest('You are already connected with this user');
    }

    const request = await prisma.friendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: sender.id,
          receiverId: receiver.id,
        },
      },
      update: {
        status: 'PENDING',
      },
      create: {
        senderId: sender.id,
        receiverId: receiver.id,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });

    const payload = { request: toApiFriendRequest(request) };
    const io = getSocketServer();
    io?.to(`user:${receiver.id}`).emit('friend-request:updated', payload);
    io?.to(`user:${sender.id}`).emit('friend-request:updated', payload);

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

friendRequestsRouter.post('/:requestId/accept', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.auth!.user.id;
    const requestId = getRouteParam(req.params.requestId, 'requestId');
    const existingRequest = await getRequest(requestId);

    if (existingRequest.receiverId !== currentUserId) {
      throw forbidden('Only the receiver can accept this request');
    }

    const result = await prisma.$transaction(async tx => {
      const request = await tx.friendRequest.update({
        where: { id: existingRequest.id },
        data: { status: 'ACCEPTED' },
        include: { sender: true, receiver: true },
      });

      const existingDirectChats = await tx.chat.findMany({
        where: {
          isGroup: false,
          members: {
            some: { userId: request.senderId },
          },
        },
        include: { members: true },
      });

      const directChat = existingDirectChats.find(chat => {
        const memberIds = chat.members.map(member => member.userId).sort();
        return (
          memberIds.length === 2 &&
          memberIds.join(':') === [request.senderId, request.receiverId].sort().join(':')
        );
      });

      const chat =
        directChat ||
        (await tx.chat.create({
          data: {
            members: {
              create: [
                { userId: request.senderId },
                { userId: request.receiverId },
              ],
            },
          },
        }));

      return { request, chatId: chat.id };
    });

    const apiRequest = toApiFriendRequest(result.request);
    const chat = await getChatForUser(result.chatId, currentUserId);
    const payload = { request: apiRequest, chat };
    const io = getSocketServer();
    io?.to(`user:${existingRequest.senderId}`).emit('friend-request:updated', payload);
    io?.to(`user:${existingRequest.receiverId}`).emit('friend-request:updated', payload);
    io?.to(`user:${existingRequest.senderId}`).emit('chat:updated', { chat });
    io?.to(`user:${existingRequest.receiverId}`).emit('chat:updated', { chat });

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

friendRequestsRouter.post('/:requestId/reject', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.auth!.user.id;
    const requestId = getRouteParam(req.params.requestId, 'requestId');
    const existingRequest = await getRequest(requestId);

    if (existingRequest.receiverId !== currentUserId) {
      throw forbidden('Only the receiver can reject this request');
    }

    const request = await prisma.friendRequest.update({
      where: { id: existingRequest.id },
      data: { status: 'REJECTED' },
      include: { sender: true, receiver: true },
    });

    const payload = { request: toApiFriendRequest(request) };
    const io = getSocketServer();
    io?.to(`user:${request.senderId}`).emit('friend-request:updated', payload);
    io?.to(`user:${request.receiverId}`).emit('friend-request:updated', payload);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});
