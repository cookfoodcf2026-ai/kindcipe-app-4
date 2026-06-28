import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export function usePendingCounts() {
  const utils = trpc.useUtils();

  const { data: mealPlans = [] } = trpc.mealPlan.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 5000,
  });

  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 5000,
  });

  const pendingMealPlans = useMemo(
    () => mealPlans.filter((m) => m.status === "pending").length,
    [mealPlans]
  );

  const pendingShoppingItems = useMemo(
    () => shoppingItems.filter((i) => i.status === "pending").length,
    [shoppingItems]
  );

  const unboughtShoppingItems = useMemo(
    () => shoppingItems.filter((i) => i.status === "active").length,
    [shoppingItems]
  );

  return {
    plannerBadge: pendingMealPlans,
    shoppingBadge: pendingShoppingItems + unboughtShoppingItems,
    shoppingPending: pendingShoppingItems,
    shoppingUnbought: unboughtShoppingItems,
  };
}
