import { PermissionsAndroid, Platform } from 'react-native';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import { backendRequest } from '../../../api/backendClient';

const APP_VERSION = '0.0.1';

function currentPlatform() {
  if (Platform.OS === 'android') return 'ANDROID';
  if (Platform.OS === 'ios') return 'IOS';
  return 'WEB';
}

/**
 * Ask the OS for notification permission. Returns true if the user granted it
 * (or if no permission is required on this platform). Safe to call multiple
 * times — the OS suppresses duplicate prompts after the first answer.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }

  // iOS (and older Android) flow through Firebase Messaging's own prompt.
  const status = await messaging().requestPermission();
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

export async function hasNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (!granted) return false;
  }

  const status = await messaging().hasPermission();
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Fetch the device's current FCM token. On iOS this throws unless APNs is set
 * up; we swallow the error and return null so the caller can decide what to do.
 */
export async function getDeviceToken() {
  try {
    return await messaging().getToken();
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to fetch FCM token', error);
    }
    return null;
  }
}

export function subscribeToTokenRefresh(handler) {
  return messaging().onTokenRefresh(handler);
}

export async function registerDeviceToken(token) {
  if (!token) return;
  await backendRequest('/api/notifications/tokens', {
    method: 'POST',
    body: {
      token,
      platform: currentPlatform(),
      appVersion: APP_VERSION,
    },
  });
}

export async function unregisterDeviceToken(token) {
  if (!token) return;
  await backendRequest('/api/notifications/tokens', {
    method: 'DELETE',
    body: { token },
  });
}

export async function fetchNotificationPreferences() {
  const payload = await backendRequest('/api/notifications/preferences');
  return payload?.preferences || null;
}

export async function updateNotificationPreferences(updates) {
  const payload = await backendRequest('/api/notifications/preferences', {
    method: 'PATCH',
    body: updates,
  });
  return payload?.preferences || null;
}
