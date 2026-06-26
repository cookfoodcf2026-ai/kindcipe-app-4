import {
  View, Text, StyleSheet, TouchableOpacity, Alert, FlatList,
  TextInput, Modal, Linking, ScrollView, ActivityIndicator, Platform,
  KeyboardAvoidingView, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import UnitPicker from "@/src/components/UnitPicker";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import { scheduleShoppingNotification, requestNotificationPermission } from "@/lib/notifications";
import {
  isFreshIngredient,
  isProcessedSnackName,
  filterPriceResults,
  SM_STYLE,
  REDIRECT_PLATFORMS,
  openPlatform,
} from "@/lib/price";
import { getCommonIngredientSuggestions, OFFLINE_FALLBACK, type CommonIngredient, type CommonIngredientSuggestion } from "@/lib/commonIngredients";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "待採購", color: "#013E77", bg: "#E8F0FE" },
  pending: { label: "待確認", color: "#CA8A04", bg: "#FEF9C3" },
  bought: { label: "已購買", color: "#16A34A", bg: "#DCFCE7" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  "蔬菜": "🥬",
  "水果": "🍎",
  "肉類": "🥩",
  "海鮮": "🐟",
  "蛋奶": "🥚",
  "調味料": "🧂",
  "乾貨": "",
  "主食": "🍚",
  "飲品": "🧃",
  "零食": "🍪",
  "日用品": "🧹",
  "家居清潔": "🧹",
  "個人護理": "🧼",
  "嬰幼兒": "🍼",
  "寵物用品": "🐾",
  "其他": "",
};

const DEFAULT_CATEGORIES = [
  "蔬菜", "水果", "肉類", "海鮮", "蛋奶",
  "調味料", "乾貨", "主食", "飲品", "零食", "日用品", "其他",
];

const HOUSEHOLD_CATEGORIES = ["日用品", "家居清潔", "個人護理", "嬰幼兒", "寵物用品"];

const isHousehold = (cat: string) => HOUSEHOLD_CATEGORIES.includes(cat);

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  "蔬菜": { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A", badge: "#16A34A" },
  "肉類": { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", badge: "#DC2626" },
  "海鮮": { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB", badge: "#2563EB" },
  "蛋奶": { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706", badge: "#D97706" },
  "調味料": { bg: "#FDF4FF", border: "#F5D0FE", text: "#A855F7", badge: "#A855F7" },
  "乾貨": { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", badge: "#92400E" },
  "主食": { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", badge: "#B45309" },
  "飲品": { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", badge: "#1D4ED8" },
  "日用品": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED", badge: "#7C3AED" },
  "家居清潔": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED", badge: "#7C3AED" },
  "個人護理": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED", badge: "#7C3AED" },
  "嬰幼兒": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED", badge: "#7C3AED" },
  "寵物用品": { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED", badge: "#7C3AED" },
  "其他": { bg: "#F9FAFB", border: "#E5E7EB", text: "#6B7280", badge: "#6B7280" },
};

const formatTimeAgo = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "剛剛";
  if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-HK");
};

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const formatDateCard = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  let suffix = "";
  if (isToday) suffix = "·今";
  else if (isTomorrow) suffix = "·明";
  return { day: String(day), weekday: `${weekday}${suffix}`, isToday, isTomorrow };
};

const isTodayDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isTomorrowDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
};

const isThisWeekDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return date >= startOfWeek && date <= endOfWeek;
};

const formatMonthLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月`;
};

export default function ShoppingTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: screenHeight } = Dimensions.get("window");
  const modalMaxHeight = screenHeight * 0.65;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState("其他");
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "food" | "household">("all");
  const [activeDateFilter, setActiveDateFilter] = useState<"all" | "today" | "tomorrow" | "week" | "custom">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateWindowStart, setDateWindowStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [visibleMonth, setVisibleMonth] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPlannedDate, setEditPlannedDate] = useState<string | null>(null);

  const [showPriceSummary, setShowPriceSummary] = useState(false);
  const [showBoughtListModal, setShowBoughtListModal] = useState(false);

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("其他");
  const [newPrice, setNewPrice] = useState("");
  const [newPlannedDate, setNewPlannedDate] = useState<string | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const [showPrice, setShowPrice] = useState(false);
  const [priceKw, setPriceKw] = useState("");
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllSupermarkets, setShowAllSupermarkets] = useState(false);

  const [showSavePrice, setShowSavePrice] = useState(false);
  const [savePriceItem, setSavePriceItem] = useState<any>(null);
  const [savePriceVal, setSavePriceVal] = useState("");
  const savePriceEditedRef = useRef(false);

  const { data: lastPricesMap = {} } = (trpc as any).shopping.lastPrices.useQuery(
    { itemNames: savePriceItem ? [savePriceItem.name] : [] },
    { enabled: !!savePriceItem },
  );

  useEffect(() => {
    if (!savePriceItem) {
      savePriceEditedRef.current = false;
      return;
    }
    if (savePriceEditedRef.current) return;
    const lastPrice = lastPricesMap[savePriceItem.name];
    if (lastPrice !== undefined && lastPrice !== null) {
      setSavePriceVal(String(lastPrice));
    } else if (savePriceItem.estimatedPrice) {
      setSavePriceVal(String(savePriceItem.estimatedPrice));
    } else {
      setSavePriceVal("");
    }
  }, [savePriceItem, lastPricesMap]);

  const cleanPriceKw = useMemo(() => priceKw.replace(/[\d.]+(克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|)?\s*$/, "").replace(/\(.*?\)/g, "").trim(), [priceKw]);
  const isFreshIng = useMemo(() => isFreshIngredient(priceKw), [priceKw]);
  const priceQ = trpc.priceWatch.search.useQuery(
    { keyword: cleanPriceKw },
    { enabled: showPrice && !!cleanPriceKw && !isFreshIng },
  );
  const priceResults = useMemo(() => filterPriceResults(priceQ.data ?? [], cleanPriceKw), [priceQ.data, cleanPriceKw]);

  // Auto-select the product with the lowest price when results load
  useEffect(() => {
    if (!priceResults || priceResults.length === 0) return;
    let cheapestIdx = 0;
    let cheapestPrice = Infinity;
    priceResults.forEach((item: any, idx: number) => {
      const validPrices = (item.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => !isNaN(v) && v > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : Infinity;
      if (minPrice < cheapestPrice) {
        cheapestPrice = minPrice;
        cheapestIdx = idx;
      }
    });
    setSelectedResultIdx(cheapestIdx);
  }, [priceResults]);

  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 15,
  });

  // Fetch full common ingredient list for local caching and filtering
  const { data: commonIngredients = [] } = (trpc as any).commonIngredient.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
  });

  // Use offline fallback when API returns empty (backend not deployed or API down)
  const ingredientsForSuggestions = commonIngredients.length > 0 ? commonIngredients : OFFLINE_FALLBACK;

  const [selectedCommonIngredientId, setSelectedCommonIngredientId] = useState<number | null>(null);
  const addModalScrollRef = useRef<ScrollView>(null);

  const nameSuggestions = useMemo(() => {
    const existingNames = Array.from(new Set(items.map((i: any) => i.name)));
    
    if (!newName.trim()) {
      if (!showNameSuggestions) return [];
      return existingNames
        .map((n) => {
          const item = items.find((i: any) => i.name === n);
          return { id: 0, name: n, category: item?.category || "其他", unit: item?.unit } as CommonIngredientSuggestion;
        })
        .slice(0, 8);
    }
    
    const commonSuggestions = getCommonIngredientSuggestions(ingredientsForSuggestions, newName);
    const existingSuggestions = existingNames
      .filter((n) => n.toLowerCase().includes(newName.toLowerCase()))
      .map((n) => {
        const item = items.find((i: any) => i.name === n);
        return { id: 0, name: n, category: item?.category || "其他", unit: item?.unit } as CommonIngredientSuggestion;
      });
    const combined = [...existingSuggestions, ...commonSuggestions.filter((c) => !existingSuggestions.some((e) => e.name === c.name))];
    return combined.slice(0, 8);
  }, [newName, items, ingredientsForSuggestions, showNameSuggestions]);

  const savePriceM = (trpc as any).shopping.savePrice.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      setShowSavePrice(false);
      setSavePriceItem(null);
      setSavePriceVal("");
      Alert.alert("已記錄", "價格已儲存");
    },
    onError: (e: Error) => Alert.alert("儲存失敗", e.message),
  });

  const addItemM = trpc.shopping.add.useMutation({
    onSuccess: (_data, variables) => {
      utils.shopping.list.invalidate();
      setShowAddModal(false);
      setNewName("");
      setNewQty("");
      setNewUnit("");
      setNewCategory("其他");
      setNewPrice("");
      setNewPlannedDate(null);
      setShowNameSuggestions(false);
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleShoppingNotification(variables.name);
      });
    },
    onError: (e) => {
      const msg = e.message || "請稍後再試";
      Alert.alert("新增失敗", msg.includes("Failed query") ? "資料庫錯誤，請聯絡管理員" : msg);
    },
  });

  const toggleBoughtM = trpc.shopping.toggleBought.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("操作失敗", e.message),
  });

  const deleteItemM = trpc.shopping.delete.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const clearBoughtM = trpc.shopping.clearBought.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("清除失敗", e.message),
  });

  const approveItemM = trpc.shopping.approve.useMutation({
    onSuccess: (_data, variables) => {
      utils.shopping.list.invalidate();
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleShoppingNotification(variables.itemName || "食材");
      });
    },
    onError: (e) => Alert.alert("確認失敗", e.message),
  });

  const rejectItemM = trpc.shopping.reject.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("拒絕失敗", e.message),
  });

  const updateItemM = trpc.shopping.updateItem.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      setShowEditModal(false);
      setEditItem(null);
    },
    onError: (e) => Alert.alert("編輯失敗", e.message),
  });

  const { familyRole } = useAuth();
  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const unboughtCount = items.filter(i => i.status !== "bought").length;
  const boughtCount = items.filter(i => i.status === "bought").length;

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q),
      );
    }
    if (activeTypeFilter === "food") {
      list = list.filter((i) => !isHousehold(i.category || "其他"));
    } else if (activeTypeFilter === "household") {
      list = list.filter((i) => isHousehold(i.category || "其他"));
    }
    if (activeDateFilter === "today") {
      list = list.filter((i) => i.plannedDate && isTodayDate(i.plannedDate));
    } else if (activeDateFilter === "tomorrow") {
      list = list.filter((i) => i.plannedDate && isTomorrowDate(i.plannedDate));
    } else if (activeDateFilter === "week") {
      list = list.filter((i) => i.plannedDate && isThisWeekDate(i.plannedDate));
    } else if (activeDateFilter === "custom" && selectedDate) {
      list = list.filter((i) => i.plannedDate === selectedDate);
    }
    return list;
  }, [items, searchQuery, activeTypeFilter, activeDateFilter, selectedDate]);

  const activeItems = useMemo(
    () => filteredItems.filter((i) => i.status !== "bought"),
    [filteredItems],
  );
  const boughtItems = useMemo(
    () => filteredItems.filter((i) => i.status === "bought"),
    [filteredItems],
  );

  const filteredUnboughtCount = activeItems.length;
  const filteredBoughtCount = boughtItems.length;

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const categoryOrder = ["蔬菜", "肉類", "海鮮", "蛋奶", "主食", "調味料", "乾貨", "飲品", "日用品", "家居清潔", "個人護理", "嬰幼兒", "寵物用品", "其他"];
    activeItems.forEach((item: any) => {
      const cat = item.category || "其他";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    const sorted: Record<string, any[]> = {};
    categoryOrder.forEach((cat) => {
      if (groups[cat]) sorted[cat] = groups[cat];
    });
    Object.keys(groups).forEach((cat) => {
      if (!sorted[cat]) sorted[cat] = groups[cat];
    });
    return sorted;
  }, [activeItems]);

  const dateCardsData = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(dateWindowStart);
      d.setDate(dateWindowStart.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates.map((date) => ({
      date,
      ...formatDateCard(date),
      count: activeItems.filter((i) => i.plannedDate === date).length,
    }));
  }, [dateWindowStart, activeItems]);

  const currentMonth = useMemo(() => {
    if (visibleMonth) return visibleMonth;
    if (dateCardsData.length === 0) return "";
    return formatMonthLabel(dateCardsData[0].date);
  }, [dateCardsData, visibleMonth]);

  const handleDateCardsScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = 98;
    const index = Math.min(
      Math.max(Math.floor(offsetX / cardWidth), 0),
      dateCardsData.length - 1,
    );
    if (index >= 0 && index < dateCardsData.length) {
      const month = formatMonthLabel(dateCardsData[index].date);
      setVisibleMonth(month);
    }
  }, [dateCardsData]);

  const shiftDateWindow = useCallback((days: number) => {
    setDateWindowStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + days);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (next < today) return today;
      return next;
    });
    setVisibleMonth("");
  }, []);

  const handleAdd = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    if (name.length > 128) {
      Alert.alert("名稱太長", "名稱最多 128 個字元");
      return;
    }
    const price = newPrice.trim() ? parseInt(newPrice.trim(), 10) : undefined;
    addItemM.mutate({
      name,
      quantity: newQty.trim() || undefined,
      unit: newUnit.trim() || undefined,
      category: newCategory === "其他" ? undefined : newCategory,
      estimatedPrice: price && !isNaN(price) ? price : undefined,
      plannedDate: newPlannedDate || undefined,
      commonIngredientId: selectedCommonIngredientId || undefined,
    });
    setSelectedCommonIngredientId(null);
  }, [newName, newQty, newUnit, newCategory, newPrice, newPlannedDate, addItemM, selectedCommonIngredientId]);

  const handleOpenAddModal = useCallback((category?: string) => {
    setAddModalCategory(category || "其他");
    setNewCategory(category || "其他");
    if (activeDateFilter === "custom" && selectedDate) {
      setNewPlannedDate(selectedDate);
    } else {
      setNewPlannedDate(new Date().toISOString().split("T")[0]);
    }
    setShowAddModal(true);
  }, [activeDateFilter, selectedDate]);

  const handleToggle = useCallback(
    (item: any) => {
      const willBuy = item.status !== "bought";
      if (willBuy) {
        if (Platform.OS === "ios") {
          Alert.prompt(
            "輸入實際價格",
            `「${item.name}」的實際購買價格？`,
            [
              { text: "跳過", style: "cancel", onPress: () => toggleBoughtM.mutate({ id: item.id, bought: true }) },
              { text: "確定", onPress: (val: string | undefined) => {
                const price = val ? parseInt(val.trim(), 10) : undefined;
                toggleBoughtM.mutate({
                  id: item.id,
                  bought: true,
                  actualPrice: price && !isNaN(price) ? price : undefined,
                });
              }},
            ],
            "plain-text",
            "",
            "number-pad",
          );
        } else {
          toggleBoughtM.mutate({ id: item.id, bought: true });
        }
      } else {
        toggleBoughtM.mutate({ id: item.id, bought: false });
      }
    },
    [toggleBoughtM],
  );

  const handleDelete = useCallback(
    (item: any) => {
      Alert.alert("刪除項目", `確定要刪除「${item.name}」？`, [
        { text: "取消", style: "cancel" },
        { text: "刪除", style: "destructive", onPress: () => deleteItemM.mutate({ id: item.id }) },
      ]);
    },
    [deleteItemM],
  );

  const handleClearBought = useCallback(() => {
    const count = boughtItems.length;
    if (count === 0) return;
    Alert.alert("清除已購買", `確定要清除 ${count} 項已購買的食材？`, [
      { text: "取消", style: "cancel" },
      { text: "清除", style: "destructive", onPress: () => clearBoughtM.mutate() },
    ]);
  }, [boughtItems, clearBoughtM]);

  const handleEdit = useCallback((item: any) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQty(item.quantity || "");
    setEditUnit(item.unit || "");
    setEditPlannedDate(item.plannedDate || null);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editItem) return;
    const name = editName.trim();
    if (!name) return;
    (updateItemM.mutate as any)({
      id: editItem.id,
      name,
      quantity: editQty.trim() || undefined,
      unit: editUnit.trim() || undefined,
      plannedDate: editPlannedDate || undefined,
    });
  }, [editItem, editName, editQty, editUnit, editPlannedDate, updateItemM]);

  const toggleCategoryExpand = useCallback((cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const handleDateCardTap = useCallback((date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
      setActiveDateFilter("all");
    } else {
      setSelectedDate(date);
      setActiveDateFilter("custom");
    }
  }, [selectedDate]);

  const categoryListData = useMemo(() => {
    const list: any[] = [];
    Object.entries(groupedByCategory).forEach(([cat, catItems]) => {
      list.push({ _type: "categoryCard" as const, cat, items: catItems });
    });
    return list;
  }, [groupedByCategory]);

  const renderItem = (item: any) => {
    const isBought = item.status === "bought";
    const isPending = item.status === "pending";
    const isProcessing = toggleBoughtM.isPending || deleteItemM.isPending;

    return (
      <View key={item.id} style={[styles.itemRow, isBought && styles.itemRowBought]}>
        <TouchableOpacity
          style={[styles.itemCheckbox, isBought && styles.itemCheckboxChecked]}
          onPress={() => !isPending && handleToggle(item)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isBought && <Ionicons name="checkmark" size={14} color="#fff" />}
          {isPending && <Ionicons name="time-outline" size={12} color="#CA8A04" />}
        </TouchableOpacity>

        <View style={styles.itemContent}>
          <View style={styles.itemNameRow}>
            <Text style={[styles.itemName, isBought && styles.itemNameBought, isPending && styles.itemNamePending]}>
              {item.name}
            </Text>
            {item.fromRecipeName && (
              <View style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{item.fromRecipeName}</Text>
              </View>
            )}
          </View>
          <View style={styles.itemMetaRow}>
            {(item.quantity || item.unit) && (
              <Text style={styles.itemQty}>{item.quantity || ""}{item.unit ? ` ${item.unit}` : ""}</Text>
            )}
            {isBought && item.boughtByName && (
              <Text style={styles.itemBoughtBy}>{item.boughtByName} · {item.boughtAt ? formatTimeAgo(item.boughtAt) : "剛剛"}</Text>
            )}
            {isPending && !isAdmin && (
              <Text style={styles.itemPendingTag}>待確認</Text>
            )}
          </View>

          {isPending && isAdmin && (
            <View style={styles.approveRow}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approveItemM.mutate({ id: item.id, itemName: item.name })}
                disabled={approveItemM.isPending}
              >
                <Ionicons name="checkmark-outline" size={14} color="#013E77" />
                <Text style={styles.approveBtnTxt}>確認採購</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => rejectItemM.mutate({ id: item.id, itemName: item.name })}
                disabled={rejectItemM.isPending}
              >
                <Ionicons name="close-outline" size={14} color="#EF4444" />
                <Text style={styles.rejectBtnTxt}>拒絕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.itemActions}>
          {!isBought && !isPending && (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { setSavePriceItem(item); savePriceEditedRef.current = false; setSavePriceVal(String(item.estimatedPrice || "")); setShowSavePrice(true); }}
              >
                <Text style={styles.actionBtnText}>輸入價格</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => handleEdit(item)}
              >
                <Ionicons name="pencil-outline" size={15} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { setPriceKw(item.name); setShowPrice(true); }}
              >
                <Text style={styles.actionBtnText}>比價</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
          {isBought && (
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCategoryCard = (cat: string, catItems: any[]) => {
    const isExpanded = expandedCategories[cat] !== false;
    const boughtCnt = catItems.filter((i) => i.status === "bought").length;
    const totalCnt = catItems.length;
    const isHouseholdCat = isHousehold(cat);
    const emoji = CATEGORY_EMOJI[cat] || (isHouseholdCat ? "🧴" : "📦");
    const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["其他"];

    return (
      <View key={cat} style={[styles.categoryCard, isHouseholdCat && { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategoryExpand(cat)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeaderLeft}>
            <Text style={styles.categoryEmoji}>{emoji}</Text>
            <Text style={[styles.categoryName, isHouseholdCat && { color: colors.text }]}>{cat}</Text>
            <Text style={styles.categoryProgress}>{boughtCnt}/{totalCnt} 已買</Text>
          </View>
          <View style={styles.categoryHeaderRight}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.badge }]}>
              <Text style={styles.categoryBadgeText}>{totalCnt}</Text>
            </View>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        {isExpanded && catItems.map((item: any) => renderItem(item))}

        {isExpanded && (
          <TouchableOpacity
            style={[styles.categoryAddBtn, isHouseholdCat && { borderTopColor: colors.border }]}
            onPress={() => handleOpenAddModal(cat)}
          >
            <Ionicons name="add-outline" size={16} color={isHouseholdCat ? colors.text : "#013E77"} />
            <Text style={[styles.categoryAddBtnText, isHouseholdCat && { color: colors.text }]}>
              手動新增{isHouseholdCat ? "生活用品" : "食材"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>購物清單</Text>
          <Text style={styles.headerSubtitle}>{filteredUnboughtCount} 項待買 · {filteredBoughtCount} 項已買</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowBoughtListModal(true)}>
            <Ionicons name="list-outline" size={15} color="#6B7280" />
            <Text style={styles.headerActionBtnTextGray}>已買清單 ({boughtCount})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAddBtn} onPress={() => handleOpenAddModal()}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.typeFilterRow}>
        {[
          { key: "all" as const, label: "全部", icon: "cart-outline" as const },
          { key: "food" as const, label: "食材", icon: "restaurant-outline" as const },
          { key: "household" as const, label: "用品", icon: "cube-outline" as const },
        ].map((tab) => {
          let count = 0;
          if (tab.key === "all") count = unboughtCount;
          else if (tab.key === "food") count = items.filter(i => i.status !== "bought" && !isHousehold(i.category || "其他")).length;
          else if (tab.key === "household") count = items.filter(i => i.status !== "bought" && isHousehold(i.category || "其他")).length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.typeFilterTab, activeTypeFilter === tab.key && styles.typeFilterTabActive]}
              onPress={() => setActiveTypeFilter(tab.key)}
            >
              <Ionicons name={tab.icon} size={14} color={activeTypeFilter === tab.key ? "#fff" : "#6B7280"} style={{ marginRight: 4 }} />
              <Text style={[styles.typeFilterTabText, activeTypeFilter === tab.key && styles.typeFilterTabTextActive]}>{tab.label}</Text>
              <View style={[styles.typeFilterBadge, activeTypeFilter === tab.key && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={[styles.typeFilterBadgeText, activeTypeFilter === tab.key && { color: "#fff" }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.dateFilterRow}>
        {[
          { key: "all" as const, label: "全部" },
          { key: "today" as const, label: "今天" },
          { key: "tomorrow" as const, label: "明天" },
          { key: "week" as const, label: "本週" },
          { key: "custom" as const, label: "自訂" },
        ].map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.dateFilterChip, activeDateFilter === chip.key && styles.dateFilterChipActive]}
            onPress={() => {
              setActiveDateFilter(chip.key);
              if (chip.key !== "custom") setSelectedDate(null);
            }}
          >
            {chip.key === "custom" && (
              <Ionicons name="calendar-outline" size={12} color={activeDateFilter === chip.key ? "#fff" : "#6B7280"} style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.dateFilterChipText, activeDateFilter === chip.key && styles.dateFilterChipTextActive]}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dateCardsData.length > 0 && (
        <View style={styles.dateCardsSection}>
          <View style={styles.dateCardsHeader}>
            <Text style={styles.dateCardsTitle}>🍴 按排餐日期</Text>
          </View>
          <Text style={styles.dateCardsMonth}>{currentMonth}</Text>
          <View style={styles.dateCardsRow}>
            <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftDateWindow(-1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color="#013E77" />
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateCardsScroll}
              onScroll={handleDateCardsScroll}
              scrollEventThrottle={16}
            >
              {dateCardsData.map((dc) => (
                <TouchableOpacity
                  key={dc.date}
                  style={[styles.dateCard, selectedDate === dc.date && styles.dateCardSelected]}
                  onPress={() => handleDateCardTap(dc.date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateCardDay, selectedDate === dc.date && styles.dateCardDaySelected]}>{dc.day}</Text>
                  <Text style={[styles.dateCardWeekday, selectedDate === dc.date && styles.dateCardWeekdaySelected]}>{dc.weekday}</Text>
                  {dc.count > 0 && (
                    <View style={styles.dateCardBadge}>
                      <Text style={styles.dateCardBadgeText}>{dc.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftDateWindow(1)} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color="#013E77" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋食材或用品..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#013E77" />
          <Text style={{ color: "#9CA3AF", fontSize: 14, marginTop: 8 }}>載入中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color="#D1D5DB" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>購物清單是空的</Text>
          <Text style={styles.emptySubtitle}>點擊右上角新增食材</Text>
        </View>
      ) : categoryListData.length === 0 && boughtItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="filter-outline" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>沒有符合條件的項目</Text>
          <Text style={styles.emptySubtitle}>試試調整篩選條件</Text>
        </View>
      ) : (
        <FlatList
          data={categoryListData}
          keyExtractor={(item: any) => `cat_${item.cat}`}
          renderItem={({ item }: { item: any }) => {
            if (item._type === "categoryCard") {
              return renderCategoryCard(item.cat, item.items);
            }
            return null;
          }}
          ListFooterComponent={
            boughtItems.length > 0 ? (
              <View style={styles.boughtSection}>
                <View style={styles.boughtHeader}>
                  <View style={styles.boughtHeaderLeft}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.boughtHeaderText}>已買 {boughtItems.length} 項</Text>
                  </View>
                  <TouchableOpacity style={styles.boughtClearBtn} onPress={handleClearBought}>
                    <Text style={styles.boughtClearBtnText}>清除已買</Text>
                  </TouchableOpacity>
                </View>
                {boughtItems.map((item: any) => renderItem(item))}
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent presentationStyle="overFullScreen" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>新增{isHousehold(addModalCategory) ? "生活用品" : "食材"}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={addModalScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <View style={styles.modalBody}>
                  <Text style={styles.fieldLabel}>名稱 *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 雞蛋"
                    placeholderTextColor="#9CA3AF"
                    value={newName}
                    maxLength={128}
                    onChangeText={(text) => { setNewName(text); setShowNameSuggestions(true); }}
                    onFocus={() => {
                      setShowNameSuggestions(true);
                      addModalScrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    autoFocus
                  />
                  {showNameSuggestions && nameSuggestions.length > 0 && (
                    <View style={styles.suggestionList}>
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 4 }}
                      >
                        {nameSuggestions.map((s, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setNewName(s.name);
                              if (s.category && DEFAULT_CATEGORIES.includes(s.category)) setNewCategory(s.category);
                              if (s.unit) setNewUnit(s.unit);
                              setSelectedCommonIngredientId(s.id || null);
                              setShowNameSuggestions(false);
                            }}
                          >
                            <Text style={styles.suggestionName}>{s.name}</Text>
                            <Text style={styles.suggestionMeta}>{s.category}{s.unit ? ` · ${s.unit}` : ""}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>數量</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g. 2"
                        placeholderTextColor="#9CA3AF"
                        value={newQty}
                        onChangeText={setNewQty}
                      />
                    </View>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>單位</Text>
                      <UnitPicker value={newUnit} onChange={setNewUnit} style={{ width: "100%", height: 42 }} />
                    </View>
                  </View>
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>預算價格 ($)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g. 20"
                        placeholderTextColor="#9CA3AF"
                        value={newPrice}
                        onChangeText={setNewPrice}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>預計購買日期</Text>
                  <PlanDatePicker
                    value={newPlannedDate || new Date().toISOString().split("T")[0]}
                    onChange={(iso) => setNewPlannedDate(iso)}
                  />
                  {newPlannedDate && (
                    <TouchableOpacity onPress={() => setNewPlannedDate(null)} style={{ alignSelf: "flex-end", marginTop: -8 }}>
                      <Text style={styles.datePickerClear}>清除日期</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.fieldLabel}>分類</Text>
                  <View style={styles.categoryRow}>
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                        onPress={() => setNewCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, newCategory === cat && styles.categoryChipTextActive]}>
                          {CATEGORY_EMOJI[cat] || ""} {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.submitBtn, !newName.trim() && styles.submitBtnDisabled]}
                    onPress={handleAdd}
                    disabled={!newName.trim()}
                  >
                    <Text style={styles.submitBtnText}>加入購物清單</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent presentationStyle="overFullScreen" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>編輯項目</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <View style={styles.modalBody}>
                  <Text style={styles.fieldLabel}>名稱 *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="名稱"
                    placeholderTextColor="#9CA3AF"
                    value={editName}
                    maxLength={128}
                    onChangeText={setEditName}
                    autoFocus
                  />
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>數量</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="數量"
                        placeholderTextColor="#9CA3AF"
                        value={editQty}
                        onChangeText={setEditQty}
                      />
                    </View>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>單位</Text>
                      <UnitPicker value={editUnit} onChange={setEditUnit} style={{ width: "100%", height: 42 }} />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>預計購買日期</Text>
                  <PlanDatePicker
                    value={editPlannedDate || new Date().toISOString().split("T")[0]}
                    onChange={(iso) => setEditPlannedDate(iso)}
                  />
                  {editPlannedDate && (
                    <TouchableOpacity onPress={() => setEditPlannedDate(null)} style={{ alignSelf: "flex-end", marginTop: -8 }}>
                      <Text style={styles.datePickerClear}>清除日期</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.submitBtn, !editName.trim() && styles.submitBtnDisabled]}
                    onPress={handleSaveEdit}
                    disabled={!editName.trim()}
                  >
                    <Text style={styles.submitBtnText}>儲存</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPriceSummary} animationType="slide" transparent presentationStyle="overFullScreen" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>參考價格</Text>
              <TouchableOpacity onPress={() => setShowPriceSummary(false)}>
                <Ionicons name="close-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {items.filter(i => i.status !== "bought").map((item: any) => (
                <View key={item.id} style={styles.priceSummaryRow}>
                  <Text style={styles.priceSummaryName}>{item.name}</Text>
                  <Text style={styles.priceSummaryPrice}>
                    {item.estimatedPrice ? `$${item.estimatedPrice}` : "未定價"}
                  </Text>
                </View>
              ))}
              <View style={styles.priceSummaryTotal}>
                <Text style={styles.priceSummaryTotalLabel}>預算總計</Text>
                <Text style={styles.priceSummaryTotalValue}>
                  ${items.filter(i => i.status !== "bought").reduce((sum: number, i: any) => sum + (i.estimatedPrice || 0), 0)}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showBoughtListModal} animationType="slide" transparent presentationStyle="overFullScreen" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.modalTitle}>已買清單</Text>
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>({items.filter(i => i.status === "bought").length})</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {items.filter(i => i.status === "bought").length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      const count = items.filter(i => i.status === "bought").length;
                      Alert.alert("清除已購買", `確定要清除 ${count} 項已購買的食材？`, [
                        { text: "取消", style: "cancel" },
                        { text: "清除", style: "destructive", onPress: () => clearBoughtM.mutate() },
                      ]);
                    }}
                    disabled={clearBoughtM.isPending}
                  >
                    <Text style={{ fontSize: 13, color: "#DC2626", fontWeight: "600" }}>清除全部</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowBoughtListModal(false)}>
                  <Ionicons name="close-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
              {items.filter(i => i.status === "bought").length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#D1D5DB" />
                  <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>暫無已買項目</Text>
                </View>
              ) : (
                items.filter(i => i.status === "bought").map((item: any) => (
                  <View key={item.id} style={styles.boughtListItem}>
                    <View style={styles.boughtListItemLeft}>
                      <Text style={styles.boughtListItemName}>{item.name}</Text>
                      <View style={styles.boughtListItemMeta}>
                        {(item.quantity || item.unit) && (
                          <Text style={styles.boughtListItemQty}>{item.quantity || ""}{item.unit ? ` ${item.unit}` : ""}</Text>
                        )}
                        {item.boughtByName && (
                          <Text style={styles.boughtListItemBy}>
                            {item.boughtByName} · {item.boughtAt ? formatTimeAgo(item.boughtAt) : "剛剛"}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.boughtListItemPrice}>
                      {item.actualPrice ? `$${item.actualPrice}` : item.estimatedPrice ? `$${item.estimatedPrice}` : ""}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSavePrice} transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={insets.bottom}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>記錄價格</Text>
                <TouchableOpacity onPress={() => setShowSavePrice(false)}>
                  <Ionicons name="close-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalBody}>
                  {savePriceItem && (
                    <>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 }}>{savePriceItem.name}</Text>
                      {lastPricesMap[savePriceItem.name] && (
                        <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>上次記錄價格：${lastPricesMap[savePriceItem.name]}</Text>
                      )}
                      <Text style={styles.fieldLabel}>價格 ($)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="輸入價格"
                        placeholderTextColor="#9CA3AF"
                        value={savePriceVal}
                        onChangeText={(text) => { savePriceEditedRef.current = true; setSavePriceVal(text); }}
                        keyboardType="number-pad"
                        autoFocus
                      />
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                        {lastPricesMap[savePriceItem.name] && (
                          <TouchableOpacity
                            style={[styles.submitBtn, { flex: 1, backgroundColor: "#E8F0FE" }]}
                            onPress={() => { savePriceEditedRef.current = true; setSavePriceVal(String(lastPricesMap[savePriceItem.name])); }}
                          >
                            <Text style={[styles.submitBtnText, { color: "#013E77" }]}>使用上次價格</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.submitBtn, { flex: 1 }]}
                          onPress={() => {
                            const price = parseInt(savePriceVal.trim(), 10);
                            if (isNaN(price) || price <= 0) { Alert.alert("請輸入有效價格"); return; }
                            savePriceM.mutate({
                              itemId: savePriceItem.id,
                              itemName: savePriceItem.name,
                              price,
                              category: savePriceItem.category,
                              unit: savePriceItem.unit,
                              quantity: savePriceItem.quantity,
                            });
                          }}
                        >
                          <Text style={styles.submitBtnText}>儲存</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPrice} transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent>
        <View style={styles.pOverlay}>
          <View style={[styles.pSheet, { maxHeight: "88%" }]}>
            <View style={styles.pHandle} />
            <View style={{ maxHeight: "88%" }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.pHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pTitle}>各平台比價</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#013E77", marginTop: 2 }}>{priceKw}</Text>
                    {cleanPriceKw !== priceKw && (
                      <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>搜尋關鍵字：「{cleanPriceKw}」</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => { setShowPrice(false); setPriceKw(""); setSelectedResultIdx(0); setShowAllResults(false); setShowAllSupermarkets(false); }}>
                    <Ionicons name="close" size={22} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>

                {isFreshIng && (
                  <View style={styles.pNotice}>
                    <Ionicons name="leaf-outline" size={13} color="#16A34A" />
                    <Text style={styles.pNoticeTxt}>新鮮食材建議到街市或超市比價，消委會格價未涵蓋此類商品</Text>
                  </View>
                )}
                {!isFreshIng && priceQ.isLoading && (
                  <View style={styles.pNotice}>
                    <ActivityIndicator size="small" color="#013E77" />
                    <Text style={{ fontSize: 12, color: "#013E77" }}>正在查詢消委會格價資料…</Text>
                  </View>
                )}
                {!isFreshIng && priceQ.isError && (
                  <View style={[styles.pNotice, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                    <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                    <Text style={{ fontSize: 12, color: "#DC2626", flex: 1 }}>無法載入消委會格價資料</Text>
                    <TouchableOpacity onPress={() => priceQ.refetch()}>
                      <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "700" }}>重試</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!isFreshIng && !priceQ.isLoading && !priceQ.isError && priceResults.length === 0 && (
                  <View style={[styles.pNotice, { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }]}>
                    <Text style={{ fontSize: 12, color: "#9CA3AF" }}>消委會格價中未找到「{cleanPriceKw}」，可直接前往各平台搜尋</Text>
                  </View>
                )}

                {!isFreshIng && priceResults.length > 0 && (() => {
                  const results = priceResults;
                  const selectedResult = results[selectedResultIdx] ?? results[0];
                  const sortedPrices = [...(selectedResult?.prices ?? [])]
                    .filter((p: any) => !isNaN(Number(p.price)) && Number(p.price) > 0)
                    .sort((a: any, b: any) => Number(a.price) - Number(b.price));
                  const lowestPrice = sortedPrices[0] ? Number(sortedPrices[0].price) : null;
                  const top3 = sortedPrices.slice(0, 3);
                  const hasMore = sortedPrices.length > 3;

                  const summaryCheapest = sortedPrices[0];

                  return (
                    <>
                      {summaryCheapest && lowestPrice !== null && (
                        <View style={styles.pSummaryCard}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <View style={styles.pSummaryLogo}>
                              <Text style={{ fontSize: 22 }}>🏆</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, color: "#16A34A", fontWeight: "800" }}>最抵格價</Text>
                              <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1A1A" }} numberOfLines={1}>{summaryCheapest.supermarketName}</Text>
                            </View>
                            <Text style={{ fontSize: 24, fontWeight: "900", color: "#16A34A" }}>HK${lowestPrice.toFixed(1)}</Text>
                          </View>
                          {sortedPrices[1] && (
                            <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                              較第二平慳 HK${(Number(sortedPrices[1].price) - lowestPrice).toFixed(1)}
                            </Text>
                          )}
                        </View>
                      )}

                      <View style={styles.pBadge}>
                        <Text style={styles.pBadgeTxt}>消委會數據 · 今日更新</Text>
                      </View>

                      {results.length > 1 && (
                        <View style={{ marginBottom: 10 }}>
                          <TouchableOpacity style={styles.pProdSel} onPress={() => setShowAllResults(v => !v)}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10, color: "#9CA3AF" }}>產品規格</Text>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A1A1A" }} numberOfLines={1}>
                                {selectedResult?.brand ? `${selectedResult.brand} ` : ""}{selectedResult?.name}
                              </Text>
                            </View>
                            <Ionicons name={showAllResults ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      )}
                      {showAllResults && results.length > 1 && (
                        <View style={{ marginBottom: 10, gap: 4 }}>
                          {results.map((r: any, idx: number) => (
                            <TouchableOpacity key={idx} style={[styles.pProdOption, selectedResultIdx === idx && styles.pProdOptionOn]} onPress={() => { setSelectedResultIdx(idx); setShowAllResults(false); }}>
                              <Text style={[styles.pProdOptionTxt, selectedResultIdx === idx && { color: "#013E77" }]}>{r.brand ? `${r.brand} ` : ""}{r.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {top3.length > 0 && (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#9CA3AF", marginBottom: 8, marginHorizontal: 20 }}>超市格價</Text>
                          {top3.map((p: any, i: number) => {
                            const st = SM_STYLE[p.supermarketCode] ?? { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", logo: "?" };
                            const isLowest = i === 0;
                            return (
                              <View key={p.supermarketCode} style={[styles.pSmRow, { backgroundColor: st.bg, borderColor: isLowest ? "#22C55E" : st.border }]}>
                                {isLowest && (
                                  <View style={styles.pLowestBadge}>
                                    <Text style={styles.pLowestBadgeTxt}>最低格價</Text>
                                  </View>
                                )}
                                <View style={[styles.pSmLogo, { backgroundColor: "#fff" }]}>
                                  <Text style={{ fontSize: 18, fontWeight: "800", color: st.color }}>{st.logo}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#1A1A1A" }}>{p.supermarketName}</Text>
                                  <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{p.supermarketCode}</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: "900", color: isLowest ? "#15803D" : "#1A1A1A" }}>HK${Number(p.price).toFixed(1)}</Text>
                              </View>
                            );
                          })}
                          {hasMore && (
                            <TouchableOpacity onPress={() => setShowAllSupermarkets(v => !v)} style={{ marginHorizontal: 20, marginTop: 6, paddingVertical: 6 }}>
                              <Text style={{ fontSize: 12, color: "#013E77", fontWeight: "700", textAlign: "center" }}>
                                {showAllSupermarkets ? "收起" : `顯示全部 ${sortedPrices.length} 間超市`}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {showAllSupermarkets && sortedPrices.slice(3).map((p: any, i: number) => {
                            const st = SM_STYLE[p.supermarketCode] ?? { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", logo: "?" };
                            return (
                              <View key={p.supermarketCode} style={[styles.pSmRow, { backgroundColor: st.bg, borderColor: st.border }]}>
                                <View style={[styles.pSmLogo, { backgroundColor: "#fff" }]}>
                                  <Text style={{ fontSize: 18, fontWeight: "800", color: st.color }}>{st.logo}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#1A1A1A" }}>{p.supermarketName}</Text>
                                  <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{p.supermarketCode}</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: "900", color: "#1A1A1A" }}>HK${Number(p.price).toFixed(1)}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </>
                  );
                })()}

                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#9CA3AF", marginBottom: 8, marginHorizontal: 20 }}>
                    {priceResults.length > 0 ? "其他平台搜尋" : "直接前往平台搜尋"}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                    {REDIRECT_PLATFORMS.map(p => (
                      <TouchableOpacity key={p.name} style={[styles.pPlatformCard, { backgroundColor: p.bg, borderColor: p.border }]} onPress={() => openPlatform(p, cleanPriceKw)}>
                        <View style={styles.pLogoCard}><Text style={{ fontSize: 22 }}>{p.logo}</Text></View>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#1A1A1A", marginTop: 6 }} numberOfLines={1}>{p.name}</Text>
                        <View style={styles.pGoCard}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>搜尋</Text>
                          <Ionicons name="open-outline" size={11} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <TouchableOpacity style={styles.pCcLink} onPress={() => Linking.openURL(`https://online-price-watch.consumer.org.hk/opw/?keyword=${encodeURIComponent(cleanPriceKw)}`)}>
                  <View style={styles.pCcIcon}><Ionicons name="business-outline" size={18} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#013E77" }}>消委會格價網查詢</Text>
                    <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>Consumer Council · 網上價格一覽通</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#013E77" />
                </TouchableOpacity>
                <View style={styles.pDisclaimer}>
                  <Text style={styles.pDisclaimerTxt}>
                    {priceResults.length > 0
                      ? "格價來自消委會「網上價格一覽通」，每日更新。實際售價以各平台為準。"
                      : "消委會格價涵蓋惠康、百佳等超市，不包括 HKTVmall、pandamart 及街市鮮貨。"}
                  </Text>
                </View>
              </ScrollView>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#013E77",
  },
  headerActionBtnTextGray: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  headerAddBtn: {
    backgroundColor: "#013E77",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  typeFilterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  typeFilterTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    justifyContent: "center",
  },
  typeFilterTabActive: {
    backgroundColor: "#013E77",
  },
  typeFilterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  typeFilterTabTextActive: {
    color: "#fff",
  },
  typeFilterBadge: {
    backgroundColor: "#fff",
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  typeFilterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#013E77",
  },
  dateFilterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dateFilterChip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  dateFilterChipActive: {
    backgroundColor: "#013E77",
  },
  dateFilterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  dateFilterChipTextActive: {
    color: "#fff",
  },
  dateCardsSection: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  dateCardsHeader: {
    marginBottom: 6,
  },
  dateCardsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  dateCardsMonth: {
    fontSize: 13,
    fontWeight: "700",
    color: "#013E77",
    textAlign: "center",
    marginBottom: 8,
  },
  dateCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  dateCardsScroll: {
    flex: 1,
  },
  dateCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    minWidth: 90,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#FED7AA",
    position: "relative",
  },
  dateCardSelected: {
    borderWidth: 2,
    borderColor: "#013E77",
    backgroundColor: "#EFF6FF",
  },
  dateCardDay: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  dateCardDaySelected: {
    color: "#013E77",
  },
  dateCardWeekday: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  dateCardWeekdaySelected: {
    color: "#013E77",
    fontWeight: "600",
  },
  dateCardBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#013E77",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dateCardBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  categoryCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  categoryProgress: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: 6,
  },
  categoryBadge: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  categoryAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  categoryAddBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#013E77",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemRowBought: {
    opacity: 0.6,
  },
  itemCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemCheckboxChecked: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  itemContent: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  itemNameBought: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  itemNamePending: {
    color: "#CA8A04",
  },
  recipeTag: {
    backgroundColor: "#E8F0FE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recipeTagText: {
    fontSize: 10,
    color: "#013E77",
    fontWeight: "500",
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  itemQty: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  itemBoughtBy: {
    fontSize: 10,
    color: "#16A34A",
  },
  itemPendingTag: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CA8A04",
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  actionBtn: {
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#013E77",
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  approveRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#E8F0FE",
  },
  approveBtnTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#013E77",
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  rejectBtnTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
  },
  boughtSection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  boughtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#BBF7D0",
  },
  boughtHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  boughtHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16A34A",
  },
  boughtClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  boughtClearBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  priceSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  priceSummaryName: {
    fontSize: 14,
    color: "#1A1A1A",
  },
  priceSummaryPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
  },
  priceSummaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  priceSummaryTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  priceSummaryTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#013E77",
  },
  boughtListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  boughtListItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  boughtListItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  boughtListItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  boughtListItemQty: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  boughtListItemBy: {
    fontSize: 11,
    color: "#16A34A",
  },
  boughtListItemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
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
    maxHeight: "85%",
    flex: 1,
    overflow: "hidden",
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
  modalBody: {
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  suggestionList: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 160,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  suggestionName: {
    fontSize: 14,
    color: "#1A1A1A",
    fontWeight: "600",
  },
  suggestionMeta: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  datePickerClear: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
    marginLeft: 12,
  },
  qtyRow: {
    flexDirection: "row",
    gap: 12,
  },
  qtyField: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryChip: {
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: "#013E77",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#666",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  submitBtn: {
    backgroundColor: "#013E77",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  pOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  pHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 8,
  },
  pHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  pNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 10,
    padding: 10,
  },
  pNoticeTxt: {
    fontSize: 11,
    color: "#16A34A",
    flex: 1,
  },
  pBadge: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  pBadgeTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#013E77",
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  pProdSel: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
  },
  pProdOption: {
    marginHorizontal: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pProdOptionOn: {
    backgroundColor: "#E8F0FE",
  },
  pProdOptionTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  pPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pPriceRowBest: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
  },
  pStoreCol: {
    flex: 1,
  },
  pStoreName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  pPriceCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pPriceVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },
  pPriceValBest: {
    color: "#16A34A",
  },
  pBestBadge: {
    backgroundColor: "#16A34A",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pBestTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  pSummaryCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#86EFAC",
    padding: 14,
  },
  pSummaryLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  pSmRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    overflow: "hidden",
  },
  pSmLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pLowestBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#16A34A",
    borderBottomLeftRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pLowestBadgeTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  pPlatform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  pLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  pGo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#013E77",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pPlatformCard: {
    width: 100,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    paddingBottom: 12,
  },
  pLogoCard: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  pGoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#013E77",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  pCcLink: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: "#E8F0FE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pCcIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#013E77",
    alignItems: "center",
    justifyContent: "center",
  },
  pDisclaimer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  pDisclaimerTxt: {
    fontSize: 10,
    color: "#9CA3AF",
    lineHeight: 15,
  },
});
