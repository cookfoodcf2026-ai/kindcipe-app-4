import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import {
  hasAnsweredAnalyticsConsent,
  markAnalyticsConsentAnswered,
  setAnalyticsOptOut,
} from "@/lib/analytics";

const BRAND = "#013E77";

/**
 * 首啟一次性「匿名使用數據」同意卡（預設開啟 = opt-out）。
 * 只喺 analytics 已設定（有 PostHog key）時先出現；語言/導航都準備好之後先 mount。
 */
export function AnalyticsConsentCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
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
        <View style={s.card}>
          <Text style={s.title}>{t("analyticsConsent.title" as any)}</Text>
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
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 },
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
