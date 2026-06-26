import { backendRequest } from '../../../api/backendClient';

function normalizeResult(result = {}) {
  return {
    ...result,
    message: result.message
      ? {
          ...result.message,
          createdAt: result.message.createdAt ? new Date(result.message.createdAt) : new Date(),
          editedAt: result.message.editedAt ? new Date(result.message.editedAt) : null,
          deletedAt: result.message.deletedAt ? new Date(result.message.deletedAt) : null,
        }
      : null,
  };
}

export function searchMessages(query, { chatId, limit } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return Promise.resolve([]);
  }

  const params = new URLSearchParams({ q });
  if (limit) {
    params.set('limit', String(limit));
  }

  const path = chatId
    ? `/api/chats/${chatId}/messages/search?${params.toString()}`
    : `/api/chats/search/messages?${params.toString()}`;

  return backendRequest(path).then((payload = {}) => (
    Array.isArray(payload.results) ? payload.results.map(normalizeResult) : []
  ));
}
