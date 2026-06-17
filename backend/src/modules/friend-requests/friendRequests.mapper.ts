import type { FriendRequest, User } from '@prisma/client';
import { getFriendlyDisplayName } from '../users/users.mapper.js';

type FriendRequestWithUsers = FriendRequest & {
  sender: User;
  receiver: User;
};

export function toApiFriendRequest(request: FriendRequestWithUsers) {
  return {
    id: request.id,
    senderId: request.sender.firebaseUid,
    receiverId: request.receiver.firebaseUid,
    senderName: getFriendlyDisplayName(request.sender.displayName, request.sender.email),
    receiverName: getFriendlyDisplayName(request.receiver.displayName, request.receiver.email),
    status: request.status.toLowerCase(),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}
