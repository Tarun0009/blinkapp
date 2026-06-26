import { prisma } from '../../config/prisma.js';
import { sendToUser, sendToUsers } from './notifications.service.js';

const BODY_MAX_CHARS = 140;

function truncate(input: string, max = BODY_MAX_CHARS) {
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function senderDisplayName(sender: { displayName: string | null; username?: string | null }) {
  return sender.displayName?.trim() || sender.username || 'Someone';
}

interface MessagePushInput {
  messageId: string;
  text: string;
  chat: {
    id: string;
    isGroup: boolean;
    title: string | null;
  };
  senderId: string;
  senderDisplayName: string;
  recipientIds: string[];
}

/**
 * Resolves recipients for a new-message push: chat members minus the sender,
 * minus anyone who has the sender (or vice versa) blocked, minus anyone who
 * has muted this chat. Per-user category preferences are honored downstream
 * inside `sendToUsers`.
 */
async function resolveMessageRecipients(
  chatId: string,
  senderId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];

  const [blocks, mutedPrefs] = await Promise.all([
    prisma.blockedUser.findMany({
      where: {
        OR: [
          { blockerId: { in: candidateIds }, blockedId: senderId },
          { blockerId: senderId, blockedId: { in: candidateIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.chatPreference.findMany({
      where: {
        chatId,
        userId: { in: candidateIds },
        mutedUntil: { gt: new Date() },
      },
      select: { userId: true },
    }),
  ]);

  const blockedIds = new Set<string>();
  for (const block of blocks) {
    if (block.blockerId === senderId) blockedIds.add(block.blockedId);
    if (block.blockedId === senderId) blockedIds.add(block.blockerId);
  }
  const mutedIds = new Set(mutedPrefs.map(row => row.userId));

  return candidateIds.filter(id => !blockedIds.has(id) && !mutedIds.has(id));
}

export async function pushNewMessageNotification(input: MessagePushInput) {
  const recipients = await resolveMessageRecipients(
    input.chat.id,
    input.senderId,
    input.recipientIds.filter(id => id !== input.senderId),
  );

  if (recipients.length === 0) return;

  const title = input.chat.isGroup
    ? input.chat.title || 'Group chat'
    : input.senderDisplayName;

  const body = input.chat.isGroup
    ? `${input.senderDisplayName}: ${truncate(input.text)}`
    : truncate(input.text);

  await sendToUsers(recipients, {
    title,
    body,
    category: 'messages',
    collapseKey: `chat:${input.chat.id}`,
    data: {
      type: 'message',
      chatId: input.chat.id,
      messageId: input.messageId,
      isGroup: input.chat.isGroup ? '1' : '0',
    },
  });
}

interface FriendRequestPushInput {
  requestId: string;
  senderId: string;
  senderDisplayName: string;
  receiverId: string;
}

export async function pushFriendRequestNotification(input: FriendRequestPushInput) {
  await sendToUser(input.receiverId, {
    title: 'New friend request',
    body: `${input.senderDisplayName} wants to connect with you`,
    category: 'friendRequests',
    collapseKey: 'friend_requests',
    data: {
      type: 'friend_request',
      requestId: input.requestId,
      senderId: input.senderId,
    },
  });
}

interface GroupInvitePushInput {
  chatId: string;
  chatTitle: string;
  adderId: string;
  adderDisplayName: string;
  addedUserIds: string[];
}

export async function pushGroupInviteNotification(input: GroupInvitePushInput) {
  if (input.addedUserIds.length === 0) return;

  // Skip recipients who have the adder (or vice versa) blocked. Block-pair
  // guards in chat routes should already prevent this, but defense-in-depth.
  const blocks = await prisma.blockedUser.findMany({
    where: {
      OR: [
        { blockerId: { in: input.addedUserIds }, blockedId: input.adderId },
        { blockerId: input.adderId, blockedId: { in: input.addedUserIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set<string>();
  for (const block of blocks) {
    if (block.blockerId === input.adderId) blockedIds.add(block.blockedId);
    if (block.blockedId === input.adderId) blockedIds.add(block.blockerId);
  }

  const recipients = input.addedUserIds.filter(id => !blockedIds.has(id));
  if (recipients.length === 0) return;

  await sendToUsers(recipients, {
    title: input.chatTitle || 'New group chat',
    body: `${input.adderDisplayName} added you to the group`,
    category: 'groupInvites',
    collapseKey: `group_invite:${input.chatId}`,
    data: {
      type: 'group_invite',
      chatId: input.chatId,
      adderId: input.adderId,
    },
  });
}

export { senderDisplayName };
