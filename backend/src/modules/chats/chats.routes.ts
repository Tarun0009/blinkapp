import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getRouteParam } from '../../shared/http/params.js';
import { badRequest, notFound } from '../../shared/http/errors.js';
import { toApiChat } from './chats.mapper.js';
import {
  assertChatMember,
  assertGroupManager,
  assertNoBlockedPairs,
  assertUsersAreConnectedToOwner,
  emitChatRemovedToUsers,
  emitChatUpdatedToUsers,
  getChatForUser,
  getChatMember,
  getChatMemberIds,
  getUserChats,
  joinSocketsToChat,
} from './chats.service.js';

const preferencesSchema = z
  .object({
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    mutedUntil: z.union([z.string().datetime(), z.null()]).optional(),
    clear: z.boolean().optional(),
  })
  .refine(
    value =>
      value.pinned !== undefined ||
      value.archived !== undefined ||
      value.mutedUntil !== undefined ||
      value.clear !== undefined,
    'At least one preference field is required.',
  );

const groupProfileSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
});

const createGroupSchema = groupProfileSchema
  .extend({
    title: z.string().trim().min(2).max(80),
    memberIds: z.array(z.string().min(1)).min(1).max(49),
  })
  .refine(value => new Set(value.memberIds).size === value.memberIds.length, {
    message: 'Duplicate members are not allowed.',
    path: ['memberIds'],
  });

const addMembersSchema = z
  .object({
    memberIds: z.array(z.string().min(1)).min(1).max(49),
  })
  .refine(value => new Set(value.memberIds).size === value.memberIds.length, {
    message: 'Duplicate members are not allowed.',
    path: ['memberIds'],
  });

export const chatsRouter = Router();

chatsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const includeArchived = String(req.query.archived ?? '') === 'true';
    const chats = await getUserChats(req.auth!.user.id, { includeArchived });
    res.json({ chats });
  } catch (error) {
    next(error);
  }
});

chatsRouter.post('/groups', requireAuth, async (req, res, next) => {
  try {
    const input = createGroupSchema.parse(req.body || {});
    const creator = req.auth!.user;
    const memberFirebaseIds = [...new Set(input.memberIds)].filter(id => id !== creator.firebaseUid);

    if (memberFirebaseIds.length === 0) {
      throw badRequest('Add at least one other member.');
    }

    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: memberFirebaseIds } },
      select: { id: true, firebaseUid: true },
    });

    if (users.length !== memberFirebaseIds.length) {
      throw badRequest('One or more selected members are no longer available.');
    }

    const memberIds = users.map(user => user.id);
    await assertUsersAreConnectedToOwner(creator.id, memberIds);
    await assertNoBlockedPairs([creator.id, ...memberIds]);

    const created = await prisma.chat.create({
      data: {
        isGroup: true,
        title: input.title,
        members: {
          create: [
            { userId: creator.id },
            ...memberIds.map(userId => ({ userId })),
          ],
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
      },
    });

    const apiChat = toApiChat(created);
    const allMemberIds = [creator.id, ...memberIds];
    joinSocketsToChat(allMemberIds, created.id);
    emitChatUpdatedToUsers(allMemberIds, apiChat);

    res.status(201).json({ chat: apiChat });
  } catch (error) {
    next(error);
  }
});

chatsRouter.patch('/:chatId/group', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const input = groupProfileSchema.parse(req.body || {});

    if (input.title === undefined) {
      throw badRequest('At least one group field is required.');
    }

    await assertGroupManager(chatId, req.auth!.user.id);

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
      },
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

    const apiChat = toApiChat(updated);
    const memberIds = updated.members.map(member => member.userId);
    emitChatUpdatedToUsers(memberIds, apiChat);

    res.json({ chat: apiChat });
  } catch (error) {
    next(error);
  }
});

chatsRouter.post('/:chatId/members', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const input = addMembersSchema.parse(req.body || {});

    await assertGroupManager(chatId, req.auth!.user.id);

    const existingMemberIds = await getChatMemberIds(chatId);
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: input.memberIds } },
      select: { id: true, firebaseUid: true },
    });

    if (users.length !== input.memberIds.length) {
      throw badRequest('One or more selected members are no longer available.');
    }

    const nextMemberIds = users
      .map(user => user.id)
      .filter(userId => !existingMemberIds.includes(userId));

    if (nextMemberIds.length === 0) {
      throw badRequest('Those people are already in this group.');
    }

    await assertUsersAreConnectedToOwner(req.auth!.user.id, nextMemberIds);
    await assertNoBlockedPairs([...existingMemberIds, ...nextMemberIds]);

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        members: {
          create: nextMemberIds.map(userId => ({
            userId,
          })),
        },
      },
    });

    const chat = await getChatForUser(chatId, req.auth!.user.id);
    const allMemberIds = await getChatMemberIds(chatId);
    joinSocketsToChat(nextMemberIds, chatId);
    emitChatUpdatedToUsers(allMemberIds, chat);

    res.status(201).json({ chat });
  } catch (error) {
    next(error);
  }
});

chatsRouter.delete('/:chatId/members/:memberId', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const targetFirebaseUid = getRouteParam(req.params.memberId, 'memberId');
    const group = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { isGroup: true },
    });

    if (!group?.isGroup) {
      throw notFound('Group chat not found');
    }

    const target = await prisma.user.findUnique({
      where: { firebaseUid: targetFirebaseUid },
      select: { id: true },
    });

    if (!target) {
      throw badRequest('Selected member is no longer available.');
    }

    const currentMember = await getChatMember(chatId, req.auth!.user.id);
    const targetMember = await getChatMember(chatId, target.id);

    if (!currentMember || !targetMember) {
      throw badRequest('That member is not in this group.');
    }

    const isSelfLeave = target.id === req.auth!.user.id;
    if (!isSelfLeave) {
      await assertGroupManager(chatId, req.auth!.user.id);
    }

    const allMemberIdsBefore = await getChatMemberIds(chatId);
    const remainingCount = allMemberIdsBefore.length - 1;
    const isTargetOwner = allMemberIdsBefore[0] === target.id;
    if (isTargetOwner && remainingCount > 0) {
      throw badRequest('The group owner cannot leave while other members remain.');
    }

    await prisma.chatMember.delete({
      where: {
        chatId_userId: { chatId, userId: target.id },
      },
    });

    if (remainingCount === 0) {
      await prisma.chat.delete({ where: { id: chatId } });
      emitChatRemovedToUsers([target.id], chatId);
      res.status(204).end();
      return;
    }

    const chat = await getChatForUser(chatId, req.auth!.user.id);
    const remainingMemberIds = await getChatMemberIds(chatId);
    emitChatRemovedToUsers([target.id], chatId);
    emitChatUpdatedToUsers(remainingMemberIds, chat);

    res.json({ chat });
  } catch (error) {
    next(error);
  }
});

chatsRouter.patch('/:chatId/preferences', requireAuth, async (req, res, next) => {
  try {
    const chatId = getRouteParam(req.params.chatId, 'chatId');
    const updates = preferencesSchema.parse(req.body || {});
    await assertChatMember(chatId, req.auth!.user.id);

    const data: Record<string, Date | null> = {};
    const create: Record<string, Date | null> = {};

    if (updates.pinned !== undefined) {
      data.pinnedAt = updates.pinned ? new Date() : null;
      create.pinnedAt = data.pinnedAt;
    }
    if (updates.archived !== undefined) {
      data.archivedAt = updates.archived ? new Date() : null;
      create.archivedAt = data.archivedAt;
    }
    if (updates.mutedUntil !== undefined) {
      const value = updates.mutedUntil ? new Date(updates.mutedUntil) : null;
      if (value && Number.isNaN(value.getTime())) {
        throw badRequest('Invalid mutedUntil timestamp.');
      }
      data.mutedUntil = value;
      create.mutedUntil = value;
    }
    if (updates.clear) {
      data.clearedAt = new Date();
      create.clearedAt = data.clearedAt;
    }

    const preference = await prisma.chatPreference.upsert({
      where: {
        chatId_userId: { chatId, userId: req.auth!.user.id },
      },
      update: data,
      create: {
        chatId,
        userId: req.auth!.user.id,
        ...create,
      },
    });

    res.json({
      preference: {
        chatId: preference.chatId,
        isPinned: !!preference.pinnedAt,
        pinnedAt: preference.pinnedAt,
        isArchived: !!preference.archivedAt,
        archivedAt: preference.archivedAt,
        mutedUntil: preference.mutedUntil,
        isMuted: preference.mutedUntil ? preference.mutedUntil.getTime() > Date.now() : false,
        clearedAt: preference.clearedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
