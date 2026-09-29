/**
 * Expo Router native intent — 攔截自訂 deep link，避免落入 +not-found。
 *
 * Share Extension（expo-share-intent）會用 `kindcipe://dataUrl=<...>` 打開 app，
 * expo-router 本身無呢條 route → 會彈「頁面不存在」。
 * 呢度將 share deep link 導向 `/`，交由 ShareIntentBridge 處理（存 pending share 再匯入）。
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes("dataUrl=")) {
      return "/";
    }
    return path;
  } catch {
    return "/";
  }
}
