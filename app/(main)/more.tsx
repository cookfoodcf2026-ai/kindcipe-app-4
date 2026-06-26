/**
 * 更多功能 Tab
 * 快速入口：AI助手 / 家中儲備 / 晚餐推薦 / 採購紀錄 / 自訂食譜 / 街市指南 / 設定
 */
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";

type MenuItemDef = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  route: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
};

const MENU_ITEMS: MenuItemDef[] = [
  {
    icon: "chatbubble-ellipses",
    label: "AI 食譜助手",
    sub: "告訴我你想吃什麼",
    route: "/ai-chef",
    iconBg: "#F5F3FF",
    iconColor: "#8B5CF6",
  },
  {
    icon: "cube-outline",
    label: "家中儲備",
    sub: "管理食品/用品庫存",
    route: "/pantry",
    iconBg: "#ECFDF5",
    iconColor: "#10B981",
  },
  {
    icon: "calendar-outline",
    label: "晚餐推薦",
    sub: "本週/下週餐單設定",
    route: "/weekly-menu",
    iconBg: "#FFF7ED",
    iconColor: "#FF8C00",
  },
  {
    icon: "receipt-outline",
    label: "採購紀錄",
    sub: "購買歷史與常買商品",
    route: "/purchase-history",
    iconBg: "#F0FDF4",
    iconColor: "#22C55E",
  },
  {
    icon: "add-circle-outline",
    label: "新增食譜",
    sub: "貼連結 · 貼文字 · 截圖上傳 · 手動輸入",
    route: "/import",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
  },
  {
    icon: "funnel-outline",
    label: "分類管理",
    sub: "自訂食譜分類與排序",
    route: "/category-manager",
    iconBg: "#FEF9C3",
    iconColor: "#CA8A04",
  },
  {
    icon: "storefront-outline",
    label: "街市指南",
    sub: "97 個香港濕貨市場",
    route: "/markets",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
  },
  {
    icon: "cart-outline",
    label: "智能補貨",
    sub: "缺貨/即將耗盡補充",
    route: "/restock",
    iconBg: "#FFF7ED",
    iconColor: "#EA580C",
  },
  {
    icon: "people-outline",
    label: "家庭管理",
    sub: "邀請成員、查看家庭資訊",
    route: "/family",
    iconBg: "#FFF7ED",
    iconColor: "#F59E0B",
  },
  {
    icon: "server-outline",
    label: "管理員面板",
    sub: "食譜 CRUD・數據分析",
    route: "/admin",
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
  },
  {
    icon: "home-outline",
    label: "廚房設定",
    sub: "預設份量・螢幕・計時器",
    route: "/kitchen-settings",
    iconBg: "#EEF4FB",
    iconColor: BRAND,
  },
  {
    icon: "settings-outline",
    label: "設定",
    sub: "語言・訂閱・帳戶",
    route: "/settings",
    iconBg: "#F3F4F6",
    iconColor: "#6B7280",
  },
];

export default function MoreTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      { text: "登出", style: "destructive", onPress: () => logout() },
    ]);
  };

  // Fetch today summary data
  // BUG#14 FIX: removed unused todayStr variable
  const { data: pantryData = [] } = trpc.pantry.list.useQuery(undefined, { staleTime: 60000 });
  const outOfStock = pantryData.filter((i: any) => i.inStock === false).length;
  const lowStock = pantryData.filter((i: any) => i.isLow).length;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.headerTitle}>更多功能</Text>
          <Text style={s.headerSub}>
            {user?.name ? `嗨，${user.name.split(" ")[0]}` : "全部功能"}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
        {/* Quick status cards */}
        {(outOfStock > 0 || lowStock > 0) && (
          <TouchableOpacity style={s.alertBanner} onPress={() => router.push("/pantry")}>
            <View style={s.alertIcon}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>家中儲備需要補充</Text>
              <Text style={s.alertSub}>
                {outOfStock > 0 ? `${outOfStock} 件缺貨` : ""}
                {outOfStock > 0 && lowStock > 0 ? " · " : ""}
                {lowStock > 0 ? `${lowStock} 件即將耗盡` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Menu grid */}
        <View style={s.grid}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.route}
              style={s.gridItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[s.gridIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={26} color={item.iconColor} />
              </View>
              <Text style={s.gridLabel}>{item.label}</Text>
              <Text style={s.gridSub} numberOfLines={1}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={s.logoutTxt}>登出</Text>
        </TouchableOpacity>

        <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  scroll: { flex: 1 },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  alertSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  gridItem: {
    width: "30%",
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flexGrow: 1,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    marginBottom: 4,
  },
  gridSub: {
    fontSize: 10,
    color: SUB,
    textAlign: "center",
    lineHeight: 13,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  logoutTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
});
