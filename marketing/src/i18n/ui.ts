export const languages = {
  "zh-HK": "中文",
  en: "English",
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = "zh-HK";

/** Public web app (login-gated product). All CTAs point here. */
export const WEBAPP_URL = "https://app.kindcipe.com";

/** Build a CTA URL into the web app login, with attribution params. */
export function ctaUrl(medium: string): string {
  const url = new URL("/login", WEBAPP_URL);
  url.searchParams.set("utm_source", "kindcipe-site");
  url.searchParams.set("utm_medium", medium);
  return url.href;
}

export const ui = {
  "zh-HK": {
    "site.name": "和諧食譜 Kindcipe",
    "nav.features": "功能",
    "nav.pricing": "定價",
    "nav.blog": "部落格",
    "nav.recipes": "食譜",
    "nav.faq": "常見問題",
    "nav.cta": "開始使用",
    "home.title": "今晚食咩？AI 一鍵搞掂",
    "home.description":
      "專為香港家庭設計的 AI 食譜 App：3餸1湯、雪櫃食材、家庭協作，一個 App 搞掂。",
    "home.ctaPrimary": "開始使用",
    "home.ctaSecondary": "了解更多",
    "home.note": "免安裝，用瀏覽器即刻開始。",
    "features.title": "功能一覽",
    "features.subtitle": "由諗食咩、買餸到落廚，Kindcipe 一個 App 幫你搞掂。",
    "features.f1.title": "AI 食譜匯入",
    "features.f1.desc": "貼上 Instagram / YouTube 連結或截圖，AI 自動拆解食材和步驟。",
    "features.f2.title": "排餐計劃",
    "features.f2.desc": "每週日曆安排早午晚餐，家庭成員可提出，管理員一鍵確認。",
    "features.f3.title": "買餸清單",
    "features.f3.desc": "食材自動分類，格價比較，一鍵跳轉落單。",
    "features.f4.title": "工人姐姐模式",
    "features.f4.desc": "雙語大字版、煮食術語翻譯，中英買餸清單一鍵傳送。",
    "features.f5.title": "家庭共享",
    "features.f5.desc": "QR Code 邀請家人，共享食譜與購物清單，設角色權限。",
    "features.f6.title": "烹飪模式",
    "features.f6.desc": "防螢幕熄滅，一步一步跟著做，內置計時器。",
    "features.cta": "開始使用",
    "footer.rights": "© 2026 和諧食譜 Kindcipe",
    "footer.privacy": "私隱政策",
    "footer.support": "支援",
  },
  en: {
    "site.name": "Kindcipe",
    "nav.features": "Features",
    "nav.pricing": "Pricing",
    "nav.blog": "Blog",
    "nav.recipes": "Recipes",
    "nav.faq": "FAQ",
    "nav.cta": "Get started",
    "home.title": "What's for dinner? One tap with AI",
    "home.description":
      "The AI recipe app built for Hong Kong families: 3 dishes + 1 soup, fridge-to-table, family collaboration.",
    "home.ctaPrimary": "Get started",
    "home.ctaSecondary": "Learn more",
    "home.note": "No install needed — start in your browser.",
    "features.title": "Everything Kindcipe does",
    "features.subtitle": "From deciding what to cook, to shopping and cooking — one app for the whole family.",
    "features.f1.title": "AI recipe import",
    "features.f1.desc": "Paste an Instagram / YouTube link or a screenshot — AI extracts the ingredients and steps.",
    "features.f2.title": "Meal planning",
    "features.f2.desc": "A weekly calendar for breakfast, lunch and dinner; members suggest, admins confirm.",
    "features.f3.title": "Shopping list",
    "features.f3.desc": "Auto-categorised ingredients with price comparison and one-tap ordering.",
    "features.f4.title": "Helper mode",
    "features.f4.desc": "Large bilingual text, cooking-term translation, and a one-tap Chinese/English shopping list.",
    "features.f5.title": "Family sharing",
    "features.f5.desc": "Invite family by QR code; share recipes and lists with role-based permissions.",
    "features.f6.title": "Cook mode",
    "features.f6.desc": "Keeps the screen awake with step-by-step guidance and built-in timers.",
    "features.cta": "Get started",
    "footer.rights": "© 2026 Kindcipe",
    "footer.privacy": "Privacy",
    "footer.support": "Support",
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split("/");
  return seg === "en" ? "en" : defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/** Remove the `/en` locale prefix, returning a locale-agnostic path. */
export function stripLocale(pathname: string): string {
  if (pathname === "/en" || pathname === "/en/") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

/** Prefix a locale-agnostic path for the given language. */
export function localizePath(pathname: string, lang: Lang): string {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return lang === defaultLang ? clean : `/en${clean}`;
}
