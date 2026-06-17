import { BACKEND_CONFIG } from '../config/backend';
import { auth } from './firebase';

function buildUrl(path) {
  return `${BACKEND_CONFIG.apiBaseUrl}${path}`;
}

function buildNetworkError(error) {
  const nextError = new Error('');

  if (error?.name === 'AbortError') {
    nextError.message = 'Request timed out';
    nextError.code = 'BACKEND_TIMEOUT';
    nextError.isNetworkError = true;
    nextError.cause = error;
    return nextError;
  }

  nextError.message = 'Network request failed';
  nextError.code = 'BACKEND_UNREACHABLE';
  nextError.isNetworkError = true;
  nextError.cause = error;
  return nextError;
}

async function getAuthToken() {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  return currentUser.getIdToken();
}

async function parseResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.message || 'Request failed');
    error.code = payload?.error || (response.status === 429 ? 'RATE_LIMITED' : response.status);
    error.status = response.status;
    error.isBackendError = true;
    error.serverMessage = payload?.message;
    error.requestId = payload?.requestId || response.headers.get('x-request-id');
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      error.retryAfterSeconds = retryAfter ? Number(retryAfter) : null;
      error.isRateLimited = true;
    }
    throw error;
  }

  return payload;
}

export async function backendRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    authRequired = true,
    headers: customHeaders,
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_CONFIG.requestTimeoutMs);

  const headers = {
    Accept: 'application/json',
    ...customHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (authRequired) {
    const token = await getAuthToken();
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw buildNetworkError(error);
  } finally {
    clearTimeout(timeout);
  }

  return parseResponse(response);
}
