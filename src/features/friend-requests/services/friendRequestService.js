import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_EVENTS } from '../../../realtime/socketEvents';
import { backendRequest } from '../../../api/backendClient';

function upsertById(items, item) {
  const index = items.findIndex((existing) => existing.id === item.id);

  if (index === -1) {
    return [item, ...items];
  }

  const next = [...items];
  next[index] = { ...next[index], ...item };
  return next;
}

export function loadFriendRequests() {
  return backendRequest('/api/friend-requests');
}

export function subscribeFriendRequests(uid, onRequests, onError) {
  if (!uid) {
    return () => {};
  }

  let incoming = [];
  let outgoing = [];

  const emit = () => {
    onRequests({ incoming, outgoing });
  };

  let active = true;

  const refreshRequests = () => {
    loadFriendRequests()
      .then((payload = {}) => {
        if (!active) return;
        incoming = payload.incoming || [];
        outgoing = payload.outgoing || [];
        emit();
      })
      .catch(onError);
  };

  refreshRequests();

  const unsubscribeConnectionReady = realtimeClient.on(SOCKET_EVENTS.CONNECTION_READY, () => {
    if (!active) return;
    refreshRequests();
  });

  const unsubscribeUpdated = realtimeClient.on(
    SOCKET_EVENTS.FRIEND_REQUEST_UPDATED,
    (payload = {}) => {
      const request = payload.request || payload;
      if (!request?.id || (request.senderId !== uid && request.receiverId !== uid)) {
        return;
      }

      if (request.receiverId === uid) {
        incoming =
          request.status === 'pending'
            ? upsertById(incoming, request)
            : incoming.filter((item) => item.id !== request.id);
      }

      if (request.senderId === uid) {
        outgoing = upsertById(outgoing, request);
      }

      emit();
    },
  );

  const unsubscribeError = realtimeClient.on(SOCKET_EVENTS.ERROR, onError || (() => {}));

  return () => {
    active = false;
    unsubscribeConnectionReady();
    unsubscribeUpdated();
    unsubscribeError();
  };
}

export function sendFriendRequest(uid, receiver) {
  return backendRequest('/api/friend-requests', {
    method: 'POST',
    body: {
      receiverId: receiver.id,
    },
  });
}

export function acceptFriendRequest(request) {
  return backendRequest(`/api/friend-requests/${request.id}/accept`, {
    method: 'POST',
  });
}

export function rejectFriendRequest(requestId) {
  return backendRequest(`/api/friend-requests/${requestId}/reject`, {
    method: 'POST',
  });
}
