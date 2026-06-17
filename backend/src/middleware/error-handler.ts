import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../shared/http/errors.js';

function logServerError(error: unknown, req: Request) {
  const userId = req.auth?.user?.id ?? null;
  const payload = {
    level: 'error',
    requestId: req.id ?? null,
    method: req.method,
    path: req.originalUrl,
    userId,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  console.error(JSON.stringify(payload));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      requestId: req.id ?? null,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request payload is invalid.',
      details: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
      requestId: req.id ?? null,
    });
    return;
  }

  logServerError(error, req);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong on our end.',
    requestId: req.id ?? null,
  });
}
