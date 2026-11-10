import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAuthToken, FAMILY_ID_KEY } from "./auth";
import { queryClient } from "./queryClient";

export interface ResetAuthStateOptions {
  clearToken?: () => Promise<void>;
  removeFamilyId?: () => Promise<void>;
  clearQueryCache?: () => void;
}

/**
 * Clear every piece of local auth state after logout / password change / reset.
 *
 * Clearing the token alone is not enough: a cached `auth.me` query plus
 * `hasToken=true` makes AuthGuard bounce the user straight back into the tabs
 * with no usable token. Wiping the React Query cache is what normal logout does.
 * Token/family removal is best-effort so a storage failure cannot block logout.
 */
export async function resetAuthState(options: ResetAuthStateOptions = {}): Promise<void> {
  const clearToken = options.clearToken ?? clearAuthToken;
  const removeFamilyId =
    options.removeFamilyId ?? (() => AsyncStorage.removeItem(FAMILY_ID_KEY));
  const clearQueryCache = options.clearQueryCache ?? (() => queryClient.clear());

  try {
    await clearToken();
  } catch {
    /* best-effort: never leave the user half-logged-out on a storage error */
  }
  try {
    await removeFamilyId();
  } catch {
    /* best-effort */
  }
  clearQueryCache();
}
