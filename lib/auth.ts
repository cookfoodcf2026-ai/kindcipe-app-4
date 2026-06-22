import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_KEY = "kindcipe_auth_token";
export const FAMILY_ID_KEY = "kindcipe_active_family_id";
export const BIOMETRIC_KEY = "kindcipe_biometric_enabled";

// ─── Token (SecureStore with biometric protection) ─────────────────────
export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
    requireAuthentication: false,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function saveAuthTokenFromResponse(data: unknown): Promise<void> {
  const token = (data as { token?: string } | null)?.token;
  if (token) {
    await saveAuthToken(token);
  }
}

// ─── Biometric ─────────────────────────────────────────────────────────
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const LocalAuthentication = require("expo-local-authentication");
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BIOMETRIC_KEY);
  return val === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRIC_KEY, "true");
    // Re-save token with biometric protection
    const token = await getAuthToken();
    if (token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
        requireAuthentication: true,
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
    // Re-save without biometric protection
    const token = await getAuthToken();
    if (token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
        requireAuthentication: false,
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const LocalAuthentication = require("expo-local-authentication");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "解鎖 Kindcipe",
      fallbackLabel: "使用密碼",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
