/**
 * Meal intent / flavour constraint extraction (pure, testable).
 *
 * Extracted from app/ai-chef.tsx so it can be unit-tested without React/RN.
 * Plain JS + JSDoc types so it runs both in the app (Metro) and directly in Node.
 *
 * @typedef {{ dishes: number, soups: number, carb: boolean }} MealIntentCount
 * @typedef {{ spicy: boolean, light: boolean, exclusions: string[] }} FlavorConstraint
 */

const CN_NUM_MAP = {
  零: 0, 一: 1, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** @param {string} s @returns {number} */
export const parseCnOrDigit = (s) => {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return CN_NUM_MAP[s] ?? 0;
};

/** @param {string} text @returns {MealIntentCount | null} */
export const detectMealIntent = (text) => {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length > 40) return null;
  // 有疑問／動作詞 → 當自由對話，唔 intercept
  if (/(點|煮法|做法|食譜|邊度|邊到|買|唔食|忌口|點樣|教我|推介|介紹|推介下)/.test(raw)) return null;
  const carb = /飯|麵|米線|粥|意粉|烏冬|拉麵/.test(raw);
  const num = "[0-9一二兩三四五六七八九十]+";
  const dishWord = "[餸送菜]";
  const soupWord = "湯(?:水)?";
  // 容忍量詞：「兩個餸」「2道菜」「1碟」
  const full = raw.match(new RegExp(`(${num})\\s*[個道碟]?\\s*${dishWord}\\s*(?:同|加|and|,|，|、|\\s)*\\s*(${num})\\s*[個道碟]?\\s*${soupWord}`));
  if (full) {
    const dishes = parseCnOrDigit(full[1]);
    const soups = parseCnOrDigit(full[2]);
    if (dishes >= 1 && dishes <= 8 && soups >= 1 && soups <= 8) return { dishes, soups, carb };
  }
  const dishOnly = raw.match(new RegExp(`(${num})\\s*[個道碟]?\\s*${dishWord}`));
  if (dishOnly) {
    const dishes = parseCnOrDigit(dishOnly[1]);
    if (dishes >= 1 && dishes <= 8) return { dishes, soups: 0, carb };
  }
  return null;
};

// 避免詞前綴（問卷／自由輸入共用）。長詞排前面，避免「豬肉」被抽成「豬」。
const AVOID_PREFIX_RE = /^\s*(?:唔要|唔食|不要|忌口)\s*[：:]?\s*/;
const AVOID_TERMS = "海鮮|海鲜|豬肉|猪肉|雞肉|牛肉|羊肉|蝦|虾|蟹|魚|鱼|蛋|花生|奶|辣|豬|猪|牛|羊|雞|鸡";

/**
 * 合併多個避免清單：接受字串或陣列，正規化前綴、按標點 split、去重。
 * @param {...(string | string[] | null | undefined)} lists
 * @returns {string[]}
 */
export const mergeAvoidLists = (...lists) => {
  const out = [];
  for (const list of lists) {
    if (!list) continue;
    const values = Array.isArray(list) ? list : [list];
    for (const value of values) {
      for (const item of String(value ?? "").split(/[，,、;；]/)) {
        const cleaned = item.replace(AVOID_PREFIX_RE, "").trim();
        if (cleaned) out.push(cleaned);
      }
    }
  }
  return [...new Set(out)];
};

// 只認完整 diet 詞，唔准 match 單一個「素」（否則「素菜」「素雞」會誤觸）。
const DIET_RE = /素食|吃素|食素|純素|全素|蛋奶素|vegan|vegetarian/i;

/**
 * 由用戶原文抽取「素食」意圖。
 * @param {string} text
 * @returns {boolean}
 */
export const extractDiet = (text) => DIET_RE.test(String(text ?? ""));

/**
 * Meal 分類池：diet 時唔可以出現肉類／海鮮。
 * @param {boolean} diet
 * @returns {string[]}
 */
export const mealCategoryPool = (diet) => diet
  ? [
      "蔬菜/小炒（全蔬菜）",
      "豆腐/豆製品主菜（如豆腐/豆乾/腐竹）",
      "蛋類主菜（如蒸蛋/炒蛋/玉子燒）",
      "菇菌/其他蔬菜主菜（如菇菌/瓜類）",
    ]
  : [
      "肉類主菜（如豬/牛/雞）",
      "海鮮/其他蛋白主菜（如魚/蝦/豆腐蛋）",
      "蔬菜/小炒",
      "其他家常菜（如蛋/豆製品/麵飯）",
    ];

/**
 * Meal prompt 入面嘅 diet 指示句（後端靠文字 parse diet，所以一定要有「素食」）。
 * @param {boolean} diet
 * @returns {string}
 */
export const dietPromptLine = (diet) => diet
  ? "飲食要求：素食，唔要肉類、海鮮、魚蝦蟹（湯都唔可以用肉／海鮮）。"
  : "";

/**
 * 結構化 meal prompt（requestInstantRecipes）用嘅 diet 短句。
 * @param {boolean} diet
 * @returns {string}
 */
export const structuredMealDietHint = (diet) => diet
  ? "；素食（唔要肉類、海鮮、魚蝦蟹）"
  : "";

/** @param {string} text @returns {FlavorConstraint} */
export const detectFlavorConstraint = (text) => {
  const raw = String(text ?? "");
  const neg = /(唔|不|無|冇|別|不要|勿)/;
  const spicy = /辛辣|麻辣|香辣|重辣|大辣/.test(raw) ||
    (/辣/.test(raw) && !neg.test(raw) && !/小辣|少辣|微辣/.test(raw));
  const light = /清淡|少油|少鹽|健康|輕盈|清心/.test(raw) || /(唔辣|不辣)/.test(raw);
  const exclusions = [];
  // matchAll 全抽：一句可以有多個「唔要 X 唔要 Y」。
  const avoidRe = new RegExp(
    `(?:唔要|唔食|不要|忌口)\\s*[：:]?\\s*(${AVOID_TERMS}|[^\\s，,。、；;！!？?]+)`,
    "g",
  );
  for (const m of raw.matchAll(avoidRe)) {
    const value = String(m[1] ?? "").trim();
    if (value) exclusions.push(value);
  }
  return { spicy, light, exclusions: [...new Set(exclusions.filter(Boolean))] };
};

/**
 * 由 session 訊息重抽用戶講過嘅「唔要／唔食／忌口」，併入家庭預設避免清單。
 * 唔加 session 欄位、唔用 ref：每次由現有 messages 重新計算，零 migration。
 * @param {{ role?: string, content?: string }[] | null | undefined} messages
 * @param {{ allergens?: string | string[], dislikes?: string | string[] } | null | undefined} defaults
 * @returns {string[]}
 */
export const sessionAvoid = (messages, defaults) => {
  const exclusions = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role !== "user") continue;
    const content = typeof message.content === "string" ? message.content : "";
    exclusions.push(...detectFlavorConstraint(content).exclusions);
  }
  return mergeAvoidLists(defaults?.allergens, defaults?.dislikes, exclusions);
};
