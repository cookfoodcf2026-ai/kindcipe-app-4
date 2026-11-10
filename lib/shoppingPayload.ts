import { resolveShoppingPlannedDate } from "./shoppingBatch";

/**
 * Shopping batch payload helpers.
 *
 * The buy/shopping date the user picked in the UI must be sent explicitly,
 * both at the top level and on every item: reading it only off the confirmed
 * item objects is unsafe because the backend may fall back to the meal date.
 */

export type ShoppingBatchConfirmItem = {
  name: string;
  nameEn?: string;
  nameFil?: string;
  nameId?: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
  plannedDate?: string | null;
  recipeId?: string;
  recipeName?: string;
  fromMealPlanId?: number;
};

export type ShoppingBatchPayloadItem = {
  name: string;
  nameEn?: string;
  nameFil?: string;
  nameId?: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
  fromRecipeId?: string;
  fromRecipeName?: string;
  fromMealPlanId?: number;
  plannedDate: string;
};

export type ShoppingBatchPayload = {
  items: ShoppingBatchPayloadItem[];
  fromRecipeId?: string;
  fromRecipeName?: string;
  fromMealPlanId?: number;
  plannedDate: string;
};

/**
 * Copy the resolved date onto every item so a per-item backend reader can
 * never fall back to the meal date.
 */
export function withItemPlannedDate<T extends Record<string, unknown>>(
  items: readonly T[],
  plannedDate: string,
): (T & { plannedDate: string })[] {
  return items.map((item) => ({ ...item, plannedDate }));
}

/**
 * Build the `shopping.addBatch` payload for the IngredientPickerModal confirm
 * flow. The caller's picked date wins; when it is missing the shared resolver
 * derives the buy date from the meal date instead of sending `undefined`.
 */
export function buildShoppingBatchPayload(params: {
  items: readonly ShoppingBatchConfirmItem[];
  pickedDate?: string | null;
  mealDate?: string | null;
  today: string;
  fromRecipeId?: string;
  fromRecipeName?: string;
  fromMealPlanId?: number;
}): ShoppingBatchPayload {
  const plannedDate = resolveShoppingPlannedDate(params.pickedDate, params.mealDate, params.today);
  return {
    items: params.items.map((item) => ({
      name: item.name,
      nameEn: item.nameEn,
      nameFil: item.nameFil,
      nameId: item.nameId,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      fromRecipeId: item.recipeId,
      fromRecipeName: item.recipeName,
      fromMealPlanId: item.fromMealPlanId,
      plannedDate,
    })),
    fromRecipeId: params.fromRecipeId,
    fromRecipeName: params.fromRecipeName,
    fromMealPlanId: params.fromMealPlanId,
    plannedDate,
  };
}

/**
 * Optimistically align cached shopping rows with the date that was just used.
 * Only rows whose name was part of the confirmation are touched; the following
 * query invalidation remains the authoritative source of truth.
 */
export function applyPlannedDateToCachedItems<T extends { name?: string | null; plannedDate?: string | null }>(
  cached: readonly T[] | null | undefined,
  names: readonly (string | null | undefined)[],
  plannedDate: string | undefined,
): T[] | undefined {
  if (!cached || !plannedDate) return cached as T[] | undefined;
  const wanted = new Set(
    names.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean),
  );
  if (wanted.size === 0) return cached as T[];
  return cached.map((item) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    return name && wanted.has(name) ? { ...item, plannedDate } : item;
  });
}
