import { UNIT_KEY_TO_LABEL } from "./commonIngredients";

function reverse(m: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) if (!(v in r)) r[v] = k;
  return r;
}

const EXTRA_UNITS: Record<string, string> = {
  "克": "g", "公斤": "kg", "毫升": "ml", "湯匙": "tbsp", "茶匙": "tsp",
  "碗": "bowl", "碟": "plate", "盤": "plate", "份": "serving", "粒": "grain",
  "根": "root", "朵": "flower", "隻": "piece", "套": "set", "排": "row",
  "小匙": "tsp", "大匙": "tbsp", "匙": "spoon", "顆": "piece", "公克": "g",
  "兩": "tael", "錢": "mace", "磚": "block", "張": "sheet",
  "大束": "largeBunch", "頭": "head",
};

export const UNIT_ZH_TO_KEY: Record<string, string> = {
  ...reverse(UNIT_KEY_TO_LABEL),
  ...EXTRA_UNITS,
};

export const QUANTITY_ZH_TO_KEY: Record<string, string> = {
  "適量": "toTaste", "适量": "toTaste", "少量": "toTaste", "酌量": "toTaste",
  "隨意": "toTaste", "随意": "toTaste", "適量調味": "toTaste", "适量调味": "toTaste",
  "適量即可": "toTaste", "to taste": "toTaste",
  "少許": "pinch", "少许": "pinch", "少許調味": "pinch", "少许调味": "pinch",
  "pinch": "pinch",
};

export const QUANTITY_NUMBER_MAP: Record<string, string> = {
  "半": "½",
};

export const UNKNOWN_UNIT_FALLBACK_KEY = "portion";

export function isQuantityLabel(value: string): boolean {
  return Boolean(QUANTITY_ZH_TO_KEY[String(value ?? "").trim()]);
}

export function unitKeyFor(value: string): string | undefined {
  return UNIT_ZH_TO_KEY[String(value ?? "").trim()];
}

export function quantityKeyFor(value: string): string | undefined {
  return QUANTITY_ZH_TO_KEY[String(value ?? "").trim()];
}

export function quantityNumberFor(value: string): string | undefined {
  return QUANTITY_NUMBER_MAP[String(value ?? "").trim()];
}
