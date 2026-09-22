import i18n from "./i18n";

// 語言版透明 logo：中文 → 中文 logo；其他語言（en/fil/id）→ 英文 logo
export const LOGO_CHINESE = require("../assets/logo-chinese.png");
export const LOGO_LATIN = require("../assets/logo-latin.png");

export function getAppLogo() {
  return i18n.language === "zh-TW" ? LOGO_CHINESE : LOGO_LATIN;
}
