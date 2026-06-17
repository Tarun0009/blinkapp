import type { Chat, ChatMember, Message, MessageReaction, User } from '@prisma/client';
import { toApiUser } from '../users/users.mapper.js';

type ChatWithRelations = Chat & {
  members: Array<ChatMember & { user: User }>;
  messages?: Message[];
};

type MessageRelations = {
  sender?: User;
  replyTo?:
    | (Message & {
        sender?: User | null;
      })
    | null;
  reactions?: Array<MessageReaction & { user?: User | null }>;
};

export type ViewerPreference = {
  isPinned: boolean;
  pinnedAt: Date | null;
  isMuted: boolean;
  mutedUntil: Date | null;
  isArchived: boolean;
  clearedAt: Date | null;
};

const EMPTY_VIEWER_PREFERENCE: ViewerPreference = {
  isPinned: false,
  pinnedAt: null,
  isMuted: false,
  mutedUntil: null,
  isArchived: false,
  clearedAt: null,
};

export function toApiChat(chat: ChatWithRelations, viewer: ViewerPreference = EMPTY_VIEWER_PREFERENCE) {
  const sortedMembers = [...chat.members].sort(
    (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
  );
  const ownerId = sortedMembers[0]?.userId;
  const members = chat.members.map(member => ({
    ...toApiUser(member.user),
    role: chat.isGroup && member.userId === ownerId ? 'OWNER' : 'MEMBER',
    joinedAt: member.joinedAt,
  }));
  const lastMessage = chat.messages?.[0];
  const hideLastMessage = !!(viewer.clearedAt && lastMessage && lastMessage.createdAt <= viewer.clearedAt);
  const visibleLastMessage = hideLastMessage ? null : lastMessage;

  return {
    id: chat.id,
    type: chat.isGroup ? 'group' : 'direct',
    name: chat.title,
    title: chat.title,
    memberIds: members.map(member => member.id),
    members,
    lastMessage: visibleLastMessage?.deletedAt
      ? 'Message deleted'
      : visibleLastMessage?.text || '',
    lastMessageAt: visibleLastMessage?.createdAt || chat.updatedAt,
    unreadCount: {},
    isPinned: viewer.isPinned,
    pinnedAt: viewer.pinnedAt,
    isMuted: viewer.isMuted,
    mutedUntil: viewer.mutedUntil,
    isArchived: viewer.isArchived,
    clearedAt: viewer.clearedAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

function groupReactions(reactions: Array<MessageReaction & { user?: User | null }> = []) {
  const grouped = new Map<
    string,
    {
      emoji: string;
      count: number;
      userIds: string[];
    }
  >();

  reactions.forEach(reaction => {
    const bucket = grouped.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      userIds: [],
    };
    bucket.count += 1;
    if (reaction.user) {
      bucket.userIds.push(reaction.user.firebaseUid);
    }
    grouped.set(reaction.emoji, bucket);
  });

  return Array.from(grouped.values());
}

function toReplyPreview(reply: NonNullable<MessageRelations['replyTo']>) {
  return {
    id: reply.id,
    chatId: reply.chatId,
    senderId: reply.sender?.firebaseUid || null,
    senderName: reply.sender?.displayName || null,
    text: reply.deletedAt ? 'Message deleted' : reply.text,
    deletedAt: reply.deletedAt,
    createdAt: reply.createdAt,
  };
}

export function toApiMessage(message: Message & MessageRelations) {
  if (!message.sender) {
    throw new Error('Message sender relation is required');
  }

  const isDeleted = Boolean(message.deletedAt);

  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.sender.firebaseUid,
    sender: toApiUser(message.sender),
    text: isDeleted ? '' : message.text,
    type: 'text',
    status: message.status.toLowerCase(),
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    replyToMessageId: message.replyToMessageId,
    replyTo: message.replyTo ? toReplyPreview(message.replyTo) : null,
    reactions: groupReactions(message.reactions),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
