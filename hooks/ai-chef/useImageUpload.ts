import { useState, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

interface UseImageUploadReturn {
  uploading: boolean;
  handleCamera: (onImageReady: (imageUrl: string) => void) => Promise<void>;
  handleImageLibrary: (onImageReady: (imageUrl: string) => void) => Promise<void>;
}

interface ImageUploadResult {
  imageUrl: string;
  base64?: string;
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const uploadLockRef = useRef(false);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('需要相機權限');
        return false;
      }
      return true;
    } catch (e) {
      Alert.alert('相機權限請求失敗');
      return false;
    }
  }, []);

  const captureImage = useCallback(async (): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      return result.assets[0].uri;
    } catch (e: any) {
      console.error('[useImageUpload] Camera capture failed:', e);
      Alert.alert('相機無法使用', '請用真機測試，或改用「從相簿選擇」。');
      return null;
    }
  }, []);

  const pickFromLibrary = useCallback(async (): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      return result.assets[0].uri;
    } catch (e) {
      console.error('[useImageUpload] Library pick failed:', e);
      return null;
    }
  }, []);

  const handleCamera = useCallback(async (onImageReady: (imageUrl: string) => void) => {
    if (uploading || uploadLockRef.current) return;

    uploadLockRef.current = true;
    setUploading(true);

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const imageUrl = await captureImage();
      if (imageUrl) {
        onImageReady(imageUrl);
      }
    } catch (e) {
      console.error('[useImageUpload] handleCamera failed:', e);
    } finally {
      setUploading(false);
      uploadLockRef.current = false;
    }
  }, [uploading, requestPermissions, captureImage]);

  const handleImageLibrary = useCallback(async (onImageReady: (imageUrl: string) => void) => {
    if (uploading || uploadLockRef.current) return;

    uploadLockRef.current = true;
    setUploading(true);

    try {
      const imageUrl = await pickFromLibrary();
      if (imageUrl) {
        onImageReady(imageUrl);
      }
    } catch (e) {
      console.error('[useImageUpload] handleImageLibrary failed:', e);
    } finally {
      setUploading(false);
      uploadLockRef.current = false;
    }
  }, [uploading, pickFromLibrary]);

  return {
    uploading,
    handleCamera,
    handleImageLibrary,
  };
}
