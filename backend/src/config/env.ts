import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  ALLOW_UNVERIFIED_AUTH: z
    .string()
    .optional()
    .transform(value => value === 'true'),
});

export const env = envSchema.parse(process.env);
