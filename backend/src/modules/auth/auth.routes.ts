import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/session', requireAuth, (req, res) => {
  res.json({
    user: req.auth?.user,
  });
});
