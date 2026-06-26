import AsyncStorage from '@react-native-async-storage/async-storage';

const CHATS_KEY = (uid) => `cache:chats:${uid}`;
const MESSAGES_KEY = (chatId) => `cache:messages:${chatId}`;
const PENDING_MESSAGES_KEY = (chatId) => `queue:messages:${chatId}`;

const MAX_CACHED_MESSAGES = 50;

async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage errors are non-fatal — the in-memory state is still authoritative.
  }
}

export function readCachedChats(uid) {
  if (!uid) return Promise.resolve([]);
  return readJson(CHATS_KEY(uid)).then((value) => (Array.isArray(value) ? value : []));
}

export function writeCachedChats(uid, chats) {
  if (!uid || !Array.isArray(chats)) return Promise.resolve();
  return writeJson(CHATS_KEY(uid), chats);
}

export function readCachedMessages(chatId) {
  if (!chatId) return Promise.resolve([]);
  return readJson(MESSAGES_KEY(chatId)).then((value) => (Array.isArray(value) ? value : []));
}

export function writeCachedMessages(chatId, messages) {
  if (!chatId || !Array.isArray(messages)) return Promise.resolve();
  return writeJson(MESSAGES_KEY(chatId), messages.slice(0, MAX_CACHED_MESSAGES));
}

export function readPendingMessages(chatId) {
  if (!chatId) return Promise.resolve([]);
  return readJson(PENDING_MESSAGES_KEY(chatId)).then((value) => (Array.isArray(value) ? value : []));
}

export function writePendingMessages(chatId, messages) {
  if (!chatId || !Array.isArray(messages)) return Promise.resolve();
  return writeJson(PENDING_MESSAGES_KEY(chatId), messages);
}

export async function clearUserCache(uid) {
  if (!uid) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const userScoped = keys.filter(
      (key) => key === CHATS_KEY(uid) || key.startsWith('cache:messages:') || key.startsWith('queue:messages:'),
    );
    if (userScoped.length) {
      await AsyncStorage.multiRemove(userScoped);
    }
  } catch {
    // ignored
  }
}
