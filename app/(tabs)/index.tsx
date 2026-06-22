import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, Image, TextInput, Dimensions, ScrollView, ActivityIndicator,
  Modal, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { loadCustomCategories } from "@/lib/category-storage";
import type { CategoryDef } from "@/lib/category-storage";
import { useMemo, useState, useEffect, useCallback } from "react";


const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 16 - 16 - CARD_GAP) / 2;
const BRAND = "#013E77";
const BG = "#F5F5F5";

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

type CategoryKey = string;

// ── Quick filters (speed/style tags) ────────────────────────────────
const QUICK_FILTERS = [
  { key: "quick30",    label: "⏱ 30分鐘", icon: null, match: (r: any) => r.cookTime <= 30 },
  { key: "ricecooker", label: "電飯煲", icon: "restaurant-outline" as const, match: (r: any) => (r.tags ?? []).some((t: string) => t.includes("電飯煲") || t.includes("炊飯")) },
  { key: "cantonese",  label: "🇭🇰 粵菜",  icon: null, match: (r: any) => (r.tags ?? []).some((t: string) => t.includes("粵") || t.includes("港式")) },
  { key: "homestyle",  label: "家常",   icon: "home-outline" as const, match: (r: any) => r.cookTime <= 45 },
  { key: "highprot",   label: "高蛋白", icon: "fitness-outline" as const, match: (r: any) => (r.tags ?? []).some((t: string) => t.includes("高蛋白") || t.includes("雞胸")) },
];

// ── Today's Summary Card ──────────────────────────────────────────
function TodaySummaryCard({ todayMeals, router, isAdmin, shoppingPending }: {
  todayMeals: any[];
  router: ReturnType<typeof useRouter>;
  isAdmin: boolean;
  shoppingPending: number;
}) {
  const lunch = todayMeals.filter((m: any) => m.mealType === "lunch" && m.status === "confirmed");
  const dinner = todayMeals.filter((m: any) => m.mealType === "dinner" && m.status === "confirmed");
  const pendingCount = todayMeals.filter((m: any) => m.status === "pending").length;

  return (
    <TouchableOpacity style={s.summaryCard} onPress={() => router.push("/(tabs)/planner" as any)} activeOpacity={0.8}>
      <View style={s.summaryHeader}>
        <Text style={s.summaryTitle}>今日摘要</Text>
      </View>

      <View style={s.summaryRows}>
        {/* 午餐 row */}
        <View style={s.summaryRow}>
          <Ionicons name="sunny-outline" size={16} color="#F59E0B" />
          <Text style={s.summaryLabel}>午餐</Text>
          <Text style={s.summaryValue} numberOfLines={1}>
            {lunch.length > 0 ? lunch.map((m: any) => m.recipeName).join("、") : "未安排"}
          </Text>
        </View>

        {/* 晚餐 row */}
        <View style={s.summaryRow}>
          <Ionicons name="moon-outline" size={16} color="#013E77" />
          <Text style={s.summaryLabel}>晚餐</Text>
          <Text style={s.summaryValue} numberOfLines={1}>
            {dinner.length > 0 ? dinner.map((m: any) => m.recipeName).join("、") : "未安排"}
          </Text>
        </View>

        {/* 採購 row */}
        <View style={s.summaryRow}>
          <Ionicons name="cart-outline" size={16} color="#22C55E" />
          <Text style={s.summaryLabel}>採購</Text>
          <Text style={s.summaryValue}>{shoppingPending > 0 ? `${shoppingPending} 項待購` : "已買齊"}</Text>
        </View>

        {/* 待確認 row (admin only) */}
        {isAdmin && pendingCount > 0 && (
          <View style={s.summaryRow}>
            <Ionicons name="time-outline" size={16} color="#EF4444" />
            <Text style={s.summaryLabel}>待確認</Text>
            <Text style={[s.summaryValue, { color: "#EF4444" }]}>{pendingCount} 個排餐</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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

// ── Main component ───────────────────────────────────────────────────
export default function RecipesTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { logout, user, familyRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "official" | "user">("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  useEffect(() => {
    loadCustomCategories().then(c => setCategories(c));
  }, []);
  const [quickPlanRecipe, setQuickPlanRecipe] = useState<{ id: string; name: string; image?: string } | null>(null);
  const [quickPlanDate, setQuickPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [quickPlanMeal, setQuickPlanMeal] = useState("dinner");

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayMeals = [] } = trpc.mealPlan.listByDateRange.useQuery({ startDate: todayStr, endDate: todayStr }, { staleTime: 30000 });
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, { staleTime: 30000 });
  const shoppingPending = (shoppingItems as any[]).filter((i: any) => i.status !== "bought").length;
  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const { data: officialRecipes = [], isLoading: loadingOfficial } =
    trpc.recipes.listOfficial.useQuery({ limit: 200 }, { staleTime: 60000 });
  const { data: userRecipes = [], isLoading: loadingUser } =
    trpc.recipes.listUser.useQuery({ limit: 200 }, { staleTime: 60000 });

  const deleteUserM = trpc.recipes.deleteUser.useMutation({
    onSuccess: () => utils.recipes.listUser.invalidate(),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });
  const addMealM = trpc.mealPlan.add.useMutation({
    onSuccess: () => { setQuickPlanRecipe(null); Alert.alert("已加入排餐"); },
    onError: (e) => Alert.alert("加入失敗", e.message),
  });

  const dateOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label = i === 0 ? "今天" : i === 1 ? "明天" : d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric", weekday: "short" });
    return { iso, label };
  }), []);

  const allUserTags = useMemo(() => {
    const set = new Set<string>();
    userRecipes.forEach((r: any) => (r.tags ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [userRecipes]);

  // Combine all recipes for unified search
  const allTaggedRecipes = useMemo(() => [
    ...officialRecipes.map((r: any) => ({ ...r, _source: "official" })),
    ...userRecipes.map((r: any) => ({ ...r, _source: "user" })),
  ], [officialRecipes, userRecipes]);

  const isLoading = loadingOfficial || loadingUser;

  const filteredRecipes = useMemo(() => {
    // Pick source pool based on viewMode
    let pool = viewMode === "official"
      ? officialRecipes.map((r: any) => ({ ...r, _source: "official" }))
      : viewMode === "user"
        ? userRecipes.map((r: any) => ({ ...r, _source: "user" }))
        : allTaggedRecipes;

    // Category filter
    if (activeCategory !== "all") {
      pool = pool.filter((r: any) => r.recipeCategory === activeCategory);
    }
    // Quick filter
    if (activeFilter) {
      const f = QUICK_FILTERS.find(f => f.key === activeFilter);
      if (f) pool = pool.filter(f.match);
    }
    // Tag filter (user recipes)
    if (activeTagFilter) {
      pool = pool.filter((r: any) => (r.tags ?? []).includes(activeTagFilter));
    }
    // Search — name, description, tags, ingredients
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter((r: any) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.tags ?? []).some((t: string) => t.toLowerCase().includes(q)) ||
        (r.ingredients ?? []).some((i: any) => i.name?.toLowerCase().includes(q))
      );
    }
    return pool;
  }, [officialRecipes, userRecipes, allTaggedRecipes, viewMode, activeCategory, activeFilter, activeTagFilter, searchQuery]);

  const handleLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      { text: "登出", style: "destructive", onPress: () => logout() },
    ]);
  };

  const navigateToRecipe = (item: any) => {
    const prefix = item._source === "user" ? "user_" : "official_";
    router.push({ pathname: "/recipe/[id]", params: { id: `${prefix}${item.id}` } });
  };

  const renderCard = ({ item }: { item: any }) => {
    const isUser = item._source === "user";
    const tags: string[] = item.tags ?? [];
    const cat = categories.find(c => c.key === item.recipeCategory);

    const handleDelete = () => {
      Alert.alert("刪除食譜", `確定要刪除「${item.name}」？`, [
        { text: "取消", style: "cancel" },
        { text: "刪除", style: "destructive", onPress: () => deleteUserM.mutate({ id: item.id }) },
      ]);
    };

    return (
      <View style={s.card}>
        <TouchableOpacity onPress={() => navigateToRecipe(item)} activeOpacity={0.85}>
          {item.thumbnailUrl || item.image
            ? <Image source={{ uri: item.thumbnailUrl || item.image }} style={s.cardImg} />
            : <View style={[s.cardImg, s.cardImgPH]}>{cat?.emoji ? <Text style={{ fontSize: 30 }}>{cat.emoji}</Text> : <Ionicons name="restaurant-outline" size={30} color="#9CA3AF" />}</View>
          }
          {/* Plan button — bottom right */}
          <TouchableOpacity
            style={s.cardPlanBtn}
            onPress={() => {
              const prefix = isUser ? "user_" : "official_";
              setQuickPlanRecipe({ id: `${prefix}${item.id}`, name: item.name, image: item.thumbnailUrl || item.image });
              setQuickPlanDate(new Date().toISOString().split("T")[0]);
              setQuickPlanMeal("dinner");
            }}
          >
            <Ionicons name="calendar-outline" size={13} color="#fff" />
          </TouchableOpacity>
          {/* User recipe: edit + delete */}
          {isUser && (
            <View style={s.cardActions}>
              <TouchableOpacity style={s.cardActionBtn} onPress={() => router.push({ pathname: "/recipe-editor", params: { id: String(item.id), name: item.name } })}>
                <Ionicons name="pencil" size={11} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[s.cardActionBtn, { backgroundColor: "rgba(220,38,38,0.8)" }]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={11} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {/* Source badge */}
          {isUser && (
            <View style={s.sourceBadge}>
              <Text style={s.sourceBadgeTxt}>我的</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={s.cardInfo}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          {item.nameEn ? <Text style={s.cardNameEn} numberOfLines={1}>{item.nameEn}</Text> : null}
          <View style={s.cardMeta}>
            {cat ? <Text style={s.cardCatEmoji}>{cat.emoji}</Text> : null}
            {item.cookTime ? <Text style={s.cardMetaTxt}>⏱ {item.cookTime}分</Text> : null}
            {item.difficulty ? <Text style={s.cardMetaTxt}> · {item.difficulty}</Text> : null}
          </View>
          {isUser && tags.length > 0 && (
            <View style={s.cardTags}>
              {tags.slice(0, 3).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[s.cardTag, activeTagFilter === tag && s.cardTagActive]}
                  onPress={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                >
                  <Text style={[s.cardTagTxt, activeTagFilter === tag && s.cardTagTxtActive]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
              {tags.length > 3 && <Text style={{ fontSize: 9, color: "#9CA3AF" }}>+{tags.length - 3}</Text>}
            </View>
          )}
        </View>
      </View>
    );
  };

  const hasFilters = searchQuery || activeCategory !== "all" || activeFilter || activeTagFilter;

  const ListHeader = (
    <>
      <TodaySummaryCard todayMeals={todayMeals} router={router} isAdmin={isAdmin} shoppingPending={shoppingPending} />
      <WeeklyMenuBar router={router} />

      {/* ── Import quick-access card ── */}
      <TouchableOpacity style={s.importCard} onPress={() => router.push("/import")} activeOpacity={0.8}>
        <View style={s.importCardIcon}>
          <Ionicons name="add" size={24} color="#013E77" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.importCardTitle}>匯入食譜</Text>
          <Text style={s.importCardSub}>Instagram · YouTube · 小紅書 · 手動輸入</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* ── Search bar — always visible, searches everything ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={17} color="#9CA3AF" />
        <TextInput
          style={s.searchInput}
          placeholder="搜尋食譜名稱、食材、標籤..."
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

      {/* ── Source toggle: All / Official / Mine ── */}
      <View style={s.sourceToggle}>
        {([
          { key: "all",      label: "全部",   count: allTaggedRecipes.length },
          { key: "official", label: "官方食譜", count: officialRecipes.length },
          { key: "user",     label: "我的食譜", count: userRecipes.length },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.sourceToggleBtn, viewMode === t.key && s.sourceToggleBtnActive]}
            onPress={() => { setViewMode(t.key); setActiveCategory("all"); setActiveFilter(null); setActiveTagFilter(null); }}
          >
            <Text style={[s.sourceToggleTxt, viewMode === t.key && s.sourceToggleTxtActive]}>{t.label}</Text>
            <View style={[s.sourceToggleCount, viewMode === t.key && s.sourceToggleCountActive]}>
              <Text style={[s.sourceToggleCountTxt, viewMode === t.key && s.sourceToggleCountTxtActive]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Categories — FIXED set, clean pills with emoji ── */}
      <View style={s.catSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {[ALL_ENTRY, ...categories].map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.catPill, isActive && s.catPillActive]}
                onPress={() => { setActiveCategory(cat.key); setActiveFilter(null); }}
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

      {/* ── Quick filters ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {QUICK_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterPill, activeFilter === f.key && s.filterPillActive]}
            onPress={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
          >
            {f.icon ? <Ionicons name={f.icon} size={12} color={activeFilter === f.key ? "#fff" : "#374151"} /> : null}
            <Text style={[s.filterPillTxt, activeFilter === f.key && s.filterPillTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tag shortcuts for user recipes */}
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

      {/* Result summary */}
      {hasFilters && (
        <View style={s.resultSummary}>
          <Text style={s.resultSummaryTxt}>找到 {filteredRecipes.length} 個食譜</Text>
          <TouchableOpacity onPress={() => { setActiveCategory("all"); setActiveFilter(null); setActiveTagFilter(null); setSearchQuery(""); }}>
            <Text style={s.resultSummaryClear}>清除篩選</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.headerTitle}>食譜庫</Text>
          <Text style={s.headerSub}>發現美味，規劃每週菜單</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/import")}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/ai-chef")}>
            <Ionicons name="chatbubble-ellipses" size={19} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={{ paddingHorizontal: 4, justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>登出</Text>
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
        ListEmptyComponent={
          <View style={s.empty}>
            {isLoading ? (
              <ActivityIndicator color={BRAND} size="large" />
            ) : hasFilters ? (
              <>
                <Ionicons name="search-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>找不到符合的食譜</Text>
                <Text style={s.emptySub}>試試清除搜尋條件或選擇其他分類</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => { setActiveCategory("all"); setActiveFilter(null); setActiveTagFilter(null); setSearchQuery(""); }}>
                  <Text style={s.emptyBtnTxt}>清除篩選</Text>
                </TouchableOpacity>
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

      {/* Quick-Plan Modal */}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {dateOptions.map(d => (
                <TouchableOpacity
                  key={d.iso}
                  style={[s.planDateChip, quickPlanDate === d.iso && s.planDateChipActive]}
                  onPress={() => setQuickPlanDate(d.iso)}
                >
                  <Text style={[s.planDateChipTxt, quickPlanDate === d.iso && { color: "#fff" }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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

  // Today summary card
  summaryCard: {
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: "#fff", borderRadius: 16,
    padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: "#EBEBEB",
  },
  summaryHeader: { marginBottom: 12 },
  summaryTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  summaryRows: { gap: 8 },
  summaryRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  summaryLabel: { fontSize: 13, fontWeight: "700", color: "#6B7280", width: 40 },
  summaryValue: { fontSize: 13, color: "#1A1A1A", flex: 1 },

  // Import card
  importCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: "#EEF4FB", borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: "#C5D9F0",
  },
  importCardIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#C5D9F0",
  },
  importCardTitle: { fontSize: 14, fontWeight: "800", color: "#013E77" },
  importCardSub: { fontSize: 11, color: "#6B7280", marginTop: 1 },

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
    marginHorizontal: 14, marginTop: 10, marginBottom: 10,
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A1A" },

  // Source toggle: All / Official / Mine
  sourceToggle: { flexDirection: "row", marginHorizontal: 14, marginBottom: 14, backgroundColor: "#EBEDF0", borderRadius: 14, padding: 4, gap: 2 },
  sourceToggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 11 },
  sourceToggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  sourceToggleTxt: { fontSize: 12, fontWeight: "600", color: "#888" },
  sourceToggleTxtActive: { color: BRAND, fontWeight: "800" },
  sourceToggleCount: { backgroundColor: "#E0E0E0", borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  sourceToggleCountActive: { backgroundColor: "#EEF4FB" },
  sourceToggleCountTxt: { fontSize: 10, fontWeight: "700", color: "#999" },
  sourceToggleCountTxtActive: { color: BRAND },

  // Categories — clean horizontal pills with emoji
  catSection: { marginBottom: 8 },
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

  // Quick filters row
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
  cardActions: { position: "absolute", top: 5, right: 5, flexDirection: "row", gap: 4 },
  cardActionBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(1,62,119,0.75)", alignItems: "center", justifyContent: "center" },
  sourceBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(1,62,119,0.8)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  sourceBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "700", color: "#1A1A1A", lineHeight: 18, marginBottom: 1 },
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
