import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";

const BRAND = "#013E77";

interface FilterModalProps {
  visible: boolean;
  inline?: boolean;
  onClose: () => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  categories: CategoryDef[];
  activeIngredientCategory: string | undefined;
  setActiveIngredientCategory: (cat: string | undefined) => void;
  filterCookTimeMax: number | undefined;
  setFilterCookTimeMax: (time: number | undefined) => void;
  activeTagFilters: string[];
  setActiveTagFilters: (tags: string[] | ((prev: string[]) => string[])) => void;
  allUserTags: string[];
  setActivePopularChips: (chips: string[] | ((prev: string[]) => string[])) => void;
  activePopularChips: string[];
  setSortBy: (sort: "popular" | "cookTime" | "difficulty") => void;
  viewMode: "all" | "official" | "user";
  setViewMode: (mode: "all" | "official" | "user") => void;
  officialCount?: number;
  userCount?: number;
}

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

export default function FilterModal({
  visible,
  inline = false,
  onClose,
  activeCategory,
  setActiveCategory,
  categories,
  activeIngredientCategory,
  setActiveIngredientCategory,
  filterCookTimeMax,
  setFilterCookTimeMax,
  activeTagFilters,
  setActiveTagFilters,
  allUserTags,
  setActivePopularChips,
  activePopularChips,
  setSortBy,
  viewMode,
  setViewMode,
  officialCount,
  userCount,
}: FilterModalProps) {
  const content = (
    <View style={[s.filterSheet, { paddingBottom: Platform.OS === "ios" ? 44 : 24 }]}>
      <View style={s.filterHandle} />
      <View style={s.filterHeader}>
        <Text style={s.filterTitle}>篩選食譜</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: "75%" }} showsVerticalScrollIndicator={false}>
        {/* Recipe Source Filter */}
        <Text style={s.filterLabel}>食譜來源</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterSourceRow}>
          {[
            { key: "all", label: "全部食譜", count: officialCount !== undefined && userCount !== undefined ? officialCount + userCount : undefined },
            { key: "official", label: "官方食譜", count: officialCount },
            { key: "user", label: "我的食譜", count: userCount },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[
                s.filterSourceChip,
                viewMode === opt.key && s.filterSourceChipActive
              ]}
              onPress={() => setViewMode(opt.key as "all" | "official" | "user")}
            >
              <Text style={[
                s.filterSourceChipTxt,
                viewMode === opt.key && s.filterSourceChipTxtActive
              ]}>{opt.label}</Text>
              {opt.count !== undefined && (
                <View style={[s.filterSourceCount, viewMode === opt.key && s.filterSourceCountActive]}>
                  <Text style={[s.filterSourceCountTxt, viewMode === opt.key && s.filterSourceCountTxtActive]}>{opt.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Filter */}
        <Text style={s.filterLabel}>菜式分類</Text>
        <View style={s.filterCategoryRow}>
          {[ALL_ENTRY, ...categories].map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[
                s.filterCategoryChip,
                activeCategory === cat.key && s.filterCategoryChipActive
              ]}
              onPress={() => setActiveCategory(cat.key)}
            >
              {cat.key === "all" ? (
                <Ionicons name="apps-outline" size={16} color={activeCategory === cat.key ? "#fff" : "#666"} />
              ) : (
                <Text style={s.filterCategoryChipEmoji}>{cat.emoji}</Text>
              )}
              <Text style={[
                s.filterCategoryChipTxt,
                activeCategory === cat.key && s.filterCategoryChipTxtActive
              ]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ingredient Category Filter */}
        <Text style={s.filterLabel}>食材分類</Text>
        <View style={s.filterIngCatRow}>
          {[
            { key: undefined, label: "全部" },
            { key: "meat", label: "🥩 肉類" },
            { key: "seafood", label: "🐟 海鮮" },
            { key: "vegetable", label: "🥬 蔬菜" },
            { key: "tofu", label: "🍲 豆製品" },
            { key: "egg", label: "🥚 蛋類" },
            { key: "mushroom", label: "🍄 菌菇" },
            { key: "carb", label: "🍚 主食" },
          ].map(cat => (
            <TouchableOpacity
              key={cat.key ?? "all"}
              style={[
                s.filterIngCatChip,
                activeIngredientCategory === cat.key && s.filterIngCatChipActive
              ]}
              onPress={() => setActiveIngredientCategory(cat.key)}
            >
              <Text style={[
                s.filterIngCatChipTxt,
                activeIngredientCategory === cat.key && s.filterIngCatChipTxtActive
              ]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Filters (Popular Chips) */}
        <Text style={s.filterLabel}>快捷篩選</Text>
        <View style={s.filterQuickRow}>
          {[
            { key: "quick15", label: "⚡ 15 分鐘內" },
            { key: "quick30", label: "⏱ 30 分鐘內" },
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
          ].map(chip => {
            const isActive = activePopularChips.includes(chip.key);
            return (
              <TouchableOpacity
                key={chip.key}
                style={[s.filterQuickChip, isActive && s.filterQuickChipActive]}
                onPress={() => {
                  setActivePopularChips(prev =>
                    prev.includes(chip.key) ? prev.filter(k => k !== chip.key) : [...prev, chip.key]
                  );
                }}
              >
                <Text style={[s.filterQuickChipTxt, isActive && s.filterQuickChipTxtActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cook Time Filter */}
        <Text style={s.filterLabel}>烹調時間</Text>
        <View style={s.filterTimeRow}>
          {[
            { label: "不限", value: undefined },
            { label: " 30 分鐘內", value: 30 },
            { label: "⏱ 45 分鐘內", value: 45 },
            { label: "⏱ 60 分鐘內", value: 60 },
          ].map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[
                s.filterTimeChip,
                filterCookTimeMax === opt.value && s.filterTimeChipActive
              ]}
              onPress={() => setFilterCookTimeMax(opt.value)}
            >
              <Text style={[
                s.filterTimeChipTxt,
                filterCookTimeMax === opt.value && s.filterTimeChipTxtActive
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tags Filter */}
        {allUserTags.length > 0 && (
          <>
            <Text style={s.filterLabel}>標籤</Text>
            <View style={s.filterTagsRow}>
              <TouchableOpacity
                style={[s.filterTagChip, activeTagFilters.length === 0 && s.filterTagChipActive]}
                onPress={() => setActiveTagFilters([])}
              >
                <Text style={[s.filterTagChipTxt, activeTagFilters.length === 0 && s.filterTagChipTxtActive]}>不限</Text>
              </TouchableOpacity>
              {allUserTags.slice(0, 30).map(tag => {
                const isActive = activeTagFilters.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[s.filterTagChip, isActive && s.filterTagChipActive]}
                    onPress={() => {
                      setActiveTagFilters(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                  >
                    <Text style={[s.filterTagChipTxt, isActive && s.filterTagChipTxtActive]}>#{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={s.filterActions}>
        <TouchableOpacity
          style={s.filterResetBtn}
          onPress={() => {
            setActiveCategory("all");
            setActiveIngredientCategory(undefined);
            setFilterCookTimeMax(undefined);
            setActiveTagFilters([]);
            setActivePopularChips([]);
            setSortBy("popular");
            setViewMode("all");
          }}
        >
          <Ionicons name="refresh-outline" size={18} color="#666" />
          <Text style={s.filterResetBtnTxt}>重置</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.filterConfirmBtn}
          onPress={onClose}
        >
          <Text style={s.filterConfirmBtnTxt}>完成</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  if (inline) {
    return (
      <View style={s.inlineRoot} pointerEvents="box-none">
        <TouchableOpacity style={s.inlineBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.inlineSheetWrap}>{content}</View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.filterOverlay}>
        {content}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  inlineRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  inlineBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  inlineSheetWrap: {
    flex: 1,
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
  filterIngCatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterIngCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterIngCatChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterIngCatChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterIngCatChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  filterSourceRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingRight: 10,
  },
  filterSourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterSourceChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterSourceChipTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  filterSourceChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  filterSourceCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginLeft: 4,
  },
  filterSourceCountActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterSourceCountTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },
  filterSourceCountTxtActive: {
    color: "#fff",
  },
  filterQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  filterQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  filterQuickChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  filterQuickChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterQuickChipTxtActive: {
    color: "#fff",
    fontWeight: "700",
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
});
