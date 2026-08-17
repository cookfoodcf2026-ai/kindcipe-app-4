import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

/**
 * useInvalidateMealPlanAndCart — 集中管理 mealPlan 同 shopping 嘅 invalidate
 *
 * 當任何「加入排餐」/「加入購物車」/「刪除排餐」動作成功之後，
 * 統一 call 呢個 hook 確保所有相關 query 都會即時 refresh，
 * 避免唔同入口寫唔同 invalidate set 引致「加咗但見唔到」嘅 sync 問題。
 */
export function useInvalidateMealPlanAndCart() {
  const utils = trpc.useUtils();

  return useCallback(async () => {
    await Promise.all([
      utils.mealPlan.listByDateRange.invalidate(),
      utils.mealPlan.list.invalidate(),
      utils.shopping.list.invalidate(),
      // shopping.listWithRecipeInfo 係 shopping tab 用嘅列表，都要一齊 refresh
      utils.shopping.listWithRecipeInfo.invalidate(),
    ]);
  }, [utils]);
}
