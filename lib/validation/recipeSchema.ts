/**
 * 食譜表單驗證 — 單一規則來源（Single Source of Truth）。
 *
 * 匯入（import.tsx）同自訂（recipe-editor.tsx）**共用**同一組核心規則，
 * 避免兩邊必填／驗證 drift。核心一致；各自獨有欄位（如自訂的 prepTime）用 options 開關。
 *
 * 註：原本建議用 Zod，但前端冇安裝 zod，臨近上架唔加新依賴 → 用純 TS 實作同等效果。
 */
import { isKnownCuisine, normalizeCuisine } from "@/lib/taxonomy";
import { normalizeDishType, type DishTypeKey } from "@/lib/dishType";

export type RecipeValidationInput = {
  name: string;
  category?: string | null;
  dishType?: string | null;
  tags: string;          // 空白/逗號分隔字串
  ingredients: { name?: string }[];
  steps: { instruction?: string }[];
  servings?: string | number | null;
  cookTime?: string | number | null;
  prepTime?: string | number | null;
};

export type RecipeValidationOptions = {
  /** 自訂食譜需要備料時間；匯入唔需要（AI 未必有）。 */
  requirePrepTime?: boolean;
};

export type RecipeValidationResult = {
  ok: boolean;
  /** 缺漏／格式錯誤的欄位（i18n key 或字串，供 Alert 顯示）。 */
  missing: string[];
};

const POSITIVE_INT = /^\d+$/;

export function splitTags(tags: string): string[] {
  return String(tags ?? "")
    .split(/[\s,，]+/)
    .map((x) => x.replace(/^#/, "").trim())
    .filter(Boolean);
}

/**
 * 驗證食譜表單。回傳缺漏清單；`ok = missing.length === 0`。
 * 匯入與自訂共用；只有規則一致，唔會再一邊嚴一邊鬆。
 */
export function validateRecipeForm(
  input: RecipeValidationInput,
  options: RecipeValidationOptions = {},
): RecipeValidationResult {
  const missing: string[] = [];

  // 名稱
  if (!String(input.name ?? "").trim()) missing.push("請輸入食譜名稱");

  // 分類（菜系）
  if (!isKnownCuisine(normalizeCuisine(input.category))) missing.push("分類");

  // 菜式類型
  if (!input.dishType || !normalizeDishType(input.dishType)) missing.push("菜式類型");

  // 常用標籤
  if (splitTags(input.tags).length === 0) missing.push("常用標籤");

  // 食材 / 步驟
  if ((input.ingredients ?? []).filter((i) => String(i?.name ?? "").trim()).length === 0) {
    missing.push("請至少輸入一種食材");
  }
  if ((input.steps ?? []).filter((s) => String(s?.instruction ?? "").trim()).length === 0) {
    missing.push("請至少輸入一個步驟");
  }

  // 份量 / 時間：正整數（非 NaN、非負）
  if (input.servings != null && String(input.servings).trim() !== "" && !POSITIVE_INT.test(String(input.servings).trim())) {
    missing.push("份量需為正整數");
  }
  if (input.cookTime != null && String(input.cookTime).trim() !== "" && !POSITIVE_INT.test(String(input.cookTime).trim())) {
    missing.push("烹調時間需為正整數（分鐘）");
  }
  if (options.requirePrepTime) {
    if (input.prepTime == null || String(input.prepTime).trim() === "" || !POSITIVE_INT.test(String(input.prepTime).trim())) {
      missing.push("備料時間需為正整數（分鐘）");
    }
  }

  return { ok: missing.length === 0, missing };
}

/** 菜式類型 key 是否合法（供表單判斷）。 */
export function isValidDishType(v?: string | null): v is DishTypeKey {
  return !!v && !!normalizeDishType(v);
}
