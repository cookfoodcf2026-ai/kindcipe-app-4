import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

const BRAND = "#013E77";

/**
 * /share — 分享中介頁（fallback destination）。
 *
 * 當 iOS Share Extension 用 `kindcipe://dataUrl=…` 開 app，+native-intent 會導向呢度。
 * 實際嘅資料處理交返 ShareIntentBridge / AuthGuard（它們會 push /import）。
 * 呢頁只係一個「安全落點」：萬一 ShareIntentBridge 冇即時 push（例如 cold start
 * 資料遲 1–2 秒），我哋都唔會顯示「頁面不存在」；若真係冇任何分享資料，就返主畫面。
 */
export default function ShareScreen() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // 等 ShareIntentBridge 處理（通常 <1s）；若 2.5s 後仍在呢頁 → 冇分享資料，返主畫面
    const id = setTimeout(() => {
      try { router.replace("/(tabs)"); } catch { /* ignore */ }
    }, 2500);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={BRAND} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" },
});
