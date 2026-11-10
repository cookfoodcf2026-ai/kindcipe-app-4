import { buyDateForMeal } from "./shoppingDate";

/**
 * Resolve the buy date that goes into shopping.addBatch.plannedDate.
 *
 * The caller's picked date always wins (it may differ from the meal date).
 * When nothing was picked, derive it from the meal date so the payload is
 * never `undefined` (the old bug sent undefined and the backend fell back to
 * the meal date).
 */
export function resolveShoppingPlannedDate(
  pickedDate: string | null | undefined,
  mealDate: string | null | undefined,
  today: string,
): string {
  const picked = (pickedDate ?? "").trim();
  if (picked) return picked;
  const fallback = buyDateForMeal(mealDate ?? null, today);
  return fallback.ok ? fallback.date : today;
}

export interface ShoppingBatchItemResult {
  index?: number;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  action?: string;
  fromRecipeId?: string | null;
  fromMealPlanId?: string | null;
}

export interface ShoppingBatchResponse {
  success?: boolean;
  count?: number;
  merged?: number;
  items?: ShoppingBatchItemResult[];
}

export interface ShoppingBatchSummary {
  added: number;
  skipped: number;
  total: number;
  allSkipped: boolean;
  partial: boolean;
}

/**
 * shopping.addBatch returns HTTP 200 even when some items are rejected.
 * Count only items with `ok === true && !skipped`; never assume every
 * requested item was written.
 */
export function summarizeShoppingBatch(result: unknown, requestedCount = 0): ShoppingBatchSummary {
  const total = Math.max(0, requestedCount);
  const res =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as ShoppingBatchResponse)
      : null;
  const items = res && Array.isArray(res.items) ? res.items : null;

  if (items) {
    let added = 0;
    let skipped = 0;
    for (const item of items) {
      if (item && item.ok === true && !item.skipped) added += 1;
      else skipped += 1;
    }
    const itemTotal = Math.max(total, items.length);
    return {
      added,
      skipped,
      total: itemTotal,
      allSkipped: added === 0 && skipped > 0,
      partial: added > 0 && skipped > 0,
    };
  }

  // Legacy array response / no item breakdown: fall back to the server count.
  const added =
    res && typeof res.count === "number" ? Math.max(0, res.count) : total;
  const skipped = Math.max(0, total - added);
  return {
    added,
    skipped,
    total,
    allSkipped: total > 0 && added === 0,
    partial: added > 0 && skipped > 0,
  };
}
