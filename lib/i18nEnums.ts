import i18n from "./i18n";
import { useTranslation } from "react-i18next";
import { CATEGORY_KEY_TO_LABEL, UNIT_KEY_TO_LABEL } from "./commonIngredients";

// ─── 中文 stored value → stable key ───────────────────────────────────────────
function reverse(m: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) if (!(v in r)) r[v] = k;
  return r;
}
const CATEGORY_ZH_TO_KEY = { ...reverse(CATEGORY_KEY_TO_LABEL), "湯水": "soup" };

// 補充單位（唔喺 UNIT_KEY_TO_LABEL 內嘅常用單位）
const EXTRA_UNITS: Record<string, string> = {
  "克": "g", "公斤": "kg", "毫升": "ml", "湯匙": "tbsp", "茶匙": "tsp",
  "碗": "bowl", "碟": "plate", "盤": "plate", "份": "serving", "粒": "grain",
  "根": "root", "朵": "flower", "隻": "piece", "套": "set", "排": "row",
};
const UNIT_ZH_TO_KEY: Record<string, string> = { ...reverse(UNIT_KEY_TO_LABEL), ...EXTRA_UNITS };

const DIFFICULTY_ZH_TO_KEY: Record<string, string> = { "簡單": "easy", "中等": "medium", "困難": "hard" };
const MEAL_ZH_TO_KEY: Record<string, string> = { "早餐": "breakfast", "午餐": "lunch", "晚餐": "dinner", "小食": "snack" };

// 中文難度 → key（同時支援已係 key 嘅值）
const DIFFICULTY_ANY: Record<string, string> = { ...DIFFICULTY_ZH_TO_KEY, easy: "easy", medium: "medium", hard: "hard" };

function resolve(kind: string, map: Record<string, string>, value: string): { key: string | undefined; fallback: string } {
  const v = String(value ?? "").trim();
  const key = map[v];
  return { key, fallback: v };
}

/** 非組件用（helper / constants）：用 i18n.t，搵唔到顯示原文 */
export const enumT = {
  category: (v: string): string => {
    const { key, fallback } = resolve("category", CATEGORY_ZH_TO_KEY, v);
    if (!key) return fallback;
    const k = `enums.category.${key}`;
    const out = String(i18n.t(k as any));
    return out === k ? fallback : out;
  },
  unit: (v: string): string => {
    const { key, fallback } = resolve("unit", UNIT_ZH_TO_KEY, v);
    if (!key) return fallback;
    const k = `enums.unit.${key}`;
    const out = String(i18n.t(k as any));
    return out === k ? fallback : out;
  },
  difficulty: (v: string): string => {
    const { key, fallback } = resolve("difficulty", DIFFICULTY_ANY, v);
    if (!key) return fallback;
    const k = `enums.difficulty.${key}`;
    const out = String(i18n.t(k as any));
    return out === k ? fallback : out;
  },
  meal: (v: string): string => {
    const { key, fallback } = resolve("meal", MEAL_ZH_TO_KEY, v);
    if (!key) return fallback;
    const k = `enums.meal.${key}`;
    const out = String(i18n.t(k as any));
    return out === k ? fallback : out;
  },
  weekday: (n: number): string => i18n.t(`enums.weekday.${((n % 7) + 7) % 7}` as any),
  month: (m: number): string => i18n.t(`enums.month.${m}` as any),
};

/** 組件用：語言切換會 re-render */
export function useEnum() {
  const { t } = useTranslation();
  const tr = (kind: string, key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    const k = `enums.${kind}.${key}`;
    const out = t(k as any);
    return out === k ? fallback : out;
  };
  return {
    category: (v: string): string => tr("category", CATEGORY_ZH_TO_KEY[String(v ?? "").trim()], String(v ?? "")),
    unit: (v: string): string => tr("unit", UNIT_ZH_TO_KEY[String(v ?? "").trim()], String(v ?? "")),
    difficulty: (v: string): string => tr("difficulty", DIFFICULTY_ANY[String(v ?? "").trim()], String(v ?? "")),
    meal: (v: string): string => tr("meal", MEAL_ZH_TO_KEY[String(v ?? "").trim()], String(v ?? "")),
    weekday: (n: number): string => t(`enums.weekday.${n}` as any),
    month: (m: number): string => t(`enums.month.${m}` as any),
  };
}
