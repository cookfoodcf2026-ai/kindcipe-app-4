/**
 * 食材相關共用 helper
 * - 調味料判斷（isSeasoning）
 * - 食材分類（categorizeIngredient / detectCategory）
 * - 份量縮放（calcAdjustedQty）
 * - 同名食材合併 + 數字相加（mergeIngredients）
 *
 * 注意：呢個檔係 ai-chef.tsx / planner.tsx / recipe/[id].tsx / IngredientPickerModal.tsx
 * 共用嘅單一來源，請勿再喺個別檔案複製關鍵字清單。
 */

// ─── 調味料 / 家中常備 ──────────────────────────────────

/** 調味料關鍵字：放喺一個 Set，用 includes 做子字串匹配 */
export const SEASONING_KEYWORDS = [
  "鹽", "糖", "油", "醬油", "生抽", "老抽", "豉油", "蠔油",
  "麻油", "胡椒粉", "黑椒粉", "醋", "料酒", "米酒", "紹酒", "紹興酒",
  "雞粉", "味精", "生粉", "粟粉", "太白粉",
  "蒜蓉", "薑蓉", "蔥花",
  "八角", "花椒", "五香粉", "味醂",
] as const;

const SEASONING_KEYWORDS_LOWER: string[] = (SEASONING_KEYWORDS as readonly string[]).map((s) => s.toLowerCase());

/**
 * 判斷食材是否調味料／家中常備
 * 用子字串匹配，但會順序檢查（長字串優先由清單順序保證）
 */
export function isSeasoning(name: string): boolean {
  const n = name.toLowerCase();
  return SEASONING_KEYWORDS_LOWER.some((kw) => n.includes(kw));
}

/** 唔會跟住人數縮放嘅類別（調味、醬料） */
export const NON_SCALABLE_CATS = new Set(["調味料", "醬料", "乾貨"]);

// ─── 食材分類 ──────────────────────────────────────────

const CATEGORY_RULES: { cat: string; keywords: string[] }[] = [
  {
    cat: "蔬菜",
    keywords: [
      "菜心", "芥蘭", "西蘭花", "椰菜", "菠菜", "生菜", "白菜", "青菜",
      "蘿蔔", "紅蘿蔔", "白蘿蔔", "番茄", "蕃茄", "薯仔", "青瓜", "黃瓜",
      "茄子", "南瓜", "冬瓜", "絲瓜", "勝瓜", "洋蔥", "洋蔥", "芹菜", "韭菜",
      "豆", "芽", "菇", "木耳", "筍", "菜",
    ],
  },
  {
    cat: "肉類",
    keywords: [
      "排骨", "豬扒", "豬腩", "豬頸", "牛肉", "豬肉", "羊肉", "雞肉", "雞翼", "雞腿", "雞胸",
      "火腿", "臘肉", "腸", "丸", "扒", "腩", "柳",
      "雞", "豬", "牛", "羊", "鴨", "鵝",
    ],
  },
  {
    cat: "海鮮",
    keywords: [
      "魚", "蝦", "蟹", "貝", "魷魚", "章魚", "帶子", "蠔", "蜆", "蛤", "鮑魚", "海參", "螺",
    ],
  },
  { cat: "蛋奶", keywords: ["雞蛋", "蛋", "牛奶", "芝士", "牛油", "奶油", "奶"] },
  {
    cat: "主食",
    keywords: ["飯", "米", "麵", "粉絲", "米粉", "河粉", "烏冬", "意粉", "通粉", "麵包", "餃子", "雲吞"],
  },
  { cat: "調味料", keywords: [...(SEASONING_KEYWORDS as readonly string[])] },
  { cat: "乾貨", keywords: ["冬菇", "木耳", "金針", "蝦米", "瑤柱", "蓮子", "百合", "紅棗", "枸杞", "臘腸", "鹹蛋", "皮蛋", "腐乳", "乾"] },
];

/**
 * 以關鍵字將食材分類（中文）
 * 順序檢查，第一個命中嘅類別就返回
 */
export function categorizeIngredient(name: string): string {
  const n = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(kw)) return rule.cat;
    }
  }
  return "其他";
}

// ─── 份量縮放 ─────────────────────────────────────────

const SPOON_UNITS = new Set(["湯匙", "茶匙", "tbsp", "tsp", "匙"]);
const COUNTABLE_UNITS = new Set(["個", "隻", "條", "塊", "片", "支", "根", "包", "罐", "盤", "顆", "粒", "瓣", "棵", "碗", "碟", "杯"]);

/**
 * 按比例縮放食材份量
 * - 調味料／醬料唔縮放
 * - 湯匙/茶匙：四捨五入到 0.5
 * - 可數單位：四捨五入到整數
 * - 其他（g/ml 等）：四捨五入到整數
 */
export function calcAdjustedQty(rawQty: string, unit: string, category: string, ratio: number): string {
  const num = parseFloat(rawQty);
  if (isNaN(num) || ratio === 1) return rawQty;
  if (NON_SCALABLE_CATS.has(category)) return rawQty;
  const adj = num * ratio;
  if (SPOON_UNITS.has(unit)) {
    const r = Math.round(adj * 2) / 2;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  }
  return String(Math.round(adj));
}

// ─── 同名食材合併 ──────────────────────────────────────

export type MergeableIngredient = {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
};

/**
 * 合併同名（trim 後相同）食材：
 * - 如果數字同單位都一樣，份量相加
 * - 唔同單位或其中一個非數字 → 只保留第一個數量（並唔會丟失，因為叫 user 去核實）
 *
 * @returns 合併後嘅食材陣列（保留原本順序，重複項目會攞第一個）
 */
export function mergeIngredients<T extends MergeableIngredient>(list: T[]): T[] {
  const map = new Map<string, T>();
  const order: string[] = [];

  for (const ing of list) {
    const key = ing.name.trim();
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { ...ing });
      order.push(key);
      continue;
    }

    const existing = map.get(key)!;
    const a = existing.quantity != null ? String(existing.quantity) : "";
    const b = ing.quantity != null ? String(ing.quantity) : "";
    const ua = existing.unit ?? "";
    const ub = ing.unit ?? "";

    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb) && ua === ub && ua !== "") {
      // 同單位且數字 → 相加
      const sum = Math.round((na + nb) * 100) / 100;
      existing.quantity = String(sum);
    } else if (!isNaN(na) && !isNaN(nb) && ua === ub && ua === "") {
      // 冇單位但係數字 → 相加
      existing.quantity = String(Math.round((na + nb) * 100) / 100);
    }
    // 否則靜靜地保留第一份（唔再 push 多一行）
  }

  return order.map((k) => map.get(k)!);
}
