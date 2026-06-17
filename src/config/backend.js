import { NativeModules, Platform } from 'react-native';

const BACKEND_PORT = 4000;
const PRODUCTION_API_URL = 'https://your-production-api.example.com';

function getMetroHost() {
  const sourceCode = NativeModules.SourceCode;
  const scriptURL =
    sourceCode?.scriptURL ||
    sourceCode?.getConstants?.()?.scriptURL ||
    '';
  const match = scriptURL.match(/\/\/([^/:]+)(?::\d+)?\//);
  return match?.[1];
}

function isLoopbackHost(host) {
  return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function getLocalBackendUrl() {
  const metroHost = getMetroHost();

  if (metroHost && !isLoopbackHost(metroHost)) {
    return `http://${metroHost}:${BACKEND_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://localhost:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

const backendUrl = __DEV__ ? getLocalBackendUrl() : PRODUCTION_API_URL;

export const BACKEND_CONFIG = {
  apiBaseUrl: backendUrl,
  socketUrl: backendUrl,
  requestTimeoutMs: 10000,
};
