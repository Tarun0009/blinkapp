import { Alert } from 'react-native';

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const FIREBASE_AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/network-request-failed': 'Check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/user-disabled': 'This account is disabled. Please contact support.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/wrong-password': 'Email or password is incorrect.',
};

const API_ERROR_MESSAGES = {
  BACKEND_TIMEOUT: 'The request took too long. Please try again.',
  BACKEND_UNREACHABLE: 'Unable to connect right now. Check your internet and try again.',
  BAD_REQUEST: 'Please check your details and try again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'That item is no longer available.',
  RATE_LIMITED: 'Slow down a bit — try that again in a moment.',
  UNAUTHORIZED: 'Your session expired. Please sign in again.',
};

function getErrorCode(error) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return error.code || error.statusCode || error.status;
}

function getStatusCode(error) {
  const code = getErrorCode(error);
  if (typeof code === 'number') {
    return code;
  }

  if (typeof error?.status === 'number') {
    return error.status;
  }

  if (typeof error?.statusCode === 'number') {
    return error.statusCode;
  }

  return undefined;
}

export function formatErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.publicMessage === 'string' && error.publicMessage.trim()) {
    return error.publicMessage;
  }

  if (typeof error.userMessage === 'string' && error.userMessage.trim()) {
    return error.userMessage;
  }

  const code = getErrorCode(error);
  if (typeof code === 'string') {
    if (FIREBASE_AUTH_MESSAGES[code]) {
      return FIREBASE_AUTH_MESSAGES[code];
    }

    if (API_ERROR_MESSAGES[code]) {
      return API_ERROR_MESSAGES[code];
    }
  }

  const status = getStatusCode(error);
  if (status === 400 || status === 422) {
    return fallback;
  }
  if (status === 401) {
    return API_ERROR_MESSAGES.UNAUTHORIZED;
  }
  if (status === 403) {
    return API_ERROR_MESSAGES.FORBIDDEN;
  }
  if (status === 404) {
    return API_ERROR_MESSAGES.NOT_FOUND;
  }
  if (status === 409) {
    return 'This action is already up to date.';
  }
  if (status >= 500) {
    return 'The service is having trouble. Please try again soon.';
  }

  return fallback;
}

export const getPublicErrorMessage = formatErrorMessage;

export function showErrorAlert(
  errorOrTitle,
  fallbackMessage = DEFAULT_ERROR_MESSAGE,
  title = 'Error',
) {
  if (
    typeof errorOrTitle === 'string' &&
    typeof fallbackMessage === 'string' &&
    title === 'Error' &&
    fallbackMessage !== DEFAULT_ERROR_MESSAGE
  ) {
    Alert.alert(errorOrTitle, fallbackMessage);
    return;
  }

  const message = formatErrorMessage(errorOrTitle, fallbackMessage);
  Alert.alert(title, message);
}
