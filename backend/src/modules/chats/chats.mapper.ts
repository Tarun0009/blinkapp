import { MessageStatus, type Chat, type ChatMember, type Message, type MessageReaction, type MessageReceipt, type User } from '@prisma/client';
import { toApiUser } from '../users/users.mapper.js';

type ChatWithRelations = Chat & {
  photoURL?: string | null;
  members: Array<ChatMember & { role?: string | null; user: User }>;
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
  receipts?: Array<MessageReceipt & { user?: User | null }>;
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

type ChatMapperOptions = {
  viewerUserId?: string;
  unreadCount?: number;
  onlineByUserId?: Map<string, boolean>;
  blockedByUserId?: string | null;
};

export function toApiChat(
  chat: ChatWithRelations,
  viewer: ViewerPreference = EMPTY_VIEWER_PREFERENCE,
  options: ChatMapperOptions = {},
) {
  const sortedMembers = [...chat.members].sort(
    (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
  );
  const fallbackOwnerId = sortedMembers[0]?.userId;
  const members = chat.members.map(member => ({
    ...toApiUser(member.user, options.onlineByUserId?.get(member.userId) ?? false),
    role: chat.isGroup
      ? member.role || (member.userId === fallbackOwnerId ? 'OWNER' : 'MEMBER')
      : 'MEMBER',
    joinedAt: member.joinedAt,
  }));
  const lastMessage = chat.messages?.[0];
  const hideLastMessage = !!(viewer.clearedAt && lastMessage && lastMessage.createdAt <= viewer.clearedAt);
  const visibleLastMessage = hideLastMessage ? null : lastMessage;
  const viewerMember = options.viewerUserId
    ? chat.members.find(member => member.userId === options.viewerUserId)
    : null;
  const viewerUnreadCount = Math.max(0, options.unreadCount ?? 0);
  const unreadCount = viewerMember?.user.firebaseUid
    ? { [viewerMember.user.firebaseUid]: viewerUnreadCount }
    : {};
  const blockedByMember = options.blockedByUserId
    ? chat.members.find(member => member.userId === options.blockedByUserId)
    : null;
  const isBlocked = !chat.isGroup && !!blockedByMember;
  const blockedByMe = isBlocked && options.viewerUserId === options.blockedByUserId;

  return {
    id: chat.id,
    type: chat.isGroup ? 'group' : 'direct',
    name: chat.title,
    title: chat.title,
    photoURL: chat.photoURL ?? null,
    memberIds: members.map(member => member.id),
    members,
    lastMessage: visibleLastMessage?.deletedAt
      ? 'Message deleted'
      : visibleLastMessage?.text || '',
    lastMessageAt: visibleLastMessage?.createdAt || chat.updatedAt,
    unreadCount,
    viewerUnreadCount,
    hasUnread: viewerUnreadCount > 0,
    isBlocked,
    blockedByMe,
    blockedByUserId: blockedByMember?.user.firebaseUid || null,
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

function toReceiptSummary(
  message: Message,
  receipts: Array<MessageReceipt & { user?: User | null }> = [],
) {
  const recipientCount = receipts.length;
  const deliveredCount = receipts.filter(receipt => receipt.deliveredAt || receipt.readAt).length;
  const readCount = receipts.filter(receipt => receipt.readAt).length;

  let status = message.status.toLowerCase();
  if (recipientCount > 0) {
    if (readCount === recipientCount) {
      status = MessageStatus.READ.toLowerCase();
    } else if (deliveredCount === recipientCount) {
      status = MessageStatus.DELIVERED.toLowerCase();
    } else {
      status = MessageStatus.SENT.toLowerCase();
    }
  }

  const firstDeliveredAt = receipts
    .map(receipt => receipt.deliveredAt || receipt.readAt)
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime())[0] || message.deliveredAt;
  const firstReadAt = receipts
    .map(receipt => receipt.readAt)
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime())[0] || message.readAt;

  return {
    status,
    deliveredAt: status === MessageStatus.SENT.toLowerCase() ? null : firstDeliveredAt,
    readAt: status === MessageStatus.READ.toLowerCase() ? firstReadAt : null,
    recipientCount,
    deliveredCount,
    readCount,
  };
}

function toApiReceipts(receipts: Array<MessageReceipt & { user?: User | null }> = []) {
  return receipts.map(receipt => ({
    userId: receipt.user?.firebaseUid || null,
    deliveredAt: receipt.deliveredAt,
    readAt: receipt.readAt,
  }));
}

export function toApiMessage(message: Message & MessageRelations) {
  if (!message.sender) {
    throw new Error('Message sender relation is required');
  }

  const isDeleted = Boolean(message.deletedAt);
  const receiptSummary = toReceiptSummary(message, message.receipts);

  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.sender.firebaseUid,
    sender: toApiUser(message.sender),
    text: isDeleted ? '' : message.text,
    type: message.type || 'text',
    imageURL: message.mediaUrl,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaSize: message.mediaSize,
    mediaName: message.mediaName,
    status: receiptSummary.status,
    deliveredAt: receiptSummary.deliveredAt,
    readAt: receiptSummary.readAt,
    receiptSummary,
    receipts: toApiReceipts(message.receipts),
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    replyToMessageId: message.replyToMessageId,
    replyTo: message.replyTo ? toReplyPreview(message.replyTo) : null,
    reactions: groupReactions(message.reactions),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}


