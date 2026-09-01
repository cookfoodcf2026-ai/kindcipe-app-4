import {
  View, Text, StyleSheet, TouchableOpacity, Alert, FlatList,
  TextInput, Modal, ScrollView, ActivityIndicator, Platform,
  KeyboardAvoidingView, Dimensions, RefreshControl,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import UnitPicker from "@/src/components/UnitPicker";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import { scheduleShoppingNotification, requestNotificationPermission } from "@/lib/notifications";
import { getCommonIngredientSuggestions, OFFLINE_FALLBACK, type CommonIngredient, type CommonIngredientSuggestion } from "@/lib/commonIngredients";
import PriceCompareModal from "@/src/components/PriceCompareModal";
import { DateUtil } from "@/src/lib/DateUtil";

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

const formatTimeAgo = (dateStr?: string | number | Date | null) => {
  if (!dateStr) return "";
  let thenMs = 0;
  if (typeof dateStr === "number") thenMs = dateStr;
  else if (dateStr instanceof Date) thenMs = dateStr.getTime();
  else {
    const d = DateUtil.parseDate(dateStr);
    if (d instanceof Date && isNaN(d.getTime())) return "";
    thenMs = d.getTime();
  }
  const now = Date.now();
  const diff = Math.floor((now - thenMs) / 1000);
  if (diff < 0) return "剛剛";
  if (diff < 60) return "剛剛";
  if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return DateUtil.formatDate(String(dateStr));
};

const formatPlannedDate = (dateStr: string) => {
  const today = DateUtil.todayISO();
  const tomorrow = DateUtil.tomorrowISO();
  
  if (dateStr === today) return "今日";
  if (dateStr === tomorrow) return "聽日";
  
  const weekday = DateUtil.getWeekday(dateStr, true);
  return `${weekday} (${dateStr.slice(5).replace("-", "/")})`;
};

const formatDateCard = (dateStr: string) => {
  const today = DateUtil.todayISO();
  const tomorrow = DateUtil.tomorrowISO();
  const isToday = dateStr === today;
  const isTomorrow = dateStr === tomorrow;
  const day = new Date(dateStr + 'T00:00:00').getDate();
  const weekday = DateUtil.getWeekday(dateStr, true);
  let suffix = "";
  if (isToday) suffix = "·今";
  else if (isTomorrow) suffix = "·明";
  return { day: String(day), weekday: `${weekday}${suffix}`, isToday, isTomorrow };
};

const isTodayDate = (dateStr: string) => {
  return DateUtil.isToday(dateStr);
};

const isTomorrowDate = (dateStr: string) => {
  return DateUtil.isTomorrow(dateStr);
};

const isThisWeekDate = (dateStr: string) => {
  return DateUtil.isThisWeek(dateStr);
};

const formatMonthLabel = (dateStr: string) => {
  return DateUtil.formatMonthLabel(dateStr);
};

type SwipeDeleteWrapperProps = {
  onDelete: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

function SwipeDeleteWrapper({ onDelete, disabled, children }: SwipeDeleteWrapperProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleDeletePress = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={styles.swipeDeleteBtn}
        onPress={handleDeletePress}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.swipeDeleteTxt}>刪除</Text>
      </TouchableOpacity>
    );
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={2}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

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
  const [refreshing, setRefreshing] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPlannedDate, setEditPlannedDate] = useState<string | null>(null);

  const [showPriceSummary, setShowPriceSummary] = useState(false);

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("其他");
  const [newPrice, setNewPrice] = useState("");
  const [newPlannedDate, setNewPlannedDate] = useState<string | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const [showPrice, setShowPrice] = useState(false);
  const [priceKw, setPriceKw] = useState("");

  const [showSavePrice, setShowSavePrice] = useState(false);
  const [savePriceItem, setSavePriceItem] = useState<any>(null);
  const [savePriceVal, setSavePriceVal] = useState("");
  const [savePriceMode, setSavePriceMode] = useState<"buy" | "actual">("actual");
  const [editBudgetPrice, setEditBudgetPrice] = useState("");
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

  const utils = trpc.useUtils();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    utils.shopping.list.refetch().finally(() => setRefreshing(false));
  }, [utils]);

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
    const existingNames = Array.from<string>(new Set(items.map((i: any) => String(i.name))));
    
    if (!newName.trim()) {
      if (!showNameSuggestions) return [];
      return existingNames
        .map((n: string) => {
          const item = items.find((i: any) => i.name === n);
          return { id: 0, name: n, category: item?.category || "其他", unit: item?.unit } as CommonIngredientSuggestion;
        })
        .slice(0, 20);
    }
    
    const commonSuggestions = getCommonIngredientSuggestions(ingredientsForSuggestions, newName);
    const existingSuggestions = existingNames
      .filter((n: string) => n.toLowerCase().includes(newName.toLowerCase()))
      .map((n: string) => {
        const item = items.find((i: any) => i.name === n);
        return { id: 0, name: n, category: item?.category || "其他", unit: item?.unit } as CommonIngredientSuggestion;
      });
    const combined = [...existingSuggestions, ...commonSuggestions.filter((c) => !existingSuggestions.some((e) => e.name === c.name))];
    return combined.slice(0, 20);
  }, [newName, items, ingredientsForSuggestions, showNameSuggestions]);

  const savePriceM = (trpc as any).shopping.savePrice.useMutation({
    onMutate: async (variables: any) => {
      await utils.shopping.list.cancel();
      const current = utils.shopping.list.getData();
      if (current) {
        utils.shopping.list.setData(undefined, (old) => {
          return old?.map(item => 
            item.id === variables.itemId 
              ? { ...item, actualPrice: variables.price }
              : item
          );
        });
      }
      return { current };
    },
    onSuccess: () => {
      if (savePriceMode === "buy") {
        toggleBoughtM.mutate({ id: savePriceItem!.id, bought: true });
      }
      utils.shopping.list.invalidate();
      setShowSavePrice(false);
      setSavePriceItem(null);
      setSavePriceVal("");
      Alert.alert(savePriceMode === "buy" ? "已購買" : "已記錄", savePriceMode === "buy" ? "價格已儲存，項目已標記為已購買" : "價格已儲存");
    },
    onError: async (e: Error, variables: any, context: any) => {
      if (context?.current) {
        utils.shopping.list.setData(undefined, context.current);
      }
      Alert.alert("儲存失敗", e.message || "請檢查網絡連接");
    },
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
      console.warn("[shopping.add] Error:", e.message);
      // Don't show error to user - the backend will retry with minimal data
      // Just log it for debugging
    },
  });

  const toggleBoughtM = trpc.shopping.toggleBought.useMutation({
    onMutate: async (variables: { id: number; bought: boolean }) => {
      await utils.shopping.list.cancel();
      const current = utils.shopping.list.getData();
      if (current) {
        utils.shopping.list.setData(undefined, (old) => {
          return old?.map(item => 
            item.id === variables.id 
              ? { ...item, status: variables.bought ? "bought" as const : "active" as const, boughtAt: variables.bought ? new Date() : null }
              : item
          );
        });
      }
      return { current };
    },
    onError: (e, variables, context) => {
      if (context?.current) {
        utils.shopping.list.setData(undefined, context.current);
      }
      Alert.alert("操作失敗", e.message);
    },
  });

  const deleteItemM = trpc.shopping.delete.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const approveItemM = trpc.shopping.approve.useMutation({
    onMutate: async (variables: { id: number; itemName?: string }) => {
      await utils.shopping.list.cancel();
      const current = utils.shopping.list.getData();
      if (current) {
        utils.shopping.list.setData(undefined, (old) => {
          return old?.filter(item => item.id !== variables.id);
        });
      }
      return { current };
    },
    onError: (e, variables, context) => {
      if (context?.current) {
        utils.shopping.list.setData(undefined, context.current);
      }
      Alert.alert("確認失敗", e.message);
    },
    onSuccess: (_data, variables) => {
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleShoppingNotification(variables.itemName || "食材");
      });
    },
  });

  const rejectItemM = trpc.shopping.reject.useMutation({
    onMutate: async (variables: { id: number; itemName?: string }) => {
      await utils.shopping.list.cancel();
      const current = utils.shopping.list.getData();
      if (current) {
        utils.shopping.list.setData(undefined, (old) => {
          return old?.filter(item => item.id !== variables.id);
        });
      }
      return { current };
    },
    onError: (e, variables, context) => {
      if (context?.current) {
        utils.shopping.list.setData(undefined, context.current);
      }
      Alert.alert("拒絕失敗", e.message);
    },
  });

  const approveAllM = (trpc as any).shopping.approveAll.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      Alert.alert("全部已確認", "所有待確認項目已確認");
    },
    onError: (e: Error) => Alert.alert("確認失敗", e.message),
  });

  const rejectAllM = (trpc as any).shopping.rejectAll.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      Alert.alert("全部已拒絕", "所有待確認項目已拒絕");
    },
    onError: (e: Error) => Alert.alert("拒絕失敗", e.message),
  });

  const updateItemM = trpc.shopping.updateItem.useMutation({
    onMutate: async (variables: any) => {
      await utils.shopping.list.cancel();
      const current = utils.shopping.list.getData();
      if (current) {
        utils.shopping.list.setData(undefined, (old) => {
          return old?.map(item => 
            item.id === variables.id 
              ? { ...item, name: variables.name, quantity: variables.quantity, unit: variables.unit, plannedDate: variables.plannedDate }
              : item
          );
        });
      }
      return { current };
    },
    onError: (e, variables, context) => {
      if (context?.current) {
        utils.shopping.list.setData(undefined, context.current);
      }
      Alert.alert("編輯失敗", e.message);
    },
    onSuccess: () => {
      utils.shopping.list.invalidate();
      setShowEditModal(false);
      setEditItem(null);
    },
  });

  const { activeFamilyId, familyRole } = useAuth();
  const isAdmin = familyRole === "owner" || familyRole === "admin";
  const hasFamily = activeFamilyId != null;

  const { data: mealPlans = [] } = trpc.mealPlan.list.useQuery(undefined, {
    enabled: !!activeFamilyId,
    staleTime: 1000 * 30,
  });

  const mealPlanDateById = useMemo(() => {
    const map: Record<number, string> = {};
    mealPlans.forEach((mp: any) => {
      map[mp.id] = mp.date;
    });
    return map;
  }, [mealPlans]);

  const getLinkedMealPlanDate = useCallback(
    (item: any) => (item?.fromMealPlanId ? mealPlanDateById[item.fromMealPlanId] || null : null),
    [mealPlanDateById],
  );

  useFocusEffect(
    useCallback(() => {
      void utils.mealPlan.list.invalidate();
      void utils.shopping.list.invalidate();
    }, [utils]),
  );

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
    () => filteredItems,
    [filteredItems],
  );

  const filteredUnboughtCount = activeItems.filter((i) => i.status !== "bought").length;
  const filteredBoughtCount = activeItems.filter((i) => i.status === "bought").length;

  const pendingItems = useMemo(
    () => filteredItems.filter((i) => i.status === "pending"),
    [filteredItems],
  );
  const pendingCount = pendingItems.length;

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
    const allCount = activeItems.filter(i => i.status !== "bought").length;
    const allCard = {
      date: "__all__",
      day: "全部",
      weekday: "所有日期",
      count: allCount,
      isAll: true,
    };
    
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(dateWindowStart);
      d.setDate(dateWindowStart.getDate() + i);
      const iso = DateUtil.toISODate(d);
      if (!iso || iso.includes("NaN")) continue;
      dates.push(iso);
    }
    const dateCards = dates.map((date) => ({
      date,
      ...formatDateCard(date),
      count: activeItems.filter((i) => i.plannedDate === date).length,
      isAll: false,
    }));
    
    return [allCard, ...dateCards];
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
    // Truncate to 128 chars if needed
    const safeName = name.slice(0, 128);
    const price = newPrice.trim() ? parseInt(newPrice.trim(), 10) : undefined;
    addItemM.mutate({
      name: safeName,
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
      setNewPlannedDate(DateUtil.todayISO());
    }
    setShowAddModal(true);
  }, [activeDateFilter, selectedDate]);

  const handleToggle = useCallback(
    (item: any) => {
      if (item.status === "bought") {
        toggleBoughtM.mutate({ id: item.id, bought: false });
        return;
      }
      if (hasFamily) {
        // Family 用戶：彈 Modal 記錄價格
        setSavePriceItem(item);
        setSavePriceMode("buy");
        savePriceEditedRef.current = false;
        setSavePriceVal(String(item.actualPrice ?? item.estimatedPrice ?? ""));
        setShowSavePrice(true);
      } else {
        // Solo 用戶：直接 toggle，唔彈 Modal
        toggleBoughtM.mutate({ id: item.id, bought: true });
      }
    },
    [toggleBoughtM, hasFamily],
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

  const openBudgetEdit = useCallback((item: any) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQty(item.quantity || "");
    setEditUnit(item.unit || "");
    setEditPlannedDate(item.plannedDate || null);
    setEditBudgetPrice(item.estimatedPrice != null ? String(item.estimatedPrice) : "");
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editItem) return;
    const name = editName.trim();
    if (!name) return;
    const linkedMealDate = getLinkedMealPlanDate(editItem);
    if (linkedMealDate && editPlannedDate && editPlannedDate > linkedMealDate) {
      Alert.alert("日期超出範圍", `採購日期不能遲過排餐日（${linkedMealDate}）`);
      return;
    }
    const budgetPrice = editBudgetPrice.trim();
    if (budgetPrice && (isNaN(parseInt(budgetPrice, 10)) || parseInt(budgetPrice, 10) <= 0)) {
      Alert.alert("請輸入有效預算價格");
      return;
    }
    (updateItemM.mutate as any)({
      id: editItem.id,
      name,
      quantity: editQty.trim() || undefined,
      unit: editUnit.trim() || undefined,
      plannedDate: editPlannedDate || undefined,
      estimatedPrice: budgetPrice ? parseInt(budgetPrice, 10) : undefined,
    });
  }, [editItem, editName, editQty, editUnit, editPlannedDate, editBudgetPrice, updateItemM, getLinkedMealPlanDate]);

  const toggleCategoryExpand = useCallback((cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const handleDateCardTap = useCallback((date: string) => {
    if (date === "__all__") {
      setSelectedDate("__all__");
      setActiveDateFilter("all");
      return;
    }
    if (selectedDate === date) {
      setSelectedDate(null);
      setActiveDateFilter("today");
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

  const openPriceAction = useCallback((item: any) => {
    const isBought = item.status === "bought";
    if (isBought || item.actualPrice != null) {
      setSavePriceItem(item);
      setSavePriceMode("actual");
      savePriceEditedRef.current = false;
      setSavePriceVal(String(item.actualPrice ?? item.estimatedPrice ?? ""));
      setShowSavePrice(true);
      return;
    }
    openBudgetEdit(item);
  }, [openBudgetEdit]);

  const renderItem = (item: any) => {
    const isBought = item.status === "bought";
    const isPending = item.status === "pending";
    const isProcessing = toggleBoughtM.isPending || deleteItemM.isPending;

    const itemContent = (
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
              item.fromRecipeId ? (
                <TouchableOpacity
                  style={styles.recipeTag}
                  onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: item.fromRecipeId } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recipeTagText}>{item.fromRecipeName}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.recipeTagNeutral}>
                  <Text style={styles.recipeTagTextNeutral} numberOfLines={1}>{item.fromRecipeName} · AI 建議</Text>
                </View>
              )
            )}
          </View>
          <View style={styles.itemMetaRow}>
            {(item.quantity || item.unit) && (
              <Text style={styles.itemQty}>{item.quantity || ""}{item.unit ? ` ${item.unit}` : ""}</Text>
            )}
            {item.plannedDate && (
              <View style={styles.plannedDateBadge}>
                <Ionicons name="calendar-outline" size={12} color="#013E77" />
                <Text style={styles.plannedDateText}>
                  {formatPlannedDate(item.plannedDate)}
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              {isBought && item.actualPrice != null ? (
                <Text style={styles.itemPrice}>購買 HK${item.actualPrice}</Text>
              ) : item.estimatedPrice != null ? (
                <Text style={styles.itemPrice}>預算 HK${item.estimatedPrice}</Text>
              ) : null}
              {!isBought && !isPending && (
                <>
                  <TouchableOpacity
                    style={styles.compareBtn}
                    onPress={() => { setPriceKw(item.name); setShowPrice(true); }}
                  >
                    <Ionicons name="search-outline" size={13} color="#013E77" />
                    <Text style={styles.compareBtnText}>格價</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => {
                      Alert.alert(item.name, "選擇操作", [
                        { text: "取消", style: "cancel" },
                        { text: "編輯", onPress: () => openBudgetEdit(item) },
                        { text: "預計價格", onPress: () => openBudgetEdit(item) },
                        { text: "格價", onPress: () => { setPriceKw(item.name); setShowPrice(true); } },
                        { text: "刪除", style: "destructive", onPress: () => handleDelete(item) },
                      ]);
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </>
              )}
            </View>
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
      </View>
    );

    return (
      <SwipeDeleteWrapper
        onDelete={() => handleDelete(item)}
        disabled={isBought || isPending}
      >
        {itemContent}
      </SwipeDeleteWrapper>
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

        {isExpanded && catItems.map((item: any) => (
          <Fragment key={item.id}>
            {renderItem(item)}
          </Fragment>
        ))}

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
          <TouchableOpacity
            style={[styles.headerAddBtn, { backgroundColor: "#F3F4F6", marginRight: 6 }]}
            onPress={() => router.push("/purchase-history")}
          >
            <Ionicons name="time-outline" size={20} color="#6B7280" />
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
          { key: "today" as const, label: "今天" },
          { key: "tomorrow" as const, label: "明天" },
          { key: "week" as const, label: "本週" },
        ].map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.dateFilterChip, activeDateFilter === chip.key && styles.dateFilterChipActive]}
            onPress={() => {
              if (chip.key === "today") {
                const today = DateUtil.todayISO();
                const todayDate = DateUtil.parseDate(today);
                setDateWindowStart(todayDate);
                setSelectedDate(today);
              } else if (chip.key === "tomorrow") {
                const tomorrow = DateUtil.tomorrowISO();
                const tomorrowDate = DateUtil.parseDate(tomorrow);
                setDateWindowStart(tomorrowDate);
                setSelectedDate(tomorrow);
              } else if (chip.key === "week") {
                const today = new Date();
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                setDateWindowStart(startOfWeek);
                setSelectedDate(null);
              } else {
                setSelectedDate(null);
              }
              setActiveDateFilter(chip.key);
            }}
          >
            <Text style={[styles.dateFilterChipText, activeDateFilter === chip.key && styles.dateFilterChipTextActive]}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dateCardsData.length > 0 && (
        <View style={styles.dateCardsSection}>
          <View style={styles.dateCardsHeader}>
            <Text style={styles.dateCardsTitle}>按購買日期</Text>
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
              {dateCardsData.map((dc, index) => (
                <TouchableOpacity
                  key={`${dc.date}-${index}`}
                  style={[styles.dateCard, selectedDate === dc.date && styles.dateCardSelected]}
                  onPress={() => handleDateCardTap(dc.date)}
                  activeOpacity={0.7}
                >
                  {dc.isAll ? (
                    <>
                      <Text style={[styles.dateCardDay, styles.dateCardAllDay, selectedDate === dc.date && styles.dateCardDaySelected]}>{dc.day}</Text>
                      <Text style={[styles.dateCardWeekday, styles.dateCardAllWeekday, selectedDate === dc.date && styles.dateCardWeekdaySelected]}>{dc.weekday}</Text>
                      {dc.count > 0 && <Text style={[styles.dateCardAllCount, selectedDate === dc.date && { color: "#fff" }]}>{dc.count} 項</Text>}
                    </>
                  ) : (
                    <>
                      <Text style={[styles.dateCardDay, selectedDate === dc.date && styles.dateCardDaySelected]}>{dc.day}</Text>
                      <Text style={[styles.dateCardWeekday, selectedDate === dc.date && styles.dateCardWeekdaySelected]}>{dc.weekday}</Text>
                      {dc.count > 0 && (
                        <View style={styles.dateCardBadge}>
                          <Text style={styles.dateCardBadgeText}>{dc.count}</Text>
                        </View>
                      )}
                    </>
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
      ) : categoryListData.length === 0 ? (
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#013E77" />
          }
          ListHeaderComponent={
            isAdmin && pendingCount > 0 ? (
              <View style={styles.pendingBatchSection}>
                <View style={styles.pendingBatchHeader}>
                  <Ionicons name="time-outline" size={18} color="#CA8A04" />
                  <Text style={styles.pendingBatchTitle}>{pendingCount} 個項目待確認</Text>
                </View>
                <View style={styles.pendingBatchButtons}>
                  <TouchableOpacity
                    style={styles.pendingBatchApproveBtn}
                    onPress={() => approveAllM.mutate()}
                    disabled={approveAllM.isPending}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#013E77" />
                    <Text style={styles.pendingBatchApproveBtnText}>全部確認</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pendingBatchRejectBtn}
                    onPress={() => rejectAllM.mutate()}
                    disabled={rejectAllM.isPending}
                  >
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                    <Text style={styles.pendingBatchRejectBtnText}>全部拒絕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={null}
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
                    value={newPlannedDate || DateUtil.todayISO()}
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
                  {editItem?.fromMealPlanId && getLinkedMealPlanDate(editItem) && (
                    <Text style={{ fontSize: 11, color: "#92400E", marginBottom: 6 }}>
                      ⚠️ 呢件食材來自排餐，最遲可選購物日：{getLinkedMealPlanDate(editItem)}
                    </Text>
                  )}
                  <PlanDatePicker
                    value={editPlannedDate || DateUtil.todayISO()}
                    onChange={(iso) => setEditPlannedDate(iso)}
                    maxDate={getLinkedMealPlanDate(editItem) || undefined}
                  />
                  {editPlannedDate && (
                    <TouchableOpacity onPress={() => setEditPlannedDate(null)} style={{ alignSelf: "flex-end", marginTop: -8 }}>
                      <Text style={styles.datePickerClear}>清除日期</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.fieldLabel}>預算價格 ($)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="預算價格"
                    placeholderTextColor="#9CA3AF"
                    value={editBudgetPrice}
                    onChangeText={setEditBudgetPrice}
                    keyboardType="number-pad"
                  />
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

      <Modal visible={showSavePrice} transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{savePriceMode === "buy" ? "記錄購買價" : "記錄購買價"}</Text>
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

      <PriceCompareModal
        visible={showPrice}
        keyword={priceKw}
        onClose={() => { setShowPrice(false); setPriceKw(""); }}
      />

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
  dateCardAllDay: {
    fontSize: 18,
    lineHeight: 20,
  },
  dateCardAllWeekday: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: 0,
  },
  dateCardAllCount: {
    fontSize: 10,
    fontWeight: "700",
    color: "#013E77",
    marginTop: 2,
  },
  swipeDeleteBtn: {
    width: 72,
    height: "100%",
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginRight: 12,
  },
  swipeDeleteTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
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
  recipeTagNeutral: {
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recipeTagTextNeutral: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
    maxWidth: 140,
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
  plannedDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plannedDateText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#013E77",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 11,
    fontWeight: "600",
    color: "#013E77",
  },
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F0FE",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  compareBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#013E77",
  },
  moreBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
  pendingBatchSection: {
    backgroundColor: "#FEF9C3",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingBatchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  pendingBatchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  pendingBatchButtons: {
    flexDirection: "row",
    gap: 8,
  },
  pendingBatchApproveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E8F0FE",
  },
  pendingBatchApproveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#013E77",
  },
  pendingBatchRejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  pendingBatchRejectBtnText: {
    fontSize: 13,
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
    maxHeight: 220,
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
});
