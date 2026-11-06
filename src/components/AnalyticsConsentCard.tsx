import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, View, Text, TouchableOpacity, Switch, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  hasAnsweredAnalyticsConsent,
  markAnalyticsConsentAnswered,
  setAnalyticsOptOut,
} from "@/lib/analytics";

const BRAND = "#183B56";

/**
 * 首啟一次性「匿名使用數據」同意卡（預設開啟 = opt-out）。
 * 只喺 analytics 已設定（有 PostHog key）時先出現；語言/導航都準備好之後先 mount。
 *
 * 2026-11-05：改成唔會鎖死畫面
 *  - 內容 ScrollView，細螢幕／大字都睇得到掣
 *  - 右上角 ✕ 一定走得到（避免整頁撳唔到嘢）
 *  - safe area padding，瀏海／底部 bar 唔會遮住掣
 */
export function AnalyticsConsentCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    hasAnsweredAnalyticsConsent().then((answered) => {
      if (!cancelled && !answered) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  const handleContinue = async () => {
    await setAnalyticsOptOut(!on);
    await markAnalyticsConsentAnswered();
    setVisible(false);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleContinue}>
      <View style={s.overlay}>
        <View style={[s.card, { marginTop: insets.top + 12, marginBottom: insets.bottom + 12 }]}>
          <View style={s.head}>
            <Text style={s.title}>{t("analyticsConsent.title" as any)}</Text>
            <Pressable onPress={handleContinue} hitSlop={12} accessibilityLabel="close">
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>
          </View>
          <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={s.body}>{t("analyticsConsent.body" as any)}</Text>
            <View style={s.row}>
              <Text style={s.rowLabel}>{t("analyticsConsent.toggle" as any)}</Text>
              <Switch
                value={on}
                onValueChange={setOn}
                trackColor={{ false: "#D1D5DB", true: BRAND + "60" }}
                thumbColor={on ? BRAND : "#F9FAFB"}
              />
            </View>
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={s.btnTxt}>{t("analyticsConsent.continue" as any)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "92%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  scroll: { flexGrow: 0 },
  body: { fontSize: 14, color: "#4B5563", lineHeight: 20, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1A1A1A", marginRight: 12 },
  btn: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
