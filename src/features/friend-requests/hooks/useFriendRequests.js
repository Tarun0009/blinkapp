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

    await sendFriendRequest(uid, receiver, currentUserProfile);
  }, [uid]);

  const acceptRequest = useCallback(async (request) => {
    return acceptFriendRequest(request);
  }, []);

  const rejectRequest = useCallback(async (requestId) => {
    return rejectFriendRequest(requestId);
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
