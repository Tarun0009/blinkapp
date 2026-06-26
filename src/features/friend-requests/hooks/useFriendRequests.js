import { useState, useEffect, useCallback } from 'react';
import {
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  subscribeFriendRequests,
} from '../services/friendRequestService';

export function useFriendRequests(uid) {
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const handleError = (err) => {
      setError(err);
      setLoading(false);
    };

    const unsubscribe = subscribeFriendRequests(
      uid,
      ({ incoming, outgoing }) => {
        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
        setError(null);
        setLoading(false);
      },
      handleError,
    );

    return unsubscribe;
  }, [uid]);

  const sendRequest = useCallback(async (receiver, currentUserProfile) => {
    if (!uid) {
      throw new Error('Not authenticated');
    }

    const payload = await sendFriendRequest(uid, receiver, currentUserProfile);
    const request = payload?.request;
    if (request?.id) {
      setOutgoingRequests((current) => {
        const index = current.findIndex((item) => item.id === request.id);
        if (index === -1) return [request, ...current];

        const next = [...current];
        next[index] = { ...next[index], ...request };
        return next;
      });
    }
    return payload;
  }, [uid]);

  const acceptRequest = useCallback(async (request) => {
    const payload = await acceptFriendRequest(request);
    setIncomingRequests((current) => current.filter((item) => item.id !== request.id));
    return payload;
  }, []);

  const rejectRequest = useCallback(async (requestId) => {
    const payload = await rejectFriendRequest(requestId);
    setIncomingRequests((current) => current.filter((item) => item.id !== requestId));
    return payload;
  }, []);

  return {
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    sendRequest,
    acceptRequest,
    rejectRequest,
  };
}
