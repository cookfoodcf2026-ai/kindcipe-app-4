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

/** @param {string} text @returns {FlavorConstraint} */
export const detectFlavorConstraint = (text) => {
  const raw = String(text ?? "");
  const neg = /(唔|不|無|冇|別|不要|勿)/;
  const spicy = /辛辣|麻辣|香辣|重辣|大辣/.test(raw) ||
    (/辣/.test(raw) && !neg.test(raw) && !/小辣|少辣|微辣/.test(raw));
  const light = /清淡|少油|少鹽|健康|輕盈|清心/.test(raw) || /(唔辣|不辣)/.test(raw);
  const exclusions = [];
  const grab = (re) => { const m = raw.match(re); if (m && m[1]) exclusions.push(m[1].trim()); };
  grab(/唔?食\s*([^\s，,。、！!？?]+)/);
  grab(/忌口[：:\s]*([^\s，,。、]+)/);
  grab(/不要\s*([^\s，,。、！!？?]+)/);
  grab(/(?:唔要|不要)\s*(辣|牛|豬|猪|羊|海鮮|海鲜|蝦|虾|蛋|花生|奶)/);
  return { spicy, light, exclusions: [...new Set(exclusions.filter(Boolean))] };
};
