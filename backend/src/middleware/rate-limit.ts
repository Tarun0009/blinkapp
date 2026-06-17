import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

const RATE_LIMITED_BODY = {
  error: 'RATE_LIMITED',
  message: 'You are doing that too fast. Try again in a moment.',
};

function viewerKey(req: Request) {
  const userId = req.auth?.user?.id;
  if (userId) {
    return `u:${userId}`;
  }
  return ipKeyGenerator(req.ip ?? '');
}

/**
 * Loose default cap applied to every request. Catches spray attacks without
 * tripping normal product use.
 */
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: RATE_LIMITED_BODY,
  keyGenerator: viewerKey,
});

/**
 * Tighter cap for any authenticated write — messages, friend requests, etc.
 * Keyed by user id so one logged-in user can't burst across many clients.
 */
export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: RATE_LIMITED_BODY,
  keyGenerator: viewerKey,
});

/**
 * Hard cap on report submissions to keep moderation queue clean.
 */
export const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'You can only submit a few reports per hour. Try again later.',
  },
  keyGenerator: viewerKey,
});

/**
 * Cap on profile updates so a buggy client or abuser cannot hammer username
 * availability or PATCH /me.
 */
export const profileRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: RATE_LIMITED_BODY,
  keyGenerator: viewerKey,
});
