import { Linking } from "react-native";

export function cleanIngredientName(name: string): string {
  return name
    .replace(/\s*\d+(\.\d+)?\s*(g|kg|ml|l|斤|兩|磅|包|個|條|隻|塊|份|碗|盒|罐|瓶|克|公斤|毫升|升|片|束|把|顆|粒|支|枝)/gi, "")
    .replace(/[一二三四五六七八九十百千]+[包個條隻塊份碗盒罐瓶片束把顆粒支枝]/g, "")
    .trim();
}

export const FRESH_KEYWORDS = ["洋蔥","豬","牛","雞","魚","蝦","蟹","豆腐","排骨","肉","菜","菠菜","白菜","椰菜","生菜","芥蘭","通菜","菜心","番茄","茄子","青椒","薑","蒜","蔥","芹菜","蘿蔔","薯","瓜","豆","芽","蘑菇","冬菇"];
export const PROCESSED_SNACK_KEYWORDS = ["薯片","零食","忌廉味","燒烤味","芝士味","朱古力味","芝士波","蝦條","粟米片","爆谷","糖果","餅乾","曲奇"];

export function isFreshIngredient(name: string): boolean {
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

export async function openPlatform(p: typeof REDIRECT_PLATFORMS[0], keyword: string) {
  if (p.app) {
    try {
      const can = await Linking.canOpenURL(p.app(keyword));
      if (can) { await Linking.openURL(p.app(keyword)); return; }
    } catch {}
  }
  await Linking.openURL(p.url(keyword));
}
