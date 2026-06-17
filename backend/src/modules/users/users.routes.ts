import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { redis } from '../../config/redis.js';
import { badRequest, conflict } from '../../shared/http/errors.js';
import { getRouteParam } from '../../shared/http/params.js';
import { profileRateLimit, reportRateLimit, writeRateLimit } from '../../middleware/rate-limit.js';
import { getFriendlyDisplayName, toApiUser, toPublicApiUser } from './users.mapper.js';
import {
  blockUser,
  findUserByFirebaseUid,
  getBlockedRelationUserIds,
  listBlockedUsers,
  reportUser,
  unblockUser,
  REPORT_REASONS,
} from './users.service.js';

const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'blink',
  'official',
  'staff',
  'team',
  'me',
  'you',
  'about',
  'login',
  'logout',
  'signup',
  'settings',
]);

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function assertUsernameShape(value: string) {
  if (!USERNAME_REGEX.test(value)) {
    throw badRequest(
      'Username must be 3-20 characters, start with a letter, and use only lowercase letters, numbers, and underscores.',
    );
  }

  if (RESERVED_USERNAMES.has(value)) {
    throw conflict('That username is reserved.', 'USERNAME_RESERVED');
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  username: z.string().trim().min(3).max(30).optional(),
  photoURL: z.string().trim().optional(),
  bio: z.string().trim().max(160).optional(),
});

const usernameAvailabilitySchema = z.object({
  value: z.string().trim().min(1).max(40),
});

const reportSchema = z.object({
  reason: z.enum(Array.from(REPORT_REASONS) as [string, ...string[]]),
  details: z.string().trim().max(500).optional(),
});

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    user: req.auth?.user ? toApiUser(req.auth.user) : null,
  });
});

usersRouter.get('/username/availability', requireAuth, profileRateLimit, async (req, res, next) => {
  try {
    const { value } = usernameAvailabilitySchema.parse({ value: req.query.value });
    const username = normalizeUsername(value);

    if (!USERNAME_REGEX.test(username)) {
      res.json({
        username,
        available: false,
        reason: 'INVALID_FORMAT',
      });
      return;
    }

    if (RESERVED_USERNAMES.has(username)) {
      res.json({
        username,
        available: false,
        reason: 'RESERVED',
      });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existing && existing.id !== req.auth!.user.id) {
      res.json({
        username,
        available: false,
        reason: 'TAKEN',
      });
      return;
    }

    res.json({
      username,
      available: true,
      reason: existing ? 'OWNED_BY_YOU' : 'AVAILABLE',
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/me', requireAuth, writeRateLimit, async (req, res, next) => {
  try {
    const userId = req.auth!.user.id;

    // Find any chats where this user is currently a member. After they leave,
    // any chat whose remaining member count drops to 0 (or 1 in a group that
    // becomes a solo orphan) should be deleted so we don't leak rows.
    const memberships = await prisma.chatMember.findMany({
      where: { userId },
      select: {
        chatId: true,
        chat: {
          select: {
            isGroup: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    const chatsToDelete = memberships
      .filter(({ chat }) => {
        const remaining = chat.members.filter(member => member.userId !== userId).length;
        // Empty chat after this user leaves, or a direct chat with only the
        // other member left — that direct chat has no other participant view
        // worth keeping either.
        return remaining === 0 || (!chat.isGroup && remaining === 1);
      })
      .map(({ chatId }) => chatId);

    await prisma.$transaction([
      // Cascade relations (chat members, friend requests, reactions, blocks,
      // reports, chat preferences, messages) are removed by the schema's
      // onDelete: Cascade rules when the User row is deleted.
      prisma.user.delete({ where: { id: userId } }),
      ...(chatsToDelete.length
        ? [prisma.chat.deleteMany({ where: { id: { in: chatsToDelete } } })]
        : []),
    ]);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me', requireAuth, profileRateLimit, async (req, res, next) => {
  try {
    const updates = updateProfileSchema.parse(req.body);

    let nextUsername: string | undefined;
    if (updates.username !== undefined) {
      nextUsername = normalizeUsername(updates.username);
      assertUsernameShape(nextUsername);
    }

    const data: Prisma.UserUpdateInput = {
      ...(updates.photoURL !== undefined ? { photoURL: updates.photoURL } : {}),
      ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
      ...(updates.displayName
        ? { displayName: getFriendlyDisplayName(updates.displayName, req.auth!.user.email) }
        : {}),
      ...(nextUsername !== undefined ? { username: nextUsername } : {}),
    };

    try {
      const user = await prisma.user.update({
        where: { id: req.auth!.user.id },
        data,
      });

      res.json({ user: toApiUser(user) });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray((error.meta as { target?: string[] } | undefined)?.target) &&
        (error.meta as { target: string[] }).target.includes('username')
      ) {
        throw conflict('That username is already taken.', 'USERNAME_TAKEN');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/connectable', requireAuth, async (req, res, next) => {
  try {
    const viewerId = req.auth!.user.id;
    const blockedIds = await getBlockedRelationUserIds(viewerId);

    const users = await prisma.user.findMany({
      where: {
        id: { not: viewerId, notIn: blockedIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const onlineKeys = users.length
      ? await redis.mget(users.map(user => `presence:${user.id}`))
      : [];

    res.json({
      users: users.map((user, index) => toPublicApiUser(user, onlineKeys[index] === 'online')),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const query = String(req.query.q ?? '').trim();

    if (query.length < 2) {
      res.json({ users: [] });
      return;
    }

    const viewerId = req.auth!.user.id;
    const blockedIds = await getBlockedRelationUserIds(viewerId);

    const users = await prisma.user.findMany({
      where: {
        id: { not: viewerId, notIn: blockedIds },
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });

    res.json({ users: users.map(user => toPublicApiUser(user)) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/blocked', requireAuth, async (req, res, next) => {
  try {
    const blocks: Awaited<ReturnType<typeof listBlockedUsers>> = await listBlockedUsers(
      req.auth!.user.id,
    );
    res.json({
      blocks: blocks.map(entry => ({
        user: toPublicApiUser(entry.user),
        blockedAt: entry.blockedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/:userId/block', requireAuth, writeRateLimit, async (req, res, next) => {
  try {
    const targetFirebaseUid = getRouteParam(req.params.userId, 'userId');
    const target = await findUserByFirebaseUid(targetFirebaseUid);
    await blockUser(req.auth!.user.id, target.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/:userId/block', requireAuth, writeRateLimit, async (req, res, next) => {
  try {
    const targetFirebaseUid = getRouteParam(req.params.userId, 'userId');
    const target = await findUserByFirebaseUid(targetFirebaseUid);
    await unblockUser(req.auth!.user.id, target.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/:userId/report', requireAuth, reportRateLimit, async (req, res, next) => {
  try {
    const targetFirebaseUid = getRouteParam(req.params.userId, 'userId');
    const { reason, details } = reportSchema.parse(req.body || {});
    const target = await findUserByFirebaseUid(targetFirebaseUid);
    const report = await reportUser(req.auth!.user.id, target.id, reason, details);
    res.status(201).json({
      report: {
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
