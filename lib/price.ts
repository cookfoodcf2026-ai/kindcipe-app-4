import { Linking, Platform } from "react-native";

export function cleanIngredientName(name: string): string {
  return name
    .replace(/\s*\d+(\.\d+)?\s*(g|kg|ml|l|斤|兩|磅|包|個|條|隻|塊|份|碗|盒|罐|瓶|克|公斤|毫升|升|片|束|把|顆|粒|支|枝)/gi, "")
    .replace(/[一二三四五六七八九十百千]+[包個條隻塊份碗盒罐瓶片束把顆粒支枝]/g, "")
    .trim();
}

// Keep this list specific. Single-character/animal substrings used to mark
// eggs, milk and tofu as "fresh" and skipped the Consumer Council lookup.

const PRICE_KEYWORD_ALIASES: Record<string, string> = {
  "egg": "雞蛋",
  "eggs": "雞蛋",
  "egg white": "雞蛋",
  "egg whites": "雞蛋",
  "egg yolk": "雞蛋",
  "egg yolks": "雞蛋",
  "蛋白": "雞蛋",
  "蛋黃": "雞蛋",
  "milk": "牛奶",
  "protein powder": "蛋白粉",
  "whey protein": "蛋白粉",
  "蛋白粉": "蛋白粉",
  "乳清蛋白": "蛋白粉",
};

/** Display name (English) and data search name (Consumer Council is Chinese) are different. */
export function resolvePriceSearchKeyword(displayName: string, nameEn?: string, canonicalName?: string): string {
  const candidates = [nameEn, displayName, canonicalName].map((v) => String(v ?? "").trim()).filter(Boolean);
  for (const candidate of candidates) {
    const direct = PRICE_KEYWORD_ALIASES[candidate.toLowerCase()];
    if (direct) return direct;
  }
  const canonical = String(canonicalName ?? "").trim();
  if (canonical && /[\u3400-\u9fff]/.test(canonical)) return cleanIngredientName(canonical);
  return cleanIngredientName(displayName || nameEn || canonical);
}

export const FRESH_KEYWORDS = ["豬肉","牛肉","羊肉","雞肉","雞翼","雞腿","排骨","鮮魚","魚","蝦","蟹","帶子","蜆","菜心","菠菜","白菜","椰菜","生菜","芥蘭","通菜","番茄","茄子","青椒","薑","蒜頭","蔥","芹菜","蘿蔔","薯仔","洋蔥","蘑菇","冬菇"];
export const FRESH_NEGATIONS = ["雞蛋","牛奶","豆奶","豆腐","魚蛋","蝦米","魚乾","肉乾","豬肉乾","牛肉乾","菜乾","薯片","薯條"];
export const PROCESSED_SNACK_KEYWORDS = ["薯片","零食","忌廉味","燒烤味","芝士味","朱古力味","芝士波","蝦條","粟米片","爆谷","糖果","餅乾","曲奇"];

export function isFreshIngredient(name: string): boolean {
  if (FRESH_NEGATIONS.some(kw => name.includes(kw))) return false;
  return FRESH_KEYWORDS.some(kw => name.includes(kw));
}

export function isProcessedSnackName(name: string): boolean {
  return PROCESSED_SNACK_KEYWORDS.some(kw => name.includes(kw));
}

export function filterPriceResults(results: any[], keyword: string): any[] {
  if (!results || results.length === 0) return [];
  if (!isFreshIngredient(keyword)) return results;
  const filtered = results.filter((r) => {
    const fullName = `${r.brand || ""}${r.name || ""}`;
    return !isProcessedSnackName(fullName);
  });
  const sorted = [...filtered].sort((a, b) => {
    const aName = `${a.brand || ""}${a.name || ""}`;
    const bName = `${b.brand || ""}${b.name || ""}`;
    const aExact = aName.includes(keyword) ? 1 : 0;
    const bExact = bName.includes(keyword) ? 1 : 0;
    return bExact - aExact;
  });
  return sorted;
}

export const SM_STYLE: Record<string, { color: string; bg: string; border: string; logo: string }> = {
  WELLCOME:  { color: "#0066CC", bg: "#EFF6FF", border: "#BFDBFE", logo: "W" },
  PARKNSHOP: { color: "#C8102E", bg: "#FFF5F5", border: "#FECACA", logo: "P" },
  JASONS:    { color: "#2D6A4F", bg: "#F0FDF4", border: "#BBF7D0", logo: "J" },
  WATSONS:   { color: "#005BAC", bg: "#EFF6FF", border: "#BFDBFE", logo: "W" },
  AEON:      { color: "#E60012", bg: "#FFF1F2", border: "#FECDD3", logo: "A" },
  DCHFOOD:   { color: "#FF6B00", bg: "#FFF7ED", border: "#FED7AA", logo: "D" },
};

export const REDIRECT_PLATFORMS = [
  {
    name: "HKTVmall", nameEn: "HKTVmall", logo: "H", bg: "#FFF1F2", border: "#FECACA",
    url: (kw: string) => `https://www.hktvmall.com/hktv/zh/search_a?keyword=${encodeURIComponent(kw)}`,
    app: (kw: string) => `hktvmall://search?keyword=${encodeURIComponent(kw)}`,
    hint: "有 App 可直接開啟",
  },
  {
    name: "pandamart", nameEn: "pandamart 24/7超市", logo: "P", bg: "#FFF0F6", border: "#FBCFE8",
    url: (kw: string) => `https://www.foodpanda.hk/darkstore/x0ad/pandamart-24-7-supermarket-central/search?q=${encodeURIComponent(kw)}`,
    app: null,
    hint: "網頁版 / App 自動開啟",
  },
  {
    name: "惠康 Wellcome", nameEn: "Wellcome Supermarket", logo: "W", bg: "#EFF6FF", border: "#BFDBFE",
    url: (kw: string) => `https://www.wellcome.com.hk/zh-hant/search?keyword=${encodeURIComponent(kw)}`,
    app: null,
    hint: "裝有 App 自動開啟",
  },
  {
    name: "百佳 PARKnSHOP", nameEn: "PARKnSHOP", logo: "P", bg: "#FFF5F5", border: "#FECACA",
    url: (kw: string) => `https://www.pns.hk/zh-hk/search?text=${encodeURIComponent(kw)}`,
    app: null,
    hint: "裝有 App 自動開啟",
  },
  {
    name: "吉之島 AEON", nameEn: "AEON City Online", logo: "A", bg: "#FFF1F2", border: "#FECDD3",
    url: (kw: string) => `https://www.aeoncity.com.hk/kh_zh/catalogsearch/result/?q=${encodeURIComponent(kw)}`,
    app: null,
    hint: "網頁版",
  },
];

export async function openPlatform(p: typeof REDIRECT_PLATFORMS[0], keyword: string): Promise<boolean> {
  const webUrl = p.url(keyword);
  // On web, React Native's canOpenURL() always returns true. Trying hktvmall://
  // then opens a blank/unknown-scheme tab and never reaches the website.
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return false;
    try {
      const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
      return !!opened;
    } catch {
      return false;
    }
  }
  if (p.app) {
    try {
      const can = await Linking.canOpenURL(p.app(keyword));
      if (can) { await Linking.openURL(p.app(keyword)); return true; }
    } catch {}
  }
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch {
    return false;
  }
}
