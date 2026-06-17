import { badRequest } from './errors.js';

export function getRouteParam(value: string | string[] | undefined, name: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw badRequest(`Missing route parameter: ${name}`);
}
