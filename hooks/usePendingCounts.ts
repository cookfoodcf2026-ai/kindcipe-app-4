import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { DateUtil } from "@/src/lib/DateUtil";

export function usePendingCounts() {
  const { data: mealPlans = [] } = trpc.mealPlan.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  // 排餐 badge：只計「當前週」嘅 pending（跟 planner screen 預設 view，避免 badge 有數但嗰週睇唔到）
  const plannerBadge = useMemo(() => {
    const monday = DateUtil.getThisMondayISO();
    const sunday = DateUtil.getThisSundayISO();
    return mealPlans.filter(
      (m) => m.status === "pending" && m.date >= monday && m.date <= sunday
    ).length;
  }, [mealPlans]);

  // 購物 badge：跟購物 screen 嘅 base filter（未買 + 冇日期或今日/未來），避免「吉但有數字」
  const shoppingBadge = useMemo(() => {
    const todayISO = DateUtil.todayISO();
    return shoppingItems.filter(
      (i) => i.status !== "bought" && (!i.plannedDate || i.plannedDate >= todayISO)
    ).length;
  }, [shoppingItems]);

  const pendingShoppingItems = useMemo(
    () => shoppingItems.filter((i) => i.status === "pending").length,
    [shoppingItems]
  );

  const unboughtShoppingItems = useMemo(
    () => shoppingItems.filter((i) => i.status === "active").length,
    [shoppingItems]
  );

  return {
    plannerBadge,
    shoppingBadge,
    shoppingPending: pendingShoppingItems,
    shoppingUnbought: unboughtShoppingItems,
  };
}
