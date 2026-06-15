/**
 * PaywallModal — 付費牆 Modal
 * 當免費用戶嘗試使用付費功能時彈出
 *
 * 使用方式：
 * <PaywallModal
 *   visible={showPaywall}
 *   onClose={() => setShowPaywall(false)}
 *   feature="import"  // 觸發的功能類型
 * />
 */
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";

type PaywallFeature =
  | "import_limit"    // 匯入次數超出
  | "recipe_limit"    // 食譜數量超出
  | "member_limit"    // 成員數量超出
  | "screenshot"      // 截圖匯入（付費功能）
  | "ingredient_search" // 食材搜尋（付費功能）
  | "multilang"       // 多語言（付費功能）
  | "generic";        // 通用

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: PaywallFeature;
  trialDaysLeft?: number; // 試用期剩餘天數（如果在試用中）
}

const FEATURE_MESSAGES: Record<PaywallFeature, { emoji: string; title: string; desc: string }> = {
  import_limit: {
    emoji: "📥",
    title: "已達免費匯入上限",
    desc: "免費版每月最多匯入 5 個食譜\n升級後可無限匯入",
  },
  recipe_limit: {
    emoji: "📚",
    title: "已達食譜儲存上限",
    desc: "免費版最多儲存 30 個自訂食譜\n升級後可無限儲存",
  },
  member_limit: {
    emoji: "👨‍👩‍👧",
    title: "已達成員上限",
    desc: "免費版最多 2 位家庭成員\n升級後最多可加入 6 位成員",
  },
  screenshot: {
    emoji: "📸",
    title: "截圖匯入為付費功能",
    desc: "升級後可用相機或截圖\n直接匯入食譜，無需手動輸入",
  },
  ingredient_search: {
    emoji: "🔍",
    title: "食材搜尋為付費功能",
    desc: "升級後可輸入食材名稱\n搜尋所有相關食譜",
  },
  multilang: {
    emoji: "🌏",
    title: "多語言為付費功能",
    desc: "升級後工人姐姐可用\n英文或印尼文查看食譜",
  },
  generic: {
    emoji: "⭐",
    title: "升級以使用此功能",
    desc: "升級至家庭版，解鎖所有功能",
  },
};

export default function PaywallModal({
  visible,
  onClose,
  feature = "generic",
  trialDaysLeft,
}: PaywallModalProps) {
  const msg = FEATURE_MESSAGES[feature];

  const handleUpgrade = () => {
    // TODO: 替換為實際的 App Store 訂閱連結
    // iOS: Linking.openURL("https://apps.apple.com/app/idXXXXXXXXX?action=write-review")
    // 或使用 expo-in-app-purchases 處理訂閱
    Linking.openURL("https://kindcipe.app/upgrade");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.sheet}
          activeOpacity={1}
          onPress={() => {}} // 防止點擊內容關閉
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Content */}
          <Text style={styles.emoji}>{msg.emoji}</Text>
          <Text style={styles.title}>{msg.title}</Text>
          <Text style={styles.desc}>{msg.desc}</Text>

          {/* Pricing */}
          <View style={styles.pricingBox}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>家庭版</Text>
              <View style={styles.pricingRight}>
                <Text style={styles.price}>HK$28</Text>
                <Text style={styles.pricePer}>/月</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>年費優惠</Text>
              <View style={styles.pricingRight}>
                <Text style={styles.price}>HK$218</Text>
                <Text style={styles.pricePer}>/年</Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>省 35%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Features list */}
          <View style={styles.featuresList}>
            {[
              "無限匯入食譜",
              "無限儲存食譜",
              "最多 6 位家庭成員",
              "截圖匯入食譜",
              "食材搜尋功能",
              "多語言支援（英文 / 印尼文）",
            ].map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* CTA buttons */}
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Text style={styles.upgradeBtnText}>立即升級</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>
              {trialDaysLeft && trialDaysLeft > 0
                ? `繼續試用（剩餘 ${trialDaysLeft} 天）`
                : "稍後再說"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  pricingBox: {
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  pricingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#013E77",
  },
  pricePer: {
    fontSize: 13,
    color: "#6B7280",
  },
  saveBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  saveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  featuresList: {
    width: "100%",
    marginBottom: 20,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkmark: {
    fontSize: 14,
    color: "#013E77",
    fontWeight: "800",
    width: 20,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
  },
  upgradeBtn: {
    backgroundColor: "#013E77",
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
});
