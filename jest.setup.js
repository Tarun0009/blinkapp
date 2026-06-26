/* eslint-env jest */

jest.mock('@react-native-firebase/auth', () => {
  const auth = jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn();
    }),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    createUserWithEmailAndPassword: jest.fn(() =>
      Promise.resolve({
        user: {
          uid: 'mock-user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: '',
          updateProfile: jest.fn(() => Promise.resolve()),
        },
      }),
    ),
    signOut: jest.fn(() => Promise.resolve()),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
  }));

  return auth;
});

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => ({
    requestPermission: jest.fn(() => Promise.resolve(1)),
    hasPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
  }));

  return {
    __esModule: true,
    default: messaging,
    AuthorizationStatus: {
      NOT_DETERMINED: -1,
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
  };
});

jest.mock('react-native-vector-icons/Feather', () => 'Feather');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => {
  const netInfo = {
    addEventListener: jest.fn((callback) => {
      callback({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
      });
      return jest.fn();
    }),
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
      }),
    ),
  };

  return {
    __esModule: true,
    default: netInfo,
    ...netInfo,
  };
});
