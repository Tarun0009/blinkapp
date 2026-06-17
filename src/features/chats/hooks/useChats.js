import { useState, useEffect } from 'react';
import { subscribeToUserChats } from '../services/chatService';

export function useChats(uid) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToUserChats(
      uid,
      (list) => {
        setChats(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  return { chats, loading, error };
}
