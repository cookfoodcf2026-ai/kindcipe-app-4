import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, Modal,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { getBilingualName } from "@/lib/bilingual";
import { useAuth } from "@/hooks/useAuth";
import UnitPicker from "@/src/components/UnitPicker";
import { useToast } from "@/src/components/Toast";
import { friendlyError } from "@/lib/errors";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#E0EAF4";

const FOOD_CATS = ["蔬菜生果", "肉類", "海鮮", "豆腐蛋類", "乾貨調味", "飲品乳製品"];
const HOUSE_CATS = ["家居清潔", "個人護理", "嬰幼兒", "寵物用品"];

const CAT_META: Record<string, { bg: string; border: string; label: string; emoji: string }> = {
  "蔬菜生果": { bg: "#F0FDF4", border: "#BBF7D0", label: "#15803D", emoji: "🥬" },
  "肉類": { bg: "#EEF4FB", border: "#C5D9F0", label: "#013E77", emoji: "🥩" },
  "海鮮": { bg: "#EFF6FF", border: "#BFDBFE", label: "#012D56", emoji: "🐟" },
  "豆腐蛋類": { bg: "#FEFCE8", border: "#FEF08A", label: "#A16207", emoji: "🥚" },
  "乾貨調味": { bg: "#EEF4FB", border: "#C5D9F0", label: "#012D56", emoji: "🫙" },
  "飲品乳製品": { bg: "#F0F9FF", border: "#BAE6FD", label: "#0369A1", emoji: "🥛" },
  "家居清潔": { bg: "#F5F3FF", border: "#DDD6FE", label: "#6D28D9", emoji: "sparkles-outline" },
  "個人護理": { bg: "#FDF2F8", border: "#F9A8D4", label: "#013E77", emoji: "water-outline" },
  "嬰幼兒": { bg: "#ECFDF5", border: "#A7F3D0", label: "#065F46", emoji: "happy-outline" },
  "寵物用品": { bg: "#EEF4FB", border: "#C5D9F0", label: "#012D56", emoji: "paw-outline" },
  "其他": { bg: "#F9FAFB", border: "#E5E7EB", label: "#374151", emoji: "grid-outline" },
};

export default function PantryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"food" | "household">("food");
  const [searchQ, setSearchQ] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set([...FOOD_CATS, ...HOUSE_CATS, "其他"]));

  const { data: pantryData = [], isLoading } = trpc.pantry.list.useQuery(undefined, { enabled: !!user });
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, { enabled: !!user });
  const { data: commonIngredients = [] } = (trpc as any).commonIngredient.list.useQuery(undefined, { staleTime: 1000 * 60 * 60 * 24, retry: 2 });
  const pantryIngLookup = useMemo(() => {
    const byName = new Map<string, { en?: string; fil?: string; id?: string }>();
    const norm = (x: string) => x.replace(/\s+/g, "").replace(/[，,。．.、()（）【】\[\]《》]/g, "").trim();
    for (const ing of commonIngredients) {
      const rec = { en: ing.nameEn ?? undefined, fil: ing.nameFil ?? undefined, id: ing.nameId ?? undefined };
      if (ing.nameZh) byName.set(norm(ing.nameZh), rec);
      if (ing.nameYue) byName.set(norm(ing.nameYue), rec);
      if (ing.nameEn) byName.set(String(ing.nameEn).toLowerCase(), rec);
    }
    return byName;
  }, [commonIngredients]);
  const biName = (name: string) => {
    const rec = pantryIngLookup.get(String(name).replace(/\s+/g, "").replace(/[，,。．.、()（）【】\[\]《》]/g, "").trim()) || pantryIngLookup.get(String(name).toLowerCase());
    return getBilingualName(name, rec?.en, rec?.fil, rec?.id);
  };
  const boughtItems = useMemo(() => shoppingItems.filter((i: any) => i.status === "bought"), [shoppingItems]);

  const addItemM = trpc.pantry.add.useMutation({
    onSuccess: () => { utils.pantry.list.invalidate(); setShowAddModal(false); setNewName(""); setNewQty(""); setNewUnit(""); showToast("已加入儲備"); },
    onError: (e) => Alert.alert("失敗", friendlyError(e)),
  });
  const deleteItemM = trpc.pantry.delete.useMutation({
    onSuccess: () => utils.pantry.list.invalidate(),
    onError: (e) => Alert.alert("失敗", friendlyError(e)),
  });
  const toggleInStockM = trpc.pantry.toggleInStock.useMutation({
    onSuccess: () => utils.pantry.list.invalidate(),
  });
  const toggleLowM = trpc.pantry.toggleLow.useMutation({
    onSuccess: () => utils.pantry.list.invalidate(),
  });
  const addFromShoppingM = trpc.pantry.addFromShopping.useMutation({
    onSuccess: (result: any) => { utils.pantry.list.invalidate(); showToast(`已將 ${result.count} 件已買商品入庫`); },
    onError: (e) => Alert.alert("失敗", friendlyError(e)),
  });
  const addShoppingM = trpc.shopping.add.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("失敗", friendlyError(e)),
  });

  const foodItems = useMemo(() => pantryData.filter((i: any) => !HOUSE_CATS.includes(i.category ?? "")), [pantryData]);
  const householdItems = useMemo(() => pantryData.filter((i: any) => HOUSE_CATS.includes(i.category ?? "")), [pantryData]);
  const displayItems = activeTab === "food" ? foodItems : householdItems;

  const filteredItems = useMemo(() => {
    if (!searchQ.trim()) return displayItems;
    const q = searchQ.toLowerCase();
    return displayItems.filter((i: any) => i.name.toLowerCase().includes(q) || (i.nameEn ?? "").toLowerCase().includes(q));
  }, [displayItems, searchQ]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of filteredItems) {
      const cat = item.category ?? "其他";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filteredItems]);

  const outOfStockItems = useMemo(() => displayItems.filter((i: any) => i.inStock === false), [displayItems]);
  const lowItems = useMemo(() => displayItems.filter((i: any) => i.isLow), [displayItems]);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleImportBought = () => {
    if (boughtItems.length === 0) { Alert.alert("目前沒有已買商品可入庫"); return; }
    addFromShoppingM.mutate(boughtItems.map((i: any) => ({
      name: i.name, category: i.category ?? undefined, quantity: i.quantity ?? undefined, unit: i.unit ?? undefined,
    })));
  };

  const handleAddToShopping = (item: any) => {
    addShoppingM.mutate({ name: item.name, category: item.category ?? "其他", quantity: item.quantity ?? "1", unit: item.unit ?? undefined });
  };

  const allCats = activeTab === "food" ? FOOD_CATS : HOUSE_CATS;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG }}>
        <ActivityIndicator color={BRAND} size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "家中儲備",
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
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {boughtItems.length > 0 && (
                <TouchableOpacity
                  style={{ backgroundColor: "#22C55E", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 }}
                  onPress={handleImportBought}
                  disabled={addFromShoppingM.isPending}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                    入庫({boughtItems.length})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ backgroundColor: BRAND, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 }}
                onPress={() => { setNewName(""); setNewCategory(allCats[0] || "其他"); setNewQty(""); setNewUnit(""); setShowAddModal(true); }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{t("pantry.add")}</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* Tab Switch */}
        <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 16, backgroundColor: "#EEF4FB", overflow: "hidden" }}>
          {[
            { key: "food" as const, label: "食品倉", count: foodItems.length, icon: "restaurant-outline" as const },
            { key: "household" as const, label: "用品倉", count: householdItems.length, icon: "water-outline" as const },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, backgroundColor: activeTab === tab.key ? BRAND : "transparent", borderRadius: 16 }}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={13} color={activeTab === tab.key ? "#fff" : "#5A4A3A"} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: activeTab === tab.key ? "#fff" : "#5A4A3A" }}>{t(tab.label as any)}</Text>
              <View style={{ backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.25)" : "#E5D5C0", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: activeTab === tab.key ? "#fff" : "#5A4A3A" }}>{tab.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF4FB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Ionicons name="search" size={14} color={SUB} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: TEXT }}
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder={`${t("搜尋" as any)}${activeTab === "food" ? t("食品" as any) : t("用品" as any)}...`}
              placeholderTextColor={SUB}
            />
            {searchQ ? (
              <TouchableOpacity onPress={() => setSearchQ("")}>
                <Ionicons name="close" size={14} color={SUB} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Import Banner */}
        {boughtItems.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: "#DCFCE7", borderWidth: 1.5, borderColor: "#86EFAC", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="cube-outline" size={18} color="#15803D" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#15803D" }}>{t("dyn.shoppingHasBought", { n: boughtItems.length })}</Text>
              <Text style={{ fontSize: 10, color: "#166534", marginTop: 1 }}>{boughtItems.slice(0, 3).map((i: any) => i.name).join("、")}{boughtItems.length > 3 ? t("dyn.etcN", { n: boughtItems.length }) : ""}</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: "#15803D", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }} onPress={handleImportBought} disabled={addFromShoppingM.isPending}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{addFromShoppingM.isPending ? t("dyn.stocking") : t("dyn.stockIn")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Out-of-Stock Banner */}
        {outOfStockItems.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Ionicons name="ellipse-outline" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>{t("dyn.outOfStockN", { n: outOfStockItems.length })}</Text>
              <Text style={{ fontSize: 10, color: "#991B1B", marginTop: 1 }}>{outOfStockItems.slice(0, 3).map((i: any) => i.name).join("、")}{outOfStockItems.length > 3 ? t("dyn.etcN", { n: outOfStockItems.length }) : ""}</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: "#EF4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }} onPress={() => { outOfStockItems.forEach((i: any) => handleAddToShopping(i)); showToast(`已將${outOfStockItems.length}件缺貨商品加入購物清單`); }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{t("pantry.addToPurchase")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Low Stock Banner */}
        {lowItems.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: "#E8F0FA", borderWidth: 1.5, borderColor: "#7BAFD4", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Ionicons name="alert-circle-outline" size={18} color={BRAND} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: BRAND }}>{t("dyn.runningLowN", { n: lowItems.length })}</Text>
              <Text style={{ fontSize: 10, color: "#78350F", marginTop: 1 }}>{lowItems.slice(0, 3).map((i: any) => i.name).join("、")}{lowItems.length > 3 ? t("dyn.etcN", { n: lowItems.length }) : ""}</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: BRAND, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }} onPress={() => { lowItems.forEach((i: any) => handleAddToShopping(i)); showToast(`已將${lowItems.length}件即將耗盡商品加入購物清單`); }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{t("pantry.addToPurchase")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category List */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedItems).map(([cat, items]) => {
            const meta = CAT_META[cat] ?? CAT_META["其他"];
            const isExpanded = expandedCats.has(cat);
            const inStockInCat = items.filter((i: any) => i.inStock !== false).length;
            return (
              <View key={cat} style={{ marginBottom: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: meta.border }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: meta.bg }}
                  onPress={() => toggleCat(cat)}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center" }}>
                    {meta.emoji.includes("-") ? (
                      <Ionicons name={meta.emoji as any} size={16} color={meta.label} />
                    ) : (
                      <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: meta.label }}>{cat}</Text>
                    <Text style={{ fontSize: 10, color: meta.label, opacity: 0.7 }}>
                      {inStockInCat}/{items.length} 有貨{items.filter((i: any) => i.isLow).length > 0 ? ` · ${items.filter((i: any) => i.isLow).length} 件即將耗盡` : ""}
                    </Text>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={meta.label} />
                </TouchableOpacity>

                {isExpanded && items.map((item: any) => {
                  const isInStock = item.inStock !== false;
                  return (
                    <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: !isInStock ? "#FFF5F5" : item.isLow ? "#EEF4FB" : CARD, borderTopWidth: 1, borderTopColor: meta.border }}>
                      <TouchableOpacity onPress={() => toggleInStockM.mutate({ id: item.id, inStock: !isInStock })}>
                        <Ionicons name={isInStock ? "checkmark-circle" : "ellipse-outline"} size={22} color={isInStock ? "#22C55E" : "#EF4444"} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: isInStock ? TEXT : SUB }}>{biName(item.name).primary}</Text>
                          {item.isLow && (
                            <View style={{ backgroundColor: "#E8F0FA", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color: BRAND }}>{t("pantry.runningLow")}</Text>
                            </View>
                          )}
                          {!isInStock && (
                            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color: "#DC2626" }}>{t("pantry.outOfStock")}</Text>
                            </View>
                          )}
                        </View>
                        {item.quantity && <Text style={{ fontSize: 10, color: SUB }}>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</Text>}
                      </View>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#E8F0FA", alignItems: "center", justifyContent: "center" }} onPress={() => handleAddToShopping(item)}>
                          <Ionicons name="cart-outline" size={14} color={BRAND} />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.isLow ? "#E8F0FA" : "#EEF4FB", alignItems: "center", justifyContent: "center" }} onPress={() => toggleLowM.mutate({ id: item.id, isLow: !item.isLow })}>
                          <Ionicons name="alert-circle-outline" size={14} color={item.isLow ? BRAND : SUB} />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", alignItems: "center", justifyContent: "center" }} onPress={() => { Alert.alert(t("shopping.deleteItem"), t("shopping.confirmDelete", { name: biName(item.name).primary }), [{ text: t("recipe.cancel"), style: "cancel" }, { text: t("shopping.delete"), style: "destructive", onPress: () => deleteItemM.mutate({ id: item.id }) }]); }}>
                          <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {filteredItems.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Ionicons name="cube-outline" size={36} color={HINT} />
              <Text style={{ fontSize: 13, color: SUB, fontWeight: "500", marginTop: 8 }}>
                {searchQ ? `${t("找不到" as any)}「${searchQ}」` : `${activeTab === "food" ? t("食品倉" as any) : t("用品倉" as any)}${t("暫無記錄" as any)}`}
              </Text>
              <Text style={{ fontSize: 11, color: HINT, marginTop: 4 }}>{t("pantry.tapAddHint")}</Text>
            </View>
          )}
          <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
        </ScrollView>

        {/* Add Modal */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>{t("pantry.addToPantry")}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>{t("pantry.productName")}</Text>
              <TextInput
                style={{ backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 10, fontSize: 14, color: TEXT, marginBottom: 12 }}
                value={newName}
                onChangeText={setNewName}
                placeholder={t("pantry.productPlaceholder")}
                placeholderTextColor={HINT}
              />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>{t("shopping.category")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {allCats.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: newCategory === cat ? BRAND : "#F1F5F9", borderWidth: 1, borderColor: newCategory === cat ? BRAND : BORDER }}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: newCategory === cat ? "#fff" : SUB }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>{t("pantry.quantityOptional")}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 10, fontSize: 14, color: TEXT }}
                  value={newQty}
                  onChangeText={setNewQty}
                  placeholder={t("pantry.quantityPlaceholder")}
                  placeholderTextColor={HINT}
                  keyboardType="decimal-pad"
                />
                <UnitPicker
                  value={newUnit}
                  onChange={setNewUnit}
                  style={{ width: 100, height: 42 }}
                />
              </View>
              <TouchableOpacity
                style={{ backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, alignItems: "center", opacity: (addItemM.isPending || !newName.trim()) ? 0.6 : 1 }}
                onPress={() => {
                  if (!newName.trim()) { Alert.alert("請輸入商品名稱"); return; }
                  const combinedQty = newQty.trim() + (newUnit.trim() ? newUnit.trim() : "");
                  addItemM.mutate({ name: newName.trim(), category: newCategory || "其他", quantity: combinedQty || undefined });
                }}
                disabled={addItemM.isPending || !newName.trim()}
              >
                {addItemM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{t("pantry.addToStock")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}
