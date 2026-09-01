import { useState, useMemo, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal,
  Platform, Dimensions, TextInput,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { DateUtil } from "@/src/lib/DateUtil";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#E0EAF4";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) {
    console.log('formatDate: null/undefined input', d);
    return "未定";
  }
  const date = typeof d === "string" ? new Date(d) : d;
  
  // 檢查是否為有效日期
  if (isNaN(date.getTime())) {
    console.warn('formatDate: Invalid date received:', d, new Date(String(d)));
    return "未定";
  }
  
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  
  console.log('formatDate debug:', { input: d, month, day, year, dateObj: date });
  
  // 如果 month 或 day 係 NaN，返回預設值
  if (isNaN(month) || isNaN(day)) {
    console.warn('formatDate: NaN month/day', { month, day, date });
    return "未定";
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(year, month, day);
  
  if (isNaN(target.getTime())) {
    console.warn('formatDate: Invalid target date', { target, year, month, day });
    return `${month + 1}月${day}日`;
  }
  
  if (target.getTime() === today.getTime()) return "今天";
  if (target.getTime() === yesterday.getTime()) return "昨天";
  return `${month + 1}月${day}日`;
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

function cleanItemName(name: string | null | undefined): string {
  if (!name || name.trim() === '') return '未知項目';
  return name.replace(/^\)|^\(/g, '').trim();
}

export default function PurchaseHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"purchased" | "missed" | "frequent">("purchased");
  const [searchQuery, setSearchQuery] = useState("");
  const [historyRange, setHistoryRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [missedDateRange, setMissedDateRange] = useState<"all" | "7d" | "30d">("all");
  const [editPurchaseItem, setEditPurchaseItem] = useState<any>(null);
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editPurchaseQty, setEditPurchaseQty] = useState("");
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false);

  const { data: history = [], isLoading: historyLoading } = (trpc as any).purchaseHistory.list.useQuery();
  const { data: frequency = [], isLoading: freqLoading } = (trpc as any).purchaseHistory.frequency.useQuery();
  const { data: shoppingItems = [], isLoading: shoppingLoading } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const utils = trpc.useUtils();
  const searchTerm = searchQuery.trim().toLowerCase();

  const filteredHistory = useMemo(() => {
    return history.filter((item: any) => {
      const matchesSearch = !searchTerm || [item.name, item.category, item.unit, item.quantity, item.userName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(searchTerm));

      if (!matchesSearch) return false;

      if (historyRange === "all") return true;
      const maxDays = historyRange === "7d" ? 7 : historyRange === "30d" ? 30 : 90;
      return daysSince(item.boughtAt) <= maxDays;
    });
  }, [history, searchTerm, historyRange]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, typeof history>();
    for (const item of filteredHistory) {
      const key = formatDate(item.boughtAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [filteredHistory]);

  const restockSuggestions = useMemo(() => {
    return frequency
      .filter((f: any) => f.count >= 2 && daysSince(f.lastBoughtAt) >= 7)
      .filter((f: any) => !searchTerm || [f.name, f.category, f.unit].filter(Boolean).some((v) => String(v).toLowerCase().includes(searchTerm)))
      .slice(0, 8);
  }, [frequency, searchTerm]);

  const frequentItems = useMemo(() => {
    return frequency
      .filter((f: any) => f.count >= 2 && daysSince(f.lastBoughtAt) <= 90)
      .filter((f: any) => !searchTerm || [f.name, f.category, f.unit].filter(Boolean).some((v) => String(v).toLowerCase().includes(searchTerm)))
      .slice(0, 20);
  }, [frequency, searchTerm]);

  const frequentItemNames = useMemo(() => frequentItems.map((item: any) => item.name), [frequentItems]);
  const { data: lastPricesMap = {} } = (trpc as any).purchaseHistory.lastPrices.useQuery(
    { itemNames: frequentItemNames },
    { enabled: frequentItemNames.length > 0 },
  );

  const missedItems = useMemo(() => {
    const today = DateUtil.todayISO();
    let filtered = shoppingItems
      .filter((item: any) => item.plannedDate && item.plannedDate < today && item.status !== "bought")
      .sort((a: any, b: any) => b.plannedDate.localeCompare(a.plannedDate));
    
    // 應用日期篩選
    if (missedDateRange === "7d") {
      const sevenDaysAgo = DateUtil.addDays(today, -7);
      filtered = filtered.filter((item: any) => item.plannedDate >= sevenDaysAgo);
    } else if (missedDateRange === "30d") {
      const thirtyDaysAgo = DateUtil.addDays(today, -30);
      filtered = filtered.filter((item: any) => item.plannedDate >= thirtyDaysAgo);
    }
    
    return filtered;
  }, [shoppingItems, missedDateRange]);

  const missedItemCount = useMemo(() => {
    const today = DateUtil.todayISO();
    const all = shoppingItems.filter(
      (i) => i.plannedDate && i.plannedDate < today && i.status !== "bought"
    ).length;
    const sevenDaysAgo = DateUtil.addDays(today, -7);
    const seven = shoppingItems.filter(
      (i) => i.plannedDate && i.plannedDate >= sevenDaysAgo && i.plannedDate < today && i.status !== "bought"
    ).length;
    const thirtyDaysAgo = DateUtil.addDays(today, -30);
    const thirty = shoppingItems.filter(
      (i) => i.plannedDate && i.plannedDate >= thirtyDaysAgo && i.plannedDate < today && i.status !== "bought"
    ).length;
    
    return { all, seven, thirty };
  }, [shoppingItems]);

  const consolidatedPurchased = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return [];

    // 1. 按日期 (dateKey) 作為第一層 Group
    const dateMap = new Map<string, any[]>();
    
    filteredHistory.forEach((item: any) => {
      const dateKey = formatDate(item.boughtAt);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(item);
    });

    // 2. 每個日期內部按品名 (name) 進行數量與金額合併
    return Array.from(dateMap.entries()).map(([date, items]) => {
      const itemMap = new Map<string, any>();

      items.forEach((item: any) => {
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
          existing.actualPrice = (existing.actualPrice || 0) + (item.actualPrice || 0);
          existing.budgetPrice = (existing.budgetPrice || 0) + (item.estimatedPrice || 0);
        } else {
          itemMap.set(item.name, { ...item });
        }
      });

      return {
        date,
        items: Array.from(itemMap.values()),
      };
    });
  }, [filteredHistory]);

  const groupedMissed = useMemo(() => {
    if (!missedItems || missedItems.length === 0) return [];

    const groups = new Map<string, any[]>();
    missedItems.forEach((item: any) => {
      const dateKey = formatDate(item.plannedDate || item.createdAt);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(item);
    });

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [missedItems]);

  const moveToTodayM = trpc.shopping.updateItem.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      utils.purchaseHistory.list.invalidate();
      Alert.alert("已移至今日", "項目已更新為今天的購買日期");
    },
    onError: (e: Error) => {
      Alert.alert("更新失敗", e.message);
    },
  });

  const moveToTodayAllM = trpc.shopping.updateItem.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      utils.purchaseHistory.list.invalidate();
      Alert.alert("已全部移至今日", `${missedItems.length} 個項目已更新`);
    },
    onError: (e: Error) => {
      Alert.alert("批量更新失敗", e.message);
    },
  });

  const handleEditPurchase = useCallback((item: any) => {
    setEditPurchaseItem(item);
    setEditPurchasePrice(String(item.actualPrice || ""));
    setEditPurchaseQty(String(item.quantity || ""));
    setShowEditPurchaseModal(true);
  }, []);

  const saveEditPurchaseM = trpc.purchaseHistory.update.useMutation({
    onSuccess: () => {
      utils.purchaseHistory.list.invalidate();
      setShowEditPurchaseModal(false);
      setEditPurchaseItem(null);
      setEditPurchasePrice("");
      setEditPurchaseQty("");
      Alert.alert("已更新", "購買記錄已更新");
    },
    onError: (e: Error) => {
      Alert.alert("更新失敗", e.message);
    },
  });

  const handleSaveEditPurchase = () => {
    if (!editPurchaseItem) return;
    const price = editPurchasePrice.trim() ? parseInt(editPurchasePrice, 10) : null;
    const qty = editPurchaseQty.trim() || null;
    
    if (price != null && (isNaN(price) || price <= 0)) {
      Alert.alert("請輸入有效價格");
      return;
    }
    
    saveEditPurchaseM.mutate({
      id: editPurchaseItem.id,
      actualPrice: price,
      quantity: qty,
    });
  };

  const handleRebuy = (item: {
    name: string;
    category?: string | null;
    unit?: string | null;
    quantity?: string | null;
    actualPrice?: number | null;
    boughtAt?: string | Date;
  }) => {
    router.push({
      pathname: "/(tabs)/shopping",
      params: {
        openAdd: "1",
        prefillName: item.name,
        prefillCategory: item.category || "其他",
        prefillUnit: item.unit || "",
        prefillQty: item.quantity || "",
        prefillPrice: item.actualPrice != null ? String(item.actualPrice) : "",
      },
    } as any);
  };

  const isLoading = historyLoading || freqLoading || shoppingLoading;

  return (
    <>
      <Stack.Screen
        options={{
          title: "購買記錄",
          headerShown: true,
          headerBackTitle: '',
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
          {/* Tabs */}
          <View style={{ flexDirection: "row" }}>
            {[
              { id: "purchased" as const, label: "已購買", count: filteredHistory.length, icon: "checkmark-circle-outline" as const },
              { id: "missed" as const, label: "未買遺漏", count: missedItems.length, icon: "alert-circle-outline" as const },
              { id: "frequent" as const, label: "常見", count: frequentItems.length, icon: "trending-up-outline" as const },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderBottomWidth: 2.5, borderBottomColor: isActive ? BRAND : "transparent" }}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Ionicons name={tab.icon} size={14} color={isActive ? BRAND : SUB} />
                  <Text style={{ fontSize: 13, fontWeight: isActive ? "800" : "500", color: isActive ? BRAND : SUB }}>
                    {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ marginTop: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F7FB", borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
              <Ionicons name="search-outline" size={16} color={SUB} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜尋商品、類別、用戶"
                placeholderTextColor={HINT}
                style={{ flex: 1, fontSize: 14, color: TEXT, paddingVertical: 0 }}
                returnKeyType="search"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}> 
                  <Ionicons name="close-circle" size={18} color={SUB} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {([
                { id: "all", label: "全部" },
                { id: "7d", label: "7日" },
                { id: "30d", label: "30日" },
                { id: "90d", label: "90日" },
              ] as const).map((chip) => {
                const active = historyRange === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => setHistoryRange(chip.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? BRAND : "#EEF4FB",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : BRAND }}>{chip.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={BRAND} size="large" />
          </View>
        ) : activeTab === "purchased" ? (
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
                    const lastPrice = lastPricesMap[item.name]?.price;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={{ width: (SW - 56) / 2, backgroundColor: CARD, borderWidth: 1.5, borderColor: "#7BAFD4", borderRadius: 12, padding: 10 }}
                        onPress={() => handleRebuy({ ...item, actualPrice: lastPrice })}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{daysSince(item.lastBoughtAt)} 天未買</Text>
                        {lastPrice != null ? <Text style={{ fontSize: 11, color: BRAND, marginTop: 4 }}>上次 HK${lastPrice}</Text> : null}
                        <View style={{ marginTop: 8, backgroundColor: BRAND, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>再買</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {consolidatedPurchased.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="clipboard-outline" size={40} color="#E5D5C5" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUB, marginTop: 12, marginBottom: 6 }}>暫無符合記錄</Text>
                <Text style={{ fontSize: 13, color: HINT, textAlign: "center" }}>調整搜尋條件或時間範圍試試</Text>
              </View>
            ) : (
              consolidatedPurchased.map(({ date, items }) => (
                <View key={date} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Ionicons name="calendar-outline" size={14} color={BRAND} />
                    <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>{date}</Text>
                    <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>{items.length} 項</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
                    {items.length > 1 ? (
                      // 合併顯示（同一日期有相同名稱的項目）
                      <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: getCategoryColor(items[0].category), alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                          <Ionicons name="cart-outline" size={18} color="#fff" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT, flex: 1 }} numberOfLines={1}>{cleanItemName(items[0].name)}</Text>
                            <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: BRAND }}>x{items.length}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 3 }}>
                            {(() => {
                              const item = items[0];
                              const hasBudget = item.estimatedPrice != null;
                              const hasActual = item.actualPrice != null;
                              const diff = hasActual && hasBudget ? item.actualPrice - item.estimatedPrice : null;
                              const diffPercent = diff && item.estimatedPrice ? diff / item.estimatedPrice : null;
                              const showDiff = diffPercent && diffPercent > 0.1;
                              
                              if (hasBudget && hasActual) {
                                return (
                                  <>
                                    <Text style={{ fontSize: 12, color: "#9CA3AF", textDecorationLine: "line-through" }}>HK${item.estimatedPrice}</Text>
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: showDiff ? "#DC2626" : "#013E77" }}>
                                      HK${item.actualPrice}
                                      {showDiff && <Text style={{ fontSize: 10, fontWeight: "700" }}> (+{diff})</Text>}
                                    </Text>
                                  </>
                                );
                              } else if (hasActual) {
                                return <Text style={{ fontSize: 12, fontWeight: "700", color: "#013E77" }}>HK${item.actualPrice}</Text>;
                              } else if (hasBudget) {
                                return <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>預算 HK${item.estimatedPrice}</Text>;
                              }
                              return null;
                            })()}
                            {items[0].boughtByUser && <Text style={{ fontSize: 12, color: SUB }}>{items[0].boughtByUser}</Text>}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: "#F5F8FC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BORDER, marginLeft: 8 }}
                          onPress={() => handleRebuy(items[0])}
                        >
                          <Ionicons name="refresh-outline" size={16} color={BRAND} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      // 單一項目顯示
                      items.map((item: any, idx: number) => {
                        const hasBudget = item.estimatedPrice != null;
                        const hasActual = item.actualPrice != null;
                        const diff = hasActual && hasBudget ? item.actualPrice - item.estimatedPrice : null;
                        const diffPercent = diff && item.estimatedPrice ? diff / item.estimatedPrice : null;
                        const showDiff = diffPercent && diffPercent > 0.1;

                        return (
                          <TouchableOpacity
                            key={item.id || idx}
                            style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: "#F9F3EC" }}
                            onPress={() => handleEditPurchase(item)}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: getCategoryColor(item.category), alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                              <Ionicons name="cart-outline" size={18} color="#fff" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT, flex: 1 }} numberOfLines={1}>{cleanItemName(item.name)}</Text>
                                {item.boughtByUser && (
                                  <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 9, fontWeight: "700", color: BRAND }}>{item.boughtByUser}</Text>
                                  </View>
                                )}
                              </View>
                              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                                {item.quantity && <Text style={{ fontSize: 12, color: SUB }}>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</Text>}
                                {hasBudget && hasActual ? (
                                  <>
                                    <Text style={{ fontSize: 12, color: "#9CA3AF", textDecorationLine: "line-through" }}>HK${item.estimatedPrice}</Text>
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: showDiff ? "#DC2626" : "#013E77" }}>
                                      HK${item.actualPrice}
                                      {showDiff && <Text style={{ fontSize: 10, fontWeight: "700" }}> (+{diff})</Text>}
                                    </Text>
                                  </>
                                ) : hasActual ? (
                                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#013E77" }}>HK${item.actualPrice}</Text>
                                ) : hasBudget ? (
                                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>預算 HK${item.estimatedPrice}</Text>
                                ) : null}
                              </View>
                            </View>
                            <TouchableOpacity
                              style={{ backgroundColor: "#F5F8FC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BORDER }}
                              onPress={() => handleRebuy(item)}
                            >
                              <Ionicons name="refresh-outline" size={16} color={BRAND} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : activeTab === "missed" ? (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {missedItems.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#16A34A" />
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#16A34A", marginTop: 16, marginBottom: 6 }}>太棒了！沒有遺漏的計劃項目 🎉</Text>
                <Text style={{ fontSize: 14, color: HINT, textAlign: "center" }}>所有計劃購買的項目都已處理</Text>
              </View>
            ) : (
              <View>
                <View style={{ backgroundColor: "#FEF3C7", borderWidth: 1.5, borderColor: "#F59E0B", borderRadius: 12, padding: 10, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="information-circle-outline" size={18} color="#B45309" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#92400E", flex: 1 }}>以下項目計劃購買日期已過去，但尚未標記為購買</Text>
                    <TouchableOpacity
                      style={{ backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                      onPress={() => {
                        Alert.alert(
                          "批量移至今日",
                          `確定要將這 ${missedItems.length} 個項目全部移至今日嗎？`,
                          [
                            { text: "取消", style: "cancel" },
                            {
                              text: "確定",
                              onPress: () => {
                                missedItems.forEach((item: any) => {
                                  moveToTodayAllM.mutate({ id: item.id, plannedDate: DateUtil.todayISO() });
                                });
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>全部移至今日 ({missedItems.length}) →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Date Filter Chips */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {[
                    { key: "all" as const, label: `全部 (${missedItemCount.all})` },
                    { key: "7d" as const, label: `7 日 (${missedItemCount.seven})` },
                    { key: "30d" as const, label: `30 日 (${missedItemCount.thirty})` },
                  ].map((chip) => (
                    <TouchableOpacity
                      key={chip.key}
                      onPress={() => setMissedDateRange(chip.key)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: missedDateRange === chip.key ? "#B45309" : "#FEF3C7",
                      }}
                    >
                      <Text style={{ 
                        fontSize: 12, 
                        fontWeight: "700" as const, 
                        color: missedDateRange === chip.key ? "#fff" : "#B45309" 
                      }}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {groupedMissed.map(({ date, items }) => (
                  <View key={date} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Ionicons name="calendar-outline" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>{date}</Text>
                      <View style={{ backgroundColor: "#FEE2E2", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>{items.length} 項</Text>
                      </View>
                    </View>
                    {items.map((item: any, idx: number) => (
                      <View key={item.id || idx} style={{ backgroundColor: CARD, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: BORDER }}>
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }} numberOfLines={1}>{cleanItemName(item.name)}</Text>
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                            <Text style={{ fontSize: 12, color: "#DC2626" }}>計劃：{item.plannedDate ? formatDate(item.plannedDate) : "未定"}</Text>
                            {(item.quantity || item.unit) && <Text style={{ fontSize: 12, color: SUB }}>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</Text>}
                            {item.estimatedPrice != null ? (
                              <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>預算 HK${item.estimatedPrice}</Text>
                            ) : (
                              <Text style={{ fontSize: 11, color: "#D1D5DB" }}>未設預算</Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                          onPress={() => moveToTodayM.mutate({ id: item.id, plannedDate: DateUtil.todayISO() })}
                        >
                          <Ionicons name="calendar-outline" size={14} color="#fff" />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>移至今日</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : activeTab === "frequent" ? (
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {frequentItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="trending-up-outline" size={40} color="#E5D5C5" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUB, marginTop: 12 }}>暫無常買商品</Text>
                <Text style={{ fontSize: 12, color: "#C4B5A5", marginTop: 6, textAlign: "center" }}>購買同一商品 2 次或以上後，將顯示在這裡</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>按購買次數排列，點擊可預填購物清單</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {frequentItems.map((item: any, idx: number) => {
                    const days = daysSince(item.lastBoughtAt);
                    const lastPrice = lastPricesMap[item.name]?.price;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={{ width: (SW - 42) / 2, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, padding: 14 }}
                        onPress={() => handleRebuy({ ...item, actualPrice: lastPrice })}
                      >
                        <View style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: idx < 3 ? BRAND : BORDER, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 10, fontWeight: "900", color: idx < 3 ? "#fff" : SUB }}>{idx + 1}</Text>
                        </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingRight: 24 }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, flex: 1 }}>
                              {item.name}
                            </Text>
                          </View>
                        <View style={{ flexDirection: "row", gap: 4, marginBottom: 10 }}>
                          <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>買過 {item.count} 次</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: SUB }}>{days === 0 ? "今天" : `${days}天前`}</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
                          <Text style={{ fontSize: 11, color: SUB }}>購買 {item.count} 次</Text>
                          {lastPrice != null && (
                            <>
                              <Text style={{ fontSize: 11, color: SUB }}>·</Text>
                              <Text style={{ fontSize: 11, fontWeight: "600", color: "#013E77" }}>平均 HK${Math.round(lastPrice)}</Text>
                            </>
                          )}
                        </View>
                        <View style={{ backgroundColor: BRAND, borderRadius: 8, paddingVertical: 7, alignItems: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>再買</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
          </ScrollView>
        ) : null}

        {/* Edit Purchase Modal */}
        <Modal
          visible={showEditPurchaseModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditPurchaseModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Math.max(insets.bottom, 20) }}>
              <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT, textAlign: "center" }}>編輯購買</Text>
              </View>
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 20 }}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 8 }}>商品名稱</Text>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: TEXT }}>{editPurchaseItem?.name}</Text>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 8 }}>購買價格 (HK$)</Text>
                  <TextInput
                    style={{ backgroundColor: "#F9FAFB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: TEXT, borderWidth: 1, borderColor: BORDER }}
                    placeholder="輸入價格"
                    placeholderTextColor="#9CA3AF"
                    value={editPurchasePrice}
                    onChangeText={setEditPurchasePrice}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 8 }}>數量</Text>
                  <TextInput
                    style={{ backgroundColor: "#F9FAFB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: TEXT, borderWidth: 1, borderColor: BORDER }}
                    placeholder="輸入數量"
                    placeholderTextColor="#9CA3AF"
                    value={editPurchaseQty}
                    onChangeText={setEditPurchaseQty}
                  />
                </View>
              </ScrollView>
              <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                  onPress={() => {
                    setShowEditPurchaseModal(false);
                    setEditPurchaseItem(null);
                    setEditPurchasePrice("");
                    setEditPurchaseQty("");
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                  onPress={handleSaveEditPurchase}
                  disabled={saveEditPurchaseM.isPending}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>儲存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
