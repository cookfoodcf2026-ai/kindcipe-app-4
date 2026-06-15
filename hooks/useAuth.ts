/**
 * useAuth — 認證狀態管理（Token-based 模式）
 *
 * 登入後 token 存於 AsyncStorage，tRPC 請求透過 Authorization: Bearer header 附帶。
 */
import { useCallback } from "react";
import { useRouter } from "expo-router";
import { clearAuthToken } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // 用 auth.me 確認登入狀態（依賴 Bearer token）
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 分鐘
  });

  const user = meQuery.data ?? null;
  const isAuthenticated = !!user;
  const isLoading = meQuery.isLoading;

  // 登出：清除後端 session 與本地 token
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await clearAuthToken();
      await utils.auth.me.invalidate();
      // 跳轉到登入頁
      router.replace("/login");
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  // 重新確認登入狀態（登入後呼叫）
  const refreshAuth = useCallback(async () => {
    await utils.auth.me.invalidate();
  }, [utils]);

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    refreshAuth,
  };
}
