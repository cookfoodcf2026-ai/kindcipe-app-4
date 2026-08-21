import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

/**
 * useInvalidateRecipesAndWeekly — 集中管理 recipes 同 weeklyMenu 嘅 invalidate。
 *
 * 當 AI Chef 儲存 / 更新食譜，或週餐 / 排餐有變動之後，
 * 統一 call 呢個 hook 確保食譜庫、搜尋、週餐推薦都即時 refresh，
 * 避免「AI Chef 儲存咗但食譜庫 / planner 見唔到」嘅 sync 問題。
 */
export function useInvalidateRecipesAndWeekly() {
  const utils = trpc.useUtils();

  return useCallback(async () => {
    await Promise.all([
      utils.recipes.listUser.invalidate(),
      utils.recipes.search.invalidate(),
      utils.recipes.getDraft.invalidate(),
      utils.weeklyMenu.getWeek.invalidate(),
    ]);
  }, [utils]);
}
