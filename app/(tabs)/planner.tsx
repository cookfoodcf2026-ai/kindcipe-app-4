import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  TextInput,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/hooks/useAuth";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import FilterModal from "@/src/components/FilterModal";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";
import RecipeCard from "@/src/components/RecipeCard";
import { mergeIngredients } from "@/constants/ingredients";
import { toISODate, getDayBefore } from "@/src/lib/date";
import { keepPreviousData } from "@tanstack/react-query";
import { useInvalidateMealPlanAndCart } from "@/hooks/useInvalidateMealPlanAndCart";
import type { CategoryDef } from "@/lib/category-storage";
import { DEFAULT_CATEGORIES, loadCustomCategories } from "@/lib/category-storage";
import { RecipeRef } from "@/src/lib/RecipeRef";
import { DateUtil } from "@/src/lib/DateUtil";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MEAL_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "早餐", icon: "sunny-outline" },
  lunch: { label: "午餐", icon: "restaurant-outline" },
  dinner: { label: "晚餐", icon: "moon-outline" },
  snack: { label: "小食", icon: "fast-food-outline" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "已確認", color: "#16A34A", bg: "#DCFCE7" },
  pending: { label: "提案中", color: "#013E77", bg: "#E8F0FE" },
  rejected: { label: "已拒絕", color: "#DC2626", bg: "#FEE2E2" },
};

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

// 隱藏實驗性 AI 推薦功能（Banner / 週餐推薦 Modal），如需重新顯示改做 true
const SHOW_EXPERIMENTAL_AI = false;
const POPULAR_CHIPS = [
  { key: "quick15", label: "⚡ 快手 15 分鐘" },
  { key: "quick30", label: "⏱ 快手 30 分鐘" },
  { key: "tonight", label: " 今晚食" },
  { key: "hk-style", label: "🇭🇰 港式家常" },
  { key: "kids", label: "👶 小朋友啱食" },
  { key: "vegetarian", label: " 素食主義" },
  { key: "light", label: "🥗 清淡少油" },
  { key: "one-person", label: "👤 一人食" },
  { key: "high-protein", label: "💪 高蛋白" },
  { key: "soup", label: "🍲 湯水" },
  { key: "low-calorie", label: "🥗 低卡減肥" },
  { key: "steamed", label: " 蒸餸" },
  { key: "stir-fry", label: " 小炒" },
  { key: "party", label: "🍽️ 請客食譜" },
  { key: "3d1s", label: "🍱 3 餸 1 湯" },
];

const INGREDIENT_CATEGORIES = [
  { key: "meat", label: "🥩 肉類", keywords: ["雞肉", "豬肉", "牛肉", "羊肉", "鴨肉", "排骨", "雞翼", "雞腿", "午餐肉", "香腸", "火腿", "培根"] },
  { key: "seafood", label: "🐟 海鮮", keywords: ["魚", "蝦", "蟹", "三文魚", "帶子", "蜆", "蠔", "魷魚", "章魚", "海參", "鮑魚"] },
  { key: "vegetable", label: "🥬 蔬菜", keywords: ["菜心", "白菜", "生菜", "菠菜", "西蘭花", "椰菜", "甘藍", "芹菜", "韭菜", "蔥", "蒜", "洋蔥"] },
  { key: "tofu", label: "🍲 豆製品", keywords: ["豆腐", "豆乾", "豆皮", "腐竹", "油豆腐", "素雞"] },
  { key: "egg", label: "🥚 蛋類", keywords: ["雞蛋", "鴨蛋", "鵪鶉蛋", "皮蛋", "鹹蛋"] },
  { key: "mushroom", label: "🍄 菌菇", keywords: ["香菇", "蘑菇", "金針菇", "杏鮑菇", "木耳", "靈芝"] },
  { key: "carb", label: "🍚 主食", keywords: ["飯", "麵", "米粉", "河粉", "烏冬", "意粉", "饅頭", "包"] },
];
const SEASONING_CATS = new Set(["調味料", "醬料"]);

const getWeekRange = (offset: number) => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { startDate: toISODate(monday), endDate: toISODate(sunday), monday, sunday };
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

// ─── AI Weekly Menu constants and helpers ───────────────────────
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

function getTodayDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

const cleanRecipeId = (id: string): string => {
  if (!id) return id;
  return id.replace(/^official_/, "").replace(/^official:/, "").replace(/^user_/, "").replace(/^user:/, "");
};

const getNumericId = (id: string): number => {
  const cleaned = cleanRecipeId(id);
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
};

function getDateForDow(weekStart: string, dow: number): string {
  const monday = new Date(weekStart + "T00:00:00");
  const d = new Date(monday);
  d.setDate(monday.getDate() + (dow - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateForDowShort(weekStart: string, dow: number): string {
  return formatDateShort(new Date(getDateForDow(weekStart, dow) + "T00:00:00"));
}

function getWeekDayLabel(weekStart: string, dow: number): string {
  return `${DAY_LABELS[dow]} · ${getDateForDowShort(weekStart, dow)}`;
}

function normalizeName(value: any): string {
  return typeof value === "string" ? value.trim() : "";
}

// Normalize a dishSlot object; empty/invalid slots become real null so backend zod passes
function toDishSlot(slot: any): { id: string; name: string; image?: string | null; cookTime?: number | null } | null {
  if (!slot || !slot.id || !slot.name) return null;
  return { id: slot.id, name: slot.name, image: slot.image ?? null, cookTime: slot.cookTime ?? null };
}

// Convert a flat weekly_menu row (meatId/meatName/...) into a dishSlot object
function toDishSlotFromFlat(item: any, slot: string): { id: string; name: string; image?: string | null; cookTime?: number | null } | null {
  const id = item?.[`${slot}Id`];
  if (!id) return null;
  return {
    id,
    name: item?.[`${slot}Name`] ?? "",
    image: item?.[`${slot}Image`] ?? null,
    cookTime: item?.[`${slot}CookTime`] ?? null,
  };
}

function matchRecipeForSlot(r: any, slotType: SlotType): boolean {
  const cat = r.recipeCategory || "";
  const tags = Array.isArray(r.tags) ? r.tags.join(" ") : (r.tags || "");
  const name = r.name || "";

  if (slotType === "soup") {
    return cat === "soup" || tags.includes("湯") || name.includes("湯") || cat === "湯水" || tags.includes("湯水");
  }

  if (slotType === "seafood") {
    const seafoodKws = ["海鮮", "魚", "蝦", "蟹", "蜆", "蠔", "魷", "帶子", "鮑", "海參", "螺"];
    return cat === "seafood" || seafoodKws.some(kw => name.includes(kw) || tags.includes(kw));
  }

  if (slotType === "veg") {
    const vegKws = ["菜", "蔬", "西蘭花", "芥蘭", "通菜", "莧菜", "瓜", "茄子", "豆腐", "蛋", "菇", "耳", "腐竹", "筍", "番茄", "薯仔", "椰菜", "菠菜", "生菜", "白菜", "芹菜", "韭菜"];
    const meatSeafoodKws = ["肉", "排骨", "雞", "豬", "牛", "羊", "鴨", "翼", "腿", "腩", "扒", "魚", "蝦", "蟹", "蠔", "蜆", "帶子", "魷", "鮑", "海參"];
    const hasVegKw = vegKws.some(kw => name.includes(kw) || tags.includes(kw));
    const hasMeatSeafoodKw = meatSeafoodKws.some(kw => name.includes(kw));
    return cat === "vegetable" || cat === "egg" || cat === "素食" || (hasVegKw && (!hasMeatSeafoodKw || tags.includes("素食") || tags.includes("蔬菜")));
  }

  if (slotType === "meat") {
    const meatKws = ["肉", "排骨", "骨", "雞", "豬", "牛", "羊", "鴨", "鵝", "翼", "腿", "腩", "扒", "丸", "腸", "叉燒", "蹄", "手", "鴿", "柳", "丁", "肚", "肝", "腎"];
    return cat === "pork" || cat === "beef" || cat === "poultry" || cat === "meat" || cat === "中菜" || meatKws.some(kw => name.includes(kw) || tags.includes(kw));
  }

  return false;
}

export default function PlannerTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openRecommend } = useLocalSearchParams<{ openRecommend?: string }>();
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDayIndex, setAddDayIndex] = useState<number>(-1);
  const [addMealType, setAddMealType] = useState<string>("dinner");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSourceFilter, setPickerSourceFilter] = useState<"all" | "official" | "user" | "template">("all");
  const [pickerRecipe, setPickerRecipe] = useState<PickerRecipe | null>(null);
  const pendingIngredientsRef = useRef<any[] | null>(null);
  const addMealLockRef = useRef(false);
  const [pendingConfirmRecipe, setPendingConfirmRecipe] = useState<PickerRecipe | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });
  
  // FilterModal states（同 index.tsx 一致）
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeIngredientCategory, setActiveIngredientCategory] = useState<string | undefined>(undefined);
  const [filterCookTimeMax, setFilterCookTimeMax] = useState<number | undefined>(undefined);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activePopularChips, setActivePopularChips] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"popular" | "cookTime" | "difficulty">("popular");
  const [viewMode, setViewMode] = useState<"all" | "official" | "user">("all");

  // ─── AI Weekly Recommendation States ───
  const [showSmartRecommend, setShowSmartRecommend] = useState(false);
  const [recommendCurrentDay, setRecommendCurrentDay] = useState(getTodayDow());
  const [editingSlot, setEditingSlot] = useState<{ day: number; slot: SlotType } | null>(null);
  const [showAISuggest, setShowAISuggest] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState<any | null>(null);
  const [pendingPlanInfo, setPendingPlanInfo] = useState<{ date: string; mealType: string; slot?: SlotType; dayOfWeek?: number } | null>(null);
  const [pendingMealPlanId, setPendingMealPlanId] = useState<number | null>(null);
  const [showMoveDateModal, setShowMoveDateModal] = useState(false);
  const [moveMealPlanTarget, setMoveMealPlanTarget] = useState<any | null>(null);
  const [moveMealPlanDate, setMoveMealPlanDate] = useState<string>("");
  const [syncShoppingItems, setSyncShoppingItems] = useState(false);
  const [syncShoppingDateMode, setSyncShoppingDateMode] = useState<"previous" | "same" | "custom">("previous");
  const [syncShoppingDate, setSyncShoppingDate] = useState<string>("");
  const [showSyncDateModal, setShowSyncDateModal] = useState(false);
  const [draftSyncShoppingDateMode, setDraftSyncShoppingDateMode] = useState<"previous" | "same" | "custom">("previous");
  const [draftSyncShoppingDate, setDraftSyncShoppingDate] = useState<string>("");
  const [pendingMoveDateSave, setPendingMoveDateSave] = useState<{ id: number; newDate: string } | null>(null);


  // Automatically open the weekly recommendation modal if requested via parameters
  useEffect(() => {
    if (openRecommend === "true") {
      setShowAISuggest(true);
      router.setParams({ openRecommend: undefined });
    }
  }, [openRecommend]);

  const { startDate, endDate, monday, sunday } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const utils = trpc.useUtils();
  const invalidateAll = useInvalidateMealPlanAndCart();
  const { activeFamilyId } = useAuth();

  // 當切換廚房時，主動刷新相關查詢
  useEffect(() => {
    if (activeFamilyId) {
      void invalidateAll();
      utils.weeklyMenu.getWeek.invalidate({ weekStart: startDate });
      utils.recipes.listUser.invalidate();
    }
  }, [activeFamilyId, startDate, invalidateAll, utils]);

  const { data: mealPlans = [], isLoading } =
    trpc.mealPlan.listByDateRange.useQuery(
      { startDate, endDate },
      { 
        staleTime: 1000 * 60 * 5,  // 5 分鐘
        refetchOnWindowFocus: false,
        retry: 2,
        placeholderData: keepPreviousData,
      },
    );

  const { data: officialRecipes = [] } = trpc.recipes.listOfficial.useQuery(
    { limit: 200, offset: 0 },
    { staleTime: 1000 * 60 * 10 }, // 10 分鐘
  );

  const { data: userRecipes = [] } = trpc.recipes.listUser.useQuery(
    { limit: 200, offset: 0 },
    { staleTime: 1000 * 60 * 10 }, // 10 分鐘
  );

  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  useEffect(() => {
    loadCustomCategories().then((loaded) => setCategories(loaded.length > 0 ? loaded : DEFAULT_CATEGORIES));
  }, []);

  // Force refetch when screen gains focus (fixes stale data after returning from AI Chat)
  const weekRef = useRef({ startDate, endDate });
  weekRef.current = { startDate, endDate };
  const utilsRef = useRef(utils);
  utilsRef.current = utils;
  useFocusEffect(
    useCallback(() => {
      const u = utilsRef.current;
      console.log("[Planner] Screen focused, refetching data...");
      void invalidateAll();
      u.mealPlan.listByDateRange.refetch(weekRef.current);
      u.weeklyMenu.getWeek.refetch({ weekStart: weekRef.current.startDate });
      u.recipes.listUser.refetch();
      u.shopping.list.refetch();
    }, [])
  );

  // ─── AI Weekly Menu Queries & Mutations ────────────────────
  const { data: recommendWeekData, refetch: refetchRecommendWeek, isFetching: isFetchingRecommend } = trpc.weeklyMenu.getWeek.useQuery(
    { weekStart: startDate },
    { 
      staleTime: 1000 * 60 * 5,  // 5 分鐘
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    },
  );

  const recommendItemsByDay: Record<number, any> = useMemo(() => {
    const map: Record<number, any> = {};
    (recommendWeekData?.items ?? []).forEach((item: any) => { map[item.dayOfWeek] = item; });
    return map;
  }, [recommendWeekData]);

  // Get this week's eat-out dates from the dedicated family_eat_out table
  const { data: eatOutDates = [] } = trpc.eatOut.listByDateRange.useQuery(
    { startDate, endDate },
    { staleTime: 30000 }
  );
  const eatOutDateSet = useMemo(() => new Set(eatOutDates), [eatOutDates]);

  const setDayM = trpc.weeklyMenu.setDay.useMutation({
    onSuccess: () => {
      utils.weeklyMenu.getWeek.invalidate({ weekStart: startDate });
      Alert.alert("已設定");
    },
    onError: (e) => Alert.alert("設定失敗", e.message),
  });

  const removeDayM = trpc.weeklyMenu.removeDay.useMutation({
    onSuccess: () => {
      utils.weeklyMenu.getWeek.invalidate({ weekStart: startDate });
      Alert.alert("已移除");
    },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const eatOutM = trpc.eatOut.set.useMutation({
    onSuccess: () => {
      setToast({ visible: true, message: "已設定外出", type: "success" });
    },
    onError: (e) => {
      let message = "設定外出失敗";
      if (e.message?.includes("請先加入家庭廚房")) {
        message = "請先加入家庭廚房才能設定外出";
      } else if (e.data?.code === "FORBIDDEN") {
        message = "權限不足，請聯繫管理員";
      }
      setToast({ visible: true, message, type: "error" });
    },
    onSettled: () => {
      utils.eatOut.listByDateRange.invalidate({ startDate, endDate });
      // eatOut may delete the day's dinner meal plans → refresh them too
      void invalidateAll();
    },
  });

  const addBatchM = trpc.mealPlan.addBatch.useMutation({
    onSuccess: async (result, variables) => {
      // Only invalidate affected queries
      await invalidateAll();
      
      const days = new Set(variables.items.map(i => i.date));
      const recipes = new Set(variables.items.map(i => i.recipeName));
      
      let message = `✅ 已排入 ${result?.count ?? days.size} 天晚餐（${result?.count ?? variables.items.length} 個餐次）`;
      if (result?.skippedCount && result.skippedCount > 0) {
        message += `，⚠️ ${result.skippedCount} 日因外出跳過`;
      }
      
      setToast({ 
        visible: true, 
        message, 
        type: "success" 
      });
    },
    onError: (e) => {
      setToast({ visible: true, message: `批量排餐失敗：${e.message}`, type: "error" });
    },
  });

  const officialMap = useMemo(() => {
    const map = new Map<number, any>();
    officialRecipes.forEach((r: any) => map.set(r.id, r));
    return map;
  }, [officialRecipes]);

  const handleApplyToday = async (item: any) => {
    if (!item) return;
    const itemDateStr = getDateForDow(startDate, item.dayOfWeek);
    const daySlots: SlotType[] = ["meat", "seafood", "veg", "soup"];
    const toAdd = daySlots.filter(s => item[`${s}Id`] && item[`${s}Name`]);

    if (toAdd.length === 0) {
      Alert.alert("本日沒有推薦的菜式", "請先使用 AI 生成或手動添加菜式");
      return;
    }

    try {
      setToast({ visible: true, message: `正在將本日推薦導入排餐中...`, type: "info" });
      const allMeals: Array<{ date: string; mealType: "dinner"; recipeId: string; recipeName: string; recipeImage?: string | null }> = [];
      const pickerRecipes: PickerRecipe[] = [];

      for (const slot of toAdd) {
        const dishId = item[`${slot}Id`]!;
        const dishName = item[`${slot}Name`]!;
        const dishImage = item[`${slot}Image`] ?? null;

        const numId = getNumericId(dishId);
        const recipeId = dishId.startsWith("user_") || dishId.startsWith("user:")
          ? `user_${numId}`
          : `official_${numId}`;
        allMeals.push({
          date: itemDateStr,
          mealType: "dinner" as const,
          recipeId,
          recipeName: dishName,
          recipeImage: dishImage,
        });

        const official = officialRecipes.find((r: any) => r.id === numId);
        if (official && Array.isArray(official.ingredients) && official.ingredients.length > 0) {
          pickerRecipes.push({
            id: dishId,
            name: dishName,
            ingredients: official.ingredients,
            date: getDayBefore(itemDateStr),
          });
        }
      }

      // 批量寫入（一次過 call）
      await addBatchM.mutateAsync({ items: allMeals });

      setShowSmartRecommend(false);
      await invalidateAll();

      // 詢問用戶下一步操作（關鍵：分離排餐和購物清單）
      Alert.alert(
        `✅ 已套用${DAY_LABELS[item.dayOfWeek]}的晚餐推薦`,
        "排餐已記錄！下一步要做什麼？",
        [
          {
            text: "繼續審視其他日期",
            style: "cancel",
            onPress: () => {} // 留在排餐頁
          },
          {
            text: "去購物清單加食材",
            onPress: () => {
              if (pickerRecipes.length > 0) {
                // 本日 4 個餸：同名食材合併（同單位相加）
                const flat = pickerRecipes.flatMap(pr =>
                  pr.ingredients.map((ing: any) => ({
                    ...ing,
                    recipeName: pr.name,
                    recipeId: pr.id,
                  }))
                );
                const mergedIngredients = mergeIngredients(flat).map((ing) => ({
                  ...ing,
                  plannedDate: ing.date ?? getDayBefore(itemDateStr),
                }));

                setPickerRecipe({
                  id: `day_${item.dayOfWeek}_ai`,
                  name: `${DAY_LABELS[item.dayOfWeek]} 晚餐推薦食材`,
                  ingredients: mergedIngredients,
                  date: getDayBefore(itemDateStr),
                });
              } else {
                router.push("/(tabs)/shopping");
              }
            }
          }
        ]
      );
    } catch (e: any) {
      console.error("[handleApplyToday] Error:", e);
      setToast({ visible: true, message: `套用失敗：${e.message}`, type: "error" });
    }
  };

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: async (_, variables) => {
      const count = variables.items.length;
      setPickerRecipe(null);
      setToast({ visible: true, message: `✅ ${count} 件食材已加入購物清單`, type: "success" });
      void invalidateAll();
    },
    onError: (e) => {
      setToast({ visible: true, message: `加入食材失敗：${e.message}`, type: "error" });
    },
  });

  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: async () => { await invalidateAll(); },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: async (result, variables) => {
      const finishAddFlow = async () => {
        setShowAddModal(false);

        const ings = pendingIngredientsRef.current;
        pendingIngredientsRef.current = null;

        const openPicker = (ingredients: any[]) => {
          setPickerRecipe({
            id: variables.recipeId,
            name: variables.recipeName,
            ingredients,
            date: variables.date,
            fromMealPlanId: result.newPlanId,
          });
        };

        if (ings && ings.length > 0) {
          openPicker(ings);
        } else {
          const found = [...officialRecipes, ...userRecipes].find(
            (r: any) => `official_${r.id}` === variables.recipeId || `user_${r.id}` === variables.recipeId
          ) as any;
          if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
            openPicker(found.ingredients);
          } else {
            setToast({ visible: true, message: "已加入排餐", type: "info" });
          }
        }

        void (async () => {
          console.log("[Planner] addMealM onSuccess, refreshing in background...");
          try {
            await utils.mealPlan.listByDateRange.refetch({ startDate, endDate });
          } catch { /* non-fatal */ }
          try { await invalidateAll(); } catch { /* non-fatal */ }
        })();

        addMealLockRef.current = false;
      };

      // Conflict detected (eatOut / duplicate): ask the user BEFORE finalizing.
      if (result.warning && result.hasConflict) {
        const isEatOutConflict = result.warning.includes("外出");
        Alert.alert(
          isEatOutConflict ? "衝突提示" : "重複食譜提示",
          result.warning,
          [
            { text: "取消", style: "cancel", onPress: () => {
              // Undo: delete the just-created meal plan + its ingredients.
              if (result.newPlanId) {
                deleteMealM.mutate({ id: result.newPlanId });
              }
              pendingIngredientsRef.current = null;
              setShowAddModal(false);
              addMealLockRef.current = false;
            }},
            { text: "確定", onPress: () => { void finishAddFlow(); }},
          ]
        );
        return;
      }

      await finishAddFlow();
    },
    onError: (e) => {
      pendingIngredientsRef.current = null;
      addMealLockRef.current = false;
      setToast({ visible: true, message: `新增失敗：${e.message}`, type: "error" });
    },
  });

  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, { staleTime: 30000, refetchInterval: 60000 });
  const deleteShoppingItemM = trpc.shopping.delete.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
  });
  const updateMealDateM = trpc.mealPlan.updateDate.useMutation({
    onSuccess: () => {
      void invalidateAll();
      setShowMoveDateModal(false);
      setShowSyncDateModal(false);
      setMoveMealPlanTarget(null);
      setMoveMealPlanDate("");
      setSyncShoppingItems(false);
      setSyncShoppingDate("");
    },
    onError: (e: any) => Alert.alert("改日期失敗", e.message),
  });

  const confirmMealM = trpc.mealPlan.confirm.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      const conf = pendingConfirmRecipe;
      setPendingConfirmRecipe(null);
      if (conf && Array.isArray(conf.ingredients) && conf.ingredients.length > 0) {
        setPickerRecipe(conf);
      }
    },
    onError: (e) => Alert.alert("確認失敗", e.message),
  });

  const rejectMealM = trpc.mealPlan.reject.useMutation({
    onSuccess: async () => { await invalidateAll(); },
    onError: (e) => Alert.alert("拒絕失敗", e.message),
  });

  const { familyRole } = useAuth();
  const isAdmin = familyRole === "owner" || familyRole === "admin";
  
  // 診斷日誌：檢查權限
  useEffect(() => {
    if (activeFamilyId) {
      console.log("[Planner] Active family:", activeFamilyId, "Role:", familyRole, "IsAdmin:", isAdmin);
    }
  }, [activeFamilyId, familyRole, isAdmin]);

  const mealsByDate = useMemo(() => {
    const map: Record<string, typeof mealPlans> = {};
    for (const mp of mealPlans) {
      if (!map[mp.date]) map[mp.date] = [];
      map[mp.date].push(mp);
    }
    return map;
  }, [mealPlans]);

  const weekDays = useMemo(() => {
    const days: { dateStr: string; date: Date; dayIndex: number; dayOfWeek: number }[] = [];
    const base = new Date(`${startDate}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push({ dateStr: toISODate(d), date: d, dayIndex: i, dayOfWeek: i + 1 });
    }
    return days;
  }, [startDate]);

  const officialRecipeMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of officialRecipes) map.set(r.id, r);
    return map;
  }, [officialRecipes]);

  const userRecipeMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of userRecipes) map.set(r.id, r);
    return map;
  }, [userRecipes]);

  const allUserTags = useMemo(() => {
    const tags = new Set<string>();
    [...officialRecipes, ...userRecipes].forEach((r: any) => {
      (Array.isArray(r?.tags) ? r.tags : []).forEach((tag: any) => {
        const t = String(tag ?? "").trim();
        if (t) tags.add(t);
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [officialRecipes, userRecipes]);

  const normalizeText = (v: any) => String(v ?? "").toLowerCase();

  const getRecipeIngredientText = (recipe: any) => {
    const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
    return ingredients
      .map((ing: any) => typeof ing === "string" ? ing : (ing?.name || ""))
      .join(" ");
  };

  const matchesIngredientCategory = (recipe: any) => {
    if (!activeIngredientCategory) return true;
    const cat = INGREDIENT_CATEGORIES.find((c) => c.key === activeIngredientCategory);
    if (!cat) return true;
    const text = normalizeText(`${recipe?.name || ""} ${recipe?.description || ""} ${getRecipeIngredientText(recipe)} ${(Array.isArray(recipe?.tags) ? recipe.tags : []).join(" ")}`);
    return cat.key === "carb"
      ? cat.key === "carb" && /飯|麵|米粉|河粉|烏冬|意粉|饅頭|包/.test(text)
      : cat.key === "egg"
        ? /蛋|雞蛋|鴨蛋|皮蛋|鹹蛋/.test(text)
        : cat.key === "tofu"
          ? /豆腐|豆乾|豆皮|腐竹|油豆腐|素雞/.test(text)
          : cat.key === "mushroom"
            ? /香菇|蘑菇|金針菇|杏鮑菇|木耳|菌菇/.test(text)
            : cat.key === "meat"
              ? /雞肉|豬肉|牛肉|羊肉|鴨肉|排骨|雞翼|雞腿|午餐肉|香腸|火腿|培根/.test(text)
              : cat.key === "seafood"
                ? /魚|蝦|蟹|三文魚|帶子|蜆|蠔|魷魚|章魚|海參|鮑魚/.test(text)
                : cat.key === "vegetable"
                  ? /菜心|白菜|生菜|菠菜|西蘭花|椰菜|甘藍|芹菜|韭菜|蔥|蒜|洋蔥/.test(text)
                  : true;
  };

  const matchesPopularChip = (recipe: any, chipKey: string) => {
    const name = normalizeText(recipe?.name);
    const desc = normalizeText(recipe?.description);
    const tags = normalizeText((Array.isArray(recipe?.tags) ? recipe.tags : []).join(" "));
    const ing = normalizeText(getRecipeIngredientText(recipe));
    const cookTime = Number(recipe?.cookTime || 0);
    const servings = Number(recipe?.servings || 0);

    switch (chipKey) {
      case "quick15": return cookTime > 0 && cookTime <= 15;
      case "quick30": return cookTime > 0 && cookTime <= 30;
      case "tonight": return true;
      case "hk-style": return /中菜|港式|家常|粵|廣東/.test(`${name} ${desc} ${tags}`);
      case "kids": return /小朋友|kids|child|家庭/.test(`${name} ${desc} ${tags}`);
      case "vegetarian": return /素|齋|vegetarian/.test(`${name} ${desc} ${tags}`);
      case "light": return /清淡|少油|少鹽|light/.test(`${name} ${desc} ${tags}`);
      case "one-person": return servings <= 1 || /一人|1人/.test(`${name} ${desc} ${tags}`);
      case "high-protein": return /高蛋白|雞|牛|豬|魚|蝦|豆腐|蛋/.test(`${name} ${desc} ${tags} ${ing}`);
      case "soup": return /湯|湯水/.test(`${name} ${desc} ${tags}`);
      case "low-calorie": return /低卡|減肥|low calorie/.test(`${name} ${desc} ${tags}`);
      case "steamed": return /蒸/.test(`${name} ${desc} ${tags}`);
      case "stir-fry": return /炒|小炒/.test(`${name} ${desc} ${tags}`);
      case "party": return /請客|宴客|聚餐|party/.test(`${name} ${desc} ${tags}`);
      case "3d1s": return /3餸1湯|三餸一湯|3 餸 1 湯|四道菜/.test(`${name} ${desc} ${tags}`);
      default: return true;
    }
  };

  const pickerFilterCount = useMemo(() => {
    return (activeCategory !== "all" ? 1 : 0)
      + (activeIngredientCategory !== undefined ? 1 : 0)
      + (filterCookTimeMax !== undefined ? 1 : 0)
      + activeTagFilters.length
      + activePopularChips.length
      + (viewMode !== "all" ? 1 : 0);
  }, [activeCategory, activeIngredientCategory, filterCookTimeMax, activeTagFilters.length, activePopularChips.length, viewMode]);

  const pickerRecipes = useMemo(() => {
    const templates = [
      { id: "template_hotpot", name: "🍲 經典打邊爐聚餐", _source: "template" as const, ingredients: [], image: null, cookTime: null, description: "經典打邊爐聚會，自動倍增換算" },
      { id: "template_bbq", name: "🍢 經典 BBQ 燒烤聚會", _source: "template" as const, ingredients: [], image: null, cookTime: null, description: "經典 BBQ 燒烤聚餐，一鍵算齊材料" },
    ];
    const all = [
      ...templates,
      ...officialRecipes.map((r: any) => ({ ...r, _source: "official" as const })),
      ...userRecipes.map((r: any) => ({ ...r, _source: "user" as const })),
    ];
    let filtered = all;

    const sourceMode = pickerSourceFilter !== "all" ? pickerSourceFilter : viewMode;
    if (sourceMode !== "all") {
      filtered = filtered.filter((r: any) => r._source === sourceMode);
    }
    if (activeCategory !== "all") {
      filtered = filtered.filter((r: any) => r.recipeCategory === activeCategory || r.category === activeCategory);
    }
    if (activeIngredientCategory !== undefined) {
      filtered = filtered.filter((r: any) => matchesIngredientCategory(r));
    }
    if (filterCookTimeMax !== undefined) {
      filtered = filtered.filter((r: any) => Number(r.cookTime || 0) <= filterCookTimeMax);
    }
    if (activeTagFilters.length > 0) {
      filtered = filtered.filter((r: any) => {
        const tags = Array.isArray(r.tags) ? r.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
        return activeTagFilters.every(tag => tags.includes(tag));
      });
    }
    if (activePopularChips.length > 0) {
      filtered = filtered.filter((r: any) => activePopularChips.every(chip => matchesPopularChip(r, chip)));
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      filtered = filtered.filter((r: any) => {
        const tags = Array.isArray(r.tags) ? r.tags.join(" ") : "";
        const ingredientText = getRecipeIngredientText(r);
        return normalizeText(r.name).includes(q)
          || normalizeText(r.description).includes(q)
          || normalizeText(tags).includes(q)
          || normalizeText(ingredientText).includes(q);
      });
    }

    if (sortBy === "cookTime") {
      filtered.sort((a: any, b: any) => (Number(a.cookTime || 999) - Number(b.cookTime || 999)));
    } else if (sortBy === "difficulty") {
      const diffOrder: Record<string, number> = { "簡單": 1, "中等": 2, "困難": 3 };
      filtered.sort((a: any, b: any) => diffOrder[a.difficulty || "中等"] - diffOrder[b.difficulty || "中等"]);
    } else {
      filtered.sort((a: any, b: any) => Number(b.popularity || 0) - Number(a.popularity || 0));
    }

    return filtered;
  }, [officialRecipes, userRecipes, pickerSearch, pickerSourceFilter, viewMode, activeCategory, activeIngredientCategory, filterCookTimeMax, activeTagFilters, activePopularChips, sortBy]);

  const handleAddMeal = useCallback(
    (recipe: any) => {
      if (addMealLockRef.current || addMealM.isPending) return;
      if (addDayIndex < 0) return;
      const dateStr = weekDays[addDayIndex]?.dateStr;
      if (!dateStr) return;
      addMealLockRef.current = true;
      const prefix = recipe._source === "user" ? "user_" : recipe._source === "template" ? "" : "official_";
      pendingIngredientsRef.current = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
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
            const recipeItems = (shoppingItems as any[]).filter(
              (si: any) =>
                (si.fromMealPlanId === mp.id || (si.fromRecipeName === mp.recipeName && si.plannedDate === mp.date)) &&
                si.status !== "bought",
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

  const openMoveDateModal = useCallback((mp: any) => {
    setMoveMealPlanTarget(mp);
    setMoveMealPlanDate(mp.date);
    setSyncShoppingItems(false);
    setSyncShoppingDateMode(getDayBefore(mp.date) < toISODate(new Date()) ? "same" : "previous");
    setSyncShoppingDate(getDayBefore(mp.date));
    setShowSyncDateModal(false);
    setPendingMoveDateSave(null);
    setShowMoveDateModal(true);
  }, [shoppingItems]);

  const openSyncDateModal = useCallback(() => {
    setDraftSyncShoppingDateMode(syncShoppingDateMode);
    setDraftSyncShoppingDate(syncShoppingDate);
    setShowSyncDateModal(true);
  }, [syncShoppingDate, syncShoppingDateMode]);

  const promptSyncShoppingDate = useCallback(() => {
    Alert.alert(
      "同步購物日期？",
      "呢個排餐已經有相關購物清單，要唔要一齊改購物日期？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "保持原有日期",
          onPress: () => {
            if (!moveMealPlanTarget || !moveMealPlanDate) return;
            updateMealDateM.mutate({
              id: moveMealPlanTarget.id,
              newDate: moveMealPlanDate,
              moveShoppingItems: false,
              shoppingDate: undefined,
            });
          },
        },
        {
          text: "需要更改",
          onPress: () => {
            if (!moveMealPlanTarget || !moveMealPlanDate) return;
            setPendingMoveDateSave({ id: moveMealPlanTarget.id, newDate: moveMealPlanDate });
            // iOS 上 Alert 之後直接開另一個 Modal 有機會唔顯示 → 先收埋 move-date modal 再開 sync modal
            setShowMoveDateModal(false);
            setTimeout(() => openSyncDateModal(), 300);
          },
        },
      ],
    );
  }, [moveMealPlanDate, moveMealPlanTarget, openSyncDateModal, updateMealDateM]);

  const clampShoppingDate = useCallback((date: string | undefined) => {
    if (!date) return date;
    const today = toISODate(new Date());
    let out = date < today ? today : date;
    if (moveMealPlanDate && out > moveMealPlanDate) out = moveMealPlanDate;
    return out;
  }, [moveMealPlanDate]);

  const confirmSyncDateModal = useCallback(() => {
    setSyncShoppingDateMode(draftSyncShoppingDateMode);
    setSyncShoppingDate(
      draftSyncShoppingDateMode === "custom"
        ? (clampShoppingDate(draftSyncShoppingDate || getDayBefore(moveMealPlanDate || toISODate(new Date()))) || toISODate(new Date()))
        : draftSyncShoppingDateMode === "same"
          ? (moveMealPlanDate || getDayBefore(toISODate(new Date())))
          : getDayBefore(moveMealPlanDate || toISODate(new Date())),
    );
    setSyncShoppingItems(true);
    setShowSyncDateModal(false);
    if (pendingMoveDateSave) {
      const nextShoppingDate =
        draftSyncShoppingDateMode === "custom"
          ? (clampShoppingDate(draftSyncShoppingDate || getDayBefore(moveMealPlanDate || toISODate(new Date()))) || toISODate(new Date()))
          : draftSyncShoppingDateMode === "same"
            ? (moveMealPlanDate || getDayBefore(toISODate(new Date())))
            : getDayBefore(moveMealPlanDate || toISODate(new Date()));
      updateMealDateM.mutate({
        id: pendingMoveDateSave.id,
        newDate: pendingMoveDateSave.newDate,
        moveShoppingItems: true,
        shoppingDate: nextShoppingDate,
      });
      setPendingMoveDateSave(null);
    }
  }, [clampShoppingDate, draftSyncShoppingDate, draftSyncShoppingDateMode, moveMealPlanDate, pendingMoveDateSave, updateMealDateM]);

  const cancelSyncDateModal = useCallback(() => {
    setShowSyncDateModal(false);
    setPendingMoveDateSave(null);
    // 用戶取消時返回 move-date modal（因為「需要更改」會先收埋佢）
    setShowMoveDateModal(true);
  }, []);

  const relatedShoppingItems = useMemo(
    () => (moveMealPlanTarget ? (shoppingItems as any[]).filter((si: any) =>
      si.fromMealPlanId === moveMealPlanTarget.id ||
      (si.fromRecipeName === moveMealPlanTarget.recipeName && si.plannedDate === moveMealPlanTarget.date)
    ) : []),
    [shoppingItems, moveMealPlanTarget],
  );

  const mealShoppingLookup = useMemo(() => {
    const byMealPlanId = new Set<number>();
    const byRecipeAndDate = new Set<string>();
    const byRecipeIdAndDate = new Set<string>();
    const byRecipeIdWithShopDate = new Set<string>();
    for (const si of shoppingItems as any[]) {
      if (si.fromMealPlanId) {
        byMealPlanId.add(si.fromMealPlanId);
      }
      if (si.fromRecipeName && si.plannedDate) {
        byRecipeAndDate.add(`${si.fromRecipeName}__${si.plannedDate}`);
      }
      if (si.fromRecipeId && si.plannedDate) {
        byRecipeIdAndDate.add(`${si.fromRecipeId}__${si.plannedDate}`);
        // 兜底：就算無 fromMealPlanId，只要同食譜 id 嘅購物項存在就當已加入
        byRecipeIdWithShopDate.add(`${si.fromRecipeId}__${si.plannedDate}`);
      }
    }
    return { byMealPlanId, byRecipeAndDate, byRecipeIdAndDate, byRecipeIdWithShopDate };
  }, [shoppingItems]);

  // 已加入判定：統一成「同一食譜 id + 同食材名」（同 recipe/[id] / ai-chef 一致）
  const pickerAlreadyAddedKeys = useMemo(() => {
    const added = new Set<string>();
    if (!pickerRecipe?.ingredients?.length || !shoppingItems.length) return added;
    const targetRecipeId = pickerRecipe.id;
    const activeItems = (shoppingItems as any[]).filter((item: any) => item.status !== "bought");
    pickerRecipe.ingredients.forEach((ing, idx) => {
      const key = `${pickerRecipe.id}::${idx}`;
      const ingName = (ing.name || "").trim();
      if (!ingName) return;
      const matched = activeItems.some((item: any) => {
        const itemName = (item.name || "").trim();
        const itemRecipeId = (item.fromRecipeId || "").trim();
        return itemName === ingName && itemRecipeId === targetRecipeId;
      });
      if (matched) added.add(key);
    });
    return added;
  }, [pickerRecipe, shoppingItems]);

  const selectedMoveShoppingDate =
    syncShoppingDateMode === "same"
      ? moveMealPlanDate || getDayBefore(toISODate(new Date()))
      : syncShoppingDateMode === "custom"
        ? clampShoppingDate(syncShoppingDate || getDayBefore(moveMealPlanDate || toISODate(new Date()))) || toISODate(new Date())
        : clampShoppingDate(getDayBefore(moveMealPlanDate || DateUtil.todayISO())) || toISODate(new Date());

  const handleAddToCartFromMeal = useCallback(
    (mp: any) => {
      const prefix = mp.recipeId.startsWith("user_") ? "user_" : "official_";
      const recipeIdNum = mp.recipeId.replace(prefix, "");
      const found = [...officialRecipes, ...userRecipes].find(
        (r: any) => `official_${r.id}` === mp.recipeId || `user_${r.id}` === mp.recipeId
      ) as any;
      if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
        setPickerRecipe({
          id: mp.recipeId,
          name: mp.recipeName,
          ingredients: found.ingredients,
          date: mp.date,
          fromMealPlanId: mp.id,
        });
      } else {
        setToast({ visible: true, message: "無法獲取食譜食材", type: "error" });
      }
    },
    [officialRecipes, userRecipes],
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
    // 開返 in-app search modal（含搜尋 bar），唔再跳去食譜庫
    setAddDayIndex(dayIndex);
    setAddMealType(mealType);
    setPickerSearch("");
    setPickerSourceFilter("all");
    setShowAddModal(true);
  };

  const renderMealItem = (mp: any) => {
    const sConfig = STATUS_CONFIG[mp.status] || STATUS_CONFIG.confirmed;
    const mConfig = MEAL_TYPE_CONFIG[mp.mealType] || MEAL_TYPE_CONFIG.dinner;
    const isPending = mp.status === "pending";
    const isTemplate = mp.recipeId && mp.recipeId.startsWith("template_");
    const hasShoppingItem = Boolean(mp.hasShoppingItem)
      || mealShoppingLookup.byMealPlanId.has(mp.id)
      || mealShoppingLookup.byRecipeAndDate.has(`${mp.recipeName}__${mp.date}`)
      || mealShoppingLookup.byRecipeIdAndDate.has(`${mp.recipeId}__${mp.date}`)
      // 兜底：AI 生成食譜可能無 fromMealPlanId，改用食譜 id 匹配（採購日通常係排餐日或前一日）
      || mealShoppingLookup.byRecipeIdWithShopDate.has(`${mp.recipeId}__${mp.date}`)
      || mealShoppingLookup.byRecipeIdWithShopDate.has(`${mp.recipeId}__${getDayBefore(mp.date)}`);
    const templateIcon = mp.recipeId === "template_hotpot" ? "flame-outline" : mp.recipeId === "template_bbq" ? "restaurant-outline" : "rose-outline";
    const templateColor = mp.recipeId === "template_hotpot" ? "#EF4444" : mp.recipeId === "template_bbq" ? "#FF8C00" : "#F59E0B";
    const templateBg = mp.recipeId === "template_hotpot" ? "#FEE2E2" : mp.recipeId === "template_bbq" ? "#FFF7ED" : "#FEF3C7";

    // Fallback: look up image from recipe lists if recipeImage is missing
    let resolvedImage = mp.recipeImage || null;
    if (!resolvedImage && !isTemplate) {
      const numId = getNumericId(mp.recipeId);
      if (!isNaN(numId)) {
        const official = officialRecipeMap.get(numId);
        if (official) {
          resolvedImage = official.thumbnailUrl || official.image || null;
        }
        if (!resolvedImage) {
          const user = userRecipeMap.get(numId);
          if (user) {
            resolvedImage = user.thumbnailUrl || user.image || null;
          }
        }
      }
    }

    return (
      <View key={mp.id} style={[styles.mealItem, { borderLeftColor: sConfig.color }]}>
        <TouchableOpacity
          style={styles.mealTouchable}
          onPress={() => {
            if (isTemplate) {
              router.push({
                pathname: "/shopping-templates",
                params: { templateId: mp.recipeId, date: mp.date },
              });
            } else {
              router.push({
                pathname: "/recipe/[id]",
                params: { id: mp.recipeId },
              });
            }
          }}
        >
          {isTemplate ? (
            <View style={[styles.mealImage, { backgroundColor: templateBg, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name={templateIcon as any} size={20} color={templateColor} />
            </View>
          ) : resolvedImage ? (
            <ExpoImage source={{ uri: resolvedImage }} style={styles.mealImage} contentFit="cover" cachePolicy="memory-disk" onError={() => console.warn("[Planner] meal image failed to load")} />
          ) : (
            <View style={[styles.mealImage, styles.mealImagePlaceholder]}>
              <Ionicons name="restaurant-outline" size={16} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.mealInfo}>
            <View style={styles.mealTop}>
              <View style={[styles.mealTypeBadge, { flexDirection: "row", alignItems: "center", gap: 2 }]}>
                <Ionicons name={mConfig.icon as any} size={9} color="#013E77" />
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
            {/* Show shopping cart status indicator */}
            {!isTemplate && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                {hasShoppingItem ? (
                  <>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={{ fontSize: 9, color: "#10B981", fontWeight: "600" }}>已加入購物車</Text>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleAddToCartFromMeal(mp)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                    <Text style={{ fontSize: 10, color: "#F59E0B", fontWeight: "600" }}>未加入購物車（點此加入）</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {isTemplate ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Ionicons name="cart-outline" size={10} color="#FF8C00" />
                <Text style={{ fontSize: 9, color: "#FF8C00", fontWeight: "700" }}>點擊開啟 🛒 買餸食材清單</Text>
              </View>
            ) : mp.proposedByName ? (
              <Text style={styles.mealProposer}>由 {mp.proposedByName} 提案</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.mealEditBtn}
            onPress={() => openMoveDateModal(mp)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="calendar-outline" size={16} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mealDeleteBtn}
            onPress={() => handleDeleteMeal(mp)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#DC2626" />
          </TouchableOpacity>
        </TouchableOpacity>
        {isPending && (
          isAdmin ? (
            <View style={styles.mealActions}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleConfirmMeal(mp)}
              >
                <Ionicons name="checkmark" size={10} color="#16A34A" />
                <Text style={styles.confirmBtnText}>確認</Text>
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
                <Ionicons name="close" size={10} color="#DC2626" />
                <Text style={styles.rejectBtnText}>拒絕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waitingRow}>
              <Ionicons name="time-outline" size={10} color="#CA8A04" />
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
            <TouchableOpacity
              style={[styles.eatOutBtn, eatOutDateSet.has(day.dateStr) && styles.eatOutBtnActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                const currentEatOut = eatOutDateSet.has(day.dateStr);
                eatOutM.mutate({
                  date: day.dateStr,
                  eatOut: !currentEatOut,
                });
              }}
            >
              <Ionicons name="restaurant-outline" size={11} color={eatOutDateSet.has(day.dateStr) ? "#D97706" : "#9CA3AF"} />
              <Text style={[styles.eatOutTxt, eatOutDateSet.has(day.dateStr) && styles.eatOutTxtActive]}>
                外出
              </Text>
            </TouchableOpacity>
            {dayMeals.length > 0 ? (
              <View style={[styles.countBadge, { backgroundColor: allConfirmed ? "#DCFCE7" : "#E8F0FE" }]}>
                <Text style={[styles.countText, { color: allConfirmed ? "#16A34A" : "#013E77" }]}>
                  {dayMeals.length} 餐
                </Text>
              </View>
            ) : eatOutDateSet.has(day.dateStr) ? (
              <View style={styles.eatOutBadge}>
                <Text style={styles.eatOutBadgeTxt}>外出用餐</Text>
              </View>
            ) : (
              <View style={styles.emptyMealContainer}>
                <Ionicons name="restaurant-outline" size={12} color="#D1D5DB" />
                <Text style={styles.emptyMealText}>未安排</Text>
              </View>
            )}
            <Text style={styles.expandArrow}>{isExpanded ? "▲" : "▼"}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.dayBody}>
            {dayMeals.length === 0 && (
              <View style={styles.dayBodyEmpty}>
                <Ionicons name="restaurant-outline" size={28} color="#E5E7EB" />
                <Text style={styles.dayBodyEmptyText}>尚未安排餐點</Text>
                <Text style={styles.dayBodyEmptySub}>點擊下方按鈕加入</Text>
              </View>
            )}
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
                      <Ionicons name={cfg.icon as any} size={11} color="#013E77" />
                      <Text style={styles.addMealBtnText}>
                        + {cfg.label}
                      </Text>
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
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/import")}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/ai-chef")}
          >
            <Ionicons name="chatbubble-ellipses" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={() => {
            console.log("[Planner] Week offset -1, current:", weekOffset);
            setWeekOffset(weekOffset - 1);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.weekNavBtn}
        >
          <Text style={styles.weekNavArrow}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.todayNavBtn}
          onPress={() => {
            console.log("[Planner] Reset to today");
            setWeekOffset(0);
          }}
        >
          <Ionicons name="today-outline" size={14} color="#013E77" />
          <Text style={styles.todayNavTxt}>今天</Text>
        </TouchableOpacity>
        <View style={styles.weekNavCenter}>
          <Text style={styles.weekLabel}>
            {formatDateShort(monday)} - {formatDateShort(sunday)}
          </Text>
          <Text style={styles.weekSubLabel}>{formatWeekLabel(monday, sunday)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            console.log("[Planner] Week offset +1, current:", weekOffset);
            setWeekOffset(weekOffset + 1);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.weekNavBtn}
        >
          <Text style={styles.weekNavArrow}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* ✨ AI 智能晚餐推薦懸浮 Banner（實驗性，隱藏） */}
      {SHOW_EXPERIMENTAL_AI && (
        <TouchableOpacity
          style={styles.aiRecommendBanner}
          onPress={() => {
          console.log("[Planner] AI Banner pressed, opening AI generator modal");
          setShowSmartRecommend(false);
          setShowAISuggest(true);
          }}
          activeOpacity={0.8}
        >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#F3E8FF", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles" size={17} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiRecommendTitle}>✨ AI 智能晚餐推薦</Text>
            <Text style={styles.aiRecommendSub}>一鍵智能生成本週「三菜一湯」，套用至日常排餐</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
      </TouchableOpacity>
      )}

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

      {/* ＋餐次搜尋 Modal（注意：要同 index.tsx 嘅搜尋 modal 保持同步） */}
      {/* TODO: 如果想用完整 FilterModal，参考 index.tsx line 1161 */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>選擇食譜</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={17} color="#9CA3AF" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="搜尋食譜..."
                placeholderTextColor="#9CA3AF"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                returnKeyType="search"
              />
              {pickerSearch ? (
                <TouchableOpacity onPress={() => setPickerSearch("")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={() => setSortBy(sortBy === "popular" ? "cookTime" : sortBy === "cookTime" ? "difficulty" : "popular")} style={styles.pickerSortBtn}>
                <Ionicons name={sortBy === "popular" ? "star-outline" : sortBy === "cookTime" ? "flame-outline" : "swap-horizontal-outline"} size={18} color="#013E77" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowFilterSheet(true)} style={styles.pickerFilterBtn}>
                <Ionicons name="filter-outline" size={18} color="#013E77" />
                {pickerFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeTxt}>{pickerFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 來源 filter chips：全部 / 官方 / 我的 / 模板 */}
            <View style={styles.pickerSourceRow}>
              {([["all", "全部"], ["official", "官方"], ["user", "我的"], ["template", "模板"]] as const).map(([key, label]) => {
                const active = pickerSourceFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.pickerSourceChip, active && styles.pickerSourceChipActive]}
                    onPress={() => setPickerSourceFilter(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerSourceChipTxt, active && styles.pickerSourceChipTxtActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
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
                      {pickerSearch || pickerSourceFilter !== "all" ? "沒有符合的食譜" : "暫無食譜"}
                    </Text>
                  </View>
                }
                renderItem={({ item }: { item: any }) => {
                  const tags: string[] = item.tags ?? [];
                  const cat = categories.find(c => c.key === item.recipeCategory);
                  return (
                    <RecipeCard
                      item={item}
                      category={cat}
                      isUser={item._source === "user"}
                      isAIGenerated={tags.includes("AI 生成")}
                      tags={tags}
                      activeTagFilters={activeTagFilters}
                      setActiveTagFilters={setActiveTagFilters}
                      setQuickPlanRecipe={() => {}}
                      navigateToRecipe={() => handleAddMeal(item)}
                      onPress={() => handleAddMeal(item)}
                      showQuickPlan={false}
                    />
                  );
                }}
              />
              <FilterModal
                inline
                visible={showFilterSheet}
                onClose={() => setShowFilterSheet(false)}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                categories={categories}
                activeIngredientCategory={activeIngredientCategory}
                setActiveIngredientCategory={setActiveIngredientCategory}
                filterCookTimeMax={filterCookTimeMax}
                setFilterCookTimeMax={setFilterCookTimeMax}
                activeTagFilters={activeTagFilters}
                setActiveTagFilters={setActiveTagFilters}
                allUserTags={allUserTags}
                setActivePopularChips={setActivePopularChips}
                activePopularChips={activePopularChips}
                setSortBy={setSortBy}
                viewMode={viewMode}
                setViewMode={setViewMode}
                officialCount={officialRecipes.length}
                userCount={userRecipes.length}
              />
          </View>
        </View>
      </Modal>

      <IngredientPickerModal
        visible={!!pickerRecipe}
        recipes={pickerRecipe ? [pickerRecipe] : []}
        defaultDate={pickerRecipe?.date ? getDayBefore(pickerRecipe.date) : undefined}
        maxDate={pickerRecipe?.date}
        showDateSelector={true}
        loading={addShoppingBatchM.isPending}
        alreadyAddedKeys={pickerAlreadyAddedKeys}
        onConfirm={(items) => {
          if (items.length > 0) {
            addShoppingBatchM.mutate({
              items: items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                category: i.category,
              })),
              fromRecipeId: items[0].recipeId,
              fromRecipeName: items[0].recipeName,
              fromMealPlanId: items[0].fromMealPlanId,
              plannedDate: items[0].plannedDate,
            });
          } else {
            setPickerRecipe(null);
            setToast({ visible: true, message: "排餐已記錄", type: "info" });
          }
        }}
        onSkip={() => {
          setPickerRecipe(null);
          setToast({ visible: true, message: "已跳過食材", type: "info" });
        }}
      />

      <Modal visible={showMoveDateModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, maxHeight: "90%" }}>
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>改排餐日期</Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  {moveMealPlanTarget ? moveMealPlanTarget.recipeName : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowMoveDateModal(false);
                setShowSyncDateModal(false);
                setPendingMoveDateSave(null);
              }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
                <Ionicons name="close-outline" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1A1A", marginBottom: 8 }}>新排餐日期</Text>
              <PlanDatePicker
                value={moveMealPlanDate || (moveMealPlanTarget?.date ?? toISODate(new Date()))}
                onChange={setMoveMealPlanDate}
                showShortcuts={true}
                monthsAhead={12}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center" }}
                  onPress={() => {
                    setShowMoveDateModal(false);
                    setShowSyncDateModal(false);
                    setPendingMoveDateSave(null);
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#013E77", alignItems: "center" }}
                  onPress={() => {
                    if (!moveMealPlanTarget || !moveMealPlanDate) return;
                    if (syncShoppingItems && syncShoppingDateMode === "custom" && !syncShoppingDate) {
                      Alert.alert("請選擇購物日期", "請先選擇自訂購物日期");
                      return;
                    }
                    if (syncShoppingItems && selectedMoveShoppingDate > moveMealPlanDate) {
                      Alert.alert("日期超出範圍", "購物日期不能遲過排餐日");
                      return;
                    }
                    if (relatedShoppingItems.length > 0 && moveMealPlanTarget && moveMealPlanDate !== moveMealPlanTarget.date) {
                      promptSyncShoppingDate();
                      return;
                    }
                    updateMealDateM.mutate({
                      id: moveMealPlanTarget.id,
                      newDate: moveMealPlanDate,
                      moveShoppingItems: syncShoppingItems,
                      shoppingDate: syncShoppingItems ? selectedMoveShoppingDate : undefined,
                    });
                  }}
                  disabled={updateMealDateM.isPending}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{updateMealDateM.isPending ? "儲存中..." : "儲存"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSyncDateModal} transparent animationType="fade" onRequestClose={cancelSyncDateModal}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 16 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 16, maxWidth: 520, width: "100%", alignSelf: "center" }}>
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" }} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>設定購物日期</Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              共 {relatedShoppingItems.length} 項，購物日期唔可以遲過排餐日
            </Text>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {[
                { key: "previous", label: "前一天" },
                { key: "same", label: "同日" },
                { key: "custom", label: "自訂" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    const key = opt.key as "previous" | "same" | "custom";
                    setDraftSyncShoppingDateMode(key);
                    if (key === "custom") {
                      const prev = getDayBefore(moveMealPlanDate || toISODate(new Date()));
                      setDraftSyncShoppingDate(prev < toISODate(new Date()) ? toISODate(new Date()) : prev);
                    }
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: draftSyncShoppingDateMode === opt.key ? "#013E77" : "#D1D5DB",
                    backgroundColor: draftSyncShoppingDateMode === opt.key ? "#E8F0FE" : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: draftSyncShoppingDateMode === opt.key ? "#013E77" : "#374151" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {draftSyncShoppingDateMode === "custom" && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8 }}>
                  自訂購物日期（唔可以遲過排餐日）
                </Text>
                <PlanDatePicker
                  value={clampShoppingDate(draftSyncShoppingDate || getDayBefore(moveMealPlanDate || toISODate(new Date()))) ?? toISODate(new Date())}
                  onChange={setDraftSyncShoppingDate}
                  maxDate={moveMealPlanDate || undefined}
                  showShortcuts={true}
                />
              </View>
            )}

            <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 10 }}>
              目前：{draftSyncShoppingDateMode === "same"
                ? (moveMealPlanDate || getDayBefore(toISODate(new Date())))
                : draftSyncShoppingDateMode === "custom"
                  ? (clampShoppingDate(draftSyncShoppingDate || getDayBefore(moveMealPlanDate || toISODate(new Date()))) || toISODate(new Date()))
                  : (clampShoppingDate(getDayBefore(moveMealPlanDate || toISODate(new Date()))) || toISODate(new Date()))}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center" }}
                onPress={cancelSyncDateModal}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#013E77", alignItems: "center" }}
                onPress={confirmSyncDateModal}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Smart Weekly Recommendation Modal（實驗性，隱藏）─── */}
      {SHOW_EXPERIMENTAL_AI && (
      <Modal visible={showSmartRecommend} animationType="slide" transparent onRequestClose={() => setShowSmartRecommend(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSmartRecommend(false)} />
          <View style={{ backgroundColor: "#FFFBF5", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "90%" }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0E8DC", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1A1A" }}>本週 AI 晚餐推薦搭配</Text>
                  <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{formatDateShort(monday)} - {formatDateShort(sunday)} · 均衡膳食結構（三菜一湯）</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7C3AED", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => { setShowSmartRecommend(false); setShowAISuggest(true); }}
                >
                  <Ionicons name="sparkles" size={11} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>AI 生成</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSmartRecommend(false)} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              {/* Day navigation tabs */}
              <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0E8DC" }}>
                {[1, 2, 3, 4, 5, 6, 7].map(d => {
                  const dayItem = recommendItemsByDay[d];
                  const has = dayItem && (dayItem.meatId || dayItem.seafoodId || dayItem.vegId || dayItem.soupId);
                  const isCurrent = recommendCurrentDay === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={{ alignItems: "center", width: 44, paddingVertical: 6, borderRadius: 10, backgroundColor: isCurrent ? "#FF8C00" : "transparent" }}
                      onPress={() => setRecommendCurrentDay(d)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: isCurrent ? "#fff" : "#4B5563" }}>{DAY_SHORT[d]}</Text>
                      <Text style={{ fontSize: 9, color: isCurrent ? "#FFF3E0" : "#9CA3AF", marginTop: 2 }}>{getDateForDowShort(startDate, d)}</Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: has ? (isCurrent ? "#fff" : "#FF8C00") : "transparent", marginTop: 4 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView style={{ flex: 1, padding: 14 }}>
                {/* Info summary */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#4B5563" }}>
                    {DAY_LABELS[recommendCurrentDay]} 晚餐推薦搭配：
                  </Text>
                  <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
                    {getDateForDow(startDate, recommendCurrentDay)}
                  </Text>
                </View>

                {/* 4 slots */}
                <View style={{ gap: 8 }}>
                  {(["meat", "seafood", "veg", "soup"] as SlotType[]).map(slot => {
                    const item = recommendItemsByDay[recommendCurrentDay];
                    const dishId = item ? item[`${slot}Id`] ?? null : null;
                    const dishName = item ? item[`${slot}Name`] ?? null : null;
                    const meta = SLOT_META[slot];
                    const hasDish = dishId && dishName;

                    const numId = getNumericId(dishId);
                    const official = !isNaN(numId) ? officialMap.get(numId) : null;
                    const resolvedImage = official ? official.thumbnailUrl || official.image : null;

                    return (
                      <View key={slot} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#F0E8DC", padding: 8, gap: 10 }}>
                        {/* Slot icon */}
                        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={meta.icon as any} size={18} color={SLOT_COLORS[slot]} />
                        </View>

                        {/* Dish Details - Clickable for preview */}
                        <TouchableOpacity
                          disabled={!hasDish}
                          onPress={() => {
                            if (showAISuggest) setShowAISuggest(false);
                            setShowSmartRecommend(false);
                            setEditingSlot({ day: recommendCurrentDay, slot });
                          }}
                          style={{ flex: 1 }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "600" }}>{meta.label}</Text>
                              <Text style={{ fontSize: 13, fontWeight: "800", color: hasDish ? "#1A1A1A" : "#9CA3AF", marginTop: 1 }} numberOfLines={1}>
                                {hasDish ? dishName : `請添加${meta.label}`}
                              </Text>
                            </View>
                            {/* Image preview */}
                            {hasDish && resolvedImage && (
                              <ExpoImage source={{ uri: resolvedImage }} style={{ width: 34, height: 34, borderRadius: 6 }} contentFit="cover" cachePolicy="memory-disk" onError={() => console.warn("[Planner] slot thumb failed to load")} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Actions */}
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {hasDish && (
                            <TouchableOpacity
                              style={{ backgroundColor: "#FEE2E2", borderRadius: 6, padding: 6 }}
                              onPress={() => {
                                Alert.alert("清除", `確定清除本日的「${meta.label}」嗎？`, [
                                  { text: "取消", style: "cancel" },
                                  {
                                    text: "清除",
                                    style: "destructive",
                                    onPress: () => {
                                      const dayItem = recommendItemsByDay[recommendCurrentDay];
                                      setDayM.mutate({
                                        weekStart: startDate,
                                        dayOfWeek: recommendCurrentDay,
                                        meat: slot === "meat" ? null : toDishSlotFromFlat(dayItem, "meat"),
                                        seafood: slot === "seafood" ? null : toDishSlotFromFlat(dayItem, "seafood"),
                                        veg: slot === "veg" ? null : toDishSlotFromFlat(dayItem, "veg"),
                                        soup: slot === "soup" ? null : toDishSlotFromFlat(dayItem, "soup"),
                                      });
                                    }
                                  }
                                ]);
                              }}
                            >
                              <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={{ backgroundColor: "#F3F4F6", borderRadius: 6, padding: 6 }}
                            onPress={() => {
                              if (showAISuggest) setShowAISuggest(false);
                              setShowSmartRecommend(false);
                              setEditingSlot({ day: recommendCurrentDay, slot });
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                              <Ionicons name={hasDish ? "swap-horizontal" : "add"} size={13} color="#6B7280" />
                              <Text style={{ fontSize: 9, fontWeight: "700", color: "#6B7280" }}>換</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Bottom Actions */}
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: "#F0E8DC", backgroundColor: "#fff", flexDirection: "row", gap: 8 }}>
              {/* 套用本日推薦 */}
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#E8F0FE", alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" }}
                onPress={() => handleApplyToday(recommendItemsByDay[recommendCurrentDay])}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#013E77" }}>✅ 套用本日 ({DAY_SHORT[recommendCurrentDay]})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* ─── AI Suggestion Configure Modal（實驗性，隱藏）─── */}
      {SHOW_EXPERIMENTAL_AI && showAISuggest && (
        <AISuggestModalRN
          visible={showAISuggest}
          weekStart={startDate}
          officialRecipes={officialRecipes}
          onClose={() => { setShowAISuggest(false); }}
          onViewRecipe={(r) => {
            router.push({ 
              pathname: "/recipe/[id]", 
              params: { id: String(r.id) } 
            });
          }}
          addShoppingBatchM={addShoppingBatchM}
          startDate={startDate}
          setDayM={setDayM}
        />
      )}

      {/* ─── Slot Picker Modal ─── */}
      {editingSlot && (
        <SlotPickerModal
          dayOfWeek={editingSlot.day}
          slotType={editingSlot.slot}
          officialRecipes={officialRecipes}
          userRecipes={userRecipes}
          isPending={setDayM.isPending}
          onSelect={(recipe) => {
            const slot = editingSlot.slot;
            const dayRow = recommendItemsByDay[editingSlot.day];
            const dishSlot = {
              id: `official_${recipe.id}`,
              name: recipe.name,
              image: recipe.thumbnailUrl || recipe.image || "",
              cookTime: recipe.cookTime || 20,
            };
            setDayM.mutate({
              weekStart: startDate,
              dayOfWeek: editingSlot.day,
              meat: slot === "meat" ? dishSlot : toDishSlotFromFlat(dayRow, "meat"),
              seafood: slot === "seafood" ? dishSlot : toDishSlotFromFlat(dayRow, "seafood"),
              veg: slot === "veg" ? dishSlot : toDishSlotFromFlat(dayRow, "veg"),
              soup: slot === "soup" ? dishSlot : toDishSlotFromFlat(dayRow, "soup"),
            });
            setEditingSlot(null);
            setShowSmartRecommend(true);
          }}
          onClose={() => { setEditingSlot(null); setShowSmartRecommend(true); }}
        />
      )}

      {/* ─── Recipe Detail Modal ─── */}
      {previewRecipe && pendingPlanInfo && (
        <RecipeDetailModal
          recipe={previewRecipe}
          onClose={() => {
            setPreviewRecipe(null);
            setPendingPlanInfo(null);
          }}
          onAddToPlan={() => {
            if (pendingPlanInfo.slot && pendingPlanInfo.dayOfWeek !== undefined) {
              const slot = pendingPlanInfo.slot;
              const dayRow = recommendItemsByDay[pendingPlanInfo.dayOfWeek];
              setDayM.mutate({
                weekStart: startDate,
                dayOfWeek: pendingPlanInfo.dayOfWeek,
                meat: slot === "meat" ? { id: `official_${previewRecipe.id}`, name: previewRecipe.name, image: previewRecipe.thumbnailUrl || previewRecipe.image || "", cookTime: previewRecipe.cookTime || 20 } : toDishSlotFromFlat(dayRow, "meat"),
                seafood: slot === "seafood" ? { id: `official_${previewRecipe.id}`, name: previewRecipe.name, image: previewRecipe.thumbnailUrl || previewRecipe.image || "", cookTime: previewRecipe.cookTime || 20 } : toDishSlotFromFlat(dayRow, "seafood"),
                veg: slot === "veg" ? { id: `official_${previewRecipe.id}`, name: previewRecipe.name, image: previewRecipe.thumbnailUrl || previewRecipe.image || "", cookTime: previewRecipe.cookTime || 20 } : toDishSlotFromFlat(dayRow, "veg"),
                soup: slot === "soup" ? { id: `official_${previewRecipe.id}`, name: previewRecipe.name, image: previewRecipe.thumbnailUrl || previewRecipe.image || "", cookTime: previewRecipe.cookTime || 20 } : toDishSlotFromFlat(dayRow, "soup"),
              });
            }
            setPreviewRecipe(null);
            setPendingPlanInfo(null);
          }}
          onAddToShopping={() => {
            const ings = Array.isArray(previewRecipe.ingredients) ? previewRecipe.ingredients : [];
            if (ings.length > 0) {
              addShoppingBatchM.mutate({
                items: ings.map((ing: any) => ({
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit,
                  category: ing.category || "其他",
                })),
                fromRecipeId: `official_${previewRecipe.id}`,
                fromRecipeName: previewRecipe.name,
                plannedDate: pendingPlanInfo?.date ? getDayBefore(pendingPlanInfo.date) : undefined,
              });
              setToast({ visible: true, message: "✅ 食材已加入購物車", type: "success" });
            }
            setPreviewRecipe(null);
            setPendingPlanInfo(null);
          }}
          isAdding={setDayM.isPending || addShoppingBatchM.isPending}
        />
      )}



      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

function RecipeDetailModal({
  recipe,
  onClose,
  onAddToPlan,
  onAddToShopping,
  isAdding,
}: {
  recipe: any;
  onClose: () => void;
  onAddToPlan: () => void;
  onAddToShopping: () => void;
  isAdding: boolean;
}) {
  const imageSource = useMemo(() => {
    if (!recipe) return null;
    const img = recipe.thumbnailUrl || recipe.image;
    if (!img || img.trim() === "") return null;
    return { uri: img };
  }, [recipe]);

  const stepsList = useMemo(() => {
    if (!recipe || !Array.isArray(recipe.steps)) return [];
    return recipe.steps.map((step: any) => {
      if (typeof step === "string") return step;
      return step.instruction || step.description || step.step || "";
    });
  }, [recipe]);

  if (!recipe) return null;

  return (
    <Modal transparent animationType="slide" visible={recipe !== null}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFFBF5", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "85%" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F0E8DC" }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#1A1A1A" }} numberOfLines={1}>{recipe.name}</Text>
              {recipe.description && (
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }} numberOfLines={1}>{recipe.description}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
              <Ionicons name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Image */}
            {imageSource ? (
              <ExpoImage source={imageSource} style={{ width: "100%", height: 180 }} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={{ width: "100%", height: 120, backgroundColor: "#EAEAEA", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="restaurant-outline" size={48} color="#C0C0C0" />
              </View>
            )}

            {/* Meta Row */}
            <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F0E8DC", backgroundColor: "#FFFFFF" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>⏱ 烹飪時間</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A1A1A" }}>{recipe.cookTime || 20} 分鐘</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#F0E8DC" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>👥 分量</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A1A1A" }}>{recipe.servings || 2} 人份</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#F0E8DC" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>🔥 難易度</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A1A1A" }}>{recipe.difficulty || "簡單"}</Text>
              </View>
            </View>

            {/* Ingredients Section */}
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="leaf" size={16} color="#16A34A" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1A1A" }}>🥬 需要食材</Text>
              </View>
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1.5, borderColor: "#F0E8DC", paddingHorizontal: 12, paddingVertical: 6 }}>
                {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 ? (
                  recipe.ingredients.map((ing: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: i < recipe.ingredients.length - 1 ? 1 : 0, borderBottomColor: "#F3F4F6" }}>
                      <Text style={{ fontSize: 13, color: "#1A1A1A" }}>{ing.name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#4B5563" }}>{ing.quantity} {ing.unit}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 12, color: "#9CA3AF", paddingVertical: 6 }}>暫無食材資訊</Text>
                )}
              </View>
            </View>

            {/* Steps Section */}
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="restaurant" size={16} color="#FF8C00" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1A1A" }}>🍳 烹飪步驟</Text>
              </View>
              <View style={{ gap: 10 }}>
                {stepsList.length > 0 ? (
                  stepsList.map((step: string, i: number) => (
                    <View key={i} style={{ flexDirection: "row", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1.5, borderColor: "#F0E8DC", padding: 12 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FF8C00", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 13, color: "#1A1A1A", lineHeight: 18 }}>{step}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 12, color: "#9CA3AF", paddingVertical: 6 }}>暫無步驟資訊</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#F0E8DC", backgroundColor: "#FFFFFF", flexDirection: "row", gap: 10 }}>
            <TouchableOpacity 
              onPress={onClose} 
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" }}
            >
              <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "700" }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onAddToShopping} 
              disabled={isAdding}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>加入購物車</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onAddToPlan} 
              disabled={isAdding}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#013E77", alignItems: "center" }}
            >
              {isAdding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>加入排餐</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── AI Weekly Menu Supporting Modals ───────────────────────────────────────────

function SlotPickerModal({
  dayOfWeek, slotType, officialRecipes, userRecipes, onSelect, onClose, isPending,
}: {
  dayOfWeek: number; slotType: SlotType; officialRecipes: any[]; userRecipes: any[];
  onSelect: (recipe: any) => void; onClose: () => void; isPending: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"library" | "ai">("library");
  const [aiStyle, setAiStyle] = useState<string>("");
  const meta = SLOT_META[slotType];

  const filtered = useMemo(() => {
    // Phase 4: Library mode only shows official + custom recipes, filter out AI-generated
    const results = [
      ...officialRecipes.filter((r: any) => matchRecipeForSlot(r, slotType)),
      ...(userRecipes || []).filter((r: any) => matchRecipeForSlot(r, slotType) && r.source !== "ai"),
    ];
    if (search.trim()) {
      const q = search.toLowerCase();
      return results.filter((r: any) => r.name.toLowerCase().includes(q));
    }
    return results;
  }, [slotType, officialRecipes, userRecipes, search]);

  const aiStyleOptions = ["中式", "西式", "日式", "韓式", "東南亞", "快手"];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFFBF5", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%", minHeight: "50%" }}>
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: "#F0E8DC" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1A1A" }}><Ionicons name={meta.icon as any} size={14} color={SLOT_COLORS[slotType]} /> 選擇{DAY_LABELS[dayOfWeek]}{meta.label}</Text>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
              <Ionicons name="close" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Mode Toggle */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: mode === "library" ? "#7C3AED" : "#F3F4F6", alignItems: "center" }}
              onPress={() => setMode("library")}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: mode === "library" ? "#fff" : "#6B7280" }}>📚 食譜庫</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: mode === "ai" ? "#7C3AED" : "#F3F4F6", alignItems: "center" }}
              onPress={() => setMode("ai")}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: mode === "ai" ? "#fff" : "#6B7280" }}>🤖 AI 生成</Text>
            </TouchableOpacity>
          </View>

          {mode === "library" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Ionicons name="search" size={14} color="#9CA3AF" />
              <TextInput
                style={{ flex: 1, fontSize: 13, color: "#1A1A1A" }}
                value={search}
                onChangeText={setSearch}
                placeholder={`搜尋${meta.label}食譜...`}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>想要咩風格？（可選）</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {aiStyleOptions.map(style => (
                  <TouchableOpacity
                    key={style}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: aiStyle === style ? "#7C3AED" : "#F3F4F6" }}
                    onPress={() => setAiStyle(aiStyle === style ? "" : style)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "600", color: aiStyle === style ? "#fff" : "#6B7280" }}>{style}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: "#7C3AED", alignItems: "center" }}
                onPress={() => {
                  Alert.alert(
                    "🤖 AI 生成食譜",
                    `AI 生成功能已移至 AI Chef，你可以：\n\n1. 去 AI Chef 輸入「生成 3 個${meta.label}食譜」\n2. 或使用「食譜庫」揀選現有食譜`,
                    [
                      { text: "取消", style: "cancel" },
                      { text: "開啟 AI Chef", onPress: () => { router.push("/ai-chef"); onClose(); } }
                    ]
                  );
                }}
              >
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff", marginTop: 2 }}>去 AI Chef 生成</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {mode === "library" && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={filtered.length === 0 ? { flexGrow: 1 } : undefined}
            ListEmptyComponent={(
              <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>食譜庫中暫無{meta.label}食譜</Text>
                <Text style={{ fontSize: 11, color: "#B0BAC9", marginTop: 4 }}>請先在食譜庫加入相關食譜</Text>
              </View>
            )}
            renderItem={({ item: recipe }) => (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                onPress={() => onSelect(recipe)}
                disabled={isPending}
              >
                {(() => {
                  const imgUrl = recipe.thumbnailUrl || recipe.image;
                  const hasImage = imgUrl && imgUrl.trim() !== "";
                  return hasImage ? (
                    <ExpoImage source={{ uri: imgUrl }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon as any} size={20} color={SLOT_COLORS[slotType]} />
                    </View>
                  );
                })()}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1A1A" }}>{recipe.name}</Text>
                  {recipe.cookTime && <Text style={{ fontSize: 10, color: "#9CA3AF" }}>⏱ {recipe.cookTime}分鐘</Text>}
                </View>
                {isPending && <ActivityIndicator size="small" color="#013E77" />}
              </TouchableOpacity>
            )}
          />
        )}

        {mode === "ai" && (
          <View style={{ padding: 32, alignItems: "center" }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.13)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Ionicons name="sparkles" size={28} color="#7C3AED" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 }}>AI 生成{meta.label}</Text>
            <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>選擇風格後，AI 會為你生成 3 個選項</Text>
          </View>
        )}
        </View>
      </View>
    </Modal>
  );
}

function AISuggestModalRN({
  visible, weekStart, officialRecipes, onClose, onViewRecipe, addShoppingBatchM, startDate, setDayM,
}: {
  visible: boolean; weekStart: string; officialRecipes: any[];
  onClose: () => void;
  onViewRecipe: (recipe: any) => void;
  addShoppingBatchM: any;
  startDate: string;
  setDayM: any;
}) {
  const insets = useSafeAreaInsets();
  const [suggestedDays, setSuggestedDays] = useState<any[] | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(getTodayDow());
  const [swapTarget, setSwapTarget] = useState<{ day: number; slot: SlotType } | null>(null);
  const [swapPreview, setSwapPreview] = useState<{ dish: any; day: number; slot: SlotType } | null>(null);
  const autoGenerateRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      autoGenerateRef.current = false;
      return;
    }

    setSelectedDay(getTodayDow());
    setSuggestedDays(null);
    setReasoning("");
    setSwapTarget(null);
    setSwapPreview(null);
    autoGenerateRef.current = false;
  }, [visible]);

  const aiSuggestM = trpc.weeklyMenu.aiSuggest.useMutation({
    onMutate: () => {
      console.log("[AI Suggest] Starting mutation...");
    },
    onSuccess: (data: any) => {
      console.log("[AI Suggest] Success:", data);
      setSuggestedDays(data.days);
      setReasoning(data.reasoning || "");
    },
    onError: (e) => {
      console.error("[AI Suggest] Error:", e);
      let message = "AI 推薦失敗";
      if (e.message?.includes("食譜庫")) {
        message = e.message;
      } else if (e.message?.includes("權限")) {
        message = "請先加入家庭廚房或聯繫管理員";
      } else if (e.message?.includes("AI")) {
        message = e.message;
      }
      Alert.alert("AI 推薦失敗", message);
    },
  });
  const handleSwap = (dayOfWeek: number, slotType: SlotType, newDish: any) => {
    setSuggestedDays(prev =>
      prev ? prev.map(d =>
        d.dayOfWeek === dayOfWeek ? { ...d, [slotType]: { ...newDish, reason: "手動替換" } } : d
      ) : prev
    );
  };

  const handleClearSlot = (dayOfWeek: number, slotType: SlotType) => {
    Alert.alert(
      "清空菜式",
      `確定要清空週${DAY_SHORT[dayOfWeek]}${SLOT_META[slotType].label}？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "清空",
          style: "destructive",
          onPress: () => {
            setSuggestedDays(prev =>
              prev ? prev.map(d =>
                d.dayOfWeek === dayOfWeek ? { ...d, [slotType]: { id: null, name: null, image: null, cookTime: null, reason: null } } : d
              ) : prev
            );
          },
        },
      ]
    );
  };

  const slots: SlotType[] = ["meat", "seafood", "veg", "soup"];
  const countFilledDay = useCallback((day: any): number =>
    slots.reduce((count, slot) => count + (normalizeName(day?.[slot]?.name) ? 1 : 0), 0),
    []);

  useEffect(() => {
    if (!visible) return;
    if (suggestedDays || aiSuggestM.isPending || autoGenerateRef.current) return;
    autoGenerateRef.current = true;
    aiSuggestM.mutate({ city: "香港" });
  }, [visible, suggestedDays, aiSuggestM.isPending, aiSuggestM]);

  const sortedDays = useMemo(() => {
    const map = new Map<number, any>();
    (suggestedDays || []).forEach(day => {
      map.set(day.dayOfWeek, day);
    });
    return [...map.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [suggestedDays]);

  const goNextIncomplete = useCallback(() => {
    if (!sortedDays.length) return;
    const idx = sortedDays.findIndex(day => day.dayOfWeek === selectedDay);
    const candidates = [...sortedDays.slice(idx + 1), ...sortedDays.slice(0, idx + 1)];
    const next = candidates.find(day => countFilledDay(day) < 4);
    if (next) setSelectedDay(next.dayOfWeek);
  }, [sortedDays, selectedDay, countFilledDay]);
  const selectedDayData = useMemo(
    () => sortedDays.find(day => day.dayOfWeek === selectedDay) || null,
    [sortedDays, selectedDay]
  );
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    sortedDays.forEach(day => {
      slots.forEach(slot => {
        const dishName = normalizeName(day?.[slot]?.name);
        if (!dishName) return;
        counts.set(dishName, (counts.get(dishName) || 0) + 1);
      });
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name));
  }, [sortedDays]);

  useEffect(() => {
    if (!sortedDays.length) return;
    if (!sortedDays.some(day => day.dayOfWeek === selectedDay)) {
      setSelectedDay(sortedDays[0].dayOfWeek);
    }
  }, [sortedDays, selectedDay]);

  if (!visible) return null;

  return (
    <>
      <Modal visible transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ flex: 1, backgroundColor: "#FFFBF5", marginTop: 60, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom }}>
            {/* Header */}
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#F0E8DC" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: "#1A1A1A" }}>AI 智能週餐推薦</Text>
                    <Text style={{ fontSize: 10, color: "#9CA3AF" }}>先完成今日，再慢慢微調本週</Text>
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
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 }}>AI 正在自動生成本週晚餐</Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginBottom: 24 }}>生成完成後，你可以逐日微調，再一鍵發布</Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7C3AED", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 }}
                    onPress={() => {
                      autoGenerateRef.current = true;
                      aiSuggestM.mutate({ city: "香港" });
                    }}
                  >
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>重新生成</Text>
                  </TouchableOpacity>
                </View>
              )}

              {aiSuggestM.isPending && (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginTop: 16 }}>AI 正在分析...</Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>正在獲取天氣資料、分析飲食記錄</Text>
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

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                    {sortedDays.map(day => {
                      const isActive = day.dayOfWeek === selectedDay;
                      const isWeekend = day.dayOfWeek >= 6;
                      return (
                        <TouchableOpacity
                          key={day.dayOfWeek}
                          onPress={() => setSelectedDay(day.dayOfWeek)}
                          style={{
                            minWidth: 86,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderRadius: 14,
                            backgroundColor: isActive ? "#7C3AED" : isWeekend ? "#FFF7ED" : "#fff",
                            borderWidth: 1.5,
                            borderColor: isActive ? "#7C3AED" : "#F0E8DC",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "900", color: isActive ? "#fff" : isWeekend ? "#FF8C00" : "#374151" }}>
                            {DAY_LABELS[day.dayOfWeek]}
                          </Text>
                          <Text style={{ fontSize: 10, marginTop: 2, color: isActive ? "rgba(255,255,255,0.9)" : "#9CA3AF" }}>
                            {getDateForDowShort(weekStart, day.dayOfWeek)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {selectedDayData && (
                    <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1.5, borderColor: "#F0E8DC", overflow: "hidden" }}>
                      <View style={{ padding: 12, backgroundColor: selectedDayData.dayOfWeek >= 6 ? "#FFF7ED" : "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#F0E8DC", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "900", color: selectedDayData.dayOfWeek >= 6 ? "#FF8C00" : "#374151" }}>
                            {DAY_LABELS[selectedDayData.dayOfWeek]}
                          </Text>
                          <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{getWeekDayLabel(weekStart, selectedDayData.dayOfWeek)}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={goNextIncomplete}
                          style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#7C3AED", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>下一日</Text>
                          <Ionicons name="chevron-forward" size={11} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ padding: 10, gap: 8 }}>
                        {slots.map(slotType => {
                          const dish = selectedDayData[slotType];
                          const meta = SLOT_META[slotType];
                          const hasValidDish = !!(dish && dish.id && dish.name);
                          const dishName = normalizeName(dish?.name);
                          const isDuplicate = !!dishName && duplicateNames.has(dishName);
                          return (
                            <View key={slotType} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FAFAFA", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#F0E8DC" }}>
                              <View style={{ width: 36, alignItems: "center" }}>
                                <Ionicons name={meta.icon as any} size={16} color={SLOT_COLORS[slotType]} />
                              </View>
                              <TouchableOpacity
                                style={{ flex: 1 }}
                                disabled={!hasValidDish}
                                onPress={() => {
                                  if (!hasValidDish) return;
                                  const numId = getNumericId(dish.id);
                                  const found = officialRecipes.find((r: any) => r.id === numId || r.name === dish.name);
                                  if (found) {
                                    onViewRecipe(found);
                                  } else {
                                    Alert.alert("找不到食譜詳情", "此食譜暫無詳細內容");
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 12, fontWeight: "700", color: hasValidDish ? "#1A1A1A" : "#9CA3AF" }} numberOfLines={1}>
                                  {hasValidDish ? dish.name : `${meta.label}（未設定）`}
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                                  {dish?.reason && <Text style={{ fontSize: 9, color: "#9CA3AF" }} numberOfLines={1}><Ionicons name="bulb" size={9} color="#9CA3AF" /> {dish.reason}</Text>}
                                  {isDuplicate && (
                                    <View style={{ backgroundColor: "#FEF3C7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#B45309" }}>本週已用</Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>
                              <View style={{ flexDirection: "row", gap: 4 }}>
                                <TouchableOpacity
                                  style={{ backgroundColor: hasValidDish ? "#F3F4F6" : "#E0E7FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}
                                  onPress={() => setSwapTarget({ day: selectedDayData.dayOfWeek, slot: slotType })}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: hasValidDish ? "#6B7280" : "#4338CA" }}>{hasValidDish ? "換" : "選擇"}</Text>
                                </TouchableOpacity>
                                {hasValidDish && (
                                  <TouchableOpacity
                                    style={{ backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}
                                    onPress={() => handleClearSlot(selectedDayData.dayOfWeek, slotType)}
                                  >
                                    <Ionicons name="close" size={10} color="#EF4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {suggestedDays && (
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: "#F0E8DC", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", backgroundColor: "#fff" }}>
                <TouchableOpacity
                  onPress={() => aiSuggestM.mutate({ city: "香港" })}
                  disabled={aiSuggestM.isPending}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: aiSuggestM.isPending ? "#B0BAC9" : "#6B7280" }}>重新生成</Text>
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
          currentRecipeName={normalizeName(suggestedDays.find(d => d.dayOfWeek === swapTarget.day)?.[swapTarget.slot]?.name)}
          blockedRecipeNames={Array.from(duplicateNames)}
          onSelect={(dish) => {
            const day = swapTarget.day;
            const slot = swapTarget.slot;
            setSwapTarget(null);
            const dayData = suggestedDays?.find(d => d.dayOfWeek === day);
            if (dayData) {
              setDayM.mutate({
                weekStart,
                dayOfWeek: day,
                meat: toDishSlot(slot === "meat" ? dish : dayData.meat),
                seafood: toDishSlot(slot === "seafood" ? dish : dayData.seafood),
                veg: toDishSlot(slot === "veg" ? dish : dayData.veg),
                soup: toDishSlot(slot === "soup" ? dish : dayData.soup),
              });
            }
            handleSwap(day, slot, dish);
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* Swap Recipe Preview Modal */}
      {swapPreview && (
        <RecipeDetailModal
          recipe={swapPreview.dish}
          onClose={() => setSwapPreview(null)}
          onAddToPlan={() => {
            // Persist the swap immediately by calling setDayM with the full day's slots
            const dayData = suggestedDays?.find(d => d.dayOfWeek === swapPreview.day);
            if (dayData) {
              setDayM.mutate({
                weekStart,
                dayOfWeek: swapPreview.day,
                meat: toDishSlot(swapPreview.slot === "meat" ? swapPreview.dish : dayData.meat),
                seafood: toDishSlot(swapPreview.slot === "seafood" ? swapPreview.dish : dayData.seafood),
                veg: toDishSlot(swapPreview.slot === "veg" ? swapPreview.dish : dayData.veg),
                soup: toDishSlot(swapPreview.slot === "soup" ? swapPreview.dish : dayData.soup),
              });
            }
            handleSwap(swapPreview.day, swapPreview.slot, swapPreview.dish);
            setSwapPreview(null);
            Alert.alert("✅ 已替換", `週${DAY_SHORT[swapPreview.day]}${SLOT_META[swapPreview.slot].label} 已更新`);
          }}
          onAddToShopping={() => {
            const ings = Array.isArray(swapPreview.dish.ingredients) ? swapPreview.dish.ingredients : [];
            const date = getDateForDow(startDate, swapPreview.day);
            if (ings.length > 0) {
              addShoppingBatchM.mutate({
                items: ings.map((ing: any) => ({
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit,
                  category: ing.category || "其他",
                })),
                fromRecipeId: swapPreview.dish.id,
                fromRecipeName: swapPreview.dish.name,
                plannedDate: getDayBefore(date),
              });
              Alert.alert("✅ 食材已加入購物車");
            }
            setSwapPreview(null);
          }}
          isAdding={false}
        />
      )}
    </>
  );
}

function SwapPickerRN({
  dayOfWeek, slotType, officialRecipes, currentId, currentRecipeName, blockedRecipeNames, onSelect, onClose,
}: {
  dayOfWeek: number; slotType: SlotType; officialRecipes: any[]; currentId: string; currentRecipeName?: string; blockedRecipeNames?: string[];
  onSelect: (dish: any) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const meta = SLOT_META[slotType];
  const blockedSet = useMemo(() => new Set((blockedRecipeNames || []).map(normalizeName)), [blockedRecipeNames]);

  const filtered = useMemo(() => {
    const results = officialRecipes.filter(r => matchRecipeForSlot(r, slotType)).map((r) => ({
      ...r,
      isBlocked: !!normalizeName(r.name) && blockedSet.has(normalizeName(r.name)) && normalizeName(r.name) !== normalizeName(currentRecipeName),
    }));
    if (search.trim()) {
      const q = search.toLowerCase();
      return results.filter(r => normalizeName(r.name).toLowerCase().includes(q));
    }
    return results;
  }, [slotType, officialRecipes, search, blockedSet, currentRecipeName]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFFBF5", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: "#F0E8DC" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#1A1A1A" }}><Ionicons name={meta.icon as any} size={14} color={SLOT_COLORS[slotType]} /> 替換{DAY_LABELS[dayOfWeek]}{meta.label}</Text>
              <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
                <Ionicons name="close" size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 8 }}>同週已用的食譜會標示出來，避免你重複揀同一款。</Text>
            <TextInput
              style={{ backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: "#1A1A1A" }}
              value={search}
              onChangeText={setSearch}
              placeholder={`搜尋${meta.label}食譜...`}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={filtered.length === 0 ? { flexGrow: 1 } : undefined}
            ListEmptyComponent={(
              <View style={{ flex: 1, padding: 32, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>食譜庫中暫無相關的{meta.label}食譜</Text>
              </View>
            )}
            renderItem={({ item: recipe }) => (
              <TouchableOpacity
                key={recipe.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", opacity: recipe.isBlocked ? 0.45 : 1 }}
                onPress={() => {
                  if (recipe.isBlocked) return;
                  onSelect({ id: `official_${recipe.id}`, name: recipe.name, image: recipe.thumbnailUrl || recipe.image, cookTime: recipe.cookTime, ingredients: recipe.ingredients, steps: recipe.steps, description: recipe.description, servings: recipe.servings, difficulty: recipe.difficulty, thumbnailUrl: recipe.thumbnailUrl, recipeCategory: recipe.recipeCategory });
                }}
                disabled={recipe.isBlocked}
              >
                {(() => {
                  const imgUrl = recipe.thumbnailUrl || recipe.image;
                  const hasImage = imgUrl && imgUrl.trim() !== "";
                  return hasImage ? (
                    <ExpoImage source={{ uri: imgUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" cachePolicy="memory-disk" onError={() => console.warn("[Planner] recommend image failed to load")} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon as any} size={18} color="#9CA3AF" />
                    </View>
                  );
                })()}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A1A1A" }}>{recipe.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                    {recipe.cookTime && <Text style={{ fontSize: 10, color: "#9CA3AF" }}>⏱ {recipe.cookTime}分鐘</Text>}
                    {recipe.isBlocked && (
                      <View style={{ backgroundColor: "#FEF3C7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#B45309" }}>本週已用</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  aiRecommendBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E9D5FF", // light purple border for AI branding
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiRecommendTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  aiRecommendSub: {
    fontSize: 10,
    color: "#7C3AED",
    fontWeight: "600",
    marginTop: 2,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#013E77",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  weekNavBtn: {
    padding: 6,
  },
  weekNavArrow: {
    fontSize: 14,
    color: "#013E77",
  },
  weekNavCenter: {
    alignItems: "center",
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  weekSubLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 10,
    paddingBottom: 32,
  },
  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 8,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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
    gap: 6,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  dayNameToday: {
    color: "#013E77",
  },
  dayDate: {
    fontSize: 13,
    color: "#666",
  },
  dayDateToday: {
    color: "#013E77",
    fontWeight: "600",
  },
  todayBadge: {
    backgroundColor: "#013E77",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  todayText: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "700",
  },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyMealText: {
    fontSize: 11,
    color: "#bbb",
  },
  eatOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  eatOutBtnActive: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  eatOutTxt: { fontSize: 9, fontWeight: "600", color: "#9CA3AF" },
  eatOutTxtActive: { color: "#D97706" },
  eatOutBadge: { backgroundColor: "#FFF7ED", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#FED7AA" },
  eatOutBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#D97706" },
  expandArrow: {
    fontSize: 9,
    color: "#999",
  },
  dayBody: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 6,
  },
  mealItem: {
    backgroundColor: "#FAFAFA",
    borderRadius: 6,
    marginBottom: 4,
    padding: 6,
    borderLeftWidth: 2,
  },
  mealImage: {
    width: 48,
    height: 48,
    borderRadius: 5,
    marginRight: 8,
  },
  mealImagePlaceholder: {
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  mealDeleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  mealEditBtn: {
    padding: 8,
    marginLeft: 8,
  },
  emptyMealContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  mealInfo: {
    flex: 1,
    minWidth: 0,
  },
  mealTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  mealTypeBadge: {
    backgroundColor: "#E8F0FE",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  mealTypeText: {
    fontSize: 9,
    color: "#013E77",
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "600",
  },
  mealName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 1,
  },
  mealProposer: {
    fontSize: 9,
    color: "#999",
  },
  mealActions: {
    flexDirection: "row",
    gap: 4,
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#DCFCE7",
    borderRadius: 4,
    paddingVertical: 4,
  },
  confirmBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16A34A",
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    paddingVertical: 4,
  },
  rejectBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
  },
  waitingRow: {
    flexDirection: "row", alignItems: "center", gap: 3,
    marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#F0F0F0",
  },
  waitingText: {
    fontSize: 10, fontWeight: "600", color: "#CA8A04",
  },
  addMealRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  addMealBtn: {
    flex: 1,
    backgroundColor: "#E8F0FE",
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  addMealBtnText: {
    fontSize: 10,
    color: "#013E77",
    fontWeight: "600",
  },
  mealTouchable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dayBodyEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 4,
  },
  dayBodyEmptyText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  dayBodyEmptySub: {
    fontSize: 11,
    color: "#D1D5DB",
  },
  todayNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#E8F0FE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 4,
  },
  todayNavTxt: {
    fontSize: 11,
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
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  pickerSortBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  pickerFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pickerSourceRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    paddingHorizontal: 4,
  },
  filterBadgeTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    paddingHorizontal: 3,
  },
  pickerSourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  pickerSourceChipActive: {
    backgroundColor: "#013E77",
  },
  pickerSourceChipTxt: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  pickerSourceChipTxtActive: {
    color: "#fff",
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
