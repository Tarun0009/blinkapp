import { NativeModules, Platform } from 'react-native';

const { BlinkNotifications } = NativeModules;

export const NOTIFICATION_CHANNELS = {
  messages: 'messages',
  friendRequests: 'friend_requests',
  groups: 'groups',
};

export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android' || !BlinkNotifications?.createChannels) {
    return false;
  }

  try {
    return await BlinkNotifications.createChannels();
  } catch {
    return false;
  }
}

export async function showForegroundNotification({ channelId, title, body }) {
  if (Platform.OS !== 'android' || !BlinkNotifications?.showNotification) {
    return false;
  }

  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Blink';
  const safeBody = typeof body === 'string' && body.trim() ? body.trim() : 'New notification';

  try {
    return await BlinkNotifications.showNotification(channelId, safeTitle, safeBody);
  } catch {
    return false;
  }
}