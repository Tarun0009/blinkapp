import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { writeRateLimit } from '../../middleware/rate-limit.js';
import {
  getNotificationPreferences,
  registerDeviceToken,
  unregisterDeviceToken,
  updateNotificationPreferences,
} from './notifications.service.js';

const registerTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  appVersion: z.string().max(40).optional(),
});

const unregisterTokenSchema = z.object({
  token: z.string().min(10).max(4096),
});

const preferencesSchema = z.object({
  messagesEnabled: z.boolean().optional(),
  friendRequestsEnabled: z.boolean().optional(),
  groupInvitesEnabled: z.boolean().optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.post('/tokens', writeRateLimit, async (req, res, next) => {
  try {
    const { token, platform, appVersion } = registerTokenSchema.parse(req.body);
    await registerDeviceToken(req.auth!.user.id, token, platform, appVersion);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.delete('/tokens', writeRateLimit, async (req, res, next) => {
  try {
    const { token } = unregisterTokenSchema.parse(req.body);
    await unregisterDeviceToken(token, req.auth!.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/preferences', async (req, res, next) => {
  try {
    const prefs = await getNotificationPreferences(req.auth!.user.id);
    res.json({
      preferences: {
        messagesEnabled: prefs.messagesEnabled,
        friendRequestsEnabled: prefs.friendRequestsEnabled,
        groupInvitesEnabled: prefs.groupInvitesEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/preferences', writeRateLimit, async (req, res, next) => {
  try {
    const updates = preferencesSchema.parse(req.body);
    const prefs = await updateNotificationPreferences(req.auth!.user.id, updates);
    res.json({
      preferences: {
        messagesEnabled: prefs.messagesEnabled,
        friendRequestsEnabled: prefs.friendRequestsEnabled,
        groupInvitesEnabled: prefs.groupInvitesEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});
