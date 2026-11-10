import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import i18n from "./i18n";

export const AUTH_TOKEN_KEY = "kindcipe_auth_token";
export const FAMILY_ID_KEY = "kindcipe_active_family_id";
export const BIOMETRIC_KEY = "kindcipe_biometric_enabled";

/**
 * SecureStore is the ONLY acceptable storage for auth tokens in production.
 * 
 * AsyncStorage fallback is ONLY for:
 * - E2E tests (EXPO_PUBLIC_E2E=1) on iOS Simulator
 * 
 * ⚠️ WARNING: Do NOT use AsyncStorage for auth tokens in production.
 * It is unencrypted and is only acceptable for E2E testing on Simulator.
 */
const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";
const isE2ETest = process.env.EXPO_PUBLIC_E2E === "1";
// SecureStore has no web implementation. On web we fall back to AsyncStorage
// (localStorage-backed) AND rely on the httpOnly session cookie the backend sets.
// Web tokens live in localStorage only where a cookie cannot be used.
const useSecureStore = !isWeb && !(isIOS && isE2ETest);

// ─── Token (SecureStore with biometric protection) ─────────────────────
export async function saveAuthToken(token: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
      requireAuthentication: false,
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

/**
 * Read the token *and* distinguish "no token" from "storage failed".
 * A SecureStore/biometric read failure must not be confused with a logout.
 */
export async function getAuthTokenState(): Promise<{ token: string | null; error: unknown }> {
  try {
    const token = useSecureStore
      ? await SecureStore.getItemAsync(AUTH_TOKEN_KEY)
      : await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return { token, error: null };
  } catch (error) {
    return { token: null, error };
  }
}

export async function getAuthToken(): Promise<string | null> {
  const { token } = await getAuthTokenState();
  return token;
}

export async function clearAuthToken(): Promise<void> {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } else {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function saveAuthTokenFromResponse(data: unknown): Promise<void> {
  const token = (data as { token?: string } | null)?.token;
  if (token) {
    await saveAuthToken(token);
  }
}

// ─── Biometric ─────────────────────────────────────────────────────────
export async function isBiometricAvailable(): Promise<boolean> {
  if (isWeb) return false; // browsers have no device biometrics API for this
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    if (token && useSecureStore) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
        requireAuthentication: true,
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
    // Re-save without biometric protection
    const token = await getAuthToken();
    if (token && useSecureStore) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
        requireAuthentication: false,
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  if (isWeb) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LocalAuthentication = require("expo-local-authentication");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: i18n.t("auth.unlock" as any),
      fallbackLabel: i18n.t("auth.usePassword" as any),
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
