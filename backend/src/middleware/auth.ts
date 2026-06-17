import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import { getFriendlyDisplayName } from '../modules/users/users.mapper.js';

function getBearerToken(req: Request) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }

  return header.slice('Bearer '.length).trim();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const decodedToken = await verifyFirebaseToken(getBearerToken(req));
    const tokenDisplayName =
      decodedToken.name && decodedToken.name !== decodedToken.email && !decodedToken.name.includes('@')
        ? decodedToken.name
        : undefined;
    const user = await prisma.user.upsert({
      where: { firebaseUid: decodedToken.uid },
      update: {
        email: decodedToken.email ?? undefined,
        ...(tokenDisplayName ? { displayName: tokenDisplayName } : {}),
        photoURL: decodedToken.picture ?? undefined,
      },
      create: {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email ?? undefined,
        displayName: getFriendlyDisplayName(tokenDisplayName, decodedToken.email),
        photoURL: decodedToken.picture ?? undefined,
      },
    });

    req.auth = {
      firebaseUid: decodedToken.uid,
      user,
    };

    next();
  } catch (error) {
    console.error('Authentication failed', error);
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication failed',
    });
  }
}
