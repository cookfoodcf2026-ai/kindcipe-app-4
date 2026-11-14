import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * 免費帳號升級提示（Life360 式：插圖／一句價值／一個主掣／X）。
 * 只喺「額度接近用完」時由 ai-chef 觸發，頻率上限由呼叫方控制（AsyncStorage 7 日）。
 */
export default function FreeUpsellModal({
  visible,
  remaining,
  priceLabel,
  canPurchaseHere = true,
  onClose,
  onUpgrade,
  onHaveCode,
}: {
  visible: boolean;
  remaining?: number;
  priceLabel?: string;
  canPurchaseHere?: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onHaveCode?: () => void;
}) {
  const showPrice = canPurchaseHere && !!priceLabel;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <TouchableOpacity style={s.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="close">
            <Ionicons name="close" size={22} color="#5F6F80" />
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Text style={s.icon}>🍲</Text>
          </View>

          <Text style={s.title}>
            {remaining != null && remaining > 0
              ? `今個月仲有 ${remaining} 次 AI 生成`
              : "免費額度用完啦"}
          </Text>

          <Text style={s.body}>
            升級 Pro：一個廚房共用 150 AI credits + 100 次匯入，最多 4 位家人共用同一份餐單同買餸清單。
          </Text>

          <TouchableOpacity style={s.primary} onPress={onUpgrade} accessibilityRole="button">
            <Text style={s.primaryText}>
              {showPrice ? `升級 Pro — ${priceLabel}/月` : "了解 Pro"}
            </Text>
          </TouchableOpacity>

          {onHaveCode ? (
            <TouchableOpacity style={s.secondary} onPress={onHaveCode} accessibilityRole="button">
              <Text style={s.secondaryText}>有 Instagram 優惠碼？</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={s.later} onPress={onClose} accessibilityRole="button">
            <Text style={s.laterText}>稍後</Text>
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
    maxWidth: 380,
    backgroundColor: "#F3F0FF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: "center",
    ...(Platform.OS === "web" ? { boxShadow: "0 18px 48px rgba(0,0,0,0.18)" } : {}),
  },
  close: { position: "absolute", top: 12, right: 12, padding: 6 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E4DDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 30 },
  title: { fontSize: 19, fontWeight: "800", color: "#3B2E7E", textAlign: "center", marginBottom: 8 },
  body: { fontSize: 13.5, lineHeight: 20, color: "#4B5563", textAlign: "center", marginBottom: 18 },
  primary: {
    width: "100%",
    backgroundColor: "#6C5CE7",
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondary: { marginTop: 12, paddingVertical: 6 },
  secondaryText: { color: "#3B2E7E", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  later: { marginTop: 6, paddingVertical: 10 },
  laterText: { color: "#6B7280", fontSize: 13 },
});
