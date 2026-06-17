import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { chatsRouter } from './modules/chats/chats.routes.js';
import { friendRequestsRouter } from './modules/friend-requests/friendRequests.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { apiRateLimit, writeRateLimit } from './middleware/rate-limit.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  morgan.token('id', req => (req as express.Request).id || '-');
  app.use(
    morgan(
      env.NODE_ENV === 'production'
        ? ':id :remote-addr :method :url :status :res[content-length] - :response-time ms'
        : ':id :method :url :status :response-time ms',
    ),
  );

  app.use('/health', healthRouter);

  // Loose global limit on the API surface — catches spray attacks without
  // tripping legitimate product use.
  app.use('/api', apiRateLimit);

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/friend-requests', writeRateLimit, friendRequestsRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/chats/:chatId/messages', writeRateLimit, messagesRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
  app.use(errorHandler);

  return app;
}
