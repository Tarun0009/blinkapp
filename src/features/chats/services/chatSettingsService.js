import { backendRequest } from '../../../api/backendClient';

export const MUTE_DURATIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Until I unmute', ms: null },
];

function patchPreferences(chatId, body) {
  return backendRequest(`/api/chats/${chatId}/preferences`, {
    method: 'PATCH',
    body,
  });
}

export function togglePin(chatId, pinned) {
  return patchPreferences(chatId, { pinned });
}

export function toggleArchive(chatId, archived) {
  return patchPreferences(chatId, { archived });
}

export function muteChat(chatId, durationMs) {
  const mutedUntil = durationMs
    ? new Date(Date.now() + durationMs).toISOString()
    : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  return patchPreferences(chatId, { mutedUntil });
}

export function unmuteChat(chatId) {
  return patchPreferences(chatId, { mutedUntil: null });
}

export function clearChat(chatId) {
  return patchPreferences(chatId, { clear: true });
}
