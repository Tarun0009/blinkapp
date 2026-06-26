import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { badRequest } from '../../shared/http/errors.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const uploadSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
  fileName: z.string().trim().max(140).optional(),
});

export const mediaRouter = Router();

function getPublicUrl(req: Request, fileName: string) {
  return `${req.protocol}://${req.get('host')}/uploads/media/${fileName}`;
}

function normalizeBase64(value: string) {
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

mediaRouter.post('/uploads', requireAuth, async (req, res, next) => {
  try {
    const input = uploadSchema.parse(req.body || {});
    const extension = ALLOWED_IMAGE_TYPES.get(input.mimeType);
    if (!extension) {
      throw badRequest('Only JPG, PNG, and WEBP images are supported.');
    }

    const buffer = Buffer.from(normalizeBase64(input.base64), 'base64');
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      throw badRequest('Image must be smaller than 5 MB.');
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads', 'media');
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    res.status(201).json({
      media: {
        url: getPublicUrl(req, fileName),
        path: `/uploads/media/${fileName}`,
        mimeType: input.mimeType,
        size: buffer.length,
        fileName: input.fileName || fileName,
      },
    });
  } catch (error) {
    next(error);
  }
});