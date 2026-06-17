export const SOCKET_EVENTS = {
  CONNECTION_READY: 'connection:ready',
  CHAT_UPDATED: 'chat:updated',
  CHAT_REMOVED: 'chat:removed',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_STATUS_UPDATED: 'message:status-updated',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
} as const;
