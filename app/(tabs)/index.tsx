import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, Dimensions, ScrollView, ActivityIndicator,
  Modal, Platform, RefreshControl, TextInput, KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateMealPlanAndCart } from "@/hooks/useInvalidateMealPlanAndCart";
import { loadCustomCategories } from "@/lib/category-storage";
import type { CategoryDef } from "@/lib/category-storage";
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import FilterModal from "@/src/components/FilterModal";
import RecipeCard from "@/src/components/RecipeCard";
import PaywallModal from "@/components/PaywallModal";
import { getRecipeCardImageRatio } from "@/lib/recipe-card-layout";
import { DateUtil } from "@/src/lib/DateUtil";

const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 14 - 14 - CARD_GAP) / 2;
const CARD_IMAGE_RATIO = getRecipeCardImageRatio(Dimensions.get("window").height);
const BRAND = "#013E77";
const BG = "#F5F5F5";

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

const CATEGORY_ORDER = ["全部", "中菜", "西餐", "日式", "韓式", "東南亞", "甜品", "飲品", "其他"];

const POPULAR_CHIPS = [
  { key: "quick15", label: "⚡ 快手 15 分鐘" },
  { key: "quick30", label: "⏱ 快手 30 分鐘" },
  { key: "tonight", label: " 今晚食" },
  { key: "hk-style", label: "🇰 港式家常" },
  { key: "kids", label: "👶 小朋友啱食" },
  { key: "vegetarian", label: " 素食主義" },
  { key: "light", label: "🥗 清淡少油" },
  { key: "one-person", label: "👤 一人食" },
  { key: "high-protein", label: "💪 高蛋白" },
  { key: "soup", label: "🍲 湯水" },
  { key: "fridge", label: "🧊 冰箱清庫存" },
  { key: "beginner", label: "⭐ 新手必學" },
  { key: "party", label: "🍽️ 請客食譜" },
  { key: "low-calorie", label: "🥗 低卡減肥" },
  { key: "3d1s", label: "🍱 3 餸 1 湯" },
  { key: "steamed", label: " 蒸餸" },
  { key: "stir-fry", label: " 小炒" },
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

const TOP_TAGS = ["15 分鐘內", "30 分鐘內", "電飯煲料理", "家常", "簡單", "素食", "低卡"];

const mealName = (m: any) => m.recipeName || m.name || "未命名食譜";

// ── Next Dinner Card (shows next dinner within 14 days) ─────────────────────────────────────────────
function TonightMenuCardCompact({ todayMeals, todayEatOut, router }: {
  todayMeals: any[];
  todayEatOut: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const todayStr = DateUtil.todayISO();
  
  // Query next 14 days of meal plans
  const endDateStr = DateUtil.addDays(todayStr, 13); // Include today = 14 days total
  
  const { data: futureMeals = [] } = trpc.mealPlan.listByDateRange.useQuery(
    { startDate: todayStr, endDate: endDateStr },
    { staleTime: 1000 * 60 * 5 }
  );
  
  const todayDinnerPlan = todayMeals.find(
    (m: any) => m.mealType === "dinner" && m.status === "confirmed"
  );
  const confirmedDinners = futureMeals.filter((m: any) => {
    if (m.mealType !== "dinner" || m.status !== "confirmed") return false;
    return !todayDinnerPlan || m.id !== todayDinnerPlan.id;
  });

  // Check if today has eat-out
  const isTodayEatOut = todayEatOut && !!todayDinnerPlan;

  // Check if today has BOTH eat-out AND dinner plan (conflict)
  const hasConflict = todayEatOut && todayDinnerPlan;
  
  const dinnerRows: Array<{ icon: string; iconColor: string; text: string; badge?: string; badgeKind?: "default" | "conflict" }> = [];

  if (hasConflict) {
    dinnerRows.push({ icon: "restaurant-outline", iconColor: "#D97706", text: "外出用餐", badge: "今天" });
    dinnerRows.push({ icon: "alert-circle-outline", iconColor: "#DC2626", text: mealName(todayDinnerPlan), badge: "需確認", badgeKind: "conflict" });
  } else if (isTodayEatOut) {
    dinnerRows.push({ icon: "restaurant-outline", iconColor: "#D97706", text: "外出用餐", badge: "今天" });
  } else if (todayDinnerPlan) {
    dinnerRows.push({ icon: "restaurant-outline", iconColor: "#F59E0B", text: mealName(todayDinnerPlan), badge: "今天" });
  }

  confirmedDinners.forEach((m: any, idx: number) => {
    let badge: string | undefined = undefined;
    
    // 只為第一個晚餐計算日期標籤（跟返購物清單做法）
    if (idx === 0) {
      const date = DateUtil.parseDate(m.date);
      const diffDays = DateUtil.daysBetween(todayStr, m.date);
      if (diffDays === 0) badge = "今天";
      else if (diffDays === 1) badge = "明天";
      else if (diffDays === 2) badge = "後天";
      else badge = `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    
    dinnerRows.push({ icon: "restaurant-outline", iconColor: "#F59E0B", text: mealName(m), badge });
  });

  const visibleDinnerRows = dinnerRows.slice(0, 3);
  const moreCount = Math.max(0, dinnerRows.length - visibleDinnerRows.length);

  return (
    <TouchableOpacity
      style={s.dualCardWrapper}
      onPress={() => router.push("/(tabs)/planner" as any)}
      activeOpacity={0.7}
    >
      <View style={s.dualCardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="moon-outline" size={16} color={BRAND} />
          <Text style={s.dualCardTitle}>下次晚餐</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={BRAND} />
      </View>

      {visibleDinnerRows.length > 0 ? (
        <View style={s.dualCardContent}>
          {visibleDinnerRows.map((row, idx) => (
            <View key={idx} style={s.dualCardRow}>
              <Ionicons name={row.icon as any} size={12} color={row.iconColor} />
              <Text style={s.dualCardRowText} numberOfLines={1}>{row.text}</Text>
              {/* 只喺第一個項目顯示日期標籤（跟返購物清單做法） */}
              {idx === 0 && row.badge && (
                <View style={row.badgeKind === "conflict" ? s.conflictBadge : s.dateBadge}>
                  <Text style={row.badgeKind === "conflict" ? s.conflictBadgeText : s.dateBadgeText}>{row.badge}</Text>
                </View>
              )}
            </View>
          ))}
          {moreCount > 0 && (
            <TouchableOpacity style={s.dualCardMoreRow} onPress={() => router.push("/(tabs)/planner" as any)}>
              <Text style={s.dualCardMoreText}>更多 {moreCount} 項 ›</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // No dinner arranged in 14 days
        <View style={s.dualCardEmpty}>
          <Text style={s.dualCardEmptyTxt}>還沒有安排晚餐</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Shopping List Preview (shows items within 14 days) ─────────────────────────────────────────────
function ShoppingListPreview({ router }: {
  router: ReturnType<typeof useRouter>;
}) {
  const todayStr = DateUtil.todayISO();
  
  // Calculate end date (14 days from today)
  const endDateStr = DateUtil.addDays(todayStr, 13); // Include today = 14 days total
  
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Filter: only active items within 14 days
  const itemsIn14Days = useMemo(() => {
    return shoppingItems.filter((i: any) => {
      if (i.status !== "active") return false;
      if (!i.plannedDate) return true; // No date = show as recent
      return i.plannedDate >= todayStr && i.plannedDate <= endDateStr;
    });
  }, [shoppingItems, todayStr, endDateStr]);

  // Limit to max 3 items
  const itemsToShow = useMemo(() => {
    return itemsIn14Days.slice(0, 3);
  }, [itemsIn14Days]);

  const moreCount = Math.max(0, itemsIn14Days.length - itemsToShow.length);

  // Calculate date label (今天/明天/後天/日期)
  const dateLabel = useMemo(() => {
    if (itemsToShow.length === 0) return null;
    const firstItemDate = itemsToShow[0]?.plannedDate;
    
    if (!firstItemDate) return null;
    
    const diffDays = DateUtil.daysBetween(todayStr, firstItemDate);
    
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "明天";
    if (diffDays === 2) return "後天";
    
    // Show full date (e.g., 8 月 10 日)
    const date = new Date(firstItemDate);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }, [itemsToShow, todayStr]);

  return (
    <TouchableOpacity
      style={s.dualCardWrapper}
      onPress={() => router.push("/(tabs)/shopping" as any)}
      activeOpacity={0.7}
    >
      <View style={s.dualCardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="cart-outline" size={16} color={BRAND} />
          <Text style={s.dualCardTitle}>購物清單</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={BRAND} />
      </View>

      {itemsToShow.length > 0 ? (
        <View style={s.dualCardContent}>
          {itemsToShow.map((item: any, idx: number) => (
            <View key={idx} style={s.dualCardRow}>
              <Ionicons name="ellipse-outline" size={12} color="#6B7280" />
              <Text style={s.dualCardRowText} numberOfLines={1}>{item.name}</Text>
              {/* Only show date label for the first item */}
              {idx === 0 && dateLabel && (
                <View style={s.dualCardDateBadge}>
                  <Text style={s.dualCardDateBadgeText}>{dateLabel}</Text>
                </View>
              )}
            </View>
          ))}
          {moreCount > 0 && (
            <View style={s.dualCardMoreRow}>
              <Text style={s.dualCardMoreText}>更多 {moreCount} 項</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={s.dualCardEmpty}>
          <Text style={s.dualCardEmptyTxt}>購物清單是空的</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Tonight's Menu Card (Original - kept for backward compatibility) ─────────────────────────────────────────────
function TonightMenuCard({ todayMeals, router, isAdmin }: {
  todayMeals: any[];
  router: ReturnType<typeof useRouter>;
  isAdmin: boolean;
}) {
  const dinner = todayMeals.filter((m: any) => m.mealType === "dinner" && m.status === "confirmed");
  const pendingCount = todayMeals.filter((m: any) => m.status === "pending").length;

  return (
    <View style={s.summaryCard}>
      <View style={s.summaryHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="moon-outline" size={18} color={BRAND} />
          <Text style={s.summaryTitle}>今晚菜單</Text>
        </View>
        <TouchableOpacity
          style={s.planBtn}
          onPress={() => router.push("/(tabs)/planner" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={14} color="#fff" />
          <Text style={s.planBtnTxt}>排餐</Text>
        </TouchableOpacity>
      </View>

      {dinner.length > 0 ? (
        <View style={s.summaryRows}>
          {dinner.map((m: any, idx: number) => (
            <View key={idx} style={s.summaryRow}>
              <Ionicons name="restaurant-outline" size={14} color="#F59E0B" />
              <Text style={s.summaryValue} numberOfLines={1}>{mealName(m)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          style={s.summaryEmpty}
          onPress={() => router.push("/(tabs)/planner" as any)}
          activeOpacity={0.7}
        >
          <Text style={s.summaryEmptyTxt}>今晚還沒安排晚餐，去排餐吧</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Pending Actions Card ─────────────────────────────────────────────
function PendingActionsCard({ router, isAdmin }: {
  router: ReturnType<typeof useRouter>;
  isAdmin: boolean;
}) {
  const { data: mealPlans = [] } = trpc.mealPlan.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const pendingMealPlans = mealPlans.filter((m: any) => m.status === "pending").length;
  const pendingShopping = shoppingItems.filter((i: any) => i.status === "pending").length;
  const unboughtShopping = shoppingItems.filter((i: any) => i.status === "active").length;

  if (!isAdmin || (pendingMealPlans === 0 && pendingShopping === 0)) return null;

  return (
    <View style={s.pendingCard}>
      <View style={s.pendingCardHeader}>
        <Ionicons name="clipboard-outline" size={16} color={BRAND} />
        <Text style={s.pendingCardTitle}>待辦事項</Text>
      </View>
      {pendingMealPlans > 0 && (
        <TouchableOpacity
          style={s.pendingRow}
          onPress={() => router.push("/(tabs)/planner" as any)}
          activeOpacity={0.7}
        >
          <View style={[s.pendingIcon, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="restaurant-outline" size={14} color="#D97706" />
          </View>
          <Text style={s.pendingLabel}>{pendingMealPlans} 個排餐待確認</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
      {pendingShopping > 0 && (
        <TouchableOpacity
          style={s.pendingRow}
          onPress={() => router.push("/(tabs)/shopping" as any)}
          activeOpacity={0.7}
        >
          <View style={[s.pendingIcon, { backgroundColor: "#DBEAFE" }]}>
            <Ionicons name="cart-outline" size={14} color={BRAND} />
          </View>
          <Text style={s.pendingLabel}>{pendingShopping} 項購物待確認</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
      {unboughtShopping > 0 && pendingShopping === 0 && (
        <TouchableOpacity
          style={s.pendingRow}
          onPress={() => router.push("/(tabs)/shopping" as any)}
          activeOpacity={0.7}
        >
          <View style={[s.pendingIcon, { backgroundColor: "#DCFCE7" }]}>
            <Ionicons name="bag-handle-outline" size={14} color="#16A34A" />
          </View>
          <Text style={s.pendingLabel}>{unboughtShopping} 項食材待買</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Weekly Menu Bar ──────────────────────────────────────────────────

// ── Recipe Card Skeleton (loading placeholder) ─────────────────────────
function RecipeCardSkeleton({ anim, imageHeight }: { anim: Animated.Value; imageHeight: number }) {
  const animatedStyle = {
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0.85],
    }),
  };

  return (
    <View style={s.skeletonCard}>
      <Animated.View style={[s.skeletonImg, { height: imageHeight }, animatedStyle]} />
      <View style={s.skeletonInfo}>
        <Animated.View style={[s.skeletonNameLine, animatedStyle]} />
        <Animated.View style={[s.skeletonNameLineShort, animatedStyle]} />
        <View style={s.skeletonMetaRow}>
          <Animated.View style={[s.skeletonMetaItem, animatedStyle]} />
          <Animated.View style={[s.skeletonMetaItem, animatedStyle]} />
        </View>
      </View>
    </View>
  );
}

// ── Premium Upgrade Button (for free/trial users) ─────────────────────
function PremiumUpgradeButton({ onPress, style }: { onPress: () => void; style?: any }) {
  return (
    <View style={[s.upgradeBarWrap, style]}>
      <TouchableOpacity
        style={s.upgradeBarBtn}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={s.upgradeBarText}>升級至 Pro 版（免費試用 7 天）{`\n`}與家人連繫，連結 AI</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function RecipesTab() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const cardImageRatio = getRecipeCardImageRatio(screenHeight);
  const router = useRouter();
  const { initialViewMode } = useLocalSearchParams<{ initialViewMode?: string }>();
  const utils = trpc.useUtils();
  const invalidateMealPlanAndCart = useInvalidateMealPlanAndCart();
  const { user, familyRole } = useAuth();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "早晨";
    if (hour < 18) return "午安";
    return "晚安";
  }, []);

  // Scroll-to-top floating button
  const listRef = useRef<FlatList>(null);
  const showTopBtn = useRef(new Animated.Value(0)).current;
  const [fabVisible, setFabVisible] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  
  const subscriptionQuery = trpc.family.subscription.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const sub = subscriptionQuery.data;
  // Only hide banner for fully paid active subscribers (trial users should still see it)
  const isPaid = sub?.status === "active";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "official" | "user">("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activePopularChips, setActivePopularChips] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filterCookTimeMax, setFilterCookTimeMax] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "cookTime" | "difficulty">("popular");
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [activeIngredientCategory, setActiveIngredientCategory] = useState<string | undefined>(undefined);
  const searchInputRef = useRef<TextInput>(null);
  const skeletonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (initialViewMode === "official" || initialViewMode === "user") {
      setViewMode(initialViewMode);
      router.setParams({ initialViewMode: undefined } as any);
    }
  }, [initialViewMode, router]);

  useEffect(() => {
    loadCustomCategories().then(c => setCategories(c));
    // Load search history
    AsyncStorage.getItem("kindcipe_search_history").then((h) => {
      if (h) setSearchHistory(JSON.parse(h));
    });
    // Skeleton loading animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(skeletonAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Debounce search query (300ms) - ONLY update query, DO NOT save history here!
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Save search history manually (only when user submits search)
  const handleSaveSearchHistory = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      setSearchHistory(prev => {
        const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 20);
        AsyncStorage.setItem("kindcipe_search_history", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const [quickPlanRecipe, setQuickPlanRecipe] = useState<{ id: string; name: string; image?: string; ingredients?: any[] } | null>(null);
  const [quickPlanDate, setQuickPlanDate] = useState<string | null>(DateUtil.todayISO());
  const [quickPlanMeal, setQuickPlanMeal] = useState("dinner");
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });

  const todayStr = DateUtil.todayISO();
  const { data: todayMeals = [] } = trpc.mealPlan.listByDateRange.useQuery({ startDate: todayStr, endDate: todayStr }, { staleTime: 30000 });

  // Use useMemo to stabilize weekStart calculation (fixes infinite re-query issue)
  const { weekStartStr, todayDow } = useMemo(() => {
    const today = DateUtil.parseDate(todayStr);
    const weekStart = new Date(today);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    weekStart.setDate(diff);
    const weekStartStr = DateUtil.toISODate(weekStart);
    const todayDow = today.getDay() + 1; // 1=Mon, 7=Sun
    return { weekStartStr, todayDow };
  }, [todayStr]);

  const { data: weekMenu = { items: [] } } = trpc.weeklyMenu.getWeek.useQuery(
    { weekStart: weekStartStr },
    { staleTime: 1000 * 60 * 5 }
  );

  // Get today's eat-out status from the dedicated family_eat_out table
  const { data: todayEatOutDates = [] } = trpc.eatOut.listByDateRange.useQuery(
    { startDate: todayStr, endDate: todayStr },
    { staleTime: 30000 }
  );
  const todayEatOut = todayEatOutDates.includes(todayStr);

  useFocusEffect(
    useCallback(() => {
      void invalidateMealPlanAndCart();
      void utils.weeklyMenu.getWeek.invalidate({ weekStart: weekStartStr });
      void utils.eatOut.listByDateRange.invalidate({ startDate: todayStr, endDate: todayStr });
      void subscriptionQuery.refetch();
    }, [invalidateMealPlanAndCart, utils, weekStartStr, todayStr, subscriptionQuery.refetch]),
  );

  const isAdmin = familyRole === "owner" || familyRole === "admin";

  // Use server-side search with infinite scroll
  const {
    recipes: searchRecipes,
    total: searchTotal,
    officialCount: searchOfficialCount,
    customCount: searchCustomCount,
    isLoading: searchLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchSearch,
    isError: isSearchError,
    error: searchError,
  } = useRecipeSearch({
    query: debouncedQuery || undefined,
    category: activeCategory === "all" ? undefined : activeCategory,
    tags: activeTagFilters.length > 0 ? activeTagFilters : undefined,
    cookTimeMax: activePopularChips.includes("quick15") ? 15 : activePopularChips.includes("quick30") ? 30 : filterCookTimeMax,
    popularChips: activePopularChips.length > 0 ? activePopularChips : undefined,
    ingredientCategory: activeIngredientCategory,
    source: viewMode,
    limit: viewType === "grid" ? 20 : 30,
  });

  // Legacy queries for backward compatibility (user recipes, counts)
  const { data: userRecipes = [], isLoading: loadingUser } =
    trpc.recipes.listUser.useQuery({ limit: 200 }, { staleTime: 60000 });

  const drafts = (userRecipes as any[])?.filter((r: any) => r.isDraft) ?? [];
  const draftIdSet = useMemo(() => {
    const set = new Set<string>();
    drafts.forEach((d: any) => set.add(String(d.id)));
    return set;
  }, [drafts]);

  const isLoading = searchLoading || loadingUser;

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: async (result, variables) => {
      setQuickPlanRecipe(null);
      // Check if there's a conflict (eatOut or duplicate recipe)
      if (result.warning && result.hasConflict) {
        const shouldKeep = await new Promise<boolean>((resolve) => {
          const isEatOutConflict = result.warning?.includes("外出");
          Alert.alert(
            isEatOutConflict ? "衝突提示" : "重複食譜提示",
            result.warning,
            [
              { text: "取消", style: "cancel", onPress: () => resolve(false) },
              { text: "確定", onPress: () => resolve(true) },
            ],
            { cancelable: false },
          );
        });

        if (!shouldKeep) {
          if (result.newPlanId) {
            deleteMealM.mutate({ id: result.newPlanId, keepRelatedItems: false });
          }
          return;
        }
      }
      
      // Find recipe from search results
      const found = searchRecipes.find((r: any) => r.id === variables.recipeId) as any;
      if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
        setPlanPickerRecipe({
          id: variables.recipeId,
          name: variables.recipeName,
          ingredients: found.ingredients,
          date: variables.date,
          fromMealPlanId: result.newPlanId,
        });
      } else {
        setToast({ visible: true, message: "已加入排餐", type: "info" });
      }

      void invalidateMealPlanAndCart();
    },
    onError: (e) => setToast({ visible: true, message: `加入失敗：${e.message}`, type: "error" }),
  });

  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: async () => {
      await invalidateMealPlanAndCart();
    },
  });

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: async (_, variables) => {
      utils.shopping.list.refetch();
      const count = variables.items.length;
      setPlanPickerRecipe(null);
      setToast({ visible: true, message: `✅ ${count} 件食材已加入購物清單`, type: "success" });
      void invalidateMealPlanAndCart();
    },
    onError: (e) => {
      setToast({ visible: true, message: `加入食材失敗：${e.message}`, type: "error" });
    },
  });

  const allUserTags = useMemo(() => {
    const counts = new Map<string, number>();
    userRecipes.forEach((r: any) => (r.tags ?? []).forEach((t: string) => counts.set(t, (counts.get(t) || 0) + 1)));
    searchRecipes.forEach((r: any) => (r.tags ?? []).forEach((t: string) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  }, [userRecipes, searchRecipes]);

  // Filter recipes based on viewMode (official/user/all)
  const filteredRecipes = useMemo(() => {
    let pool = [...searchRecipes];

    if (viewMode === "official") {
      pool = pool.filter((r: any) => r.source === "official");
    } else if (viewMode === "user") {
      pool = pool.filter((r: any) => r.source === "custom");
    }

    // Deduplicate by recipe id (keep first occurrence)
    const seen = new Set<string>();
    pool = pool.filter((r: any) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // Hide drafts from the public grid (they resume via 新增食譜 / 編輯草稿, not here)
    if (draftIdSet.size > 0) {
      pool = pool.filter((r: any) => {
        const rawId = String(r.id).replace(/^user_/, "");
        return !draftIdSet.has(rawId);
      });
    }

    // Apply sorting
    if (sortBy === "popular") {
      // Backend already sorts by popularity (relevance → popularity → created_at)
    } else if (sortBy === "cookTime") {
      pool.sort((a, b) => (a.cookTime || 999) - (b.cookTime || 999));
    } else if (sortBy === "difficulty") {
      const difficultyOrder: Record<string, number> = { "簡單": 1, "中等": 2, "困難": 3 };
      pool.sort((a: any, b: any) => (difficultyOrder[a.difficulty || ""] || 999) - (difficultyOrder[b.difficulty || ""] || 999));
    }

    return pool;
  }, [searchRecipes, viewMode, sortBy, draftIdSet]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchSearch(),
        invalidateMealPlanAndCart(),
        utils.recipes.listUser.invalidate().catch(() => {}),
        utils.weeklyMenu.getWeek.invalidate().catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const navigateToRecipe = (item: any) => {
    // item.id already has prefix "official_" or "user_" from search endpoint
    router.push({ pathname: "/recipe/[id]", params: { id: item.id } });
  };

  const renderCard = ({ item }: { item: any }) => {
    const isUser = item.source === "custom";
    const tags: string[] = item.tags ?? [];
    const isAIGenerated = tags.includes("AI 生成");
    const cat = categories.find(c => c.key === item.recipeCategory);

    return (
      <RecipeCard
        item={item}
        category={cat}
        isUser={isUser}
        isAIGenerated={isAIGenerated}
        tags={tags}
        activeTagFilters={activeTagFilters}
        setActiveTagFilters={setActiveTagFilters}
        setQuickPlanRecipe={setQuickPlanRecipe}
        navigateToRecipe={navigateToRecipe}
        showQuickPlan={false} // 暫時隱藏快速排餐按鈕（2026-08-09）：簡化食譜卡 UI，用戶仍可透過詳情頁 / 排餐頁 / AI Chef 加入排餐
      />
    );
  };

  // 含 viewMode —— 用於顯示「清除篩選」bar（揀「我的食譜」都算篩選）
  const hasFilters = viewMode !== "all" || searchQuery || activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || activeIngredientCategory !== undefined;
  // 唔含 viewMode —— 用於 empty state 分支，避免 viewMode 狹窄化令「我的食譜」空狀態不可達
  const hasFilterTokens = searchQuery || activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || activeIngredientCategory !== undefined;
  const hasActiveTokens = activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || activeIngredientCategory !== undefined || filterCookTimeMax !== undefined;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (viewMode === "user") parts.push("我的食譜");
    else if (viewMode === "official") parts.push("官方食譜");
    if (activeCategory !== "all") {
      const cat = categories.find(c => c.key === activeCategory);
      parts.push(cat?.label || activeCategory);
    }
    if (activePopularChips.length > 0) {
      activePopularChips.forEach(chipKey => {
        const chip = POPULAR_CHIPS.find(c => c.key === chipKey);
        parts.push(chip?.label.replace(/^[^\s]+\s/, "") || chipKey);
      });
    }
    if (activeTagFilters.length > 0) {
      activeTagFilters.forEach(tag => parts.push(`#${tag}`));
    }
    if (activeIngredientCategory) {
      const ingCat = INGREDIENT_CATEGORIES.find(c => c.key === activeIngredientCategory);
      parts.push(ingCat?.label || activeIngredientCategory);
    }
    if (searchQuery.trim()) parts.push(`"${searchQuery}"`);
    return parts.join(" · ");
  }, [viewMode, activeCategory, activePopularChips, activeTagFilters, activeIngredientCategory, searchQuery, categories]);

  const ListHeader = (
    <View style={s.listHeaderOuter}>
      {/* Dual-card layout: Tonight's Menu + Shopping List Preview */}
      <View style={s.dualCardContainer}>
        <TonightMenuCardCompact todayMeals={todayMeals} todayEatOut={todayEatOut} router={router} />
        <ShoppingListPreview router={router} />
      </View>
      
      <PendingActionsCard router={router} isAdmin={isAdmin} />

      <View style={[s.searchWrap, { marginRight: Math.max(14, insets.right) }]}>
        <Ionicons name="search" size={17} color="#9CA3AF" />
        <TextInput
          ref={searchInputRef}
          style={s.searchInput}
          placeholder="搜尋食譜、食材、標籤"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setShowSearchHistory(text.length > 0 && searchHistory.length > 0);
          }}
          onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
          returnKeyType="search"
          onSubmitEditing={() => {
            handleSaveSearchHistory(searchQuery);
            setShowSearchHistory(false);
          }}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => {
            setSearchQuery("");
            searchInputRef.current?.focus();
          }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
        
        {/* Sort Dropdown */}
        <TouchableOpacity onPress={() => setSortBy(sortBy === "popular" ? "cookTime" : sortBy === "cookTime" ? "difficulty" : "popular")} style={s.sortBtn}>
          <Ionicons name={sortBy === "popular" ? "star-outline" : sortBy === "cookTime" ? "flame-outline" : "swap-horizontal-outline"} size={18} color={BRAND} />
        </TouchableOpacity>
        
        {/* Filter Button */}
        <TouchableOpacity onPress={() => setShowFilterSheet(true)} style={s.filterBtn}>
          <Ionicons name="filter-outline" size={18} color={BRAND} />
          {(viewMode !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || activeCategory !== "all" || filterCookTimeMax !== undefined || activeIngredientCategory !== undefined) && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>
                {(viewMode !== "all" ? 1 : 0) + activeTagFilters.length + activePopularChips.length + (activeCategory !== "all" ? 1 : 0) + (filterCookTimeMax !== undefined ? 1 : 0) + (activeIngredientCategory !== undefined ? 1 : 0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search History Dropdown */}
      {showSearchHistory && (
        <View style={s.searchHistoryWrap}>
          <View style={s.searchHistoryHeader}>
            <Text style={s.searchHistoryTitle}>最近搜尋</Text>
            <TouchableOpacity onPress={() => { setSearchHistory([]); AsyncStorage.setItem("kindcipe_search_history", JSON.stringify([])); }}>
              <Text style={s.searchHistoryClear}>全部清除</Text>
            </TouchableOpacity>
          </View>
          <View style={s.searchHistoryList}>
            {searchHistory.slice(0, 20).map((query, idx) => {
              const removeItem = () => {
                const updated = searchHistory.filter(s => s !== query);
                setSearchHistory(updated);
                AsyncStorage.setItem("kindcipe_search_history", JSON.stringify(updated));
              };
              return (
                <View key={`${query}-${idx}`}>
                  {idx > 0 && <View style={s.searchHistoryDivider} />}
                  <TouchableOpacity
                    style={s.searchHistoryItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      handleSaveSearchHistory(query);
                      setSearchQuery(query);
                      setShowSearchHistory(false);
                      searchInputRef.current?.blur();
                    }}
                  >
                    <View style={s.searchHistoryAvatar}>
                      <Ionicons name="time-outline" size={16} color="#6B7280" />
                    </View>
                    <Text style={s.searchHistoryTerm} numberOfLines={1}>{query}</Text>
                    <TouchableOpacity onPress={removeItem} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color="#C4C4C4" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Smart Filter Tokens */}
      {hasActiveTokens && (
        <View style={s.smartFilterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.smartFilterRow}>
            {/* Category Token */}
            {activeCategory !== "all" && (
              <View style={s.smartToken}>
                <Text style={s.smartTokenTxt}>
                  {categories.find(c => c.key === activeCategory)?.emoji || "🍽️"} {categories.find(c => c.key === activeCategory)?.label || activeCategory}
                </Text>
                <TouchableOpacity onPress={() => setActiveCategory("all")}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {/* Ingredient Category Token */}
            {activeIngredientCategory !== undefined && (
              <View style={s.smartToken}>
                <Text style={s.smartTokenTxt}>
                  {INGREDIENT_CATEGORIES.find(c => c.key === activeIngredientCategory)?.label || activeIngredientCategory}
                </Text>
                <TouchableOpacity onPress={() => setActiveIngredientCategory(undefined)}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {/* Popular Chips Tokens */}
            {activePopularChips.map(chipKey => {
              const chip = POPULAR_CHIPS.find(c => c.key === chipKey);
              return (
                <View key={chipKey} style={s.smartToken}>
                  <Text style={s.smartTokenTxt}>{chip?.label || chipKey}</Text>
                  <TouchableOpacity onPress={() => setActivePopularChips(prev => prev.filter(k => k !== chipKey))}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {/* Cook Time Token */}
            {filterCookTimeMax !== undefined && (
              <View style={s.smartToken}>
                <Text style={s.smartTokenTxt}>⏱ {filterCookTimeMax}分鐘內</Text>
                <TouchableOpacity onPress={() => setFilterCookTimeMax(undefined)}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {/* Tag Tokens */}
            {activeTagFilters.map(tag => (
              <View key={tag} style={s.smartToken}>
                <Text style={s.smartTokenTxt}>#{tag}</Text>
                <TouchableOpacity onPress={() => setActiveTagFilters(prev => prev.filter(t => t !== tag))}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {/* Clear All */}
            <TouchableOpacity style={s.clearAllBtn} onPress={() => {
              setActiveCategory("all");
              setActiveTagFilters([]);
              setActivePopularChips([]);
              setActiveIngredientCategory(undefined);
              setFilterCookTimeMax(undefined);
              setSearchQuery("");
            }}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {(viewMode === "user" || viewMode === "all") && allUserTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <View style={s.filterRowLabel}>
            <Ionicons name="pricetag-outline" size={11} color="#9CA3AF" />
            <Text style={{ fontSize: 10, color: "#9CA3AF", fontWeight: "600" }}>標籤</Text>
          </View>
          {activeTagFilters.length > 0 && (
            <TouchableOpacity style={[s.filterPill, { borderColor: "#EF4444", backgroundColor: "#FEF2F2" }]} onPress={() => setActiveTagFilters([])}>
              <Ionicons name="close" size={10} color="#EF4444" />
              <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "700", marginLeft: 2 }}>清除</Text>
            </TouchableOpacity>
          )}
          {TOP_TAGS.map(tag => {
            const isActive = activeTagFilters.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[s.filterPill, isActive && s.filterPillActive]}
                onPress={() => {
                  setActiveTagFilters(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                }}
              >
                <Text style={[s.filterPillTxt, isActive && s.filterPillTxtActive]}>#{tag}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={s.filterPill}
            onPress={() => setShowFilterSheet(true)}
          >
            <Text style={s.filterPillTxt}>更多 ▼</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {hasFilters && (
        <View style={s.resultSummary}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {isLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color="#9CA3AF" />
                <Text style={s.resultSummaryTxt}>正在搜尋...</Text>
              </View>
            ) : filterSummary ? (
              <Text style={s.resultSummaryTxt} numberOfLines={1}>{filterSummary} · {searchTotal} 個結果</Text>
            ) : (
              <Text style={s.resultSummaryTxt}>找到 {searchTotal} 個食譜</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => { setViewMode("all"); setActiveCategory("all"); setActiveTagFilters([]); setActivePopularChips([]); setActiveIngredientCategory(undefined); setSearchQuery(""); }}>
            <Text style={s.resultSummaryClear}>清除篩選</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 12, paddingRight: Math.max(16, insets.right) }]}> 
        <View style={s.headerTopRow}>
          <View>
            <Text style={s.headerTitle}>和諧食譜</Text>
            <Text style={s.headerSub}>{user?.name ? `${greeting}，${user.name.split(" ")[0]}` : "發現美味，規劃每週菜單"}</Text>
          </View>
          <View style={s.headerActions}>
            {!isPaid && <PremiumUpgradeButton onPress={() => setShowPaywall(true)} />}
            <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/import")}> 
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/ai-chef")}> 
              <Ionicons name="chatbubble-ellipses" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isLoading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(1,62,119,0.15)" }}>
          <Animated.View style={{ width: "60%", height: "100%", backgroundColor: BRAND, opacity: Animated.multiply(skeletonAnim, 0.5).interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) }} />
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={filteredRecipes}
          keyExtractor={(item: any) => item.id}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={[s.gridContent, { paddingBottom: Math.max(100, insets.bottom + 80) }]}
          ListHeaderComponent={ListHeader}
          renderItem={renderCard}
          onEndReached={() => fetchNextPage()}
          onEndReachedThreshold={0.3}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setFabVisible(y > 600);
            Animated.timing(showTopBtn, {
              toValue: y > 600 ? 1 : 0,
              duration: 150,
              useNativeDriver: true,
            }).start();
          }}
          onScrollToTop={() => {
            setFabVisible(false);
            showTopBtn.setValue(0);
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={BRAND} size="small" />
              </View>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={s.skeletonGrid}>
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
              <RecipeCardSkeleton anim={skeletonAnim} imageHeight={CARD_WIDTH * cardImageRatio} />
            </View>
          ) : (
          <View style={s.empty}>
            {isSearchError ? (
              <>
                <Ionicons name="warning-outline" size={44} color="#EF4444" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>搜尋出錯</Text>
                <Text style={s.emptySub}>
                  {searchError?.message?.includes("SQL") || searchError?.message?.includes("搜尋失敗")
                    ? "系統搜尋時遇到問題，請稍後再試" :
                    searchError?.message?.includes("UNAUTHORIZED") || searchError?.message?.includes("login") || searchError?.message?.includes("登入")
                    ? "請重新登入後再試" :
                    searchError?.message || "請稍後再試"}
                </Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => refetchSearch()}>
                  <Text style={s.emptyBtnTxt}>重試</Text>
                </TouchableOpacity>
              </>
            ) : hasFilterTokens ? (
              <>
                <Ionicons name="search-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>找不到符合嘅食譜</Text>
                <Text style={s.emptySub}>試下清除篩選或者揀其他分類</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setViewMode("all"); setActiveCategory("all"); setActiveTagFilters([]); setActivePopularChips([]); setActiveIngredientCategory(undefined); }}>
                    <Text style={s.emptySuggestChipTxt}>清除篩選</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setSearchQuery(""); setActivePopularChips(["quick30"]); }}>
                    <Text style={s.emptySuggestChipTxt}> 快手30 分鐘</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setSearchQuery(""); setActivePopularChips(["light"]); }}>
                    <Text style={s.emptySuggestChipTxt}> 清淡少油</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : viewMode === "user" ? (
              <>
                <Ionicons name="flame-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>還沒有食譜</Text>
                <Text style={s.emptySub}>從 Instagram、YouTube 匯入你喜歡的食譜</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setShowFilterSheet(true)}>
                  <Text style={s.emptyBtnTxt}>+ 篩選食譜</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="book-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>暫無食譜</Text>
              </>
            )}
          </View>
          )
        }
      />
      </KeyboardAvoidingView>

      <Animated.View
        pointerEvents={fabVisible ? "auto" : "none"}
        style={[
          s.scrollTopFab,
          {
            bottom: insets.bottom + 72,
            opacity: showTopBtn,
            transform: [
              {
                translateY: showTopBtn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={s.scrollTopFabBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <FilterModal
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
        officialCount={searchOfficialCount}
        userCount={searchCustomCount}
      />

      <Modal visible={!!quickPlanRecipe} transparent animationType="slide">
        <View style={s.planOverlay}>
          <View style={s.planSheet}>
            <View style={s.planHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>加入排餐</Text>
                <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }} numberOfLines={1}>{quickPlanRecipe?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setQuickPlanRecipe(null)}>
                <Ionicons name="close" size={22} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <Text style={s.planLabel}>選擇日期</Text>
            <PlanDatePicker value={quickPlanDate} onChange={setQuickPlanDate} showShortcuts={true} />
            {quickPlanDate && (
              <TouchableOpacity 
                onPress={() => setQuickPlanDate(null)} 
                style={{ alignSelf: "flex-end", marginTop: -8, marginRight: 16 }}
              >
                <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>清除日期</Text>
              </TouchableOpacity>
            )}

            <Text style={s.planLabel}>餐次</Text>
            <View style={s.planMealRow}>
              {[{ id: "breakfast", label: "早餐", icon: "sunny-outline" as const }, { id: "lunch", label: "午餐", icon: "partly-sunny-outline" as const }, { id: "dinner", label: "晚餐", icon: "moon-outline" as const }, { id: "snack", label: "小食", icon: "cafe-outline" as const }].map(m => (
                <TouchableOpacity key={m.id} style={[s.planMealChip, quickPlanMeal === m.id && s.planMealChipActive]} onPress={() => setQuickPlanMeal(m.id)}>
                  <Ionicons name={m.icon} size={18} color={quickPlanMeal === m.id ? "#fff" : "#374151"} />
                  <Text style={[s.planMealTxt, quickPlanMeal === m.id && { color: "#fff" }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.planConfirmBtn, addMealM.isPending && { opacity: 0.6 }]}
              onPress={() => {
                if (!quickPlanRecipe) return;
                if (!quickPlanDate) {
                  Alert.alert("日期無效", "請選擇排餐日期", [{ text: "確定" }]);
                  return;
                }
                addMealM.mutate({ date: quickPlanDate, mealType: quickPlanMeal as any, recipeId: quickPlanRecipe.id, recipeName: quickPlanRecipe.name, recipeImage: quickPlanRecipe.image, autoAddIngredients: false });
              }}
              disabled={addMealM.isPending}
            >
              {addMealM.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="calendar-outline" size={18} color="#fff" /><Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>確認加入排餐</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <IngredientPickerModal
        visible={!!planPickerRecipe}
        recipes={planPickerRecipe ? [planPickerRecipe] : []}
        defaultDate={planPickerRecipe?.date}
        maxDate={planPickerRecipe?.date}
        showDateSelector={true}
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
              fromRecipeId: items[0].recipeId,
              fromRecipeName: items[0].recipeName,
              fromMealPlanId: items[0].fromMealPlanId,
              plannedDate: items[0].plannedDate,
            });
          } else {
            setPlanPickerRecipe(null);
            setToast({ visible: true, message: "排餐已記錄", type: "info" });
          }
        }}
        onSkip={() => {
          setPlanPickerRecipe(null);
          setToast({ visible: true, message: "已跳過食材", type: "info" });
        }}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="generic"
        trialDaysLeft={sub?.trialEndsAt ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000)) : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: BRAND,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginLeft: "auto",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  headerBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },

  // Tonight menu card
  summaryCard: {
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: "#fff", borderRadius: 16,
    padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: "#EBEBEB",
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  summaryTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  planBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: BRAND, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  planBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  summaryRows: { gap: 7 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryValue: { fontSize: 13, color: "#1A1A1A", flex: 1 },
  summaryEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  summaryEmptyTxt: { fontSize: 13, color: "#9CA3AF" },
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, padding: 8, backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FECACA" },
  pendingBannerTxt: { flex: 1, fontSize: 12, color: "#EF4444", fontWeight: "700" },

  // Dual-card layout (Tonight's Menu + Shopping List)
  dualCardContainer: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  dualCardWrapper: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    minHeight: 108,
  },
  dualCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dualCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  dualCardLink: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  dualCardLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: BRAND,
  },
  dualCardContent: {
    gap: 4,
  },
  dualCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
    minHeight: 22,
  },
  dualCardRowText: {
    fontSize: 12,
    color: "#1A1A1A",
    flex: 1,
  },
  dualCardDateBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dualCardDateBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D97706",
  },
  dualCardMoreRow: {
    marginTop: 0,
    paddingTop: 2,
  },
  dualCardMoreText: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND,
    textAlign: "right",
  },
  dateBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D97706",
  },
  conflictBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  conflictBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#DC2626",
  },
  dualCardEmpty: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dualCardEmptyTxt: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  // Pending actions card
  pendingCard: { marginHorizontal: 14, marginBottom: 10, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E8E8E8", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  pendingCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  pendingCardTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  pendingIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  pendingLabel: { flex: 1, fontSize: 13, color: "#1A1A1A", fontWeight: "500" },

  // Quick actions
  quickActions: { flexDirection: "row", gap: 10, marginHorizontal: 14, marginBottom: 8 },
  quickActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: "#E8E8E8",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickActionTitle: { fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
  quickActionSub: { fontSize: 10, color: "#9CA3AF", marginTop: 1 },
  upgradeBarWrap: {
    marginLeft: 0,
    alignItems: "center",
  },
  upgradeBarBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#EAB308",
    backgroundColor: "#FFF0B8",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  upgradeBarText: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: 0.1,
  },

  // Weekly bar
  weekDot: { width: 58, borderRadius: 10, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", padding: 6, alignItems: "center" },
  weekDotToday: { backgroundColor: "#FF8C00", borderColor: "#FF8C00" },
  weekDotEmpty: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  weekDotLabel: { fontSize: 12, fontWeight: "700", color: "#FF8C00" },
  weekDotDish: { fontSize: 8, color: "#6B7280", marginTop: 2, textAlign: "center", width: 50 },

  // Search
  searchWrap: {
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
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  searchInput: { 
    flex: 1, 
    fontSize: 14, 
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  sortBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
  sortIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  sortIndicatorTxt: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },

  // Smart Filter Tokens
  smartFilterWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  smartFilterRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  smartToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: BRAND,
  },
  smartTokenTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  clearAllBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search history dropdown
  searchHistoryWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  // Ingredient category filter
  ingCatWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    position: "relative",
  },
  ingCatRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 40,
  },
  ingCatChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  ingCatChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  ingCatClear: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  searchHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  searchHistoryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  searchHistoryClear: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND,
  },
  searchHistoryList: {
    flexDirection: "column",
  },
  searchHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  searchHistoryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchHistoryTerm: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  searchHistoryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EFEFEF",
  },

  // Source toggle
  sourceToggle: { 
    flexDirection: "row", 
    marginHorizontal: 14, 
    marginBottom: 14, 
    backgroundColor: "#F5F5F7", 
    borderRadius: 16, 
    padding: 5, 
    gap: 3,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  sourceToggleBtn: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 4, 
    paddingVertical: 10, 
    borderRadius: 13,
    backgroundColor: "transparent",
  },
  sourceToggleBtnActive: { 
    backgroundColor: "#fff", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3,
  },
  sourceToggleTxt: { 
    fontSize: 13, 
    fontWeight: "600", 
    color: "#666",
  },
  sourceToggleTxtActive: { 
    color: BRAND, 
    fontWeight: "800",
  },
  sourceToggleCount: { 
    backgroundColor: "rgba(0,0,0,0.08)", 
    borderRadius: 99, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    minWidth: 20, 
    alignItems: "center",
  },
  sourceToggleCountActive: { 
    backgroundColor: "#EEF4FB",
  },
  sourceToggleCountTxt: { 
    fontSize: 11, 
    fontWeight: "700", 
    color: "#666",
  },
  sourceToggleCountTxtActive: { 
    color: BRAND,
  },

  // Category scroll bar
  catSection: { marginBottom: 10 },
  catRow: { paddingHorizontal: 14, gap: 8 },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  catPillActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  catPillEmoji: { fontSize: 14 },
  catPillLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  catPillLabelActive: {
    color: "#fff",
    fontWeight: "700",
  },

  // Popular chips
  popularSection: { marginBottom: 10 },
  popularRow: { paddingHorizontal: 14, gap: 10 },
  popularChip: {
    paddingHorizontal: 14, 
    paddingVertical: 9,
    borderRadius: 99, 
    backgroundColor: "#fff",
    borderWidth: 1.5, 
    borderColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  popularChipActive: { 
    backgroundColor: "#EEF4FB", 
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  popularChipTxt: { 
    fontSize: 12, 
    fontWeight: "600", 
    color: "#4B5563",
  },
  popularChipTxtActive: { 
    color: BRAND, 
    fontWeight: "800",
  },

  // Tag filters
  filterRow: { 
    paddingHorizontal: 14, 
    paddingBottom: 10, 
    gap: 8,
    alignItems: "center",
  },
  filterRowLabel: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    paddingRight: 4,
  },
  filterPill: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 99, 
    backgroundColor: "#fff",
    borderWidth: 1.5, 
    borderColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillActive: { 
    backgroundColor: BRAND, 
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  filterPillTxt: { 
    fontSize: 12, 
    fontWeight: "600", 
    color: "#374151",
  },
  filterPillTxtActive: { 
    color: "#fff",
  },

  // Result summary
  resultSummary: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginHorizontal: 14, 
    marginBottom: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: "#EEF4FB", 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: "#C5D9F0",
  },
  resultSummaryTxt: { 
    fontSize: 12, 
    color: BRAND, 
    fontWeight: "700",
  },
  resultSummaryClear: { 
    fontSize: 12, 
    color: "#EF4444", 
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Grid
  gridContent: { paddingHorizontal: 14, paddingBottom: 100 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  // 抵消 gridContent 嘅水平 padding，令 ListHeader 內元素同食譜卡一樣只縮 14
  listHeaderOuter: { marginHorizontal: -14 },

  // Recipe card skeleton (loading)
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  skeletonImg: {
    width: "100%",
    height: CARD_WIDTH * CARD_IMAGE_RATIO,
    backgroundColor: "#F3F4F6",
  },
  skeletonInfo: {
    padding: 10,
    gap: 8,
  },
  skeletonNameLine: {
    width: "85%",
    height: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
  },
  skeletonNameLineShort: {
    width: "50%",
    height: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
  },
  skeletonMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  skeletonMetaItem: {
    width: 45,
    height: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
  },

  // Recipe card
  card: { 
    width: CARD_WIDTH, 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    overflow: "hidden", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardImg: { width: CARD_WIDTH, height: CARD_WIDTH * CARD_IMAGE_RATIO },
  cardImgPH: { 
    backgroundColor: "#F0F0F0", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F5F5F5",
  },
  placeholderContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 8,
    textAlign: "center",
  },
  cardBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 1,
  },
  sourceBadge: { 
    backgroundColor: "rgba(1, 62, 119, 0.9)", 
    borderRadius: 8, 
    paddingHorizontal: 8, 
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sourceBadgeTxt: { 
    fontSize: 10, 
    fontWeight: "700", 
    color: "#fff",
    letterSpacing: 0.5,
  },
  aiBadgeCorner: {
    backgroundColor: "rgba(1, 62, 119, 0.9)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  aiBadgeCornerTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  cardPlanBtn: { 
    position: "absolute", 
    bottom: 8, 
    right: 8, 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: "rgba(1, 62, 119, 0.9)", 
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cardInfo: { padding: 12 },
  cardName: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#1A1A1A", 
    lineHeight: 20, 
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  aiBadge: { 
    backgroundColor: BRAND, 
    borderRadius: 6, 
    paddingHorizontal: 6, 
    paddingVertical: 2,
    marginLeft: 4,
  },
  aiBadgeTxt: { 
    fontSize: 9, 
    fontWeight: "800", 
    color: "#fff",
    letterSpacing: 0.5,
  },
  cardNameEn: { 
    fontSize: 11, 
    color: "#9CA3AF", 
    marginBottom: 6, 
    lineHeight: 16,
    fontStyle: "italic",
  },
  cardMeta: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 6,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardCatEmoji: { fontSize: 12, marginRight: 2 },
  cardMetaTxt: { 
    fontSize: 11, 
    color: "#6B7280",
    fontWeight: "500",
  },
  cardTags: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 4,
    marginTop: 4,
  },
  cardTag: { 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 99, 
    backgroundColor: "#EEF4FB", 
    borderWidth: 1, 
    borderColor: "#C5D9F0",
  },
  cardTagActive: { 
    backgroundColor: BRAND, 
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTagTxt: { 
    fontSize: 10, 
    color: BRAND, 
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardTagTxtActive: { 
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Empty state
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingTop: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: BRAND, marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: BRAND, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  emptySuggestChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, backgroundColor: "#EEF4FB",
    borderWidth: 1, borderColor: "#C5D9F0",
  },
  emptySuggestChipTxt: { fontSize: 12, fontWeight: "600", color: BRAND },

  // Filter sheet
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "80%",
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E0D8",
    alignSelf: "center",
    marginBottom: 16,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    marginBottom: 10,
    marginTop: 4,
  },
  filterCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterCategoryChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterCategoryChipEmoji: {
    fontSize: 14,
  },
  filterCategoryChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterCategoryChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  filterTimeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterTimeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterTimeChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterTimeChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterTimeChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  filterTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  filterTagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterTagChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterTagChipTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  filterTagChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  filterResetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
  },
  filterResetBtnTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  filterConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: "center",
  },
  filterConfirmBtnTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },

  // Scroll-to-top floating button
  scrollTopFab: {
    position: "absolute",
    right: 16,
    zIndex: 20,
  },
  scrollTopFabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },

  // Quick-plan modal
  planOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  planSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  planHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  planLabel: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  planDateChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: "#F3F4F6", marginRight: 8 },
  planDateChipActive: { backgroundColor: BRAND },
  planDateChipTxt: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  planMealRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  planMealChip: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", gap: 4 },
  planMealChipActive: { backgroundColor: BRAND },
  planMealTxt: { fontSize: 12, fontWeight: "700", color: "#374151" },
  planConfirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: BRAND, paddingVertical: 16, borderRadius: 16, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
});
