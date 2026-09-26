/**
 * 菜系（recipeCategory / cuisine）與常用標籤（tags）統一來源。
 *
 * 注意：舊官方食譜用英文「食材分類」存喺 recipeCategory
 * （poultry / pork / beef / seafood / vegetable / egg / carb / mixed），
 * 呢啲**唔係菜系**，normalizeCuisine() 會回 null（唔亂猜、唔誤導）。
 * 正確值要靠後端 AI backfill 修正。
 */

export type CuisineKey =
  | "中菜"
  | "西餐"
  | "日式"
  | "韓式"
  | "東南亞"
  | "港式"
  | "台式"
  | "泰式"
  | "印度"
  | "甜品"
  | "飲品"
  | "其他";

export const CUISINE_OPTIONS: { key: CuisineKey; icon: string }[] = [
  { key: "中菜", icon: "restaurant-outline" },
  { key: "西餐", icon: "leaf-outline" },
  { key: "日式", icon: "fish-outline" },
  { key: "韓式", icon: "flame-outline" },
  { key: "東南亞", icon: "restaurant-outline" },
  { key: "港式", icon: "storefront-outline" },
  { key: "台式", icon: "cafe-outline" },
  { key: "泰式", icon: "flame-outline" },
  { key: "印度", icon: "restaurant-outline" },
  { key: "甜品", icon: "star-outline" },
  { key: "飲品", icon: "cafe-outline" },
  { key: "其他", icon: "grid-outline" },
];

export const CUISINE_KEYS: string[] = CUISINE_OPTIONS.map((o) => o.key);

// 舊英文「食材分類」值 → 唔屬菜系，需 backfill 或由用戶重揀
export const LEGACY_CATEGORY_VALUES = new Set([
  "poultry", "pork", "beef", "seafood", "vegetable", "egg", "carb", "mixed",
]);

/** 任何值 → 已知菜系 key；空 / 舊值 / 未知 → null（唔假裝正確） */
export const normalizeCuisine = (v?: string | null): CuisineKey | null => {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  if (CUISINE_KEYS.includes(raw)) return raw as CuisineKey;
  return null;
};

export const isKnownCuisine = (v?: string | null): boolean => normalizeCuisine(v) !== null;

// 常用標籤（editor / import 共用）
export const SUGGESTED_TAGS = [
  "蒸", "炒", "炆", "焗", "煎", "炸", "燉", "涼拌", "烤", "紅燒",
  "清淡", "鹹香", "酸甜", "辛辣", "鮮味", "家常菜", "快手菜", "宴客菜",
  "高蛋白", "低卡", "素食", "減脂餐", "小朋友", "30 分鐘內",
];
