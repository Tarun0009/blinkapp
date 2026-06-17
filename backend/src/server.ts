import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { connectRedis, redis } from './config/redis.js';
import { createSocketServer } from './realtime/socket.js';

async function main() {
  const app = createApp();
  const httpServer = createServer(app);
  createSocketServer(httpServer);

  await prisma.$connect();
  await connectRedis();

  httpServer.on('error', async error => {
    const isAddressInUse =
      error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';

    if (isAddressInUse) {
      console.error(`Port ${env.PORT} is already in use.`);
      console.error('Stop the existing backend process or change PORT in backend/.env.');
    } else {
      console.error('Backend server error');
      console.error(error);
    }

    await prisma.$disconnect();
    redis.disconnect();
    process.exit(1);
  });

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Blink backend listening on http://0.0.0.0:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/health`);
  });
}

main().catch(async error => {
  console.error('Failed to start Blink backend');
  console.error(error);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(1);
});
