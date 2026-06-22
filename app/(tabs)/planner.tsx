import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Image,
  TextInput,
  Dimensions,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { scheduleMealNotification, requestNotificationPermission } from "@/lib/notifications";
import { useMemo, useState, useCallback } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/hooks/useAuth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MEAL_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "早餐", icon: "sunny-outline" },
  lunch: { label: "午餐", icon: "sunny-outline" },
  dinner: { label: "晚餐", icon: "moon-outline" },
  snack: { label: "小食", icon: "film-outline" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "已確認", color: "#16A34A", bg: "#DCFCE7" },
  pending: { label: "提案中", color: "#013E77", bg: "#E8F0FE" },
  rejected: { label: "已拒絕", color: "#DC2626", bg: "#FEE2E2" },
};

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const SEASONING_CATS = new Set(["調味料", "醬料"]);

const getWeekRange = (offset: number) => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { startDate: fmt(monday), endDate: fmt(sunday), monday, sunday };
};

const formatDateShort = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()}`;

const formatWeekLabel = (monday: Date, sunday: Date) => {
  const now = new Date();
  const todayMonday = getWeekRange(0).monday;
  if (monday.getTime() === todayMonday.getTime()) return "本週";
  const nextMonday = getWeekRange(1).monday;
  if (monday.getTime() === nextMonday.getTime()) return "下週";
  const prevMonday = getWeekRange(-1).monday;
  if (monday.getTime() === prevMonday.getTime()) return "上週";
  return `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
};

const isToday = (d: Date) => {
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const isPast = (d: Date) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
};

export default function PlannerTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDayIndex, setAddDayIndex] = useState<number>(-1);
  const [addMealType, setAddMealType] = useState<string>("dinner");
  const [pickerSearch, setPickerSearch] = useState("");
  const [eatOutDays, setEatOutDays] = useState<Set<string>>(new Set());
  // Ingredient picker state — shown after adding a recipe
  const [ingPickerRecipe, setIngPickerRecipe] = useState<{ id: string; name: string; ingredients: any[]; date: string } | null>(null);
  const [selectedIngs, setSelectedIngs] = useState<Set<number>>(new Set());
  // Store ingredients directly in state to avoid stale-closure issues with onSuccess
  const [pendingIngredients, setPendingIngredients] = useState<any[] | null>(null);
  const [pendingConfirmRecipe, setPendingConfirmRecipe] = useState<{ id: string; name: string; ingredients: any[]; date: string } | null>(null);

  const { startDate, endDate, monday, sunday } = getWeekRange(weekOffset);

  const utils = trpc.useUtils();

  const { data: mealPlans = [], isLoading } =
    trpc.mealPlan.listByDateRange.useQuery(
      { startDate, endDate },
      { staleTime: 1000 * 30 },
    );

  const { data: officialRecipes = [] } = trpc.recipes.listOfficial.useQuery(
    { limit: 200, offset: 0 },
    { staleTime: 1000 * 60 },
  );

  const { data: userRecipes = [] } = trpc.recipes.listUser.useQuery(
    { limit: 200, offset: 0 },
    { staleTime: 1000 * 60 },
  );

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
  });

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: (_, variables) => {
      utils.mealPlan.listByDateRange.invalidate();
      setShowAddModal(false);

      // Send local notification
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleMealNotification(variables.recipeName, variables.mealType === "dinner" ? "晚餐" : variables.mealType === "lunch" ? "午餐" : "早餐");
      });

      // Read ingredients stored before mutation fired
      const ings = pendingIngredients;
      setPendingIngredients(null);

      if (ings && ings.length > 0) {
        setIngPickerRecipe({
          id: variables.recipeId,
          name: variables.recipeName,
          ingredients: ings,
          date: variables.date,
        });
        setSelectedIngs(new Set(ings.map((_: any, i: number) => i)));
      } else {
        // Fallback: search loaded recipe lists
        const found = [...officialRecipes, ...userRecipes].find(
          (r: any) => `official_${r.id}` === variables.recipeId || `user_${r.id}` === variables.recipeId
        ) as any;
        if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
          setIngPickerRecipe({
            id: variables.recipeId,
            name: variables.recipeName,
            ingredients: found.ingredients,
            date: variables.date,
          });
          setSelectedIngs(new Set(found.ingredients.map((_: any, i: number) => i)));
        } else {
          Alert.alert("已加入排餐");
        }
      }
    },
    onError: (e) => { setPendingIngredients(null); Alert.alert("新增失敗", e.message); },
  });

  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: () => utils.mealPlan.listByDateRange.invalidate(),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, { staleTime: 30000, refetchInterval: 15000 });
  const deleteShoppingItemM = trpc.shopping.delete.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
  });

  const confirmMealM = trpc.mealPlan.confirm.useMutation({
    onSuccess: () => {
      utils.mealPlan.listByDateRange.invalidate();
      const conf = pendingConfirmRecipe;
      setPendingConfirmRecipe(null);
      if (conf && Array.isArray(conf.ingredients) && conf.ingredients.length > 0) {
        setIngPickerRecipe(conf);
        // Default: all checked except seasoning
        const initSel = new Set<number>();
        conf.ingredients.forEach((_: any, i: number) => {
          if (!SEASONING_CATS.has(conf.ingredients[i].category || "")) initSel.add(i);
        });
        setSelectedIngs(initSel);
      }
    },
    onError: (e) => Alert.alert("確認失敗", e.message),
  });

  const rejectMealM = trpc.mealPlan.reject.useMutation({
    onSuccess: () => utils.mealPlan.listByDateRange.invalidate(),
    onError: (e) => Alert.alert("拒絕失敗", e.message),
  });

  const { familyRole } = useAuth();
  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const mealsByDate = useMemo(() => {
    const map: Record<string, typeof mealPlans> = {};
    for (const mp of mealPlans) {
      if (!map[mp.date]) map[mp.date] = [];
      map[mp.date].push(mp);
    }
    return map;
  }, [mealPlans]);

  const weekDays = useMemo(() => {
    const days: { dateStr: string; date: Date; dayIndex: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ dateStr: d.toISOString().split("T")[0], date: d, dayIndex: i });
    }
    return days;
  }, [monday]);

  const pickerRecipes = useMemo(() => {
    // BUG#1 FIX: include both official AND user recipes in picker
    const all = [
      ...officialRecipes.map((r: any) => ({ ...r, _source: "official" as const })),
      ...userRecipes.map((r: any) => ({ ...r, _source: "user" as const })),
    ];
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      return all.filter(
        (r: any) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q),
      );
    }
    return all;
  }, [officialRecipes, userRecipes, pickerSearch]);

  const handleAddMeal = useCallback(
    (recipe: any) => {
      if (addDayIndex < 0) return;
      const dateStr = weekDays[addDayIndex]?.dateStr;
      if (!dateStr) return;
      const prefix = recipe._source === "user" ? "user_" : "official_";
      // Store ingredients before mutation fires — onSuccess reads them
      setPendingIngredients(Array.isArray(recipe.ingredients) ? recipe.ingredients : []);
      addMealM.mutate({
        date: dateStr,
        mealType: addMealType as "breakfast" | "lunch" | "dinner" | "snack",
        recipeId: `${prefix}${recipe.id}`,
        recipeName: recipe.name,
        recipeImage: recipe.thumbnailUrl || recipe.image || undefined,
        autoAddIngredients: false,
      });
    },
    [addDayIndex, addMealType, weekDays, addMealM],
  );

  const handleDeleteMeal = useCallback(
    (mp: any) => {
      Alert.alert("刪除餐點", `確定要刪除「${mp.recipeName}」？`, [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            deleteMealM.mutate({ id: mp.id });
            // Check for non-bought shopping items from this recipe
            const recipeItems = (shoppingItems as any[]).filter(
              (si: any) =>
                si.fromRecipeName === mp.recipeName &&
                !si.bought,
            );
            if (recipeItems.length > 0) {
              setTimeout(() => {
                Alert.alert(
                  "食材仍在購物清單",
                  `「${mp.recipeName}」中有 ${recipeItems.length} 項食材未購買，要一併從購物清單移除嗎？`,
                  [
                    { text: "保留食材", style: "cancel" },
                    {
                      text: "移除食材",
                      style: "destructive",
                      onPress: () => {
                        recipeItems.forEach((si: any) =>
                          deleteShoppingItemM.mutate({ id: si.id }),
                        );
                      },
                    },
                  ],
                );
              }, 300);
            }
          },
        },
      ]);
    },
    [deleteMealM, shoppingItems, deleteShoppingItemM],
  );

  const handleConfirmMeal = useCallback(
    (mp: any) => {
      const prefix = mp.recipeId.startsWith("user_") ? "user_" : "official_";
      const recipeId = mp.recipeId.replace(prefix, "");
      const found = [...officialRecipes, ...userRecipes].find(
        (r: any) => String(r.id) === recipeId,
      ) as any;
      const ings = found?.ingredients;
      if (Array.isArray(ings) && ings.length > 0) {
        setPendingConfirmRecipe({
          id: mp.recipeId,
          name: mp.recipeName,
          ingredients: ings,
          date: mp.date,
        });
      }
      confirmMealM.mutate({ id: mp.id });
    },
    [officialRecipes, userRecipes, confirmMealM],
  );

  const toggleDay = (idx: number) => {
    setExpandedDay(expandedDay === idx ? null : idx);
  };

  const openAddModal = (dayIndex: number, mealType: string) => {
    setAddDayIndex(dayIndex);
    setAddMealType(mealType);
    setPickerSearch("");
    setShowAddModal(true);
  };

  const renderMealItem = (mp: any) => {
    const sConfig = STATUS_CONFIG[mp.status] || STATUS_CONFIG.confirmed;
    const mConfig = MEAL_TYPE_CONFIG[mp.mealType] || MEAL_TYPE_CONFIG.dinner;
    const isPending = mp.status === "pending";
    return (
      <View key={mp.id} style={[styles.mealItem, { borderLeftColor: sConfig.color }]}>
        <TouchableOpacity
          style={styles.mealTouchable}
          onPress={() =>
            router.push({
              pathname: "/recipe/[id]",
              params: { id: mp.recipeId },
            })
          }
          onLongPress={() => handleDeleteMeal(mp)}
        >
          {mp.recipeImage ? (
            <Image source={{ uri: mp.recipeImage }} style={styles.mealImage} />
          ) : null}
          <View style={styles.mealInfo}>
            <View style={styles.mealTop}>
              <View style={[styles.mealTypeBadge, { flexDirection: "row", alignItems: "center", gap: 3 }]}>
                <Ionicons name={(mConfig.icon as any)} size={12} color="#013E77" />
                <Text style={styles.mealTypeText}>{mConfig.label}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sConfig.bg }]}>
                <Text style={[styles.statusText, { color: sConfig.color }]}>
                  {sConfig.label}
                </Text>
              </View>
            </View>
            <Text style={styles.mealName} numberOfLines={1}>
              {mp.recipeName}
            </Text>
            {mp.proposedByName ? (
              <Text style={styles.mealProposer}>由 {mp.proposedByName} 提案</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {isPending && (
          isAdmin ? (
            <View style={styles.mealActions}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleConfirmMeal(mp)}
              >
                <Ionicons name="checkmark-outline" size={14} color="#16A34A" />
                <Text style={styles.confirmBtnText}> 確認</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => {
                  Alert.alert("拒絕餐點", `確定要拒絕「${mp.recipeName}」？`, [
                    { text: "取消", style: "cancel" },
                    {
                      text: "拒絕",
                      style: "destructive",
                      onPress: () => rejectMealM.mutate({ id: mp.id }),
                    },
                  ]);
                }}
              >
                <Ionicons name="close-outline" size={14} color="#DC2626" />
                <Text style={styles.rejectBtnText}> 拒絕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waitingRow}>
              <Ionicons name="time-outline" size={13} color="#CA8A04" />
              <Text style={styles.waitingText}>
                等待 {mp.proposedByName || "管理員"} 確認
              </Text>
            </View>
          )
        )}
      </View>
    );
  };

  const renderDayCard = (day: (typeof weekDays)[0], idx: number) => {
    const dayMeals = mealsByDate[day.dateStr] || [];
    const isExpanded = expandedDay === idx;
    const today = isToday(day.date);
    const past = isPast(day.date);
    const allConfirmed = dayMeals.length > 0 && dayMeals.every((m) => m.status === "confirmed");
    const hasPending = dayMeals.some((m) => m.status === "pending");

    return (
      <TouchableOpacity
        key={day.dateStr}
        style={[
          styles.dayCard,
          today && styles.dayCardToday,
          past && styles.dayCardPast,
        ]}
        onPress={() => toggleDay(idx)}
        activeOpacity={0.7}
      >
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderLeft}>
            <Text style={[styles.dayName, today && styles.dayNameToday]}>
              {DAY_NAMES[day.date.getDay()]}
            </Text>
            <Text style={[styles.dayDate, today && styles.dayDateToday]}>
              {formatDateShort(day.date)}
            </Text>
            {today && <View style={styles.todayBadge}><Text style={styles.todayText}>今天</Text></View>}
          </View>
          <View style={styles.dayHeaderRight}>
            {/* Eat-out toggle */}
            <TouchableOpacity
              style={[styles.eatOutBtn, eatOutDays.has(day.dateStr) && styles.eatOutBtnActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                setEatOutDays(prev => {
                  const next = new Set(prev);
                  if (next.has(day.dateStr)) next.delete(day.dateStr);
                  else next.add(day.dateStr);
                  return next;
                });
              }}
            >
              <Ionicons name="restaurant-outline" size={12} color={eatOutDays.has(day.dateStr) ? "#D97706" : "#9CA3AF"} />
              <Text style={[styles.eatOutTxt, eatOutDays.has(day.dateStr) && styles.eatOutTxtActive]}>
                外出
              </Text>
            </TouchableOpacity>
            {dayMeals.length > 0 ? (
              <View style={[styles.countBadge, { backgroundColor: allConfirmed ? "#DCFCE7" : "#E8F0FE" }]}>
                <Text style={[styles.countText, { color: allConfirmed ? "#16A34A" : "#013E77" }]}>
                  {dayMeals.length} 餐
                </Text>
              </View>
            ) : eatOutDays.has(day.dateStr) ? (
              <View style={styles.eatOutBadge}>
                <Text style={styles.eatOutBadgeTxt}>外出用餐</Text>
              </View>
            ) : (
              <Text style={styles.emptyMealText}>尚未安排</Text>
            )}
            <Text style={styles.expandArrow}>{isExpanded ? "▲" : "▼"}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.dayBody}>
            {dayMeals.map(renderMealItem)}
            <View style={styles.addMealRow}>
              {["breakfast", "lunch", "dinner", "snack"].map((mt) => {
                const cfg = MEAL_TYPE_CONFIG[mt];
                const exists = dayMeals.some((m) => m.mealType === mt);
                return (
                  <TouchableOpacity
                    key={mt}
                    style={styles.addMealBtn}
                    onPress={() => openAddModal(idx, mt)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Text style={styles.addMealBtnText}>{exists ? "↻" : "+"}</Text>
                      <Ionicons name={(cfg?.icon as any)} size={12} color="#013E77" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>排餐計劃</Text>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={() => setWeekOffset(weekOffset - 1)}
          style={styles.weekNavBtn}
        >
          <Text style={styles.weekNavArrow}>◀</Text>
        </TouchableOpacity>
        <View style={styles.weekNavCenter}>
          <Text style={styles.weekLabel}>
            {formatDateShort(monday)} - {formatDateShort(sunday)}
          </Text>
          <Text style={styles.weekSubLabel}>{formatWeekLabel(monday, sunday)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setWeekOffset(weekOffset + 1)}
          style={styles.weekNavBtn}
        >
          <Text style={styles.weekNavArrow}>▶</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: "#999", fontSize: 14 }}>載入中...</Text>
        </View>
      ) : (
        <FlatList
          data={weekDays}
          keyExtractor={(d) => d.dateStr}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => renderDayCard(item, index)}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>選擇食譜</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBar}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="搜尋食譜..."
                placeholderTextColor="#999"
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
            </View>

            <FlatList
              data={pickerRecipes}
              keyExtractor={(item: any) => `${item._source ?? "official"}_${item.id}`}
              numColumns={2}
              columnWrapperStyle={styles.pickerGridRow}
              contentContainerStyle={styles.pickerGrid}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={{ color: "#999", fontSize: 14 }}>
                    {pickerSearch ? "沒有符合的食譜" : "暫無官方食譜"}
                  </Text>
                </View>
              }
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.pickerCard}
                  onPress={() => handleAddMeal(item)}
                >
                  {item.thumbnailUrl || item.image ? (
                    <Image
                      source={{ uri: item.thumbnailUrl || item.image }}
                      style={styles.pickerCardImage}
                    />
                  ) : (
                    <View style={[styles.pickerCardImage, styles.pickerCardPlaceholder]}>
                      <Ionicons name="flame-outline" size={28} color="#999" />
                    </View>
                  )}
                  <View style={styles.pickerCardInfo}>
                    <Text style={styles.pickerCardName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.cookTime ? (
                      <Text style={styles.pickerCardMeta}>⏱️ {item.cookTime}分</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Ingredient Picker Sheet */}
      <Modal visible={!!ingPickerRecipe} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "75%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>加入食材到採購清單</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{ingPickerRecipe?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setIngPickerRecipe(null); Alert.alert("已加入排餐"); }}>
                <Ionicons name="close-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>
                選擇要加入採購清單的食材（調味料預設不勾選）
              </Text>
              {(ingPickerRecipe?.ingredients ?? []).map((ing: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                  onPress={() => {
                    setSelectedIngs(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      return next;
                    });
                  }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#013E77", alignItems: "center", justifyContent: "center", backgroundColor: selectedIngs.has(idx) ? "#013E77" : "transparent" }}>
                    {selectedIngs.has(idx) && <Ionicons name="checkmark-outline" size={12} color="#fff" />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}>{ing.name}</Text>
                  <Text style={{ fontSize: 12, color: "#9CA3AF" }}>{ing.quantity} {ing.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ padding: 16, gap: 8 }}>
              <TouchableOpacity
                style={{ backgroundColor: "#013E77", paddingVertical: 14, borderRadius: 14, alignItems: "center" }}
                onPress={() => {
                  if (!ingPickerRecipe) return;
                  const toAdd = ingPickerRecipe.ingredients
                    .filter((_: any, i: number) => selectedIngs.has(i))
                    .map((i: any) => ({ name: i.name, quantity: String(i.quantity || ""), unit: i.unit || "", category: i.category || "食材" }));
                  if (toAdd.length > 0) {
                    addShoppingBatchM.mutate({
                      items: toAdd,
                      fromRecipeId: ingPickerRecipe.id,
                      fromRecipeName: ingPickerRecipe.name,
                      plannedDate: ingPickerRecipe.date,
                    });
                  }
                  setIngPickerRecipe(null);
                  Alert.alert("已加入排餐", toAdd.length > 0 ? `${toAdd.length} 件食材已加入採購清單` : "排餐已記錄");
                }}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                  {selectedIngs.size > 0 ? `加入 ${selectedIngs.size} 件食材到採購清單` : "跳過，只加入排餐"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 10, alignItems: "center" }}
                onPress={() => { setIngPickerRecipe(null); Alert.alert("已加入排餐"); }}
              >
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>跳過，不加入採購清單</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#013E77",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  weekNavBtn: {
    padding: 8,
  },
  weekNavArrow: {
    fontSize: 16,
    color: "#013E77",
  },
  weekNavCenter: {
    alignItems: "center",
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  weekSubLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: "#013E77",
  },
  dayCardPast: {
    opacity: 0.7,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  dayNameToday: {
    color: "#013E77",
  },
  dayDate: {
    fontSize: 14,
    color: "#666",
  },
  dayDateToday: {
    color: "#013E77",
    fontWeight: "600",
  },
  todayBadge: {
    backgroundColor: "#013E77",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyMealText: {
    fontSize: 12,
    color: "#bbb",
  },
  // Eat-out styles
  eatOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  eatOutBtnActive: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  eatOutTxt: { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
  eatOutTxtActive: { color: "#D97706" },
  eatOutBadge: { backgroundColor: "#FFF7ED", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#FED7AA" },
  eatOutBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  expandArrow: {
    fontSize: 10,
    color: "#999",
  },
  dayBody: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 10,
  },
  mealItem: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    marginBottom: 8,
    padding: 10,
    borderLeftWidth: 3,
  },
  mealImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
  },
  mealInfo: {
    flex: 1,
  },
  mealTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  mealTypeBadge: {
    backgroundColor: "#E8F0FE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mealTypeText: {
    fontSize: 11,
    color: "#013E77",
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  mealName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  mealProposer: {
    fontSize: 11,
    color: "#999",
  },
  addMealRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  addMealBtn: {
    flex: 1,
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  addMealBtnText: {
    fontSize: 12,
    color: "#013E77",
    fontWeight: "600",
  },
  mealTouchable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mealActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingVertical: 6,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 6,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  waitingRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  waitingText: {
    fontSize: 12, fontWeight: "600", color: "#CA8A04",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_WIDTH > 400 ? "80%" : "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalClose: {
    fontSize: 18,
    color: "#999",
    paddingHorizontal: 4,
  },
  modalSearchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalSearchInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1A1A1A",
  },
  pickerGrid: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  pickerGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  pickerCard: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    overflow: "hidden",
  },
  pickerCardImage: {
    height: 100,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerCardPlaceholder: {},
  pickerCardInfo: {
    padding: 8,
  },
  pickerCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  pickerCardMeta: {
    fontSize: 11,
    color: "#999",
  },
  pickerEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
});
