/**
 * Expo Router native intent — 攔截自訂 deep link，避免落入 +not-found。
 *
 * Share Extension（expo-share-intent）會用 `kindcipe://dataUrl=<scheme>ShareKey#<type>`
 * 打開 app。呢度用「寬鬆比對」將分享 deep link 導向 `/import`（匯入頁）。
 *
 * 單一導航擁有者原則：導航一律交由 AuthGuard 處理；`/import` 只係一個明確落點，
 * 唔會有其他頁／timer 同佢爭。就算呢層失效，+not-found 亦唔會顯示錯誤。
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const p = String(path ?? "");
    // 只認真正嘅分享 deep link（dataUrl= / shareKey）。
    // ⚠️ 唔可以 match 任何 `kindcipe://`：正常啟動時 expo-router 會傳 `kindcipe:///`
    // （getRootURL fallback），若 match 就會令正常開 app 都閃去 /import。
    if (/dataurl=/i.test(p) || /sharekey/i.test(p)) {
      return "/import";
    }
    return p || "/";
  } catch {
    // 永不 crash：任何錯誤返主畫面
    return "/(tabs)";
  }
}
