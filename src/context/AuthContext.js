import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  changePassword as changePasswordService,
  deleteAccount as deleteAccountService,
  register,
  sendPasswordReset,
  signIn,
  signOut,
  subscribeToAuthState,
  updateAuthProfile,
} from '../features/auth/services/authService';
import {
  buildUserProfile,
  fetchCurrentUserProfile,
  patchCurrentUserProfile,
  syncUserProfile,
} from '../features/profile/services/userService';
import {
  getDeviceToken,
  registerDeviceToken,
  requestNotificationPermission,
  subscribeToTokenRefresh,
  unregisterDeviceToken,
} from '../features/notifications/services/notificationService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const firebaseUserRef = useRef(null);
  const lastRegisteredTokenRef = useRef(null);

  const registerForPushNotifications = useCallback(async () => {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const token = await getDeviceToken();
      if (!token) return;
      await registerDeviceToken(token);
      lastRegisteredTokenRef.current = token;
    } catch {
      // Push registration is best-effort — don't break login if FCM is misconfigured.
    }
  }, []);

  // Re-register if FCM rotates the token.
  useEffect(() => {
    const unsubscribe = subscribeToTokenRefresh(async (token) => {
      try {
        if (!firebaseUserRef.current) return;
        await registerDeviceToken(token);
        lastRegisteredTokenRef.current = token;
      } catch {
        // Best-effort.
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      firebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const baseProfile = buildUserProfile(firebaseUser);

      if (isMounted) {
        setUser(firebaseUser);
        setUserProfile(baseProfile);
        setLoading(false);
      }

      try {
        await syncUserProfile(baseProfile);
        const payload = await fetchCurrentUserProfile();
        if (isMounted && firebaseUserRef.current?.uid === firebaseUser.uid && payload?.user) {
          setUserProfile((current) => ({ ...current, ...payload.user }));
        }
      } catch {
        // Hydration is best-effort — the local Firebase profile already covers basic UI.
      }

      registerForPushNotifications();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [registerForPushNotifications]);

  const login = useCallback(async (email, password) => {
    return signIn(email, password);
  }, []);

  const signup = useCallback(async (email, password, displayName) => {
    const firebaseUser = await register(email, password, displayName);

    if (firebaseUser) {
      const profile = buildUserProfile(firebaseUser, { displayName });
      setUserProfile(profile);
      syncUserProfile(profile).catch(() => {});
    }

    return firebaseUser;
  }, []);

  const logout = useCallback(async () => {
    // Best-effort: unregister this device's push token BEFORE signing out so the
    // backend stops fanning out notifications to it. We do this while the
    // Firebase ID token is still valid.
    const token = lastRegisteredTokenRef.current;
    if (token) {
      try {
        await unregisterDeviceToken(token);
      } catch {
        // Ignore — stale tokens are pruned server-side when FCM rejects them.
      }
      lastRegisteredTokenRef.current = null;
    }
    await signOut();
  }, []);

  const resetPassword = useCallback(async (email) => {
    return sendPasswordReset(email);
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!firebaseUserRef.current) throw new Error('Not authenticated');

      const payload = await patchCurrentUserProfile(updates);
      const serverUser = payload?.user || {};

      await updateAuthProfile(firebaseUserRef.current, {
        displayName: serverUser.displayName,
        photoURL: serverUser.photoURL,
      });

      setUserProfile((current) => ({
        ...buildUserProfile(firebaseUserRef.current),
        ...current,
        ...serverUser,
      }));

      return serverUser;
    },
    [],
  );

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await changePasswordService(currentPassword, newPassword);
  }, []);

  const deleteAccount = useCallback(async (currentPassword) => {
    await deleteAccountService(currentPassword);
    // Firebase auth state listener will fire and reset user/userProfile.
  }, []);

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      login,
      signup,
      logout,
      resetPassword,
      updateProfile,
      changePassword,
      deleteAccount,
    }),
    [
      user,
      userProfile,
      loading,
      login,
      signup,
      logout,
      resetPassword,
      updateProfile,
      changePassword,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
