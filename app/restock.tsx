/**
 * 智能補貨頁面
 * 基於 Pantry 庫存狀態 + 購買頻率推薦補貨清單
 * 缺貨 / 即將耗盡 → 一鍵加入購物清單
 */
import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Linking,
  Dimensions,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#E0EAF4";

const SUPERMARKETS = [
  { id: "HKTVMALL", name: "HKTVmall", color: "#FF6600", icon: "cart-outline" },
  { id: "PARKNSHOP", name: "百佳", color: "#007DC5", icon: "checkmark-circle-outline" },
  { id: "WELLCOME", name: "惠康", color: "#E31837", icon: "close-circle-outline" },
];

async function openSupermarket(id: string, keyword: string) {
  const kw = encodeURIComponent(keyword.replace(/\d+/g, "").trim());
  const urls: Record<string, string> = {
    HKTVMALL: `https://www.hktvmall.com/hktv/zh/search?query=${kw}`,
    PARKNSHOP: `https://www.parknshop.com/search?q=${kw}`,
    WELLCOME: `https://www.wellcome.com.hk/search?q=${kw}`,
  };
  await Linking.openURL(urls[id] ?? urls.HKTVMALL);
}

function daysSince(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export default function RestockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"urgent" | "predict">("urgent");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [markedRestocked, setMarkedRestocked] = useState<Set<string>>(new Set());

  const { data: pantryData = [], isLoading: pantryLoading } = trpc.pantry.list.useQuery();
  const { data: frequency = [], isLoading: freqLoading } = trpc.purchaseHistory.frequency.useQuery();

  const addShoppingM = trpc.shopping.add.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const toggleInStockM = trpc.pantry.toggleInStock.useMutation({
    onSuccess: () => utils.pantry.list.invalidate(),
  });

  // Urgent: out-of-stock + low-stock
  const urgentItems = useMemo(() => {
    const out = pantryData
      .filter((i: any) => i.inStock === false && !markedRestocked.has(i.id))
      .map((i: any) => ({ ...i, status: "out" as const }));
    const low = pantryData
      .filter((i: any) => i.isLow && i.inStock !== false && !markedRestocked.has(i.id))
      .map((i: any) => ({ ...i, status: "low" as const }));
    return [...out, ...low];
  }, [pantryData, markedRestocked]);

  // Predict: items bought 2+ times, not bought in 14+ days, not in pantry or pantry low
  const predictItems = useMemo(() => {
    const pantryNames = new Set(pantryData.map((i: any) => i.name.toLowerCase()));
    return frequency
      .filter((f: any) => {
        if (f.count < 2) return false;
        if (daysSince(f.lastBoughtAt) < 14) return false;
        return true;
      })
      .slice(0, 12);
  }, [frequency, pantryData]);

  const restockedCount = pantryData.filter((i: any) => markedRestocked.has(i.id)).length;
  const outCount = pantryData.filter((i: any) => i.inStock === false).length;
  const lowCount = pantryData.filter((i: any) => i.isLow).length;

  const isLoading = pantryLoading || freqLoading;

  const handleMarkRestocked = (item: any) => {
    setMarkedRestocked(prev => new Set(prev).add(item.id));
    toggleInStockM.mutate({ id: item.id, inStock: true });
  };

  const handleMarkAllRestocked = () => {
    Alert.alert("全部標記為有貨", `確認將 ${urgentItems.length} 件商品標記為有貨？`, [
      { text: "取消", style: "cancel" },
      {
        text: "確認",
        onPress: () => {
          urgentItems.forEach(item => {
            setMarkedRestocked(prev => new Set(prev).add(item.id));
            toggleInStockM.mutate({ id: item.id, inStock: true });
          });
        },
      },
    ]);
  };

  const handleAddToShopping = (name: string) => {
    addShoppingM.mutate({ name, status: "active" });
    Alert.alert("已加入購物清單", `「${name}」已加入購物清單`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "智能補貨",
          headerStyle: { backgroundColor: BG },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "800", color: TEXT },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <Ionicons name="chevron-back" size={24} color={TEXT} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* Stats Banner */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {[
              { label: "缺貨", value: outCount, color: "#DC2626", bg: "#FEF2F2" },
              { label: "即將耗盡", value: lowCount, color: "#D97706", bg: "#FFFBEB" },
              { label: "已補貨", value: restockedCount, color: "#16A34A", bg: "#F0FDF4" },
            ].map(stat => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: stat.bg, borderRadius: 12, padding: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: stat.color }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {/* Tabs */}
          <View style={{ flexDirection: "row" }}>
            {[
              { id: "urgent" as const, label: "緊急補貨" },
              { id: "predict" as const, label: "智能預測" },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2.5, borderBottomColor: isActive ? BRAND : "transparent" }}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={{ fontSize: 13, fontWeight: isActive ? "800" : "500", color: isActive ? BRAND : SUB }}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={BRAND} size="large" />
          </View>
        ) : activeTab === "urgent" ? (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {urgentItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT, marginTop: 12 }}>所有物品庫存充足</Text>
                <Text style={{ fontSize: 13, color: SUB, marginTop: 4 }}>沒有缺貨或即將耗盡的物品</Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: SUB }}>共 {urgentItems.length} 件需要補貨</Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E8F0FA", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                    onPress={handleMarkAllRestocked}
                  >
                    <Ionicons name="checkmark-done-outline" size={14} color={BRAND} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: BRAND }}>全部標記有貨</Text>
                  </TouchableOpacity>
                </View>

                {urgentItems.map((item: any) => {
                  const isExpanded = expandedItem === item.id;
                  const isOut = item.status === "out";
                  return (
                    <View key={item.id} style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: isOut ? "#FECACA" : "#FDE68A", marginBottom: 8, overflow: "hidden" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isOut ? "#FEF2F2" : "#FFFBEB", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={isOut ? "ellipse-outline" : "alert-circle-outline"} size={20} color={isOut ? "#DC2626" : "#D97706"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{item.name}</Text>
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                            <View style={{ backgroundColor: isOut ? "#FEF2F2" : "#FFFBEB", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: isOut ? "#DC2626" : "#D97706" }}>{isOut ? "缺貨" : "即將耗盡"}</Text>
                            </View>
                            {item.category && <Text style={{ fontSize: 10, color: SUB }}>{item.category}</Text>}
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <TouchableOpacity
                            style={{ padding: 8, backgroundColor: "#F0FDF4", borderRadius: 8, borderWidth: 1, borderColor: "#86EFAC" }}
                            onPress={() => handleMarkRestocked(item)}
                          >
                            <Ionicons name="checkmark" size={14} color="#16A34A" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ padding: 8, backgroundColor: "#EEF4FB", borderRadius: 8 }}
                            onPress={() => setExpandedItem(isExpanded ? null : item.id)}
                          >
                            <Ionicons name={isExpanded ? "chevron-up" : "pricetag-outline"} size={14} color={BRAND} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Price comparison panel */}
                      {isExpanded && (
                        <View style={{ padding: 10, backgroundColor: "#FAFAFA", borderTopWidth: 1, borderTopColor: BORDER }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 8 }}>搜尋比價</Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {SUPERMARKETS.map(sm => (
                              <TouchableOpacity
                                key={sm.id}
                                style={{ flex: 1, alignItems: "center", backgroundColor: CARD, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: BORDER }}
                                onPress={() => openSupermarket(sm.id, item.name)}
                              >
                                <Ionicons name={sm.icon as any} size={16} color={sm.color} />
                                <Text style={{ fontSize: 10, fontWeight: "700", color: sm.color, marginTop: 2 }}>{sm.name}</Text>
                                <Text style={{ fontSize: 9, color: SUB }}>前往搜尋</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            style={{ marginTop: 8, backgroundColor: BRAND, borderRadius: 10, paddingVertical: 8, alignItems: "center" }}
                            onPress={() => { handleAddToShopping(item.name); setExpandedItem(null); }}
                          >
                            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>加入購物清單</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
            <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {predictItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="trending-up-outline" size={48} color={HINT} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUB, marginTop: 12 }}>暫無預測補貨建議</Text>
                <Text style={{ fontSize: 12, color: HINT, marginTop: 4, textAlign: "center" }}>購買同一商品 2 次後，AI 將預測補貨時機</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>
                  根據購買頻率推薦，共 {predictItems.length} 件商品可能需要補充
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {predictItems.map((item: any) => {
                    const days = daysSince(item.lastBoughtAt);
                    return (
                      <View key={item.name} style={{ width: (SW - 42) / 2, backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, padding: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT, marginBottom: 6 }}>{item.name}</Text>
                        <View style={{ flexDirection: "row", gap: 4, marginBottom: 10 }}>
                          <View style={{ backgroundColor: "#EEF4FB", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: BRAND }}>買過 {item.count} 次</Text>
                          </View>
                          <Text style={{ fontSize: 10, color: SUB }}>{days}天前</Text>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: BRAND, borderRadius: 8, paddingVertical: 7, alignItems: "center" }}
                          onPress={() => handleAddToShopping(item.name)}
                        >
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>加入購物清單</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
            <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}
