export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string) {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function forbidden(message: string) {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function badRequest(message: string) {
  return new HttpError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string, code = 'CONFLICT') {
  return new HttpError(409, code, message);
}
