import { backendRequest } from '../api/backendClient';

export async function loadConnectableUsers() {
  const payload = await backendRequest('/api/users/connectable');
  return payload?.users || [];
}
