import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const HEADER = 'x-request-id';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.length <= 80 ? incoming : randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
