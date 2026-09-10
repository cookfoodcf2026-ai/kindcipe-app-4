import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// 開關：而家冇第三方廣告，先顯示 Pro promo 佔位。
// 將來接入 AdMob 時，將呢個 flag 轉做 true，並喺 render 度換成 <BannerAd>。
const SHOW_ADS = false;

type AdSlotProps = {
  onPressUpgrade?: () => void;
};

// 統一嘅廣告 slot —— 無論而家係 promo 定將來係真廣告，都佔同一位置，
// 轉換時淨係改 SHOW_ADS 同埋 AdSlot 入面嘅 render 內容，唔使改 layout。
export default function AdSlot({ onPressUpgrade }: AdSlotProps) {
  const router = useRouter();

  if (SHOW_ADS) {
    // TODO(ads): 接入 AdMob BannerAd 之後喺呢度 render。
    // 例如：<BannerAd unitId="ca-app-pub-xxx" size="BANNER" />
    return (
      <View style={s.ad}>
        <Text style={s.adText}>廣告</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={s.ad}
      activeOpacity={0.85}
      onPress={() => {
        if (onPressUpgrade) onPressUpgrade();
        else router.push("/(tabs)/more" as any);
      }}
    >
      <View style={s.iconWrap}>
        <Ionicons name="sparkles" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>升級 Pro，解鎖無限 AI 排餐</Text>
        <Text style={s.subtitle}>與家人連繫，連結 AI，免費試用 7 天</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B45309" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  ad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0D8CE",
    backgroundColor: "#F5EDE0",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F5A823",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "800", color: "#2C1A0E" },
  subtitle: { fontSize: 11, color: "#4A3A2C", marginTop: 2 },
  adText: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
});
