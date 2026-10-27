/**
 * useSubscription - 訂閱狀態管理
 *
 * 獲取當前家庭廚房的訂閱狀態，包括：
 * - status: "trial" | "active" | "free" | "expired"
 * - isPaid: 是否為付費用戶
 * - maxImportsPerMonth: 每月匯入上限 (Pro 100，Free 10)
 * - aiChatLimit: 每月 AI credits (Pro 250，Free 15)
 */
import { trpc } from "@/lib/trpc";

export function useSubscription() {
  const { data: subscription, isLoading, error, refetch } = trpc.subscription.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 分鐘
    retry: 1,
  });

  return {
    subscription,
    isLoading,
    error,
    refetch,
    isPaid: subscription?.isPaid ?? false,
    status: subscription?.status ?? "free",
    aiChatLimit: subscription?.aiChatLimit ?? 15,
    maxImportsPerMonth: subscription?.maxImportsPerMonth ?? 10,
  };
}
