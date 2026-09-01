import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { loadCustomCategories, type CategoryDef } from "@/lib/category-storage";
import RecipeCard from "@/src/components/RecipeCard";
import FilterModal from "@/src/components/FilterModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";

type SourceType = "official" | "kol" | "user" | "all";

const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 14 - 14 - CARD_GAP) / 2;

const TOP_TAGS = ["15 分鐘內", "30 分鐘內", "電飯煲料理", "家常", "簡單", "素食", "低卡"];

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

export default function RecipesPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const sourceParam = ((params.source as SourceType) || "all") as SourceType;
  const [source, setSource] = useState<SourceType>(sourceParam);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activePopularChips, setActivePopularChips] = useState<string[]>([]);
  const [filterCookTimeMax, setFilterCookTimeMax] = useState<number | undefined>(undefined);
  const [activeIngredientCategory, setActiveIngredientCategory] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"popular" | "cookTime" | "difficulty">("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadCustomCategories().then(setCategories);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("kindcipe_search_history").then((h) => {
      if (h) {
        try {
          const parsed = JSON.parse(h);
          if (Array.isArray(parsed)) setSearchHistory(parsed);
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    setSource(sourceParam);
  }, [sourceParam]);

  const handleSaveSearchHistory = (query: string) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(s => s !== query);
      const updated = [query, ...filtered].slice(0, 20);
      AsyncStorage.setItem("kindcipe_search_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Phase 1: Use useRecipeSearch for infinite scrolling (matches index.tsx)
  const {
    recipes: searchRecipes,
    total: searchTotal,
    officialCount: searchOfficialCount,
    customCount: searchCustomCount,
    kolCount: searchKolCount,
    isLoading: searchLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch: refetchSearch,
    isError: isSearchError,
    error: searchError,
  } = useRecipeSearch({
    query: searchQuery || undefined,
    category: activeCategory === "all" ? undefined : activeCategory,
    tags: activeTagFilters.length > 0 ? activeTagFilters : undefined,
    cookTimeMax: filterCookTimeMax,
    popularChips: activePopularChips.length > 0 ? activePopularChips : undefined,
    ingredientCategory: activeIngredientCategory,
    source: source,
    limit: 20,
  });

  // Phase 2: Special handling for user recipes (matches index.tsx pattern)
  const {
    data: userRecipes = [],
    isLoading: loadingUser,
    refetch: refetchUser,
  } = trpc.recipes.listUser.useQuery(
    { limit: 200 },
    { enabled: source === "user", staleTime: 60000 }
  );

  const isLoading = searchLoading || loadingUser;

  const onRefresh = useCallback(() => {
    if (source === "user") {
      refetchUser();
    } else {
      refetchSearch();
    }
  }, [source, refetchUser, refetchSearch]);

  const getTitle = () => {
    switch (source) {
      case "official":
        return "🍳 官方食譜";
      case "kol":
        return "🌟 網紅食譜";
      case "user":
        return "📝 我的食譜";
      default:
        return "📖 食譜庫";
    }
  };

  const getEmptyMessage = () => {
    switch (source) {
      case "official":
        return "暫無官方食譜";
      case "kol":
        return "暫無網紅食譜";
      case "user":
        return "你還沒有食譜，去新增一個吧！";
      default:
        return "暫無食譜";
    }
  };

  const officialCount = source === "official" ? searchOfficialCount : 0;
  const userCount = source === "user" ? userRecipes.length : 0;
  const kolCount = source === "kol" ? searchKolCount : 0;

  const hasFilters = source !== "all" || searchQuery || activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || filterCookTimeMax !== undefined;

  const handleTagFilterPress = (tag: string) => {
    setActiveTagFilters(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleQuickPlanRecipe = (recipe: { id: string; name: string; image?: string; ingredients?: any[] } | null) => {
    console.log("Quick plan:", recipe);
  };

  const handleNavigateToRecipe = (item: any) => {
    const idStr = String(item.id);
    router.push(`/recipe/${idStr}`);
  };

  // Phase 3: Render RecipeCard with 2-column grid
  const renderRecipeCard = ({ item }: { item: any }) => {
    const recipeType = item.source === "official" ? "official" : "custom";
    const idStr = String(item.id);
    const recipeId = idStr.startsWith("official_") || idStr.startsWith("user_")
      ? idStr.split("_")[1]
      : idStr;

    const cat = categories.find(c => c.key === item.recipeCategory);
    const tags = item.tags ?? [];
    const isUser = item.source === "user";
    const isAIGenerated = tags.includes("AI 生成");

    return (
      <RecipeCard
        item={{
          ...item,
          id: recipeId,
          _source: item.source,
        }}
        category={cat}
        isUser={isUser}
        isAIGenerated={isAIGenerated}
        tags={tags}
        activeTagFilters={activeTagFilters}
        setActiveTagFilters={setActiveTagFilters}
        setQuickPlanRecipe={handleQuickPlanRecipe}
        navigateToRecipe={handleNavigateToRecipe}
        showQuickPlan={false}
      />
    );
  };

  const renderFilterPill = (label: string, isActive: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[s.filterPill, isActive && s.filterPillActive]}
      onPress={onPress}
    >
      <Text style={[s.filterPillTxt, isActive && s.filterPillTxtActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Phase 1: Infinite scroll with anti-shake protection
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityLabel="返回"
        >
          <Ionicons name="arrow-back" size={24} color="#013E77" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{getTitle()}</Text>
        <View style={s.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
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
        
        {/* Sort Button */}
        <TouchableOpacity onPress={() => setSortBy(sortBy === "popular" ? "cookTime" : sortBy === "cookTime" ? "difficulty" : "popular")} style={s.sortBtn}>
          <Ionicons name={sortBy === "popular" ? "star-outline" : sortBy === "cookTime" ? "flame-outline" : "swap-horizontal-outline"} size={18} color="#013E77" />
        </TouchableOpacity>
        
        {/* Filter Button */}
        <TouchableOpacity onPress={() => setShowFilterSheet(true)} style={s.filterBtn}>
          <Ionicons name="filter-outline" size={18} color="#013E77" />
          {hasFilters && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>
                {(source !== "all" ? 1 : 0) + (activeCategory !== "all" ? 1 : 0) + activeTagFilters.length + activePopularChips.length + (filterCookTimeMax !== undefined ? 1 : 0)}
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
      {(activeCategory !== "all" || activeTagFilters.length > 0 || activePopularChips.length > 0 || filterCookTimeMax !== undefined) && (
        <View style={s.smartFilterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.smartFilterRow}>
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
            {filterCookTimeMax !== undefined && (
              <View style={s.smartToken}>
                <Text style={s.smartTokenTxt}>⏱ {filterCookTimeMax}分鐘內</Text>
                <TouchableOpacity onPress={() => setFilterCookTimeMax(undefined)}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
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
            {activeTagFilters.map(tag => (
              <View key={tag} style={s.smartToken}>
                <Text style={s.smartTokenTxt}>#{tag}</Text>
                <TouchableOpacity onPress={() => setActiveTagFilters(prev => prev.filter(t => t !== tag))}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.clearAllBtn} onPress={() => {
              setActiveCategory("all");
              setActiveTagFilters([]);
              setActivePopularChips([]);
              setFilterCookTimeMax(undefined);
            }}>
              <Text style={s.clearAllTxt}>清除全部</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Filter Pills */}
      {searchRecipes.length > 0 && (
        <View style={s.filterPillsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPillsContainer}>
            {renderFilterPill("全部", source === "all", () => setSource("all"))}
            {renderFilterPill("官方", source === "official", () => setSource("official"))}
            {renderFilterPill("網紅", source === "kol", () => setSource("kol"))}
            {renderFilterPill("我的", source === "user", () => setSource("user"))}
            
            <View style={s.filterDivider} />
            
            {TOP_TAGS.map(tag => 
              renderFilterPill(tag, activeTagFilters.includes(tag), () => handleTagFilterPress(tag))
            )}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#013E77" />
        </View>
      ) : searchRecipes.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="restaurant-outline" size={64} color="#D1D5DB" />
          <Text style={s.emptyTxt}>{getEmptyMessage()}</Text>
        </View>
      ) : (
        <FlatList
          data={searchRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRecipeCard}
          numColumns={2}
          contentContainerStyle={s.listContent}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={s.footerLoader}>
                <ActivityIndicator size="small" color="#013E77" />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor="#013E77"
            />
          }
        />
      )}

      {/* Filter Modal */}
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
        allUserTags={Array.from(new Set(searchRecipes.flatMap((r: any) => r.tags ?? [])))}
        setActivePopularChips={setActivePopularChips}
        activePopularChips={activePopularChips}
        setSortBy={setSortBy}
        viewMode={source}
        setViewMode={setSource}
        officialCount={officialCount}
        userCount={userCount}
        kolCount={kolCount}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1C1E",
  },
  headerRight: {
    width: 40,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    paddingVertical: 4,
  },
  sortBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#EEF4FB",
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#EEF4FB",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },
  searchHistoryWrap: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  searchHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  searchHistoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  searchHistoryClear: {
    fontSize: 12,
    color: "#013E77",
    fontWeight: "600",
  },
  searchHistoryList: {
    paddingVertical: 4,
  },
  searchHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchHistoryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchHistoryTerm: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
  },
  searchHistoryDivider: {
    height: 1,
    backgroundColor: "#F0EDE8",
    marginHorizontal: 14,
  },
  smartFilterWrap: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  smartFilterRow: {
    gap: 8,
    paddingRight: 16,
  },
  smartToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#013E77",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  smartTokenTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  clearAllTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  filterPillsWrap: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  filterPillsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterPillActive: {
    backgroundColor: "#013E77",
    borderColor: "#013E77",
  },
  filterPillTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  filterPillTxtActive: {
    color: "#fff",
  },
  filterDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTxt: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
    textAlign: "center",
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
  },
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
