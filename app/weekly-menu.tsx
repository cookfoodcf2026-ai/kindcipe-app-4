import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Image,
  Platform, Dimensions,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BG = "#FFFBF5";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#F0E8DC";

const DAY_LABELS = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];
const DAY_SHORT = ["", "一", "二", "三", "四", "五", "六", "日"];

type SlotType = "meat" | "seafood" | "veg" | "soup";

const SLOT_META: Record<SlotType, { icon: string; label: string; color: string }> = {
  meat: { icon: "restaurant-outline", label: "肉類", color: "#FFF0D6" },
  seafood: { icon: "fish-outline", label: "海鮮", color: "#E0F2FE" },
  veg: { icon: "leaf-outline", label: "蔬菜", color: "#DCFCE7" },
  soup: { icon: "cafe-outline", label: "湯水", color: "#FEF9C3" },
};

const SLOT_COLORS: Record<SlotType, string> = {
  meat: "#DC2626", seafood: "#0284C7", veg: "#16A34A", soup: "#0891B2",
};

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateForDow(weekStart: string, dow: number): string {
  const monday = new Date(weekStart + "T00:00:00");
  const d = new Date(monday);
  d.setDate(monday.getDate() + (dow - 1));
  return toDateStr(d);
}

function getTodayDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export default function WeeklyMenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const [weekOffset, setWeekOffset] = useState(0);
  const [currentDay, setCurrentDay] = useState(getTodayDow());
  const [editingSlot, setEditingSlot] = useState<{ day: number; slot: SlotType } | null>(null);
  const [showAISuggest, setShowAISuggest] = useState(false);
  const [planPickerRecipes, setPlanPickerRecipes] = useState<PickerRecipe[]>([]);

  const displayWeekStart = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay();
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    if (weekOffset === 1) monday.setDate(monday.getDate() + 7);
    return toDateStr(monday);
  }, [weekOffset]);

  const { data, isLoading, refetch } = trpc.weeklyMenu.getWeek.useQuery(
    { weekStart: displayWeekStart },
    { staleTime: 30000 },
  );

  const { data: officialRecipes = [] } = trpc.recipes.listOfficial.useQuery({ limit: 100, offset: 0 });
  const officialMap = useMemo(() => {
    const map = new Map<number, any>();
    officialRecipes.forEach((r: any) => map.set(r.id, r));
    return map;
  }, [officialRecipes]);

  const setDayM = trpc.weeklyMenu.setDay.useMutation({
    onSuccess: () => { utils.weeklyMenu.getWeek.invalidate({ weekStart: displayWeekStart }); Alert.alert("已設定"); },
    onError: (e) => Alert.alert("設定失敗", e.message),
  });

  const removeDayM = trpc.weeklyMenu.removeDay.useMutation({
    onSuccess: () => { utils.weeklyMenu.getWeek.invalidate({ weekStart: displayWeekStart }); Alert.alert("已移除"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: () => utils.mealPlan.listByDateRange.invalidate(),
    onError: (e) => Alert.alert("加入排餐失敗", e.message),
  });

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: (_, variables) => {
      utils.shopping.list.invalidate();
      utils.mealPlan.listByDateRange.invalidate();
      utils.shopping.list.refetch();
      const count = variables.items.length;
      setPlanPickerRecipes([]);
      Alert.alert("已加入排餐", count > 0 ? `${count} 件食材已加入購物清單` : "排餐已記錄");
    },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const itemsByDay: Record<number, any> = useMemo(() => {
    const map: Record<number, any> = {};
    (data?.items ?? []).forEach((item: any) => { map[item.dayOfWeek] = item; });
    return map;
  }, [data]);

  const currentItem = itemsByDay[currentDay];
  const currentDateStr = getDateForDow(displayWeekStart, currentDay);
  const todayStr = toDateStr(new Date());
  const isToday = todayStr === currentDateStr;
  const isPast = weekOffset === 0 && currentDateStr < todayStr;

  const slots: SlotType[] = ["meat", "seafood", "veg", "soup"];

  const getSlot = (item: any, slot: SlotType): { id: string | null; name: string | null; image: string | null; cookTime: number | null } => ({
    id: item ? item[`${slot}Id`] ?? null : null,
    name: item ? item[`${slot}Name`] ?? null : null,
    image: item ? item[`${slot}Image`] ?? null : null,
    cookTime: item ? item[`${slot}CookTime`] ?? null : null,
  });

  const resolveImage = (recipeId: string | null, storedImage: string | null) => {
    if (!recipeId) return null;
    const cleanId = recipeId.startsWith("official:") ? recipeId.slice(9) : recipeId;
    const numId = parseInt(cleanId, 10);
    if (!isNaN(numId)) {
      const official = officialMap.get(numId);
      if (official) return official.thumbnailUrl || official.image || null;
    }
    return null;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "晚餐推薦設定",
          headerStyle: { backgroundColor: BG },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "800", color: TEXT },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <Ionicons name="chevron-back" size={24} color={TEXT} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7C3AED", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
              onPress={() => setShowAISuggest(true)}
            >
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>AI 生成</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Week toggle */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 2, gap: 2 }}>
            {[
              { key: 0, label: "本週" },
              { key: 1, label: "下週" },
            ].map(w => (
              <TouchableOpacity
                key={w.key}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: weekOffset === w.key ? "#FF8C00" : "transparent" }}
                onPress={() => { setWeekOffset(w.key); setCurrentDay(w.key === 0 ? getTodayDow() : 1); }}
              >
                <Text style={{ fontSize: 12, fontWeight: weekOffset === w.key ? "800" : "500", color: weekOffset === w.key ? "#fff" : "#6B7280" }}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: SUB }}>{(data?.items ?? []).length}/7 天已設定</Text>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
          {/* Day navigation */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <TouchableOpacity style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }} onPress={() => setCurrentDay(d => d > 1 ? d - 1 : 7)}>
              <Ionicons name="chevron-back" size={16} color="#6B7280" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => {
                const ds = getDateForDow(displayWeekStart, d);
                const has = itemsByDay[d] && (itemsByDay[d].meatId || itemsByDay[d].seafoodId || itemsByDay[d].vegId || itemsByDay[d].soupId);
                return (
                  <TouchableOpacity key={d} style={{ alignItems: "center", gap: 2 }} onPress={() => setCurrentDay(d)}>
                    <Text style={{ fontSize: 10, fontWeight: currentDay === d ? "800" : "500", color: currentDay === d ? "#FF8C00" : todayStr === ds ? "#FF8C00" : SUB }}>{DAY_SHORT[d]}</Text>
                    <View style={{ width: currentDay === d ? 8 : 6, height: currentDay === d ? 8 : 6, borderRadius: 99, backgroundColor: currentDay === d ? "#FF8C00" : has ? "#FFC87A" : "#E5E7EB", borderWidth: todayStr === ds && currentDay !== d ? 1.5 : 0, borderColor: "#FF8C00" }} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }} onPress={() => setCurrentDay(d => d < 7 ? d + 1 : 1)}>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Day header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: isToday ? "#FF8C00" : TEXT }}>{DAY_LABELS[currentDay]}</Text>
            <Text style={{ fontSize: 12, color: SUB }}>{currentDateStr.slice(5).replace("-", "/")}</Text>
            {isToday && <View style={{ backgroundColor: "#FF8C00", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>今天</Text></View>}
            {isPast && <View style={{ backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 10, color: SUB }}>已過</Text></View>}
          </View>

          {/* 4 dish slots */}
          {isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color="#FF8C00" size="large" />
            </View>
          ) : (
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER, overflow: "hidden" }}>
              {slots.map(slotType => {
                const dish = getSlot(currentItem, slotType);
                const meta = SLOT_META[slotType];
                const hasDish = dish.id && dish.name;
                const resolvedImage = hasDish ? resolveImage(dish.id, dish.image) : null;
                return (
                  <View key={slotType} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                    <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon as any} size={22} color={SLOT_COLORS[slotType]} />
                    </View>
                    {hasDish ? (
                      <>
                        {resolvedImage ? (
                          <Image source={{ uri: resolvedImage }} style={{ width: 48, height: 48, borderRadius: 10, opacity: isPast ? 0.5 : 1 }} />
                        ) : (
                          <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: meta.color, alignItems: "center", justifyContent: "center", opacity: isPast ? 0.5 : 1 }}>
                            <Ionicons name={meta.icon as any} size={22} color={SLOT_COLORS[slotType]} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: isPast ? SUB : TEXT }}>{dish.name}</Text>
                          {dish.cookTime && <Text style={{ fontSize: 10, color: SUB }}>⏱ {dish.cookTime}分鐘</Text>}
                        </View>
                      </>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: SUB }}>{meta.label}</Text>
                        <Text style={{ fontSize: 10, color: HINT }}>尚未設定</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}
                      onPress={() => setEditingSlot({ day: currentDay, slot: slotType })}
                    >
                      <Ionicons name={hasDish ? "create-outline" : "add"} size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Action row */}
              <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
                {!isPast && (
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FF8C00", paddingVertical: 10, borderRadius: 10 }}
                    onPress={async () => {
                      const toAdd = slots.filter(s => { const d = getSlot(currentItem, s); return d.id && d.name; });
                      if (toAdd.length === 0) { Alert.alert("沒有可加入的菜式"); return; }
                      try {
                        await Promise.all(toAdd.map((s) => {
                          const d = getSlot(currentItem, s);
                          return addMealM.mutateAsync({
                            date: currentDateStr, mealType: "dinner", recipeId: d.id!, recipeName: d.name!, autoAddIngredients: false,
                          });
                        }));
                        const pickerRecipes: PickerRecipe[] = [];
                        toAdd.forEach((s) => {
                          const d = getSlot(currentItem, s);
                          const cleanId = d.id!.startsWith("official:") ? d.id!.slice(9) : d.id!;
                          const numId = parseInt(cleanId, 10);
                          const official = officialMap.get(numId);
                          if (official && Array.isArray(official.ingredients) && official.ingredients.length > 0) {
                            pickerRecipes.push({
                              id: d.id!,
                              name: d.name!,
                              ingredients: official.ingredients,
                              date: currentDateStr,
                            });
                          }
                        });
                        if (pickerRecipes.length > 0) {
                          setPlanPickerRecipes(pickerRecipes);
                        } else {
                          Alert.alert(`已將 ${toAdd.length} 道菜加入排餐`);
                        }
                      } catch (e: any) {
                        Alert.alert("加入排餐失敗", e?.message || "請稍後再試");
                      }
                    }}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>全部加入排餐</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ backgroundColor: "#F3F4F6", borderRadius: 10, padding: 10 }}
                  onPress={() => { Alert.alert("清除", `確認清除${DAY_LABELS[currentDay]}的餐單？`, [{ text: "取消", style: "cancel" }, { text: "清除", style: "destructive", onPress: () => removeDayM.mutate({ weekStart: displayWeekStart, dayOfWeek: currentDay }) }]); }}
                >
                  <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Legend */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16, justifyContent: "center" }}>
            {slots.map(s => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SLOT_COLORS[s] }} />
                <Text style={{ fontSize: 10, color: SUB }}>{SLOT_META[s].label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
        </ScrollView>
      </View>

      {/* Slot Picker Modal */}
      <Modal visible={editingSlot !== null} transparent animationType="slide">
        <SlotPickerModal
          dayOfWeek={editingSlot?.day ?? 1}
          slotType={editingSlot?.slot ?? "meat"}
          officialRecipes={officialRecipes}
          onSelect={(recipe) => {
            if (!editingSlot) return;
            const existing = itemsByDay[editingSlot.day];
            const makeSlot = (s: SlotType) => {
              if (s === editingSlot.slot) {
                return { id: `official:${recipe.id}`, name: recipe.name, image: recipe.thumbnailUrl || recipe.image, cookTime: recipe.cookTime };
              }
              const d = getSlot(existing, s);
              return { id: d.id ?? "", name: d.name ?? "", image: d.image, cookTime: d.cookTime };
            };
            setDayM.mutate({
              weekStart: displayWeekStart,
              dayOfWeek: editingSlot.day,
              meat: makeSlot("meat") as any,
              seafood: makeSlot("seafood") as any,
              veg: makeSlot("veg") as any,
              soup: makeSlot("soup") as any,
            });
            setEditingSlot(null);
          }}
          onClose={() => setEditingSlot(null)}
          isPending={setDayM.isPending}
        />
      </Modal>

      {/* AI Suggest Modal */}
      <AISuggestModalRN
        visible={showAISuggest}
        weekStart={displayWeekStart}
        officialRecipes={officialRecipes}
        onClose={() => setShowAISuggest(false)}
        onPublished={() => { setShowAISuggest(false); utils.weeklyMenu.getWeek.invalidate({ weekStart: displayWeekStart }); refetch(); }}
      />

      <IngredientPickerModal
        visible={planPickerRecipes.length > 0}
        recipes={planPickerRecipes}
        loading={addShoppingBatchM.isPending}
        onConfirm={(items) => {
          if (items.length > 0) {
            addShoppingBatchM.mutate({
              items: items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                category: i.category,
              })),
              fromRecipeName: planPickerRecipes.map((r) => r.name).join("、"),
              plannedDate: planPickerRecipes[0]?.date,
            });
          } else {
            setPlanPickerRecipes([]);
            Alert.alert("已加入排餐");
          }
        }}
        onSkip={() => {
          setPlanPickerRecipes([]);
          Alert.alert("已加入排餐");
        }}
      />
    </>
  );
}

function SlotPickerModal({
  dayOfWeek, slotType, officialRecipes, onSelect, onClose, isPending,
}: {
  dayOfWeek: number; slotType: SlotType; officialRecipes: any[];
  onSelect: (recipe: any) => void; onClose: () => void; isPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const meta = SLOT_META[slotType];

  const filtered = useMemo(() => {
    const results: any[] = [];
    officialRecipes.forEach((r: any) => {
      const cat = r.recipeCategory || "";
      const tags = Array.isArray(r.tags) ? r.tags.join(" ") : "";
      const name = r.name;
      let match = false;
      if (slotType === "soup") match = cat === "soup" || tags.includes("湯") || name.includes("湯");
      else if (slotType === "seafood") match = cat === "seafood" || tags.includes("海鮮") || tags.includes("魚") || tags.includes("蝦");
      else if (slotType === "veg") match = cat === "vegetable" || cat === "egg";
      else if (slotType === "meat") match = cat === "pork" || cat === "beef" || cat === "poultry";
      if (match) results.push(r);
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      return results.filter(r => r.name.toLowerCase().includes(q));
    }
    return results;
  }, [slotType, officialRecipes, search]);

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%", minHeight: "50%" }}>
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}><Ionicons name={meta.icon as any} size={14} color={SLOT_COLORS[slotType]} /> 選擇{DAY_LABELS[dayOfWeek]}{meta.label}</Text>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
              <Ionicons name="close" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="search" size={14} color={SUB} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: TEXT }}
              value={search}
              onChangeText={setSearch}
              placeholder={`搜尋${meta.label}食譜...`}
              placeholderTextColor={SUB}
            />
          </View>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: SUB }}>食譜庫中暫無{meta.label}食譜</Text>
              <Text style={{ fontSize: 11, color: HINT, marginTop: 4 }}>請先在食譜庫加入相關食譜</Text>
            </View>
          ) : (
            filtered.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                onPress={() => onSelect(recipe)}
                disabled={isPending}
              >
                {recipe.thumbnailUrl || recipe.image ? (
                  <Image source={{ uri: recipe.thumbnailUrl || recipe.image }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={meta.icon as any} size={20} color={SLOT_COLORS[slotType]} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>{recipe.name}</Text>
                  {recipe.cookTime && <Text style={{ fontSize: 10, color: SUB }}>⏱ {recipe.cookTime}分鐘</Text>}
                </View>
                {isPending && <ActivityIndicator size="small" color={BRAND} />}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function AISuggestModalRN({
  visible, weekStart, officialRecipes, onClose, onPublished,
}: {
  visible: boolean; weekStart: string; officialRecipes: any[];
  onClose: () => void; onPublished: () => void;
}) {
  const [suggestedDays, setSuggestedDays] = useState<any[] | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [swapTarget, setSwapTarget] = useState<{ day: number; slot: SlotType } | null>(null);

  const aiSuggestM = trpc.weeklyMenu.aiSuggest.useMutation({
    onSuccess: (data: any) => {
      setSuggestedDays(data.days);
      setReasoning(data.reasoning || "");
    },
    onError: (e) => Alert.alert("AI 推薦失敗", e.message),
  });
  const setWeekM = trpc.weeklyMenu.setWeek.useMutation({
    onSuccess: () => { Alert.alert("餐單已發布"); onPublished(); },
    onError: (e) => Alert.alert("發布失敗", e.message),
  });

  const handleSwap = (dayOfWeek: number, slotType: SlotType, newDish: any) => {
    setSuggestedDays(prev =>
      prev ? prev.map(d =>
        d.dayOfWeek === dayOfWeek ? { ...d, [slotType]: { ...newDish, reason: "手動替換" } } : d
      ) : prev
    );
  };

  const slots: SlotType[] = ["meat", "seafood", "veg", "soup"];

  if (!visible) return null;

  return (
    <>
      <Modal visible transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ flex: 1, backgroundColor: BG, marginTop: 60, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
            {/* Header */}
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: TEXT }}>AI 智能週餐推薦</Text>
                    <Text style={{ fontSize: 10, color: SUB }}>每天：1肉 + 1海鮮 + 1蔬菜 + 1湯</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }}>
              {!suggestedDays && !aiSuggestM.isPending && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.13)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Ionicons name="sparkles" size={28} color="#7C3AED" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, marginBottom: 8 }}>讓 AI 幫你安排本週 7 天晚餐</Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginBottom: 24 }}>每天自動安排：肉類 + 海鮮/魚 + 蔬菜 + 湯</Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7C3AED", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 }}
                    onPress={() => aiSuggestM.mutate({ city: "香港" })}
                  >
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>開始 AI 生成</Text>
                  </TouchableOpacity>
                </View>
              )}

              {aiSuggestM.isPending && (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT, marginTop: 16 }}>AI 正在分析...</Text>
                  <Text style={{ fontSize: 11, color: SUB, marginTop: 4 }}>正在獲取天氣資料、分析飲食記錄</Text>
                </View>
              )}

              {suggestedDays && (
                <>
                  {reasoning && (
                    <View style={{ backgroundColor: "#F5F3FF", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#DDD6FE" }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Ionicons name="sparkles" size={12} color="#7C3AED" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 11, color: "#5B21B6", lineHeight: 18 }}>{reasoning}</Text>
                      </View>
                    </View>
                  )}

                  <View style={{ gap: 10 }}>
                    {[...suggestedDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(day => (
                      <View key={day.dayOfWeek} style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, overflow: "hidden" }}>
                        <View style={{ padding: 8, backgroundColor: day.dayOfWeek >= 6 ? "#FFF7ED" : "#F8FAFC", borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 12, fontWeight: "900", color: day.dayOfWeek >= 6 ? "#FF8C00" : "#374151" }}>
                            {DAY_LABELS[day.dayOfWeek]}{day.dayOfWeek >= 6 ? " 週末" : ""}
                          </Text>
                        </View>
                        <View style={{ padding: 8, gap: 6 }}>
                          {slots.map(slotType => {
                            const dish = day[slotType];
                            const meta = SLOT_META[slotType];
                            return (
                              <View key={slotType} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FAFAFA", borderRadius: 10, padding: 6, borderWidth: 1, borderColor: BORDER }}>
                                <View style={{ width: 36, alignItems: "center" }}>
                                  <Ionicons name={meta.icon as any} size={16} color={SLOT_COLORS[slotType]} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }} numberOfLines={1}>{dish?.name || "—"}</Text>
                                  {dish?.reason && <Text style={{ fontSize: 9, color: SUB }}><Ionicons name="bulb" size={9} color={SUB} /> {dish.reason}</Text>}
                                </View>
                                <TouchableOpacity
                                  style={{ backgroundColor: "#F3F4F6", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 }}
                                  onPress={() => setSwapTarget({ day: day.dayOfWeek, slot: slotType })}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#6B7280" }}>換</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {suggestedDays && (
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" }}
                  onPress={() => aiSuggestM.mutate({ city: "香港" })}
                  disabled={aiSuggestM.isPending}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151" }}>重新生成</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FF8C00", alignItems: "center" }}
                  onPress={() => {
                    if (!suggestedDays) return;
                    setWeekM.mutate({
                      weekStart,
                      days: suggestedDays.map((d: any) => ({
                        dayOfWeek: d.dayOfWeek,
                        meat: { id: d.meat.id, name: d.meat.name, image: d.meat.image, cookTime: d.meat.cookTime },
                        seafood: { id: d.seafood.id, name: d.seafood.name, image: d.seafood.image, cookTime: d.seafood.cookTime },
                        veg: { id: d.veg.id, name: d.veg.name, image: d.veg.image, cookTime: d.veg.cookTime },
                        soup: { id: d.soup.id, name: d.soup.name, image: d.soup.image, cookTime: d.soup.cookTime },
                      }) as any),
                    });
                  }}
                  disabled={setWeekM.isPending}
                >
                  {setWeekM.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>一鍵確認發布</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Swap Picker overlay */}
      {swapTarget && suggestedDays && (
        <SwapPickerRN
          dayOfWeek={swapTarget.day}
          slotType={swapTarget.slot}
          officialRecipes={officialRecipes}
          currentId={suggestedDays.find(d => d.dayOfWeek === swapTarget.day)?.[swapTarget.slot]?.id || ""}
          onSelect={(dish) => { handleSwap(swapTarget.day, swapTarget.slot, dish); setSwapTarget(null); }}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </>
  );
}

function SwapPickerRN({
  dayOfWeek, slotType, officialRecipes, onSelect, onClose,
}: {
  dayOfWeek: number; slotType: SlotType; officialRecipes: any[]; currentId: string;
  onSelect: (dish: any) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const meta = SLOT_META[slotType];

  const filtered = useMemo(() => {
    const results: any[] = [];
    officialRecipes.forEach((r: any) => {
      const cat = r.recipeCategory || "";
      const tags = Array.isArray(r.tags) ? r.tags.join(" ") : "";
      const name = r.name;
      let match = false;
      if (slotType === "soup") match = cat === "soup" || tags.includes("湯") || name.includes("湯");
      else if (slotType === "seafood") match = cat === "seafood" || tags.includes("海鮮") || tags.includes("魚") || tags.includes("蝦");
      else if (slotType === "veg") match = cat === "vegetable" || cat === "egg";
      else if (slotType === "meat") match = cat === "pork" || cat === "beef" || cat === "poultry";
      if (match) results.push(r);
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      return results.filter(r => r.name.toLowerCase().includes(q));
    }
    return results;
  }, [slotType, officialRecipes, search]);

  return (
    <Modal transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}><Ionicons name={meta.icon as any} size={14} color={SLOT_COLORS[slotType]} /> 替換{DAY_LABELS[dayOfWeek]}{meta.label}</Text>
              <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
                <Ionicons name="close" size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: TEXT }}
              value={search}
              onChangeText={setSearch}
              placeholder={`搜尋${meta.label}食譜...`}
              placeholderTextColor={SUB}
            />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {filtered.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                onPress={() => onSelect({ id: `official:${recipe.id}`, name: recipe.name, image: recipe.thumbnailUrl || recipe.image, cookTime: recipe.cookTime })}
              >
                <Image source={{ uri: recipe.image || recipe.thumbnailUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=80&q=60" }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>{recipe.name}</Text>
                  {recipe.cookTime && <Text style={{ fontSize: 10, color: SUB }}>⏱ {recipe.cookTime}分鐘</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
