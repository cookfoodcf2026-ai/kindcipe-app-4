/**
 * Shared React Query client instance.
 *
 * Kept in its own module so non-component code (e.g. useAuth.logout) can call
 * `queryClient.clear()` to wipe ALL cached queries — critical for logout, since
 * a stale `auth.me` cache would otherwise let AuthGuard bounce the user back in.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 分鐘
      gcTime: 1000 * 60 * 10, // 10 分鐘，避免 cache 無限累積
      refetchOnWindowFocus: false, // RN 由 useAppStateRefetch hook 手動觸發
      refetchOnReconnect: true, // 斷網重連自動 refetch
      refetchIntervalInBackground: false, // 背景不輪詢
    },
  },
});
