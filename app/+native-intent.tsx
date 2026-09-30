/**
 * Expo Router native intent — 攔截自訂 deep link，避免落入 +not-found。
 *
 * Share Extension（expo-share-intent）會用 `kindcipe://dataUrl=<scheme>ShareKey#<type>`
 * 打開 app，expo-router 本身無呢條 route → 會彈「頁面不存在」。
 *
 * 呢度用「寬鬆比對」將任何分享 deep link 導向 `/share` 中介頁；
 * ShareIntentBridge 再負責存 pending 並 push `/import`。
 * 就算呢層失效，+not-found 亦已改為自動 redirect（最後保險）。
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const p = String(path ?? "");
    // 寬鬆：大小寫不拘、dataUrl / sharekey / shareKey 都認
    if (/dataurl=/i.test(p) || /sharekey/i.test(p)) {
      return "/share";
    }
    return p || "/";
  } catch {
    // 永不 crash：任何錯誤一律返主畫面
    return "/(tabs)";
  }
}
