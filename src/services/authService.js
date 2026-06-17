import { EmailAuthProvider } from '@react-native-firebase/auth';
import { auth } from '../api/firebase';
import { backendRequest } from '../api/backendClient';

export function subscribeToAuthState(onChange) {
  return auth().onAuthStateChanged(onChange);
}

export function signIn(email, password) {
  return auth().signInWithEmailAndPassword(email, password);
}

export async function register(email, password, displayName) {
  const credential = await auth().createUserWithEmailAndPassword(email, password);

  if (credential.user && displayName) {
    await credential.user.updateProfile({ displayName });
  }

  return credential.user;
}

export function signOut() {
  return auth().signOut();
}

export function sendPasswordReset(email) {
  return auth().sendPasswordResetEmail(email);
}

export function updateAuthProfile(firebaseUser, updates) {
  if (!firebaseUser) {
    return Promise.resolve();
  }

  const authUpdates = {};
  if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
  if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;

  if (Object.keys(authUpdates).length === 0) {
    return Promise.resolve();
  }

  return firebaseUser.updateProfile(authUpdates);
}

export async function reauthenticate(currentPassword) {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser || !firebaseUser.email) {
    throw new Error('Not signed in.');
  }
  const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
  await firebaseUser.reauthenticateWithCredential(credential);
}

export async function changePassword(currentPassword, newPassword) {
  await reauthenticate(currentPassword);
  const firebaseUser = auth().currentUser;
  if (!firebaseUser) {
    throw new Error('Not signed in.');
  }
  await firebaseUser.updatePassword(newPassword);
}

/**
 * Order matters here: hit our backend first (while the Firebase ID token is
 * still valid) to cascade-delete the Postgres user row, then delete the
 * Firebase auth user. If the Firebase delete fails for any reason we are
 * already cleaned up on our side; the orphaned auth account can be retried.
 */
export async function deleteAccount(currentPassword) {
  await reauthenticate(currentPassword);
  await backendRequest('/api/users/me', { method: 'DELETE' });
  const firebaseUser = auth().currentUser;
  if (firebaseUser) {
    await firebaseUser.delete();
  }
}
