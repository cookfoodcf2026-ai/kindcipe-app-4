/**
 * 菜式類型（dishType）統一來源。
 *
 * Canonical value = 英文 key（同後端 classifyDishType 一致）。
 * 舊資料可能係中文（例如 recipe-editor 舊版存「主菜」「湯水」），
 * 一律經 normalizeDishType() 轉 key 之後先比較，避免中英對唔上。
 */

export type DishTypeKey =
  | "meat"
  | "seafood"
  | "vegetable"
  | "soup"
  | "carb"
  | "appetizer"
  | "dessert"
  | "drink"
  | "other";

export const DISH_TYPE_KEYS: DishTypeKey[] = [
  "meat",
  "seafood",
  "vegetable",
  "soup",
  "carb",
  "appetizer",
  "dessert",
  "drink",
  "other",
];

export const DISH_TYPE_ICONS: Record<DishTypeKey, string> = {
  meat: "restaurant-outline",
  seafood: "fish-outline",
  vegetable: "leaf-outline",
  soup: "water-outline",
  carb: "restaurant-outline",
  appetizer: "fast-food-outline",
  dessert: "ice-cream-outline",
  drink: "cafe-outline",
  other: "grid-outline",
};

// 中文（新舊）→ key
const ZH_TO_KEY: Record<string, DishTypeKey> = {
  "主菜": "meat",
  "肉類": "meat",
  "主菜（肉類）": "meat",
  "海鮮": "seafood",
  "海鮮/蛋白": "seafood",
  "蔬菜": "vegetable",
  "蔬菜/小炒": "vegetable",
  "湯": "soup",
  "湯水": "soup",
  "飯": "carb",
  "麵": "carb",
  "飯麵": "carb",
  "主食": "carb",
  "飯麵/主食": "carb",
  "前菜": "appetizer",
  "小食": "appetizer",
  "前菜/小吃": "appetizer",
  "前菜/小食": "appetizer",
  "甜品": "dessert",
  "飲品": "drink",
  "其他": "other",
};

/** 任何值（英文 key 或舊中文）→ canonical key；空 / 未知 → "other" */
export const normalizeDishType = (v?: string | null): DishTypeKey => {
  const raw = String(v ?? "").trim();
  if (!raw) return "other";
  if ((DISH_TYPE_KEYS as string[]).includes(raw)) return raw as DishTypeKey;
  return ZH_TO_KEY[raw] ?? "other";
};

/** 由菜名推斷（冇 dishType 時嘅兜底），永遠回一個 key */
export const inferDishTypeKeyFromName = (name: string): DishTypeKey => {
  const n = String(name || "");
  if (/湯$|湯水|煲湯|燉湯|老火湯|滾湯|湯羹|濃湯|清湯|羅宋湯|粟米湯|番茄湯|羹/.test(n)) return "soup";
  if (/糖水|西米露|布甸|布丁|啫喱|慕斯|雪糕|蛋糕|蛋撻|曲奇|奶凍|糕點|甜點|芝麻糊|紅豆沙|綠豆沙|楊枝甘露|芋圓/.test(n)) return "dessert";
  if (/水$|涼茶|竹蔗茅根|茅根水|山楂水|薏米水|蘆根|羅漢果|菊花茶|檸檬茶|雪梨水|陳皮水|汽水|果汁|茶飲/.test(n)) return "drink";
  if (/飯|炒飯|炊飯|燴飯|蓋飯|丼|粥|麵|拉麵|意粉|烏冬|米粉|米線|河粉|通粉|湯麵|撈麵|饅頭|餃子|雲吞/.test(n)) return "carb";
  if (/前菜|小食|小吃|沙律|沙拉|涼拌|春卷|頭盤/.test(n)) return "appetizer";
  if (/菜心|芥蘭|通菜|菠菜|生菜|白菜|椰菜|西蘭花|時蔬|素菜|青菜|蔬菜|南瓜|蘿蔔|薯仔|番茄|茄子|青椒|洋蔥|節瓜|勝瓜|苦瓜|西洋菜|冬瓜|青瓜|黃瓜|絲瓜|豆芽|豆角|青豆|毛豆|雲耳|木耳|菇|菌|芽菜/.test(n)) return "vegetable";
  if (/蒸魚|清蒸|炒蝦|蝦|蟹|鮑魚|魚|帶子|海參|花膠|龍蝦|石斑|魷魚|章魚|墨魚|三文魚|蜆|蠔|豆腐|豆卜|豆干|腐皮|蒸蛋|炒蛋|蛋/.test(n)) return "seafood";
  if (/排骨|牛|雞|豬|肉|鴨|鵝|羊|腩|雞翼|雞腿|雞髀|肉丸|叉燒|燒肉|豬扒|牛扒|雞扒|豬手|豬腳/.test(n)) return "meat";
  return "other";
};
