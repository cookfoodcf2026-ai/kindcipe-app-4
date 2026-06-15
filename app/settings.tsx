/**
 * 用戶設定頁面
 * 功能：
 * - 用戶資料顯示
 * - 語言切換（繁體中文、English、Filipino、Indonesian）
 * - 採購紀錄入口
 * - 家庭管理入口
 * - 登出
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert
} from "react-native";
import * as WebBrowser from 'expo-web-browser';
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import PaywallModal from "@/components/PaywallModal";

const LANGUAGES = [
  { code: "zh-HK", label: "繁體中文", flag: "🇭🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "id", label: "Indonesia", flag: "🇮🇩" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [selectedLang, setSelectedLang] = useState("zh-HK");
  const [showLangPicker, setShowLangPicker] = useState(false);

  const handleLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];

  const [showPaywall, setShowPaywall] = useState(false);
  const subscriptionQuery = trpc.family.subscription.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const sub = subscriptionQuery.data;

  const getSubscriptionLabel = () => {
    if (!sub) return null;
    if (sub.status === "trial") {
      const daysLeft = sub.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
        : 0;
      return { label: `試用中（剩餘 ${daysLeft} 天）`, color: "#F59E0B", isPaid: true, daysLeft };
    }
    if (sub.status === "active") return { label: "家庭版（已訂閱）", color: "#16A34A", isPaid: true, daysLeft: 0 };
    if (sub.status === "expired") return { label: "訂閱已到期", color: "#EF4444", isPaid: false, daysLeft: 0 };
    return { label: "免費版", color: "#6B7280", isPaid: false, daysLeft: 0 };
  };
  const subInfo = getSubscriptionLabel();

  return (
    <View style={styles.container}>
      {/* 頭部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 用戶資料 */}
        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name || "用戶"}</Text>
              <Text style={styles.profileEmail}>{user.email || ""}</Text>
              {user.role && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {user.role === "admin" ? "管理員" : "家庭成員"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginCard}
            onPress={() => router.push("/login")}
          >
            <Ionicons name="person-circle-outline" size={48} color="#013E77" />
            <Text style={styles.loginCardTitle}>未登入</Text>
            <Text style={styles.loginCardSubtitle}>點擊登入以使用完整功能</Text>
          </TouchableOpacity>
        )}

        {/* 訂閱狀態卡片 */}
        {isAuthenticated && subInfo && (
          <View style={[styles.subCard, { borderLeftColor: subInfo.color }]}>
            <View style={styles.subCardLeft}>
              <Text style={styles.subCardTitle}>訂閱狀態</Text>
              <Text style={[styles.subCardStatus, { color: subInfo.color }]}>{subInfo.label}</Text>
            </View>
            {!subInfo.isPaid && (
              <TouchableOpacity
                style={styles.upgradeSmallBtn}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.upgradeSmallBtnText}>升級</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 語言設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>語言</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowLangPicker(!showLangPicker)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="language-outline" size={20} color="#013E77" />
              </View>
              <Text style={styles.settingLabel}>顯示語言</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {currentLang.flag} {currentLang.label}
              </Text>
              <Ionicons
                name={showLangPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color="#9CA3AF"
              />
            </View>
          </TouchableOpacity>

          {showLangPicker && (
            <View style={styles.langPicker}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    selectedLang === lang.code && styles.langOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedLang(lang.code);
                    setShowLangPicker(false);
                  }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langLabel,
                      selectedLang === lang.code && styles.langLabelActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {selectedLang === lang.code && (
                    <Ionicons name="checkmark" size={18} color="#013E77" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 功能入口 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>功能</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/purchase-history")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="receipt-outline" size={20} color="#22C55E" />
              </View>
              <Text style={styles.settingLabel}>採購紀錄</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/family")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="people-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.settingLabel}>家庭管理</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/ai-assistant")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="sparkles-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.settingLabel}>AI 助手</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* 關於 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>關於</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.settingLabel}>版本</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => WebBrowser.openBrowserAsync('https://cookfoodapp-fcqnrmih.manus.space/privacy', {
              toolbarColor: '#013E77',
              controlsColor: '#ffffff',
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            })}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.settingLabel}>私隱政策</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* 登出按鈕 */}
        {isAuthenticated && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutBtnText}>登出</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="generic"
        trialDaysLeft={subInfo?.daysLeft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FC" },

  header: {
    backgroundColor: "#013E77",
    flexDirection: "row", alignItems: "center",
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: "#fff" },

  // 用戶資料
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#013E77", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  profileEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  roleBadge: {
    backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignSelf: "flex-start", marginTop: 6,
  },
  roleText: { fontSize: 11, color: "#013E77", fontWeight: "700" },

  loginCard: {
    alignItems: "center", backgroundColor: "#fff",
    margin: 16, padding: 24, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  loginCardTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginTop: 8 },
  loginCardSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  // 設定區塊
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", marginBottom: 8, letterSpacing: 0.5 },

  settingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center",
  },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 13, color: "#6B7280" },

  // 語言選擇
  langPicker: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 2, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  langOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  langOptionActive: { backgroundColor: "#EFF6FF" },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "600" },
  langLabelActive: { color: "#013E77" },

  // 訂閱狀態卡片
  subCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderRadius: 16, borderLeftWidth: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  subCardLeft: { flex: 1 },
  subCardTitle: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  subCardStatus: { fontSize: 16, fontWeight: "800" },
  upgradeSmallBtn: {
    backgroundColor: "#013E77", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  upgradeSmallBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // 登出
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FEF2F2", padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutBtnText: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
});
