import messaging from '@react-native-firebase/messaging';
import { auth } from '../../../api/firebase';
import { navigate, navigationRef } from '../../../navigation/navigationRef';
import { fetchChatById } from '../../chats/services/chatService';
import {
  ensureNotificationChannels,
  NOTIFICATION_CHANNELS,
  showForegroundNotification,
} from './localNotifications';

const NOTIFICATION_TYPES = new Set(['message', 'friend_request', 'group_invite']);
const READY_POLL_INTERVAL_MS = 100;
const MAX_READY_ATTEMPTS = 80;

let activeNotificationChatId = null;

export function setActiveNotificationChat(chatId) {
  activeNotificationChatId = chatId || null;
}

function navigateToChatStack(screen, params) {
  navigate('Main', {
    screen: 'ChatsTab',
    params: {
      screen,
      params,
    },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNotificationTarget(remoteMessage) {
  const data = remoteMessage?.data || {};
  const type = cleanString(data.type);

  if (!NOTIFICATION_TYPES.has(type)) {
    return null;
  }

  if (type === 'friend_request') {
    return {
      type,
      requestId: cleanString(data.requestId),
      senderId: cleanString(data.senderId),
    };
  }

  const chatId = cleanString(data.chatId);
  if (!chatId) {
    return null;
  }

  return {
    type,
    chatId,
    messageId: cleanString(data.messageId),
    isGroup: cleanString(data.isGroup) === '1',
  };
}

function getOtherMember(chat, currentUid) {
  return chat.members?.find((member) => member.id !== currentUid) || null;
}

function getChatName(chat, currentUid) {
  if (chat.type === 'group') {
    return chat.name || chat.title || 'Group Chat';
  }

  const otherMember = getOtherMember(chat, currentUid);
  return otherMember?.displayName || otherMember?.username || 'Blink User';
}

function buildChatRoomParams(chat, currentUid, target) {
  const isGroup = chat.type === 'group';
  const otherMember = isGroup ? null : getOtherMember(chat, currentUid);

  return {
    chatId: chat.id,
    chatName: getChatName(chat, currentUid),
    isGroup,
    members: chat.members || [],
    otherUserId: otherMember?.id || null,
    isPinned: chat.isPinned,
    isMuted: chat.isMuted,
    mutedUntil: chat.mutedUntil,
    isArchived: chat.isArchived,
    isBlocked: chat.isBlocked,
    blockedByMe: chat.blockedByMe,
    blockedByUserId: chat.blockedByUserId,
    highlightMessageId: target?.messageId || null,
  };
}

function navigateToChatList() {
  navigateToChatStack('ChatList');
}

async function openNotificationTarget(target) {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    return;
  }

  if (target.type === 'friend_request') {
    navigateToChatStack('FriendRequests');
    return;
  }

  try {
    const chat = await fetchChatById(target.chatId);
    if (!chat?.id) {
      navigateToChatList();
      return;
    }

    navigateToChatStack('ChatRoom', buildChatRoomParams(chat, currentUser.uid, target));
  } catch {
    // Notification taps should never expose backend errors. If the chat was
    // deleted, archived differently, or the device is offline, land safely.
    navigateToChatList();
  }
}

function runWhenAppReady(callback) {
  const tryRun = () => {
    if (!navigationRef.isReady() || !auth().currentUser) {
      return false;
    }

    callback();
    return true;
  };

  if (tryRun()) {
    return;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (tryRun() || attempts >= MAX_READY_ATTEMPTS) {
      clearInterval(interval);
    }
  }, READY_POLL_INTERVAL_MS);
}

/**
 * Convert a remote message into a frontend navigation target. Backend payloads
 * are { type: 'message' | 'friend_request' | 'group_invite', ...ids }.
 */
function handleRemoteMessageTap(remoteMessage) {
  const target = parseNotificationTarget(remoteMessage);
  if (!target) return;

  runWhenAppReady(() => {
    openNotificationTarget(target);
  });
}

function getForegroundChannel(target) {
  if (target.type === 'friend_request') return NOTIFICATION_CHANNELS.friendRequests;
  if (target.type === 'group_invite' || target.isGroup) return NOTIFICATION_CHANNELS.groups;
  return NOTIFICATION_CHANNELS.messages;
}

function getForegroundCopy(remoteMessage, target) {
  const notification = remoteMessage?.notification || {};
  const data = remoteMessage?.data || {};
  return {
    title: cleanString(notification.title) || cleanString(data.title) || 'Blink',
    body:
      cleanString(notification.body) ||
      cleanString(data.body) ||
      (target.type === 'friend_request' ? 'New friend request' : 'New message'),
  };
}

function handleForegroundRemoteMessage(remoteMessage) {
  const target = parseNotificationTarget(remoteMessage);
  if (!target) return;

  if (target.type === 'message' && target.chatId && target.chatId === activeNotificationChatId) {
    return;
  }

  const copy = getForegroundCopy(remoteMessage, target);
  showForegroundNotification({
    channelId: getForegroundChannel(target),
    title: copy.title,
    body: copy.body,
  });
}

/**
 * Wire up notification tap handlers. Must be called exactly once at app boot
 * (before the user's logged-in state is known). Returns an unsubscribe.
 */
export function attachNotificationHandlers() {
  ensureNotificationChannels();
  const unsubForeground = messaging().onMessage(handleForegroundRemoteMessage);

  // App was BACKGROUNDED when user tapped the notification.
  const unsubOpen = messaging().onNotificationOpenedApp(handleRemoteMessageTap);

  // App was QUIT when user tapped the notification — fires on launch only.
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        handleRemoteMessageTap(remoteMessage);
      }
    })
    .catch(() => {});

  return () => {
    unsubForeground();
    unsubOpen();
  };
}
