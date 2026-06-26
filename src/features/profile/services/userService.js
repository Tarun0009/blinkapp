import { backendRequest } from '../../../api/backendClient';

export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

export function buildUserProfile(firebaseUser, overrides = {}) {
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || '',
    username: null,
    bio: null,
    ...overrides,
  };
}

export function syncUserProfile(profile) {
  if (!profile?.uid) {
    return Promise.resolve(null);
  }

  return backendRequest('/api/users/me', {
    method: 'PATCH',
    body: {
      displayName: profile.displayName || undefined,
      photoURL: profile.photoURL || undefined,
    },
  });
}

export function fetchCurrentUserProfile() {
  return backendRequest('/api/users/me');
}

export function patchCurrentUserProfile(updates) {
  return backendRequest('/api/users/me', {
    method: 'PATCH',
    body: updates,
  });
}

export function checkUsernameAvailability(value) {
  const query = encodeURIComponent(String(value || '').trim());
  return backendRequest(`/api/users/username/availability?value=${query}`);
}
