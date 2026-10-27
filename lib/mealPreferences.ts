export type MealPreferenceTime = "quick" | "normal" | "leisure";

export type MealPreferences = {
  servings: number;
  time: MealPreferenceTime;
  timeModes: MealPreferenceTime[];
  hasKids: boolean;
  hasElderly: boolean;
  dislikes: string[];
  allergens: string[];
};

export const DEFAULT_MEAL_PREFERENCES: MealPreferences = {
  servings: 4,
  time: "normal",
  timeModes: ["quick", "normal"],
  hasKids: false,
  hasElderly: false,
  dislikes: [],
  allergens: [],
};

/** Common allergens; these are treated as hard exclusions, not preferences. */
export const COMMON_ALLERGENS = [
  "花生",
  "堅果",
  "海鮮",
  "甲殼類",
  "蛋",
  "奶",
  "麩質",
  "大豆",
  "芝麻",
];

/** Common dislikes / dietary preferences. */
export const COMMON_DISLIKES = [
  "牛",
  "豬",
  "羊",
  "辣",
  "香菜",
  "內臟",
  "素食",
];

export function normalizeMealPreferences(raw: unknown): MealPreferences {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const servings = Number(value.servings);
  const legacyTime: MealPreferenceTime = value.time === "quick" || value.time === "leisure" ? value.time : "normal";
  const rawModes = Array.isArray(value.timeModes)
    ? value.timeModes.filter((mode): mode is MealPreferenceTime => mode === "quick" || mode === "normal" || mode === "leisure")
    : [];
  const timeModes: MealPreferenceTime[] = rawModes.length > 0 ? [...new Set(rawModes)] : (value.time ? [legacyTime] : DEFAULT_MEAL_PREFERENCES.timeModes);
  const time: MealPreferenceTime = timeModes[0] ?? legacyTime;
  const normalizeList = (input: unknown) =>
    Array.isArray(input)
      ? input.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : [];
  return {
    servings: Number.isInteger(servings) && servings >= 1 && servings <= 12
      ? servings
      : DEFAULT_MEAL_PREFERENCES.servings,
    time,
    timeModes,
    hasKids: value.hasKids === true,
    hasElderly: value.hasElderly === true,
    dislikes: normalizeList(value.dislikes),
    allergens: normalizeList(value.allergens),
  };
}
