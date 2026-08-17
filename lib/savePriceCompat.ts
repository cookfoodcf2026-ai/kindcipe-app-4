/**
 * savePrice 兼容層 — 統一處理舊後端未有 `shopping.savePrice` route 的情況。
 *
 * 新後端（`server/routers.ts` 有 `shoppingRouter.savePrice`）會直接寫入
 * purchaseHistory + 更新 estimatedPrice；舊後端未有此 route 時，會回傳
 * `No procedure found on path "shopping.savePrice"`。
 *
 * 呢度提供一個 fallback：用已部署嘅 `shopping.toggleBought` 兩段式
 * （先標記買入帶 actualPrice，再還原狀態）去記錄價格到 purchaseHistory，
 * 令「上次記錄價格」都可以正常顯示。
 */
import { apiClient } from "@/lib/trpc";

export function isSavePriceMissingRoute(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("no procedure found on path") && msg.includes("shopping.saveprice");
}

export async function savePriceViaToggleBoughtFallback(itemId: number, price: number): Promise<void> {
  await apiClient.shopping.toggleBought.mutate({ id: itemId, bought: true, actualPrice: price });
  await apiClient.shopping.toggleBought.mutate({ id: itemId, bought: false });
}