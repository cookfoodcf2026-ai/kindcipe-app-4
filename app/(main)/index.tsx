import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, Image, TextInput, Dimensions, ScrollView, ActivityIndicator,
  Modal, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { loadCustomCategories } from "@/lib/category-storage";
import type { CategoryDef } from "@/lib/category-storage";
import { useMemo, useState, useEffect } from "react";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";

const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 16 - 16 - CARD_GAP) / 2;
const BRAND = "#013E77";
const BG = "#F5F5F5";

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

const CATEGORY_ORDER = ["全部", "中菜", "西餐", "日式", "韓式", "東南亞", "甜品", "飲品", "其他"];

const POPULAR_CHIPS = [
  { key: "quick30", label: " 快手30分鐘", filter: (r: any) => (r.cookTime ?? 999) <= 30 },
  { key: "tonight", label: "🌙 今晚食", filter: (r: any) => r.recipeCategory === "中菜" || r.recipeCategory === "家常菜" },
  { key: "kids", label: "👶 小朋友啱食", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("小朋友") || t.includes("清淡") || t.includes("簡單")) },
  { key: "light", label: "🥗 清淡少油", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("清淡") || t.includes("健康") || t.includes("少油")) },
  { key: "soup", label: " 湯水", filter: (r: any) => r.recipeCategory === "湯水" || r.name.includes("湯") },
  { key: "fridge", label: "🧊 冰箱清庫存", filter: (r: any) => (r.tags ?? []).some((t: string) => t.includes("家常") || t.includes("簡單")) },
  { key: "protein", label: "💪 高蛋白", filter: (r: any) => (r.ingredients ?? []).some((i: any) => ["雞肉", "豬肉", "牛肉", "魚", "蝦", "豆腐", "雞蛋"].some(p => i.name?.includes(p))) },
  { key: "3d1s", label: "🍱 3餸1湯", filter: (r: any) => r.recipeCategory === "中菜" || r.recipeCategory === "家常菜" },
];

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
          onPress={() => router.push("/(main)/planner" as any)}
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
          onPress={() => router.push("/(main)/planner" as any)}
          activeOpacity={0.7}
        >
          <Text style={s.summaryEmptyTxt}>今晚還沒安排晚餐，去排餐吧</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {isAdmin && pendingCount > 0 && (
        <TouchableOpacity
          style={s.pendingBanner}
          onPress={() => router.push("/(main)/planner" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={14} color="#EF4444" />
          <Text style={s.pendingBannerTxt}>{pendingCount} 個排餐待確認</Text>
          <Ionicons name="chevron-forward" size={12} color="#EF4444" />
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
      <TouchableOpacity style={s.quickActionBtn} onPress={() => router.push("/import")} activeOpacity={0.8}>
        <View style={[s.quickActionIcon, { backgroundColor: "#EEF4FB" }]}>
          <Ionicons name="add-circle-outline" size={22} color={BRAND} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.quickActionTitle}>新增食譜</Text>
          <Text style={s.quickActionSub}>貼連結 · 貼文字 · 截圖上傳 · 手動輸入</Text>
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
  const [viewMode, setViewMode] = useState<"all" | "official" | "user">("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activePopularChip, setActivePopularChip] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    loadCustomCategories().then(c => setCategories(c));
  }, []);
  const [quickPlanRecipe, setQuickPlanRecipe] = useState<{ id: string; name: string; image?: string; ingredients?: any[] } | null>(null);
  const [quickPlanDate, setQuickPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [quickPlanMeal, setQuickPlanMeal] = useState("dinner");
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayMeals = [] } = trpc.mealPlan.listByDateRange.useQuery({ startDate: todayStr, endDate: todayStr }, { staleTime: 30000 });

  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const { data: officialRecipes = [], isLoading: loadingOfficial } =
    trpc.recipes.listOfficial.useQuery({ limit: 200 }, { staleTime: 60000 });
  const { data: userRecipes = [], isLoading: loadingUser } =
    trpc.recipes.listUser.useQuery({ limit: 200 }, { staleTime: 60000 });

  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: (_, variables) => {
      utils.mealPlan.listByDateRange.invalidate();
      setQuickPlanRecipe(null);

      const found = [...officialRecipes, ...userRecipes].find(
        (r: any) => `official_${r.id}` === variables.recipeId || `user_${r.id}` === variables.recipeId
      ) as any;
      if (found && Array.isArray(found.ingredients) && found.ingredients.length > 0) {
        setPlanPickerRecipe({
          id: variables.recipeId,
          name: variables.recipeName,
          ingredients: found.ingredients,
          date: variables.date,
        });
      } else {
        Alert.alert("已加入排餐");
      }
    },
    onError: (e) => Alert.alert("加入失敗", e.message),
  });

  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      utils.mealPlan.listByDateRange.invalidate();
      utils.shopping.list.refetch();
    },
    onError: (e) => {
      setToast({ visible: true, message: `加入食材失敗：${e.message}`, type: "error" });
    },
  });

  const allUserTags = useMemo(() => {
    const set = new Set<string>();
    userRecipes.forEach((r: any) => (r.tags ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [userRecipes]);

  const allTaggedRecipes = useMemo(() => [
    ...officialRecipes.map((r: any) => ({ ...r, _source: "official" })),
    ...userRecipes.map((r: any) => ({ ...r, _source: "user" })),
  ], [officialRecipes, userRecipes]);

  const isLoading = loadingOfficial || loadingUser;

  const filteredRecipes = useMemo(() => {
    let pool = viewMode === "official"
      ? officialRecipes.map((r: any) => ({ ...r, _source: "official" }))
      : viewMode === "user"
        ? userRecipes.map((r: any) => ({ ...r, _source: "user" }))
        : allTaggedRecipes;

    if (activeCategory !== "all") {
      pool = pool.filter((r: any) => r.recipeCategory === activeCategory);
    }
    if (activeTagFilter) {
      pool = pool.filter((r: any) => (r.tags ?? []).includes(activeTagFilter));
    }
    if (activePopularChip) {
      const chip = POPULAR_CHIPS.find(c => c.key === activePopularChip);
      if (chip) pool = pool.filter(chip.filter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.map((r: any) => {
        let score = 0;
        const name = (r.name ?? "").toLowerCase();
        const desc = (r.description ?? "").toLowerCase();
        const tags: string[] = (r.tags ?? []).map((t: string) => t.toLowerCase());
        const ings: string[] = (r.ingredients ?? []).map((i: any) => (i.name ?? "").toLowerCase());

        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 80;
        else if (name.includes(q)) score += 60;

        if (tags.some((t: string) => t === q)) score += 50;
        else if (tags.some((t: string) => t.includes(q))) score += 30;

        if (ings.some((i: string) => i === q)) score += 40;
        else if (ings.some((i: string) => i.includes(q))) score += 20;

        if (desc.includes(q)) score += 10;

        return { ...r, _score: score };
      }).filter((r: any) => r._score > 0);

      pool.sort((a: any, b: any) => b._score - a._score);
    }

    return pool;
  }, [officialRecipes, userRecipes, allTaggedRecipes, viewMode, activeCategory, activeTagFilter, activePopularChip, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.recipes.listOfficial.invalidate(),
      utils.recipes.listUser.invalidate(),
      utils.mealPlan.listByDateRange.invalidate(),
      utils.weeklyMenu.getWeek.invalidate(),
    ]);
    setRefreshing(false);
  };

  const navigateToRecipe = (item: any) => {
    const prefix = item._source === "user" ? "user_" : "official_";
    router.push({ pathname: "/recipe/[id]", params: { id: `${prefix}${item.id}` } });
  };

  const renderCard = ({ item }: { item: any }) => {
    const isUser = item._source === "user";
    const tags: string[] = item.tags ?? [];
    const isAIGenerated = tags.includes("AI生成");
    const cat = categories.find(c => c.key === item.recipeCategory);
    const catColor = getCategoryColor(item.recipeCategory);

    return (
      <View style={s.card}>
        <TouchableOpacity onPress={() => navigateToRecipe(item)} activeOpacity={0.85}>
          {item.thumbnailUrl || item.image
            ? <Image source={{ uri: item.thumbnailUrl || item.image }} style={s.cardImg} />
            : (
              <View style={[s.cardImg, s.cardImgPH, { backgroundColor: catColor.bg }]}>
                <Text style={{ fontSize: 28, marginBottom: 4 }}>{cat?.emoji || "🍽️"}</Text>
                <Text style={{ fontSize: 10, color: catColor.text, fontWeight: "700", textAlign: "center" }} numberOfLines={2}>{item.name}</Text>
              </View>
            )
          }
          <TouchableOpacity
            style={s.cardPlanBtn}
            onPress={() => {
              const prefix = isUser ? "user_" : "official_";
              setQuickPlanRecipe({ id: `${prefix}${item.id}`, name: item.name, image: item.thumbnailUrl || item.image, ingredients: item.ingredients });
              setQuickPlanDate(new Date().toISOString().split("T")[0]);
              setQuickPlanMeal("dinner");
            }}
          >
            <Ionicons name="calendar-outline" size={13} color="#fff" />
          </TouchableOpacity>
          {isUser && (
            <View style={s.sourceBadge}>
              <Text style={s.sourceBadgeTxt}>我的</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={s.cardInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[s.cardName, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
            {isAIGenerated && (
              <View style={s.aiBadge}>
                <Text style={s.aiBadgeTxt}>AI</Text>
              </View>
            )}
          </View>
          {item.nameEn ? <Text style={s.cardNameEn} numberOfLines={1}>{item.nameEn}</Text> : null}
          <View style={s.cardMeta}>
            {cat ? <Text style={s.cardCatEmoji}>{cat.emoji}</Text> : null}
            {item.cookTime ? <Text style={s.cardMetaTxt}>⏱ {item.cookTime}分</Text> : null}
            {item.difficulty ? <Text style={s.cardMetaTxt}> · {item.difficulty}</Text> : null}
          </View>
          {isUser && tags.length > 0 && (
            <View style={s.cardTags}>
              {tags.slice(0, 2).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[s.cardTag, activeTagFilter === tag && s.cardTagActive]}
                  onPress={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                >
                  <Text style={[s.cardTagTxt, activeTagFilter === tag && s.cardTagTxtActive]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
              {tags.length > 2 && <Text style={{ fontSize: 9, color: "#9CA3AF" }}>+{tags.length - 2}</Text>}
            </View>
          )}
        </View>
      </View>
    );
  };

  const hasFilters = searchQuery || activeCategory !== "all" || activeTagFilter || activePopularChip;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (activeCategory !== "all") {
      const cat = categories.find(c => c.key === activeCategory);
      parts.push(cat?.label || activeCategory);
    }
    if (activePopularChip) {
      const chip = POPULAR_CHIPS.find(c => c.key === activePopularChip);
      parts.push(chip?.label.replace(/^[^\s]+\s/, "") || activePopularChip);
    }
    if (activeTagFilter) parts.push(`#${activeTagFilter}`);
    if (searchQuery.trim()) parts.push(`"${searchQuery}"`);
    return parts.join(" · ");
  }, [activeCategory, activePopularChip, activeTagFilter, searchQuery, categories]);

  const ListHeader = (
    <>
      <TonightMenuCard todayMeals={todayMeals} router={router} isAdmin={isAdmin} />
      <WeeklyMenuBar router={router} />
      <QuickActions router={router} />

      <View style={s.searchWrap}>
        <Ionicons name="search" size={17} color="#9CA3AF" />
        <TextInput
          style={s.searchInput}
          placeholder="搜尋食譜、食材、標籤"
          placeholderTextColor="#BCBCBC"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#BCBCBC" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.sourceToggle}>
        {([
          { key: "all",      label: "全部",   count: allTaggedRecipes.length },
          { key: "official", label: "官方食譜", count: officialRecipes.length },
          { key: "user",     label: "我的食譜", count: userRecipes.length },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.sourceToggleBtn, viewMode === t.key && s.sourceToggleBtnActive]}
            onPress={() => { setViewMode(t.key); setActiveCategory("all"); setActiveTagFilter(null); setActivePopularChip(null); }}
          >
            <Text style={[s.sourceToggleTxt, viewMode === t.key && s.sourceToggleTxtActive]}>{t.label}</Text>
            <View style={[s.sourceToggleCount, viewMode === t.key && s.sourceToggleCountActive]}>
              <Text style={[s.sourceToggleCountTxt, viewMode === t.key && s.sourceToggleCountTxtActive]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.catSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {[ALL_ENTRY, ...categories].map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.catPill, isActive && s.catPillActive]}
                onPress={() => { setActiveCategory(cat.key); }}
              >
                {cat.key === "all" ? (
                  <Ionicons name="clipboard-outline" size={15} color={isActive ? "#fff" : "#444"} />
                ) : (
                  <Text style={s.catPillEmoji}>{cat.emoji}</Text>
                )}
                <Text style={[s.catPillLabel, isActive && s.catPillLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.popularSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularRow}>
          {POPULAR_CHIPS.map(chip => {
            const isActive = activePopularChip === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[s.popularChip, isActive && s.popularChipActive]}
                onPress={() => setActivePopularChip(isActive ? null : chip.key)}
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
          {activeTagFilter && (
            <TouchableOpacity style={[s.filterPill, { borderColor: "#EF4444", backgroundColor: "#FEF2F2" }]} onPress={() => setActiveTagFilter(null)}>
              <Ionicons name="close" size={10} color="#EF4444" />
              <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "700", marginLeft: 2 }}>清除</Text>
            </TouchableOpacity>
          )}
          {allUserTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[s.filterPill, activeTagFilter === tag && s.filterPillActive]}
              onPress={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
            >
              <Text style={[s.filterPillTxt, activeTagFilter === tag && s.filterPillTxtActive]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {hasFilters && (
        <View style={s.resultSummary}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {filterSummary ? (
              <Text style={s.resultSummaryTxt} numberOfLines={1}>{filterSummary} · {filteredRecipes.length} 個結果</Text>
            ) : (
              <Text style={s.resultSummaryTxt}>找到 {filteredRecipes.length} 個食譜</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => { setActiveCategory("all"); setActiveTagFilter(null); setActivePopularChip(null); setSearchQuery(""); }}>
            <Text style={s.resultSummaryClear}>清除篩選</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
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
          <View style={{ width: "60%", height: "100%", backgroundColor: BRAND }} />
        </View>
      )}

      <FlatList
        data={filteredRecipes}
        keyExtractor={(item: any) => `${item._source}_${item.id}`}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        contentContainerStyle={s.gridContent}
        ListHeaderComponent={ListHeader}
        renderItem={renderCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        ListEmptyComponent={
          <View style={s.empty}>
            {isLoading ? (
              <ActivityIndicator color={BRAND} size="large" />
            ) : hasFilters ? (
              <>
                <Ionicons name="search-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>找不到符合嘅食譜</Text>
                <Text style={s.emptySub}>試下清除篩選或者揀其他分類</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setActiveCategory("all"); setActiveTagFilter(null); setActivePopularChip(null); }}>
                    <Text style={s.emptySuggestChipTxt}>清除篩選</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setSearchQuery(""); setActivePopularChip("quick30"); }}>
                    <Text style={s.emptySuggestChipTxt}> 快手30分鐘</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.emptySuggestChip} onPress={() => { setSearchQuery(""); setActivePopularChip("light"); }}>
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
              {[{ id: "breakfast", label: "早餐", icon: "sunny-outline" as const }, { id: "lunch", label: "午餐", icon: "sunny-outline" as const }, { id: "dinner", label: "晚餐", icon: "moon-outline" as const }, { id: "snack", label: "小食", icon: "film-outline" as const }].map(m => (
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
            setToast({ visible: true, message: `✅ ${items.length} 件食材已加入購物清單`, type: "success" });
          } else {
            setToast({ visible: true, message: "排餐已記錄", type: "info" });
          }
          setPlanPickerRecipe(null);
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
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginTop: 4, marginBottom: 10,
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A1A" },

  // Source toggle
  sourceToggle: { flexDirection: "row", marginHorizontal: 14, marginBottom: 12, backgroundColor: "#EBEDF0", borderRadius: 14, padding: 4, gap: 2 },
  sourceToggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 11 },
  sourceToggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  sourceToggleTxt: { fontSize: 12, fontWeight: "600", color: "#888" },
  sourceToggleTxtActive: { color: BRAND, fontWeight: "800" },
  sourceToggleCount: { backgroundColor: "#E0E0E0", borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  sourceToggleCountActive: { backgroundColor: "#EEF4FB" },
  sourceToggleCountTxt: { fontSize: 10, fontWeight: "700", color: "#999" },
  sourceToggleCountTxtActive: { color: BRAND },

  // Categories
  catSection: { marginBottom: 6 },
  catRow: { paddingHorizontal: 14, gap: 8 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: "#E8E8E8",
  },
  catPillActive: { backgroundColor: BRAND, borderColor: BRAND },
  catPillEmoji: { fontSize: 15 },
  catPillLabel: { fontSize: 12, fontWeight: "700", color: "#444" },
  catPillLabelActive: { color: "#fff" },

  // Popular chips
  popularSection: { marginBottom: 8 },
  popularRow: { paddingHorizontal: 14, gap: 8 },
  popularChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 99, backgroundColor: "#F9FAFB",
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  popularChipActive: { backgroundColor: "#EEF4FB", borderColor: BRAND },
  popularChipTxt: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  popularChipTxtActive: { color: BRAND, fontWeight: "700" },

  // Tag filters
  filterRow: { paddingHorizontal: 14, paddingBottom: 8, gap: 7 },
  filterRowLabel: { flexDirection: "row", alignItems: "center", gap: 3, paddingRight: 4 },
  filterPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  filterPillActive: { backgroundColor: BRAND, borderColor: BRAND },
  filterPillTxt: { fontSize: 12, fontWeight: "600", color: "#374151" },
  filterPillTxtActive: { color: "#fff" },

  // Result summary
  resultSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#EEF4FB", borderRadius: 10, borderWidth: 1, borderColor: "#C5D9F0" },
  resultSummaryTxt: { fontSize: 12, color: BRAND, fontWeight: "600" },
  resultSummaryClear: { fontSize: 11, color: "#EF4444", fontWeight: "700" },

  // Grid
  gridContent: { paddingHorizontal: 14, paddingBottom: 32 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },

  // Recipe card
  card: { width: CARD_WIDTH, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  cardImg: { width: CARD_WIDTH, height: CARD_WIDTH * 0.65 },
  cardImgPH: { backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  cardPlanBtn: { position: "absolute", bottom: 6, right: 6, width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(1,62,119,0.85)", alignItems: "center", justifyContent: "center" },
  sourceBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(1,62,119,0.8)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  sourceBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "700", color: "#1A1A1A", lineHeight: 18, marginBottom: 1 },
  aiBadge: { backgroundColor: BRAND, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  aiBadgeTxt: { fontSize: 8, fontWeight: "800", color: "#fff" },
  cardNameEn: { fontSize: 10, color: "#9CA3AF", marginBottom: 3, lineHeight: 14 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 4 },
  cardCatEmoji: { fontSize: 12, marginRight: 2 },
  cardMetaTxt: { fontSize: 10, color: "#999" },
  cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cardTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: "#EEF4FB", borderWidth: 1, borderColor: "#C5D9F0" },
  cardTagActive: { backgroundColor: BRAND, borderColor: BRAND },
  cardTagTxt: { fontSize: 9, color: BRAND, fontWeight: "700" },
  cardTagTxtActive: { color: "#fff" },

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
