/**
 * useAuth — 認證狀態管理（Token-based 模式）
 *
 * 登入後 token 存於 AsyncStorage，tRPC 請求透過 Authorization: Bearer header 附帶。
 * 支援多廚房切換：activeFamilyId 存於 AsyncStorage，tRPC 請求附帶 X-Family-Id header。
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { clearAuthToken, FAMILY_ID_KEY } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [familyIdReady, setFamilyIdReady] = useState(false);

  // 從 AsyncStorage 恢復 activeFamilyId
  useEffect(() => {
    AsyncStorage.getItem(FAMILY_ID_KEY).then((id) => {
      if (id) setActiveFamilyId(id);
      setFamilyIdReady(true);
    });
  }, []);

  // 用 auth.me 確認登入狀態（依賴 Bearer token）
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 分鐘
  });

  const user = meQuery.data ?? null;
  const isAuthenticated = !!user;
  const isLoading = meQuery.isLoading;

  // 獲取用戶所有家庭
  const { data: families = [] } = trpc.family.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  // 自動選取默認家庭：若無 activeFamilyId，設為第一個
  useEffect(() => {
    if (familyIdReady && !activeFamilyId && families.length > 0) {
      const defaultId = String(families[0].id);
      setActiveFamilyId(defaultId);
      AsyncStorage.setItem(FAMILY_ID_KEY, defaultId);
    }
  }, [familyIdReady, activeFamilyId, families]);

  // 主動切換家庭
  const switchFamily = useCallback(
    async (familyId: string) => {
      setActiveFamilyId(familyId);
      await AsyncStorage.setItem(FAMILY_ID_KEY, familyId);
      // 不等待 invalidate，讓它在背景刷新
      utils.invalidate();
    },
    [utils],
  );

  // 獲取當前活躍家庭的詳細資料（後端根據 X-Family-Id header 決定回傳哪個家庭）
  const familyIdNum = activeFamilyId ? parseInt(activeFamilyId, 10) : undefined;
  const { data: activeFamily, refetch: refetchActiveFamily } = trpc.family.get.useQuery(
    familyIdNum ? { id: familyIdNum } : undefined,
    {
      enabled: isAuthenticated && !!activeFamilyId,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  );

  // 當前用戶在活躍家庭中的角色
  const familyRole = (() => {
    if (!activeFamily?.members || !user) return null;
    const myMember = activeFamily.members.find(
      (m: any) => m.userId === user.id,
    );
    return myMember?.familyRole ?? null;
  })();

  // 登出：先清本地（即時、可靠），再通知後端清 session cookie（best-effort）
  const localLogout = useCallback(async () => {
    try {
      await clearAuthToken();
      await AsyncStorage.removeItem(FAMILY_ID_KEY);
    } catch { /* ignore */ }
    setActiveFamilyId(null);
    // 立即清 auth.me cache，否則 AuthGuard 仍然見到舊 user 會彈返入 app（「登出唔到」）
    try { utils.auth.me.setData(undefined, null as any); } catch { /* ignore */ }
    utils.invalidate();
    router.replace("/login");
  }, [utils, router]);

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(() => {
    void localLogout();
    logoutMutation.mutate(); // 後端清 cookie，唔等佢
  }, [localLogout, logoutMutation]);

  const refreshAuth = useCallback(async () => {
    await utils.auth.me.invalidate();
  }, [utils]);

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    logoutAsync: logoutMutation.mutateAsync,
    logoutPending: logoutMutation.isPending,
    logoutError: logoutMutation.error,
    resetLogout: logoutMutation.reset,
    refreshAuth,
    activeFamily,
    activeFamilyId,
    familyRole,
    families,
    switchFamily,
  };
}
