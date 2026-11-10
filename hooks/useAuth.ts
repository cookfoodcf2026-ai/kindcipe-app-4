/**
 * useAuth — 認證狀態管理（Token-based 模式）+ 全域 Provider
 *
 * 登入後 token 存於 AsyncStorage，tRPC 請求透過 Authorization: Bearer header 附帶。
 * 支援多廚房切換：activeFamilyId 存於 AsyncStorage，tRPC 請求附帶 X-Family-Id header。
 *
 * 注意：呢個係 React Context Provider（`AuthProvider`）→ 全部 screen 共用同一份
 * activeFamilyId／role，切廚房會即時同步所有已 mount 嘅 screen（以前係每個 screen
 * 各自一份 state，切完其他 screen 停留舊廚房）。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { getAuthTokenState, FAMILY_ID_KEY } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { resetAuthState } from "@/lib/hardLogout";
import {
  authMeRetryDelay,
  deriveAuthStatus,
  shouldRetryAuthMe,
  type AuthStatus,
} from "@/lib/authStatus";

type AuthValue = {
  user: any;
  isLoading: boolean;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  logout: () => void;
  logoutAsync: () => Promise<void>;
  /** Wipe local auth state (token + family + query cache) and go to /login. */
  hardLogout: () => Promise<void>;
  logoutPending: boolean;
  logoutError: unknown;
  resetLogout: () => void;
  refreshAuth: () => Promise<void>;
  activeFamily: any;
  activeFamilyId: string | null;
  familyRole: string | null;
  families: any[];
  switchFamily: (familyId: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [familyIdReady, setFamilyIdReady] = useState(false);
  // null = token state still unknown (read in flight, or storage failed)
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  const readTokenState = useCallback(async () => {
    const result = await getAuthTokenState();
    setHasToken(result.error ? null : !!result.token);
    setTokenChecked(true);
  }, []);

  // 從 AsyncStorage 恢復 activeFamilyId
  useEffect(() => {
    AsyncStorage.getItem(FAMILY_ID_KEY).then((id) => {
      if (id) setActiveFamilyId(id);
      setFamilyIdReady(true);
    });
  }, []);

  useEffect(() => {
    void readTokenState();
  }, [readTokenState]);

  // 用 auth.me 確認登入狀態（依賴 Bearer token）。
  // Retry only transient failures; a 401 must settle immediately.
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: (failureCount: number, error: unknown) => shouldRetryAuthMe(failureCount, error),
    retryDelay: (failureCount: number) => authMeRetryDelay(failureCount),
    staleTime: 1000 * 60 * 5, // 5 分鐘
  });

  const user = meQuery.data ?? null;
  const isLoading = meQuery.isLoading || !tokenChecked;
  const authStatus: AuthStatus = deriveAuthStatus({
    hasToken,
    data: meQuery.data,
    error: meQuery.error,
    isLoading,
  });
  // Backwards-compatible boolean for screens that only care about "definitely signed in".
  const isAuthenticated = authStatus === "authenticated";

  // 獲取用戶所有家庭
  const { data: families = [] } = trpc.family.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  // 選取／修正預設家庭：無 activeFamilyId，或 activeFamilyId 已唔存在（被刪/解散）→ 用第一個。
  useEffect(() => {
    if (!isAuthenticated || !familyIdReady || families.length === 0) return;
    const valid = activeFamilyId && families.some((f: any) => String(f.id) === activeFamilyId);
    if (!valid) {
      const next = String(families[0].id);
      setActiveFamilyId(next);
      AsyncStorage.setItem(FAMILY_ID_KEY, next);
    }
  }, [isAuthenticated, familyIdReady, families, activeFamilyId]);

  // 主動切換家庭（同步 server isDefault，令 header-less 請求都啱）
  const setActiveMutation = trpc.family.setActive.useMutation();
  const switchFamily = useCallback(
    async (familyId: string) => {
      setActiveFamilyId(familyId);
      await AsyncStorage.setItem(FAMILY_ID_KEY, familyId);
      const n = parseInt(familyId, 10);
      if (!isNaN(n)) { try { setActiveMutation.mutate({ familyId: n }); } catch { /* best-effort */ } }
      // 不等待 invalidate，讓它在背景刷新
      utils.invalidate();
    },
    [utils, setActiveMutation],
  );

  // 獲取當前活躍家庭的詳細資料（後端根據 X-Family-Id header 決定回傳哪個家庭）
  const familyIdNum = activeFamilyId ? parseInt(activeFamilyId, 10) : undefined;
  const { data: activeFamily } = trpc.family.get.useQuery(
    familyIdNum ? { id: familyIdNum } : undefined,
    {
      enabled: isAuthenticated && !!activeFamilyId,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  );

  // 當前用戶在活躍家庭中的角色。
  // `family.get` can still be loading/fail while `family.list` is already cached;
  // fall back to the list/ownerId so owner/admin controls are not silently disabled.
  const familyRole = (() => {
    if (!user) return null;
    const myMember = activeFamily?.members?.find(
      (m: any) => String(m.userId) === String(user.id),
    );
    if (myMember?.familyRole) return myMember.familyRole;
    if (activeFamily && String(activeFamily.ownerId) === String(user.id)) return "owner";
    const family = families.find((f: any) => String(f.id) === String(activeFamilyId));
    if (family?.role) return family.role;
    return (user as any)?.activeFamilyRole ?? null;
  })();

  // 登出／改密碼／重設密碼共用：清 token + family + 全部 cache，再返登入頁。
  // 只清 token 唔夠：殘留 auth.me cache + hasToken=true 會令 AuthGuard 彈返 app。
  const hardLogout = useCallback(async () => {
    await resetAuthState();
    setActiveFamilyId(null);
    setHasToken(false);
    setTokenChecked(true);
    router.replace("/login");
  }, [router]);

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(() => {
    void hardLogout();
    logoutMutation.mutate(); // 後端清 cookie，唔等佢
  }, [hardLogout, logoutMutation]);

  // logoutAsync：同一路徑，但返回 Promise（供 UI 顯示 pending／錯誤）。永不 reject（logout 一定要成功）。
  const logoutAsync = useCallback(async () => {
    try {
      await hardLogout();
    } finally {
      try { await logoutMutation.mutateAsync(); } catch { /* best-effort */ }
    }
  }, [hardLogout, logoutMutation]);

  const refreshAuth = useCallback(async () => {
    await readTokenState();
    await utils.auth.me.invalidate();
  }, [utils, readTokenState]);

  const value = useMemo<AuthValue>(() => ({
    user,
    isLoading,
    authStatus,
    isAuthenticated,
    logout,
    logoutAsync,
    hardLogout,
    logoutPending: logoutMutation.isPending,
    logoutError: logoutMutation.error,
    resetLogout: logoutMutation.reset,
    refreshAuth,
    activeFamily,
    activeFamilyId,
    familyRole,
    families,
    switchFamily,
  }), [
    user, isLoading, authStatus, isAuthenticated, logout, logoutAsync, hardLogout, logoutMutation.isPending,
    logoutMutation.error, logoutMutation.reset, refreshAuth, activeFamily, activeFamilyId,
    familyRole, families, switchFamily,
  ]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
