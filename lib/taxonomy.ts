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

/**
 * 將 AI/自由文字標籤「對齊」到 SUGGESTED_TAGS（令 Common tags chips 亮起）。
 * AI 常回「減脂料理／懶人料理／快手／家常」等，需映射去既定詞彙。
 * 回傳：canonical 標籤（可能多個，已去重）＋ 未對應嘅原始標籤（保留在文字欄）。
 */
const TAG_SYNONYMS: Record<string, string[]> = {
  "蒸": ["蒸", "清蒸", "steam", "steamed"],
  "炒": ["炒", "小炒", "快炒", "stir", "stir-fry", "stirfry"],
  "炆": ["炆", "燜", "燉煮", "braise", "braised"],
  "焗": ["焗", "烤焗", "bake", "baked"],
  "煎": ["煎", "香煎", "pan-fry", "panfry", "fried"],
  "炸": ["炸", "氣炸", "deep-fry", "air-fry", "airfry"],
  "燉": ["燉", "炖", "煲", "老火", "stew", "stewed"],
  "涼拌": ["涼拌", "冷盤", "沙拉", "salad", "cold"],
  "烤": ["烤", "燒烤", "grill", "roast", "roasted", "bbq"],
  "紅燒": ["紅燒", "滷", "braised soy"],
  "清淡": ["清淡", "少油", "少鹽", "清爽", "light", "healthy"],
  "鹹香": ["鹹香", "惹味", "鹹", "savory", "savoury"],
  "酸甜": ["酸甜", "糖醋", "sweet and sour", "sweetandsour"],
  "辛辣": ["辛辣", "辣", "麻辣", "香辣", "spicy", "hot"],
  "鮮味": ["鮮味", "鮮", "鮮甜", "umami", "fresh"],
  "家常菜": ["家常", "家常菜", "住家", "home", "home-style", "homestyle"],
  "快手菜": ["快手", "快手菜", "懶人", "懶人料理", "簡單", "quick", "easy", "lazy"],
  "宴客菜": ["宴客", "宴客菜", "請客", "派對", "party", "festive"],
  "高蛋白": ["高蛋白", "蛋白質", "protein", "high-protein", "highprotein"],
  "低卡": ["低卡", "低熱量", "low calorie", "low-calorie", "lowcal"],
  "素食": ["素食", "素", "蔬食", "vegetarian", "vegan", "veggie"],
  "減脂餐": ["減脂", "減脂餐", "減脂料理", "減肥", "瘦身", "低脂", "diet", "fat loss", "lowfat"],
  "小朋友": ["小朋友", "兒童", "寶寶", "kid", "kids", "child", "toddler"],
  "30 分鐘內": ["30 分鐘內", "30分鐘", "半小時", "快", "30min", "30 min", "under 30"],
};

export function alignTagsToSuggested(rawTags: string[]): { canonical: string[]; extras: string[] } {
  const canonical = new Set<string>();
  const extras: string[] = [];
  for (const raw of rawTags) {
    const t = String(raw ?? "").replace(/^#/, "").trim();
    if (!t) continue;
    // 已經係 canonical
    if ((SUGGESTED_TAGS as string[]).includes(t)) { canonical.add(t); continue; }
    // 同義詞映射（用 includes 做子字串比對，處理「韓式減脂料理」等）
    const lower = t.toLowerCase();
    let matched = false;
    for (const [canon, syns] of Object.entries(TAG_SYNONYMS)) {
      if (syns.some((s) => lower.includes(s.toLowerCase()))) { canonical.add(canon); matched = true; }
    }
    if (!matched) extras.push(t);
  }
  return { canonical: [...canonical], extras };
}
