import { prisma } from '../../config/prisma.js';
import { badRequest, notFound } from '../../shared/http/errors.js';

const REPORT_REASONS = new Set([
  'SPAM',
  'HARASSMENT',
  'IMPERSONATION',
  'INAPPROPRIATE_CONTENT',
  'OTHER',
]);

export async function findUserByFirebaseUid(firebaseUid: string) {
  const user = await prisma.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    throw notFound('User not found.');
  }
  return user;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw badRequest('You cannot block yourself.');
  }

  await prisma.blockedUser.upsert({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    update: {},
    create: { blockerId, blockedId },
  });

  // Cancel any pending requests in either direction so they don't pollute the inbox.
  await prisma.friendRequest.updateMany({
    where: {
      OR: [
        { senderId: blockerId, receiverId: blockedId, status: 'PENDING' },
        { senderId: blockedId, receiverId: blockerId, status: 'PENDING' },
      ],
    },
    data: { status: 'CANCELLED' },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.blockedUser.deleteMany({
    where: { blockerId, blockedId },
  });
}

export async function listBlockedUsers(blockerId: string) {
  const blocks = await prisma.blockedUser.findMany({
    where: { blockerId },
    include: { blocked: true },
    orderBy: { createdAt: 'desc' },
  });
  return blocks.map(block => ({ user: block.blocked, blockedAt: block.createdAt }));
}

export async function isBlockedEitherWay(userAId: string, userBId: string) {
  const block = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

export async function getBlockedRelationUserIds(userId: string) {
  const rows = await prisma.blockedUser.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const userIds = new Set<string>();
  rows.forEach(row => {
    userIds.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  });

  return [...userIds];
}

export async function reportUser(
  reporterId: string,
  reportedId: string,
  reason: string,
  details?: string,
) {
  if (reporterId === reportedId) {
    throw badRequest('You cannot report yourself.');
  }
  if (!REPORT_REASONS.has(reason)) {
    throw badRequest('Invalid report reason.');
  }

  return prisma.userReport.create({
    data: {
      reporterId,
      reportedId,
      reason,
      details: details?.trim() || null,
    },
  });
}

export { REPORT_REASONS };
