import { useCallback } from 'react';
import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const IMAGE_OPTIONS = {
  mediaType: 'photo',
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
};

export function useImagePicker() {
  const pickFromGallery = useCallback(() => {
    return new Promise((resolve) => {
      launchImageLibrary(IMAGE_OPTIONS, (response) => {
        if (response.didCancel) {
          resolve(null);
          return;
        }
        if (response.errorCode || response.errorMessage) {
          Alert.alert('Image Picker Error', response.errorMessage || 'Unable to select image.');
          resolve(null);
          return;
        }
        resolve(response.assets?.[0]?.uri || null);
      });
    });
  }, []);

  const pickFromCamera = useCallback(() => {
    return new Promise((resolve) => {
      launchCamera(IMAGE_OPTIONS, (response) => {
        if (response.didCancel) {
          resolve(null);
          return;
        }
        if (response.errorCode || response.errorMessage) {
          Alert.alert('Camera Error', response.errorMessage || 'Unable to take a photo.');
          resolve(null);
          return;
        }
        resolve(response.assets?.[0]?.uri || null);
      });
    });
  }, []);

  const showPicker = useCallback(() => {
    return new Promise((resolve) => {
      Alert.alert('Send Image', 'Choose a source', [
        { text: 'Camera', onPress: async () => resolve(await pickFromCamera()) },
        { text: 'Gallery', onPress: async () => resolve(await pickFromGallery()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
  }, [pickFromCamera, pickFromGallery]);

  return { pickFromGallery, pickFromCamera, showPicker };
}
