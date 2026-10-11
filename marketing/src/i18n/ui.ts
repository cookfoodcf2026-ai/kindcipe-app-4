export const languages = {
  "zh-HK": "中文",
  en: "English",
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = "zh-HK";

/** Public web app (login-gated product). All CTAs point here. */
export const WEBAPP_URL = "https://app.kindcipe.com";

/** Kindcipe's own Instagram account. */
export const INSTAGRAM_URL = "https://www.instagram.com/kindcipe.app/";

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
    "home.igTitle": "追蹤我哋 Instagram",
    "home.igDesc": "最新食譜靈感同「今晚食咩」示範，日日更新。",
    "home.igCta": "追蹤 @kindcipe.app",
    "features.title": "功能一覽",
    "features.subtitle": "由諗食咩、買餸到落廚，Kindcipe 一個 App 幫你搞掂。",
    "features.f1.title": "AI 食譜匯入",
    "features.f1.desc": "貼上 Instagram / YouTube 連結或截圖，AI 自動拆解食材和步驟。",
    "features.f2.title": "排餐計劃",
    "features.f2.desc": "每週日曆安排早午晚餐，家庭成員可提出，管理員一鍵確認。",
    "features.f3.title": "買餸清單",
    "features.f3.desc": "食材自動分類，全家共享同一份購物清單，一鍵導出／分享。",
    "features.f4.title": "工人姐姐模式",
    "features.f4.desc": "雙語大字版、煮食術語翻譯，中英買餸清單一鍵傳送。",
    "features.f5.title": "家庭共享",
    "features.f5.desc": "QR Code 邀請家人，共享食譜與購物清單，設角色權限。",
    "features.f6.title": "烹飪模式",
    "features.f6.desc": "防螢幕熄滅，一步一步跟著做，內置計時器。",
    "features.cta": "開始使用",
    "pricing.title": "定價方案",
    "pricing.subtitle": "免費開始，需要時升級。免安裝，用瀏覽器即刻開始。",
    "pricing.free.name": "免費版",
    "pricing.free.price": "HK$0",
    "pricing.free.period": "永久免費",
    "pricing.free.f1": "IG 匯入累積 20 個",
    "pricing.free.f2": "廚房成員最多 6 人",
    "pricing.free.f3": "AI 助理每日 5 次",
    "pricing.free.f4": "排餐歷史 30 天",
    "pricing.paid.name": "付費版",
    "pricing.paid.price": "HK$30",
    "pricing.paid.period": "/月",
    "pricing.paid.badge": "推薦",
    "pricing.paid.f1": "無限食譜匯入",
    "pricing.paid.f2": "無限廚房成員",
    "pricing.paid.f3": "無限 AI 對話",
    "pricing.paid.f4": "購物清單匯出／分享",
    "pricing.paid.f5": "工人姐姐模式",
    "pricing.paid.f6": "多人排餐審批",
    "pricing.paid.yearly": "年費 HK$288（等於 HK$24/月）",
    "pricing.cta": "開始使用",
    "faq.title": "常見問題",
    "faq.q1": "Kindcipe 是什麼？",
    "faq.a1": "和諧食譜 Kindcipe 是專為香港家庭設計的 AI 食譜 App，支援 IG/YouTube 連結匯入、排餐計劃、買餸清單、工人姐姐雙語模式。",
    "faq.q2": "多少錢？",
    "faq.a2": "免費版提供基本功能；付費版 HK$30/月或 HK$288/年，解鎖無限匯入、工人模式同更多家庭成員。",
    "faq.q3": "支援工人姐姐嗎？",
    "faq.a3": "支援。工人姐姐模式提供雙語大字版食譜、煮食術語翻譯、中英買餸清單一鍵傳送。",
    "faq.cta": "開始使用",
    "support.title": "支援中心",
    "support.intro": "需要幫手？我們通常 1–2 個工作日內回覆。",
    "support.contactTitle": "聯絡我們",
    "support.contactNote": "請提供：帳戶電郵、問題描述、截圖（如有）、裝置型號與系統版本。",
    "support.faqTitle": "常見問題",
    "support.q1": "點樣取消訂閱？",
    "support.a1": "iOS：設定 → Apple ID → 訂閱 → Kindcipe → 取消。Android：Google Play → 訂閱 → Kindcipe → 取消。",
    "support.q2": "點樣刪除帳戶？",
    "support.a2": "App 內：設定 → 刪除帳戶。所有個人資料會被移除，此操作不可復原。",
    "support.q3": "AI 生成唔到食譜？",
    "support.a3": "請確認網絡連線正常，或稍後再試。免費版每日有使用上限。",
    "support.q4": "買餸清單點樣分享？",
    "support.a4": "購物清單頁 → 一鍵導出／分享，即可 Send 畀家人或姐姐。",
    "support.q5": "支援邊幾種語言？",
    "support.a5": "繁體中文、English、Filipino（Tagalog）、Bahasa Indonesia。可在「設定 → 顯示語言」切換。",
    "support.privacyTitle": "私隱",
    "support.privacyNote": "私隱政策：",
    "recipes.title": "食譜",
    "recipes.subtitle": "家常、湯水、宴客菜——全部可以一鍵排入餐單。",
    "recipes.cta": "開始使用",
    "recipes.ingredients": "食材",
    "recipes.steps": "步驟",
    "recipes.minutes": "分鐘",
    "recipes.back": "返回食譜",
    "blog.title": "部落格",
    "blog.subtitle": "用 AI 同家庭協作，重新諗「今晚食咩」。",
    "blog.readMore": "閱讀全文",
    "blog.cta": "開始使用",
    "blog.back": "返回部落格",
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
    "home.igTitle": "Follow us on Instagram",
    "home.igDesc": "Fresh recipe ideas and dinner inspiration, updated daily.",
    "home.igCta": "Follow @kindcipe.app",
    "features.title": "Everything Kindcipe does",
    "features.subtitle": "From deciding what to cook, to shopping and cooking — one app for the whole family.",
    "features.f1.title": "AI recipe import",
    "features.f1.desc": "Paste an Instagram / YouTube link or a screenshot — AI extracts the ingredients and steps.",
    "features.f2.title": "Meal planning",
    "features.f2.desc": "A weekly calendar for breakfast, lunch and dinner; members suggest, admins confirm.",
    "features.f3.title": "Shopping list",
    "features.f3.desc": "Auto-categorised ingredients, one shared shopping list for the family, one-tap export/share.",
    "features.f4.title": "Helper mode",
    "features.f4.desc": "Large bilingual text, cooking-term translation, and a one-tap Chinese/English shopping list.",
    "features.f5.title": "Family sharing",
    "features.f5.desc": "Invite family by QR code; share recipes and lists with role-based permissions.",
    "features.f6.title": "Cook mode",
    "features.f6.desc": "Keeps the screen awake with step-by-step guidance and built-in timers.",
    "features.cta": "Get started",
    "pricing.title": "Pricing",
    "pricing.subtitle": "Start free and upgrade when you need. No install — start in your browser.",
    "pricing.free.name": "Free",
    "pricing.free.price": "HK$0",
    "pricing.free.period": "forever",
    "pricing.free.f1": "Up to 20 imported recipes",
    "pricing.free.f2": "Up to 6 kitchen members",
    "pricing.free.f3": "5 AI requests per day",
    "pricing.free.f4": "30-day meal-plan history",
    "pricing.paid.name": "Pro",
    "pricing.paid.price": "HK$30",
    "pricing.paid.period": "/month",
    "pricing.paid.badge": "Popular",
    "pricing.paid.f1": "Unlimited recipe imports",
    "pricing.paid.f2": "Unlimited kitchen members",
    "pricing.paid.f3": "Unlimited AI chat",
    "pricing.paid.f4": "Shopping list export/share",
    "pricing.paid.f5": "Helper mode",
    "pricing.paid.f6": "Multi-member meal approvals",
    "pricing.paid.yearly": "Yearly HK$288 (≈ HK$24/month)",
    "pricing.cta": "Get started",
    "faq.title": "Frequently asked questions",
    "faq.q1": "What is Kindcipe?",
    "faq.a1": "Kindcipe is an AI recipe app built for Hong Kong families, with Instagram/YouTube import, meal planning, a shopping list, and a bilingual helper mode.",
    "faq.q2": "How much does it cost?",
    "faq.a2": "The free tier covers the basics; Pro is HK$30/month or HK$288/year and unlocks unlimited imports, helper mode and more family members.",
    "faq.q3": "Does it support domestic helpers?",
    "faq.a3": "Yes. Helper mode offers large bilingual recipes, cooking-term translation, and a one-tap Chinese/English shopping list.",
    "faq.cta": "Get started",
    "support.title": "Support",
    "support.intro": "Need a hand? We usually reply within 1–2 business days.",
    "support.contactTitle": "Contact us",
    "support.contactNote": "Please include: account email, a description of the issue, screenshots (if any), device model and OS version.",
    "support.faqTitle": "Frequently asked questions",
    "support.q1": "How do I cancel my subscription?",
    "support.a1": "iOS: Settings → Apple ID → Subscriptions → Kindcipe → Cancel. Android: Google Play → Subscriptions → Kindcipe → Cancel.",
    "support.q2": "How do I delete my account?",
    "support.a2": "In the app: Settings → Delete account. All personal data is removed and the action cannot be undone.",
    "support.q3": "AI won't generate a recipe?",
    "support.a3": "Check your network connection or try again later. The free tier has a daily usage limit.",
    "support.q4": "How do I share my shopping list?",
    "support.a4": "On the shopping list screen → one-tap export/share to send it to family or your helper.",
    "support.q5": "Which languages are supported?",
    "support.a5": "Traditional Chinese, English, Filipino (Tagalog) and Bahasa Indonesia, switchable in Settings → Display language.",
    "support.privacyTitle": "Privacy",
    "support.privacyNote": "Privacy policy:",
    "recipes.title": "Recipes",
    "recipes.subtitle": "Home-style dishes, soups and party food — all ready for your meal plan.",
    "recipes.cta": "Get started",
    "recipes.ingredients": "Ingredients",
    "recipes.steps": "Steps",
    "recipes.minutes": "min",
    "recipes.back": "Back to recipes",
    "blog.title": "Blog",
    "blog.subtitle": "Rethink dinner time with AI and family collaboration.",
    "blog.readMore": "Read more",
    "blog.cta": "Get started",
    "blog.back": "Back to blog",
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
