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
  // Common auth / family / import backend messages (were leaking raw Chinese to fil/id users)
  [/食譜內容不足/, "error.recipeEmpty"],
  [/請先驗證你的電郵/, "error.verifyEmail"],
  [/驗證碼不正確|驗證碼發送失敗|缺少電郵或驗證碼/, "error.codeInvalid"],
  [/嘗試次數過多/, "error.tooMany"],
  [/此 email 已有帳號|此電郵已被使用|此 email 已連結到另一個帳號|已有帳號/, "error.emailTaken"],
  [/Google 帳號|Google 憑證|Google 驗證失敗/, "error.googleLinked"],
  [/帳號最多|最多建立 1 個廚房/, "error.kitchenLimit"],
  [/請先建立或加入家庭廚房|請先加入家庭廚房/, "error.needFamily"],
  [/廚房嘅成員|已被移出此廚房/, "error.notMember"],
  [/購物日期不能遲過排餐日/, "error.dateOrder"],
  [/圖片太大|不支援的圖片格式|缺少圖片/, "error.imageInvalid"],
  [/電郵或密碼錯誤|舊密碼不正確|登入失敗|建立帳號失敗|新密碼與確認密碼不一致|重設連結/, "error.authFailed"],
  [/無法解析此連結|無法解析/, "error.parseUrl"],
  [/請先登入|Please login|UNAUTHORIZED/, "error.needLogin"],
  [/No family found|找不到家庭/, "error.noFamily"],
  [/Access denied|FORBIDDEN/, "error.forbidden"],
  [/NOT_FOUND|找不到/, "error.notFound"],
  [/已存在|duplicate/i, "error.duplicate"],
  [/quota|額度/i, "error.quota"],
  // Purchases / subscriptions / trial codes
  [/網上付款暫時未開放|iapUnavailable/i, "error.iapUnavailable"],
  [/購買憑證驗證失敗|App Store 交易憑證|產品 ID 不符|未知產品 ID|Bundle ID 不符|未有訂閱記錄/, "error.purchaseFailed"],
  [/請輸入試用碼|試用碼無效|試用碼已過期|試用碼已用盡|試用已到期|兌換過試用碼/, "error.trial"],
  // Permissions / admin
  [/管理員帳號或密碼錯誤/, "error.adminAuth"],
  [/無權存取此檔案|需要客服權限|需要稽核權限/, "error.forbidden"],
  // Account / profile
  [/請輸入舊密碼/, "error.needOldPassword"],
  [/此 email 未有帳號|此 email 已有帳號|未有帳號|找不到此帳號/, "error.accountNotFound"],
  [/名稱不能為空/, "error.nameEmpty"],
  [/呢個登入方式已經係你嘅帳號/, "error.emailTaken"],
  [/此食譜已在你的食譜庫中/, "error.duplicate"],
  [/target 與 source 不可相同|無法識別要合併的帳號/, "error.mergeFailed"],
  [/太頻繁/, "error.tooMany"],
  [/截圖匯入係 Pro|screenshot.*Pro/i, "error.screenshotPro"],
  [/家庭不存在/, "error.noFamily"],
  [/AI 未返回結果|AI 返回格式錯誤/, "error.aiBadResponse"],
  // AI / LLM failure modes → give the user something actionable
  [/DASHSCOPE_API_KEY is not set|API key is not set|not configured/i, "error.aiNotConfigured"],
  [/GEMINI_API_KEY not set/i, "error.aiNotConfigured"],
  [/rate.?limit|too many requests|429|請求太頻繁/i, "error.aiBusy"],
  [/Network request failed|Failed to fetch|ECONN|timeout|aborted/i, "error.network"],
  [/AI returned empty|LLM 回覆格式異常|非 JSON|Unexpected character|JSON Parse/i, "error.aiBadResponse"],
];

const TECHNICAL = /Unexpected|JSON|position \d|Cannot read|undefined is not|is not a function|TypeError|SyntaxError|ECONN|Network request failed|aborted|timeout|Failed to fetch|500|stack/i;

export function friendlyError(e: unknown, fallbackKey = "error.generic"): string {
  const raw = String((e as any)?.message ?? e ?? "").trim();
  if (!raw) return i18n.t(fallbackKey as any);

  for (const [re, key] of BACKEND_MESSAGE_MAP) {
    if (re.test(raw)) return i18n.t(key as any);
  }
  // Intentional user-facing message (short, Chinese, not technical).
  // Only surface it verbatim to Chinese users; for other languages fall back to a
  // localized generic message so raw Chinese never leaks into fil/id/en UI.
  const hasCJK = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(raw);
  if (hasCJK && raw.length <= 80 && !TECHNICAL.test(raw)) {
    const lang = String((i18n as any)?.language || "zh").toLowerCase();
    if (lang.startsWith("zh")) return raw;
    return i18n.t(fallbackKey as any);
  }

  return i18n.t(fallbackKey as any);
}
