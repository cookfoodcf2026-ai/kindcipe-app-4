import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
  Platform, Dimensions,
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

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (target.getTime() === today.getTime()) return "今天";
  if (target.getTime() === yesterday.getTime()) return "昨天";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function daysSince(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function getCategoryColor(category: string | null | undefined): string {
  const map: Record<string, string> = {
    "蔬菜生果": "#4CAF50", "肉類": "#F44336", "海鮮": "#2196F3",
    "乳製品蛋類": "#FFC107", "豆腐豆製品": "#FF9800", "米麵糧油": "#795548",
    "調味料": "#9C27B0", "飲品": "#00BCD4", "零食小食": "#E91E63",
    "家居清潔": "#009688", "個人護理": "#FF5722",
  };
  if (!category) return "#D1D5DB";
  for (const [key, color] of Object.entries(map)) {
    if (category.includes(key) || key.includes(category)) return color;
  }
  return "#9CA3AF";
}

export default function PurchaseHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"history" | "frequent">("history");
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());

  const { data: history = [], isLoading: historyLoading } = trpc.purchaseHistory.list.useQuery();
  const { data: frequency = [], isLoading: freqLoading } = trpc.purchaseHistory.frequency.useQuery();

  const addItemM = trpc.shopping.add.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, typeof history>();
    for (const item of history) {
      const key = formatDate(item.boughtAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [history]);

  const restockSuggestions = useMemo(() => {
    return frequency
      .filter((f: any) => f.count >= 2 && daysSince(f.lastBoughtAt) >= 7)
      .slice(0, 8);
  }, [frequency]);

  const frequentItems = useMemo(() => {
    return frequency
      .filter((f: any) => f.count >= 2 && daysSince(f.lastBoughtAt) <= 90)
      .slice(0, 20);
  }, [frequency]);

  const handleAddToList = async (name: string) => {
    if (addingItems.has(name)) return;
    setAddingItems(prev => new Set(prev).add(name));
    try {
      await addItemM.mutateAsync({ name, status: "active" });
      setTimeout(() => {
        setAddingItems(prev => { const n = new Set(prev); n.delete(name); return n; });
      }, 1500);
    } catch {
      setAddingItems(prev => { const n = new Set(prev); n.delete(name); return n; });
    }
  };

  const isLoading = historyLoading || freqLoading;

  return (
    <>
      <Stack.Screen
        options={{
          title: "採購記錄",
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
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="clipboard-outline" size={16} color="#fff" />
            </View>
            <Text style={{ fontSize: 17, fontWeight: "900", color: TEXT, flex: 1 }}>採購記錄</Text>
            {history.length > 0 && (
              <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>共 {history.length} 筆</Text>
              </View>
            )}
          </View>
          {/* Tabs */}
          <View style={{ flexDirection: "row" }}>
            {[
              { id: "history" as const, label: "採購歷史", icon: "time-outline" as const },
              { id: "frequent" as const, label: "常買商品", icon: "trending-up-outline" as const },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderBottomWidth: 2.5, borderBottomColor: isActive ? BRAND : "transparent" }}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Ionicons name={tab.icon} size={14} color={isActive ? BRAND : SUB} />
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
        ) : activeTab === "history" ? (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Restock Suggestions */}
            {restockSuggestions.length > 0 && (
              <View style={{ backgroundColor: "#EEF4FB", borderWidth: 1.5, borderColor: "#7BAFD4", borderRadius: 14, padding: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Ionicons name="trending-up-outline" size={14} color={BRAND} />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: BRAND }}>智能補貨建議</Text>
                  <Text style={{ fontSize: 11, color: "#B45309" }}>超過 7 天未購買</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {restockSuggestions.map((item: any) => {
                    const isAdding = addingItems.has(item.name);
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={{ width: (SW - 56) / 2, backgroundColor: isAdding ? "#E8F5E9" : CARD, borderWidth: 1.5, borderColor: isAdding ? "#4CAF50" : "#7BAFD4", borderRadius: 12, padding: 10 }}
                        onPress={() => handleAddToList(item.name)}
                        disabled={isAdding}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: isAdding ? "#2E7D32" : TEXT }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{daysSince(item.lastBoughtAt)} 天未買</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {groupedHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="clipboard-outline" size={40} color="#E5D5C5" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUB, marginTop: 12, marginBottom: 6 }}>暫無採購記錄</Text>
                <Text style={{ fontSize: 12, color: "#C4B5A5", textAlign: "center" }}>在「採購清單」勾選商品為「已買」後，記錄將自動出現</Text>
              </View>
            ) : (
              groupedHistory.map(([dateLabel, items]) => (
                <View key={dateLabel} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: BRAND }}>{dateLabel}</Text>
                    </View>
                    <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                    <Text style={{ fontSize: 11, color: SUB }}>{items.length} 件</Text>
                  </View>
                  <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
                    {items.map((item: any, idx: number) => {
                      const isAdding = addingItems.has(item.name);
                      return (
                        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: "#F9F3EC" }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getCategoryColor(item.category), marginRight: 10 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{item.name}</Text>
                            <Text style={{ fontSize: 11, color: SUB, marginTop: 1 }}>
                              {[item.quantity, item.unit, item.category].filter(Boolean).join(" · ")}
                              {item.userName ? ` · ${item.userName}` : ""}
                            </Text>
                          </View>
                          {item.actualPrice != null && (
                            <View style={{ backgroundColor: "#EEF4FB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: "800", color: BRAND }}>HK${item.actualPrice}</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={{ backgroundColor: isAdding ? "#E8F5E9" : BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                            onPress={() => handleAddToList(item.name)}
                            disabled={isAdding}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {isAdding && <Ionicons name="checkmark-outline" size={16} color="#22C55E" />}
                              <Text style={{ fontSize: 12, fontWeight: "700", color: isAdding ? "#2E7D32" : "#fff" }}>
                                {isAdding ? "已加" : "再買"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
            <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {frequentItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="trending-up-outline" size={40} color="#E5D5C5" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUB, marginTop: 12 }}>暫無常買商品</Text>
                <Text style={{ fontSize: 12, color: "#C4B5A5", marginTop: 6, textAlign: "center" }}>購買同一商品 2 次或以上後，將顯示在這裡</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>按購買次數排列，點擊可快速加入清單</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {frequentItems.map((item: any, idx: number) => {
                    const isAdding = addingItems.has(item.name);
                    const days = daysSince(item.lastBoughtAt);
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={{ width: (SW - 42) / 2, backgroundColor: isAdding ? "#E8F5E9" : CARD, borderWidth: 1.5, borderColor: isAdding ? "#4CAF50" : BORDER, borderRadius: 14, padding: 14 }}
                        onPress={() => handleAddToList(item.name)}
                        disabled={isAdding}
                      >
                        <View style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: idx < 3 ? BRAND : BORDER, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 10, fontWeight: "900", color: idx < 3 ? "#fff" : SUB }}>{idx + 1}</Text>
                        </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingRight: 24 }}>
                            {isAdding && <Ionicons name="checkmark-outline" size={16} color="#22C55E" style={{ marginRight: 4 }} />}
                            <Text style={{ fontSize: 15, fontWeight: "800", color: isAdding ? "#2E7D32" : TEXT, flex: 1 }}>
                              {item.name}
                            </Text>
                          </View>
                        <View style={{ flexDirection: "row", gap: 4, marginBottom: 10 }}>
                          <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>買過 {item.count} 次</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: SUB }}>{days === 0 ? "今天" : `${days}天前`}</Text>
                        </View>
                        <View style={{ backgroundColor: isAdding ? "transparent" : BRAND, borderRadius: 8, paddingVertical: 7, alignItems: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: isAdding ? "#2E7D32" : "#fff" }}>
                            {isAdding ? "已加入清單" : "加入清單"}
                          </Text>
                        </View>
                      </TouchableOpacity>
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
