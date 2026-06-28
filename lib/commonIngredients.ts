/**
 * Common ingredient types and helpers.
 *
 * The full ingredient list is now fetched from the backend API
 * (trpc.commonIngredient.list) and cached in memory.
 * This file provides:
 * - Type definitions matching the backend response
 * - A small offline fallback list (~30 items) for when the API is unavailable
 * - Local filter function that searches across all language fields
 * - Category key to label mapping for shopping item insertion
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommonIngredient = {
  id: number;
  categoryKey: string;
  defaultUnitKey: string | null;
  nameYue: string;
  nameZh: string;
  nameEn: string;
  nameFil: string | null;
  nameId: string | null;
  isActive: boolean;
  sortOrder: number;
};

// Shape returned to the UI (localized name + shopping-compatible category/unit)
export type CommonIngredientSuggestion = {
  id: number;
  name: string;
  category: string; // Chinese label for shopping_items.category
  unit?: string;
};

// ─── Category Key → Chinese Label Mapping ─────────────────────────────────────

export const CATEGORY_KEY_TO_LABEL: Record<string, string> = {
  vegetables: "蔬菜",
  fruits: "水果",
  meat: "肉類",
  seafood: "海鮮",
  dairy: "蛋奶",
  seasoning: "調味料",
  dryGoods: "乾貨",
  staple: "主食",
  beverage: "飲品",
  snacks: "零食",
  household: "日用品",
  cleaning: "家居清潔",
  personal: "個人護理",
  baby: "嬰幼兒",
  pet: "寵物用品",
  other: "其他",
};

// ─── Unit Key → Chinese Label Mapping ─────────────────────────────────────────

export const UNIT_KEY_TO_LABEL: Record<string, string> = {
  piece: "個",
  pack: "包",
  bottle: "支",
  can: "罐",
  box: "盒",
  catty: "斤",
  slice: "片",
  bunch: "扎",
  pair: "對",
  roll: "卷",
  cup: "杯",
  bag: "袋",
  clove: "瓣",
  stalk: "條",
  block: "塊",
  tree: "棵",
  strip: "條",
 朵: "朵",
};

// ─── Offline Fallback List (~30 most common items) ────────────────────────────
// Used only when the API cache is empty (first launch + no network).

export const OFFLINE_FALLBACK: CommonIngredient[] = [
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "番茄", nameZh: "番茄", nameEn: "Tomato", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "洋蔥", nameZh: "洋蔥", nameEn: "Onion", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "clove", nameYue: "蒜頭", nameZh: "蒜頭", nameEn: "Garlic", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "slice", nameYue: "薑", nameZh: "薑", nameEn: "Ginger", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "stalk", nameYue: "蔥", nameZh: "蔥", nameEn: "Spring Onion", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "白菜", nameZh: "白菜", nameEn: "Chinese Cabbage", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "菠菜", nameZh: "菠菜", nameEn: "Spinach", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "薯仔", nameZh: "薯仔", nameEn: "Potato", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "紅蘿蔔", nameZh: "紅蘿蔔", nameEn: "Carrot", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "vegetables", defaultUnitKey: "piece", nameYue: "青瓜", nameZh: "青瓜", nameEn: "Cucumber", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "meat", defaultUnitKey: "catty", nameYue: "豬肉", nameZh: "豬肉", nameEn: "Pork", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "meat", defaultUnitKey: "catty", nameYue: "牛肉", nameZh: "牛肉", nameEn: "Beef", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "meat", defaultUnitKey: "piece", nameYue: "雞", nameZh: "雞", nameEn: "Chicken", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "meat", defaultUnitKey: "piece", nameYue: "雞翼", nameZh: "雞翼", nameEn: "Chicken Wing", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seafood", defaultUnitKey: "piece", nameYue: "魚", nameZh: "魚", nameEn: "Fish", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seafood", defaultUnitKey: "catty", nameYue: "蝦", nameZh: "蝦", nameEn: "Shrimp", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "dairy", defaultUnitKey: "piece", nameYue: "雞蛋", nameZh: "雞蛋", nameEn: "Egg", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "dairy", defaultUnitKey: "box", nameYue: "牛奶", nameZh: "牛奶", nameEn: "Milk", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "dairy", defaultUnitKey: "slice", nameYue: "芝士", nameZh: "芝士", nameEn: "Cheese", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seasoning", defaultUnitKey: "pack", nameYue: "鹽", nameZh: "鹽", nameEn: "Salt", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seasoning", defaultUnitKey: "pack", nameYue: "糖", nameZh: "糖", nameEn: "Sugar", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seasoning", defaultUnitKey: "bottle", nameYue: "醬油", nameZh: "醬油", nameEn: "Soy Sauce", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "seasoning", defaultUnitKey: "bottle", nameYue: "蠔油", nameZh: "蠔油", nameEn: "Oyster Sauce", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "dryGoods", defaultUnitKey: "pack", nameYue: "米", nameZh: "米", nameEn: "Rice", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "dryGoods", defaultUnitKey: "pack", nameYue: "麵條", nameZh: "麵條", nameEn: "Noodles", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "beverage", defaultUnitKey: "bottle", nameYue: "水", nameZh: "水", nameEn: "Water", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "beverage", defaultUnitKey: "can", nameYue: "可樂", nameZh: "可樂", nameEn: "Cola", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "household", defaultUnitKey: "bottle", nameYue: "洗潔精", nameZh: "洗潔精", nameEn: "Dish Soap", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "household", defaultUnitKey: "pack", nameYue: "廁紙", nameZh: "廁紙", nameEn: "Toilet Paper", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
  { id: 0, categoryKey: "household", defaultUnitKey: "pack", nameYue: "紙巾", nameZh: "紙巾", nameEn: "Tissue", nameFil: null, nameId: null, isActive: true, sortOrder: 0 },
];

// ─── Local Filter (searches across all language fields) ───────────────────────

export const getCommonIngredientSuggestions = (
  ingredients: CommonIngredient[],
  query: string,
  limit = 20,
): CommonIngredientSuggestion[] => {
  if (!query.trim() || ingredients.length === 0) return [];
  const q = query.toLowerCase();

  const matched = ingredients.filter((ing) => {
    if (!ing.isActive) return false;
    return (
      ing.nameYue.toLowerCase().includes(q) ||
      ing.nameZh.toLowerCase().includes(q) ||
      ing.nameEn.toLowerCase().includes(q) ||
      (ing.nameFil && ing.nameFil.toLowerCase().includes(q)) ||
      (ing.nameId && ing.nameId.toLowerCase().includes(q))
    );
  });

  // Rank: exact match > startsWith > contains
  const ranked = matched.sort((a, b) => {
    const getRank = (ing: CommonIngredient) => {
      const fields = [ing.nameYue, ing.nameZh, ing.nameEn, ing.nameFil, ing.nameId]
        .filter(Boolean)
        .map((f) => f!.toLowerCase());
      if (fields.some((f) => f === q)) return 0; // exact
      if (fields.some((f) => f.startsWith(q))) return 1; // startsWith
      return 2; // contains
    };
    return getRank(a) - getRank(b);
  });

  return ranked
    .slice(0, limit)
    .map((ing) => ({
      id: ing.id,
      name: ing.nameYue,
      category: CATEGORY_KEY_TO_LABEL[ing.categoryKey] || "其他",
      unit: ing.defaultUnitKey ? (UNIT_KEY_TO_LABEL[ing.defaultUnitKey] || undefined) : undefined,
    }));
};

// ─── Convert API response to suggestion shape ─────────────────────────────────

export const toSuggestion = (ing: CommonIngredient): CommonIngredientSuggestion => ({
  id: ing.id,
  name: ing.nameYue,
  category: CATEGORY_KEY_TO_LABEL[ing.categoryKey] || "其他",
  unit: ing.defaultUnitKey ? (UNIT_KEY_TO_LABEL[ing.defaultUnitKey] || undefined) : undefined,
});
