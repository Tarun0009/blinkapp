export const SOCKET_EVENTS = {
  ERROR: 'error',
  CONNECTION_READY: 'connection:ready',
  CHAT_UPDATED: 'chat:updated',
  CHAT_REMOVED: 'chat:removed',

  MESSAGE_NEW: 'message:new',
  MESSAGE_CREATED: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_STATUS_UPDATED: 'message:status-updated',
  MESSAGE_REMOVED: 'message:removed',

  FRIEND_REQUEST_UPDATED: 'friend-request:updated',

  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
};

export const SOCKET_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  OPEN: 'open',
  AUTHENTICATED: 'authenticated',
  BACKGROUND: 'background',
  CLOSED: 'closed',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};
