import auth from '@react-native-firebase/auth';

export { auth };
export const currentUid = () => auth().currentUser?.uid;
