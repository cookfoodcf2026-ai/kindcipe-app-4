import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTH_TOKEN_KEY = "kindcipe_auth_token";

export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function saveAuthTokenFromResponse(data: unknown): Promise<void> {
  const token = (data as { token?: string } | null)?.token;
  if (token) {
    await saveAuthToken(token);
  }
}
