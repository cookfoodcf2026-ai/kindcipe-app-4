import i18n from "./i18n";

/**
 * Turn any thrown error into a message that is safe + friendly to show a user.
 *  - Known backend messages (intentionally user-facing) are mapped to localized text.
 *  - Other short Chinese messages are treated as intentional and shown as-is.
 *  - Raw technical errors (JSON/stack/English) fall back to a generic localized message.
 */
const BACKEND_MESSAGE_MAP: Array<[RegExp, string]> = [
  [/免費版每月最多建立\s*20\s*條自訂食譜/, "error.recipeLimit"],
  [/AI 編輯暫時只支援/, "error.aiEditLang"],
  [/無法解析此連結|無法解析/, "error.parseUrl"],
  [/請先登入|Please login|UNAUTHORIZED/, "error.needLogin"],
  [/No family found|找不到家庭/, "error.noFamily"],
  [/Access denied|FORBIDDEN/, "error.forbidden"],
  [/NOT_FOUND|找不到/, "error.notFound"],
  [/已存在|duplicate/i, "error.duplicate"],
  [/quota|額度/i, "error.quota"],
];

const TECHNICAL = /Unexpected|JSON|position \d|Cannot read|undefined is not|is not a function|TypeError|SyntaxError|ECONN|Network request failed|aborted|timeout|Failed to fetch|500|stack/i;

export function friendlyError(e: unknown, fallbackKey = "error.generic"): string {
  const raw = String((e as any)?.message ?? e ?? "").trim();
  if (!raw) return i18n.t(fallbackKey as any);

  for (const [re, key] of BACKEND_MESSAGE_MAP) {
    if (re.test(raw)) return i18n.t(key as any);
  }
  // Intentional user-facing message (short, Chinese, not technical) → show it.
  const hasCJK = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(raw);
  if (hasCJK && raw.length <= 80 && !TECHNICAL.test(raw)) return raw;

  return i18n.t(fallbackKey as any);
}
