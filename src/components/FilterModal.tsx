import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";

const BRAND = "#013E77";

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  categories: CategoryDef[];
  filterCookTimeMax: number | undefined;
  setFilterCookTimeMax: (time: number | undefined) => void;
  activeTagFilters: string[];
  setActiveTagFilters: (tags: string[] | ((prev: string[]) => string[])) => void;
  allUserTags: string[];
  setActivePopularChips: (chips: string[] | ((prev: string[]) => string[])) => void;
  setSortBy: (sort: "popular" | "cookTime" | "difficulty") => void;
}

const ALL_ENTRY: CategoryDef = { key: "all", label: "全部", emoji: "" };

export default function FilterModal({
  visible,
  onClose,
  activeCategory,
  setActiveCategory,
  categories,
  filterCookTimeMax,
  setFilterCookTimeMax,
  activeTagFilters,
  setActiveTagFilters,
  allUserTags,
  setActivePopularChips,
  setSortBy,
}: FilterModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.filterOverlay}>
        <View style={[s.filterSheet, { paddingBottom: Platform.OS === "ios" ? 44 : 24 }]}>
          <View style={s.filterHandle} />
          <View style={s.filterHeader}>
            <Text style={s.filterTitle}>篩選食譜</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: "80%" }} showsVerticalScrollIndicator={false}>
            {/* Category Filter */}
            <Text style={s.filterLabel}>分類</Text>
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
                setFilterCookTimeMax(undefined);
                setActiveTagFilters([]);
                setActivePopularChips([]);
                setSortBy("popular");
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
});
