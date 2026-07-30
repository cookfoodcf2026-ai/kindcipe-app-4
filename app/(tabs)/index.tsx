import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, Dimensions, ScrollView, ActivityIndicator,
  Modal, Platform, RefreshControl, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
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

const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 14 - 14 - CARD_GAP) / 2;
const BRAND = "#013E77";
const BG = "#F5F5F5";

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

const CATEGORY_ORDER = ["全部", "中菜", "西餐", "日式", "韓式", "東南亞", "甜品", "飲品", "其他"];

const POPULAR_CHIPS = [
  { key: "quick15", label: "⚡ 快手 15 分鐘", filter: (r: any) => (r.cookTime ?? 999) <= 15 },
  { key: "quick30", label: "⏱ 快手 30 分鐘", filter: (r: any) => (r.cookTime ?? 999) <= 30 },
  { key: "tonight", label: " 今晚食", filter: (r: any) => r.recipeCategory === "中菜" || (r.tags ?? []).includes("家常菜") },
  { key: "hk-style", label: "🇰 港式家常", filter: (r: any) => (r.tags ?? []).includes("港式") },
  { key: "kids", label: "👶 小朋友啱食", filter: (r: any) => {
      const tags = r.tags ?? [];
      const ingredients = r.ingredients ?? [];
      if (tags.some((t: string) => t.includes("小朋友"))) return true;
      const hasSpicy = ingredients.some((i: any) => ["辣椒", "胡椒", "辣油", "豆瓣", "花椒"].some(s => i.name?.includes(s)));
      const hasDeepFry = r.steps?.some((s: any) => s.instruction?.includes("炸"));
      return r.difficulty === "簡單" && !hasSpicy && !hasDeepFry;
    }
  },
  { key: "vegetarian", label: " 素食主義", filter: (r: any) => {
      const tags = r.tags ?? [];
      const ingredients = r.ingredients ?? [];
      if (tags.some((t: string) => t.includes("素食"))) return true;
      const MEAT_KEYWORDS = ["雞", "豬", "牛", "羊", "魚", "蝦", "蟹", "肉", "腩", "翼", "腿", "排骨", "臘", "大腸", "牛柳", "牛仔骨", "蜆", "", "帶子", "三文魚", "西冷", "拉麵", "叉燒"];
      return !ingredients.some((i: any) => MEAT_KEYWORDS.some(m => i.name?.includes(m)));
    }
  },
  { key: "light", label: "🥗 清淡少油", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("清淡") || t.includes("健康") || t.includes("少油")) },
  { key: "one-person", label: "👤 一人食", filter: (r: any) => (r.servings ?? 999) <= 2 },
  { key: "high-protein", label: "💪 高蛋白", filter: (r: any) => (r.ingredients ?? []).some((i: any) => ["雞肉", "豬肉", "牛肉", "魚", "蝦", "豆腐", "雞蛋", "牛柳", "牛仔骨", "三文魚", "西冷"].some(p => i.name?.includes(p))) },
  { key: "soup", label: "🍲 湯水", filter: (r: any) => r.recipeCategory === "湯水" || r.name.includes("湯") || (r.tags ?? []).includes("湯水") },
  { key: "fridge", label: "🧊 冰箱清庫存", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("家常") || t.includes("簡單")) },
  { key: "beginner", label: "⭐ 新手必學", filter: (r: any) => r.difficulty === "簡單" && (r.tags ?? []).some((t: string) => t.includes("新手") || t.includes("基礎")) },
  { key: "party", label: "🍽️ 請客食譜", filter: (r: any) => (r.servings ?? 0) >= 4 || (r.tags ?? []).some((t: string) => t.includes("宴客")) },
  { key: "low-calorie", label: "🥗 低卡減肥", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("低卡") || t.includes("減肥")) },
  { key: "3d1s", label: "🍱 3 餸 1 湯", filter: (r: any) => r.recipeCategory === "中菜" },
  { key: "steamed", label: " 蒸餸", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("蒸")) },
  { key: "stir-fry", label: " 小炒", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("炒")) },
];

const TOP_TAGS = ["15 分鐘內", "30 分鐘內", "電飯煲料理", "家常", "簡單", "素食", "低卡"];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "中菜": { bg: "#FFF1F0", text: "#B91C1C" },
  "西餐": { bg: "#EFF6FF", text: "#1D4ED8" },
  "日式": { bg: "#FFF0F6", text: "#BE185D" },
  "韓式": { bg: "#FFF7ED", text: "#C2410C" },
  "東南亞": { bg: "#F0FDF4", text: "#15803D" },
  "甜品": { bg: "#FEFCE8", text: "#A16207" },
  "飲品": { bg: "#F5F3FF", text: "#7C3AED" },
  "其他": { bg: "#F3F4F6", text: "#4B5563" },
};

const getCategoryColor = (key?: string) => CATEGORY_COLORS[key || "其他"] || CATEGORY_COLORS["其他"];

const mealName = (m: any) => m.recipeName || m.name || "未命名食譜";

// ── Tonight's Menu Card ─────────────────────────────────────────────
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
    staleTime: 1000 * 10,
    refetchInterval: 5000,
  });
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 5000,
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
function WeeklyMenuBar({ router }: { router: ReturnType<typeof useRouter> }) {
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);
  const { data } = trpc.weeklyMenu.getWeek.useQuery({ weekStart }, { staleTime: 60000 });
  const items = (data?.items ?? []) as any[];
  const filled = items.filter(i => i.meatId || i.seafoodId || i.vegId || i.soupId);
  if (filled.length === 0) return null;
  const DAY_SHORT = ["", "一", "二", "三", "四", "五", "六", "日"];
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  return (
    <TouchableOpacity style={s.weeklyBar} onPress={() => router.push("/weekly-menu")} activeOpacity={0.85}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="star-outline" size={14} color="#FF8C00" />
          <Text style={s.weeklyBarTitle}>本週晚餐推薦</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{filled.length}/7 天</Text>
          <Ionicons name="chevron-forward" size={13} color="#9CA3AF" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
        {[1,2,3,4,5,6,7].map(dow => {
          const day = items.find((i: any) => i.dayOfWeek === dow);
          const has = day && (day.meatId || day.seafoodId || day.vegId || day.soupId);
          const isToday = dow === todayDow;
          return (
            <View key={dow} style={[s.weekDot, isToday && s.weekDotToday, !has && s.weekDotEmpty]}>
              <Text style={[s.weekDotLabel, isToday && { color: "#fff" }]}>{DAY_SHORT[dow]}</Text>
              {has && <Text style={s.weekDotDish} numberOfLines={1}>{day.meatName || day.seafoodName || day.vegName || day.soupName}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </TouchableOpacity>
  );
}

// ── Quick Actions ────────────────────────────────────────────────────
function QuickActions({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View style={s.quickActions}>
      <TouchableOpacity
        style={[s.quickActionBtn, { borderColor: "#D1FAE5", backgroundColor: "#ECFDF5" }]}
        onPress={() => router.push("/markets")}
        activeOpacity={0.8}
      >
        <View style={[s.quickActionIcon, { backgroundColor: "#D1FAE5" }]}>
          <Ionicons name="cart-outline" size={22} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.quickActionTitle, { color: "#065F46" }]}>🛒 街市買餸精明情報</Text>
          <Text style={[s.quickActionSub, { color: "#047857" }]}>
            全港街市分佈、營業時間與買餸貼士（合作接洽中）
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function RecipesTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user, familyRole } = useAuth();

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
  const searchInputRef = useRef<TextInput>(null);
  const skeletonAnim = useRef(new Animated.Value(0)).current;
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

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      // Save to search history if non-empty
      if (searchQuery.trim().length > 0) {
        setSearchHistory(prev => {
          const updated = [searchQuery.trim(), ...prev.filter(s => s !== searchQuery.trim())].slice(0, 10);
          AsyncStorage.setItem("kindcipe_search_history", JSON.stringify(updated));
          return updated;
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [quickPlanRecipe, setQuickPlanRecipe] = useState<{ id: string; name: string; image?: string; ingredients?: any[] } | null>(null);
  const [quickPlanDate, setQuickPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [quickPlanMeal, setQuickPlanMeal] = useState("dinner");
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayMeals = [] } = trpc.mealPlan.listByDateRange.useQuery({ startDate: todayStr, endDate: todayStr }, { staleTime: 30000 });

  const isAdmin = familyRole === "owner" || familyRole === "admin";

  // Use server-side search with infinite scroll
  const {
    recipes: searchRecipes,
    total: searchTotal,
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
    limit: viewType === "grid" ? 20 : 30,
  });

  // Legacy queries for backward compatibility (user recipes, counts)
  const { data: userRecipes = [], isLoading: loadingUser } =
    trpc.recipes.listUser.useQuery({ limit: 200 }, { staleTime: 60000 });

  const isLoading = searchLoading || loadingUser;

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: (_, variables) => {
      utils.mealPlan.listByDateRange.invalidate();
      utils.shopping.list.invalidate();
      setQuickPlanRecipe(null);

      // Find recipe from search results
      const found = searchRecipes.find((r: any) => r.id === variables.recipeId) as any;
      if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
        setPlanPickerRecipe({
          id: variables.recipeId,
          name: variables.recipeName,
          ingredients: found.ingredients,
          date: variables.date,
        });
      } else {
        setToast({ visible: true, message: "已加入排餐", type: "info" });
      }
    },
    onError: (e) => setToast({ visible: true, message: `加入失敗：${e.message}`, type: "error" }),
  });

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: (_, variables) => {
      utils.shopping.list.invalidate();
      utils.mealPlan.listByDateRange.invalidate();
      utils.shopping.list.refetch();
      const count = variables.items.length;
      setPlanPickerRecipe(null);
      setToast({ visible: true, message: `✅ ${count} 件食材已加入購物清單`, type: "success" });
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
  }, [searchRecipes, viewMode, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSearch(),
      utils.recipes.listUser.invalidate(),
      utils.mealPlan.listByDateRange.invalidate(),
      utils.weeklyMenu.getWeek.invalidate(),
    ]);
    setRefreshing(false);
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
      />
    );
  };

  const hasFilters = searchQuery || activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
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
    if (searchQuery.trim()) parts.push(`"${searchQuery}"`);
    return parts.join(" · ");
  }, [activeCategory, activePopularChips, activeTagFilters, searchQuery, categories]);

  const ListHeader = (
    <>
      <TonightMenuCard todayMeals={todayMeals} router={router} isAdmin={isAdmin} />
      <PendingActionsCard router={router} isAdmin={isAdmin} />
      <WeeklyMenuBar router={router} />
      <QuickActions router={router} />

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
          clearButtonMode="while-editing"
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
          {(activeTagFilters.length > 0 || activePopularChips.length > 0 || activeCategory !== "all" || filterCookTimeMax !== undefined) && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>
                {activeTagFilters.length + activePopularChips.length + (activeCategory !== "all" ? 1 : 0) + (filterCookTimeMax !== undefined ? 1 : 0)}
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
              <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View style={s.searchHistoryRow}>
            {searchHistory.slice(0, 5).map((query, idx) => (
              <TouchableOpacity
                key={idx}
                style={s.searchHistoryChip}
                onPress={() => {
                  setSearchQuery(query);
                  setShowSearchHistory(false);
                  searchInputRef.current?.blur();
                }}
              >
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={s.searchHistoryChipTxt} numberOfLines={1}>{query}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Sort Indicator */}
      {sortBy !== "popular" && (
        <View style={s.sortIndicator}>
          <Text style={s.sortIndicatorTxt}>
            {sortBy === "cookTime" ? "⏱ 時間" : "⭐ 難度"}
          </Text>
          <TouchableOpacity onPress={() => setSortBy("popular")}>
            <Ionicons name="close" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.sourceToggle}>
        {([
          { key: "all",      label: "全部",   count: searchTotal },
          { key: "official", label: "官方食譜", count: searchTotal },
          { key: "user",     label: "我的食譜", count: userRecipes.length },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.sourceToggleBtn, viewMode === t.key && s.sourceToggleBtnActive]}
            onPress={() => { setViewMode(t.key); setActiveCategory("all"); setActiveTagFilters([]); setActivePopularChips([]); }}
          >
            <Text style={[s.sourceToggleTxt, viewMode === t.key && s.sourceToggleTxtActive]}>{t.label}</Text>
            <View style={[s.sourceToggleCount, viewMode === t.key && s.sourceToggleCountActive]}>
              <Text style={[s.sourceToggleCountTxt, viewMode === t.key && s.sourceToggleCountTxtActive]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Scroll Bar */}
      <View style={s.catSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {[ALL_ENTRY, ...categories].map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catPill, activeCategory === cat.key && s.catPillActive]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.8}
            >
              <Text style={s.catPillEmoji}>{cat.emoji || "🍽️"}</Text>
              <Text style={[s.catPillLabel, activeCategory === cat.key && s.catPillLabelActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Popular Chips - Keep for quick access */}
      <View style={s.popularSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularRow}>
          {POPULAR_CHIPS.map(chip => {
            const isActive = activePopularChips.includes(chip.key);
            return (
              <TouchableOpacity
                key={chip.key}
                style={[s.popularChip, isActive && s.popularChipActive]}
                onPress={() => {
                  setActivePopularChips(prev =>
                    prev.includes(chip.key) ? prev.filter(k => k !== chip.key) : [...prev, chip.key]
                  );
                }}
              >
                <Text style={[s.popularChipTxt, isActive && s.popularChipTxtActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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
            {filterSummary ? (
              <Text style={s.resultSummaryTxt} numberOfLines={1}>{filterSummary} · {searchTotal} 個結果</Text>
            ) : (
              <Text style={s.resultSummaryTxt}>找到 {searchTotal} 個食譜</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => { setActiveCategory("all"); setActiveTagFilters([]); setActivePopularChips([]); setSearchQuery(""); }}>
            <Text style={s.resultSummaryClear}>清除篩選</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 12, paddingRight: Math.max(16, insets.right) }]}>
        <View>
          <Text style={s.headerTitle}>食譜庫</Text>
          <Text style={s.headerSub}>{user?.name ? `嗨，${user.name.split(" ")[0]}` : "發現美味，規劃每週菜單"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/import")}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/ai-chef")}>
            <Ionicons name="chatbubble-ellipses" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(1,62,119,0.15)" }}>
          <Animated.View style={{ width: "60%", height: "100%", backgroundColor: BRAND, opacity: Animated.multiply(skeletonAnim, 0.5).interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) }} />
        </View>
      )}

      <FlatList
        data={filteredRecipes}
        keyExtractor={(item: any) => item.id}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        contentContainerStyle={[s.gridContent, { paddingBottom: Math.max(100, insets.bottom + 80) }]}
        ListHeaderComponent={ListHeader}
        renderItem={renderCard}
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={BRAND} size="small" />
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        ListEmptyComponent={
          <View style={s.empty}>
            {isSearchError ? (
              <>
                <Ionicons name="warning-outline" size={44} color="#EF4444" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>搜尋出錯</Text>
                <Text style={s.emptySub}>{searchError?.message || "請稍後再試"}</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => refetchSearch()}>
                  <Text style={s.emptyBtnTxt}>重試</Text>
                </TouchableOpacity>
              </>
            ) : isLoading ? (
              <ActivityIndicator color={BRAND} size="large" />
            ) : hasFilters ? (
              <>
                <Ionicons name="search-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>找不到符合嘅食譜</Text>
                <Text style={s.emptySub}>試下清除篩選或者揀其他分類</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setActiveCategory("all"); setActiveTagFilters([]); setActivePopularChips([]); }}>
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
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/import")}>
                  <Text style={s.emptyBtnTxt}>+ 匯入食譜</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="book-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>暫無食譜</Text>
              </>
            )}
          </View>
        }
      />

      <FilterModal
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        categories={categories}
        filterCookTimeMax={filterCookTimeMax}
        setFilterCookTimeMax={setFilterCookTimeMax}
        activeTagFilters={activeTagFilters}
        setActiveTagFilters={setActiveTagFilters}
        allUserTags={allUserTags}
        setActivePopularChips={setActivePopularChips}
        setSortBy={setSortBy}
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
            <PlanDatePicker value={quickPlanDate} onChange={setQuickPlanDate} />

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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    backgroundColor: BRAND,
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

  // Weekly bar
  weeklyBar: { marginHorizontal: 14, marginBottom: 8, backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: "#FEF3C7", shadowColor: "#FF8C00", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  weeklyBarTitle: { fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
  weekDot: { width: 58, borderRadius: 10, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", padding: 6, alignItems: "center" },
  weekDotToday: { backgroundColor: "#FF8C00", borderColor: "#FF8C00" },
  weekDotEmpty: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  weekDotLabel: { fontSize: 12, fontWeight: "700", color: "#FF8C00" },
  weekDotDish: { fontSize: 8, color: "#6B7280", marginTop: 2, textAlign: "center", width: 50 },

  // Search
  searchWrap: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8,
    marginHorizontal: 14, 
    marginTop: 8, 
    marginBottom: 4,
    backgroundColor: "#fff", 
    borderRadius: 16,
    paddingHorizontal: 14, 
    paddingVertical: 11,
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
    fontSize: 15, 
    color: "#1A1A1A",
    paddingVertical: 2,
  },
  sortBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  filterBtn: {
    width: 36,
    height: 36,
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
  searchHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  searchHistoryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  searchHistoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  searchHistoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  searchHistoryChipTxt: {
    fontSize: 12,
    color: "#1A1A1A",
    fontWeight: "500",
    maxWidth: 120,
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
  cardImg: { width: CARD_WIDTH, height: CARD_WIDTH * 0.8 },
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
