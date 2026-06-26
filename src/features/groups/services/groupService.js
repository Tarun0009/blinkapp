import { backendRequest } from '../../../api/backendClient';

export function createGroupChat({ title, memberIds, photoURL }) {
  return backendRequest('/api/chats/groups', {
    method: 'POST',
    body: {
      title,
      memberIds,
      ...(photoURL ? { photoURL } : {}),
    },
  });
}

export function updateGroupChat(chatId, updates) {
  return backendRequest(`/api/chats/${chatId}/group`, {
    method: 'PATCH',
    body: updates,
  });
}

export function addGroupMembers(chatId, memberIds) {
  return backendRequest(`/api/chats/${chatId}/members`, {
    method: 'POST',
    body: { memberIds },
  });
}

export function removeGroupMember(chatId, memberId) {
  return backendRequest(`/api/chats/${chatId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export function updateGroupMemberRole(chatId, memberId, role) {
  return backendRequest(`/api/chats/${chatId}/members/${memberId}/role`, {
    method: 'PATCH',
    body: { role },
  });
}
