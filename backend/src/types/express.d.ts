import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        firebaseUid: string;
        user: User;
      };
    }
  }
}

export {};
