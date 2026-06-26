import { backendRequest } from '../../../api/backendClient';

export const REPORT_REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Something else' },
];

export function blockUser(userId) {
  return backendRequest(`/api/users/${userId}/block`, { method: 'POST' });
}

export function unblockUser(userId) {
  return backendRequest(`/api/users/${userId}/block`, { method: 'DELETE' });
}

export function fetchBlockedUsers() {
  return backendRequest('/api/users/blocked').then((payload) => payload?.blocks || []);
}

export function reportUser(userId, reason, details) {
  return backendRequest(`/api/users/${userId}/report`, {
    method: 'POST',
    body: { reason, ...(details ? { details } : {}) },
  });
}
