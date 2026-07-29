import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";

const BRAND = "#013E77";
const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 14 - 14 - CARD_GAP) / 2;

interface RecipeCardProps {
  item: any;
  category?: CategoryDef;
  isUser: boolean;
  isAIGenerated: boolean;
  tags: string[];
  activeTagFilters: string[];
  setActiveTagFilters: (tags: string[] | ((prev: string[]) => string[])) => void;
  setQuickPlanRecipe: (recipe: { id: string; name: string; image?: string; ingredients?: any[] } | null) => void;
  navigateToRecipe: (item: any) => void;
}

export default function RecipeCard({
  item,
  category,
  isUser,
  isAIGenerated,
  tags,
  activeTagFilters,
  setActiveTagFilters,
  setQuickPlanRecipe,
  navigateToRecipe,
}: RecipeCardProps) {
  const catColor = category ? getCategoryColor(category.key) : getCategoryColor("其他");

  // Check if image is a local asset
  const getLocalImage = (recipeName: string) => {
    const nameMap: Record<string, any> = {
      '番茄炒蛋': require('@/assets/recipes/scrambled-eggs-tomatoes.png'),
      '蒜蓉炒菜心': require('@/assets/recipes/garlic-choy-sum.png'),
      '紅燒肉': require('@/assets/recipes/braised-pork-belly.png'),
      '宮保雞丁': require('@/assets/recipes/kung-pao-chicken.png'),
      '麻婆豆腐': require('@/assets/recipes/mapo-tofu.png'),
      '糖醋排骨': require('@/assets/recipes/sweet-sour-ribs.png'),
      '清蒸鱸魚': require('@/assets/recipes/steamed-sea-bass.png'),
      '豉油王炒麵': require('@/assets/recipes/soy-sauce-noodles.png'),
      '臘味煲仔飯': require('@/assets/recipes/claypot-rice.png'),
      '紅蘿蔔粟米豬骨湯': require('@/assets/recipes/carrot-corn-soup.png'),
      '回鍋肉': require('@/assets/recipes/twice-cooked-pork.png'),
      '干煸四季豆': require('@/assets/recipes/dry-fried-beans.png'),
      '蝦仁炒蛋': require('@/assets/recipes/shrimp-scrambled-eggs.png'),
      '梅菜扣肉': require('@/assets/recipes/preserved-vegetable-pork.png'),
      '薑蔥蒸雞': require('@/assets/recipes/steamed-chicken.png'),
      '魚香茄子': require('@/assets/recipes/fish-fragrant-eggplant.png'),
      '腐乳通菜': require('@/assets/recipes/fermented-water-spinach.png'),
      '鹽焗雞翼': require('@/assets/recipes/salt-baked-wings.png'),
      '蠔油冬菇炆雞': require('@/assets/recipes/braised-chicken-mushroom.png'),
      '榨菜肉絲湯米粉': require('@/assets/recipes/rice-noodle-soup.png'),
    };
    return nameMap[recipeName];
  };

  const localImage = getLocalImage(item.name);
  const imageUrl = item.thumbnailUrl || item.image;
  const hasImage = localImage || imageUrl;

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => navigateToRecipe(item)} activeOpacity={0.85}>
        {/* ── Image / Placeholder ── */}
        {hasImage
          ? localImage
            ? <Image source={localImage} style={s.cardImg} resizeMode="cover" />
            : <Image source={{ uri: imageUrl }} style={s.cardImg} resizeMode="cover" />
          : (
            <View style={[s.cardImg, s.cardImgPH, { backgroundColor: catColor.bg }]}>
              <View style={s.placeholderContent}>
                <Text style={s.placeholderEmoji}>{category?.emoji || "🍽️"}</Text>
              </View>
            </View>
          )
        }
        
        {/* ─ Badges ── */}
        <View style={s.cardBadges}>
          {isUser && (
            <View style={s.sourceBadge}>
              <Text style={s.sourceBadgeTxt}>我的</Text>
            </View>
          )}
          {isAIGenerated && (
            <View style={s.aiBadgeCorner}>
              <Text style={s.aiBadgeCornerTxt}>AI</Text>
            </View>
          )}
          {(item.popularity ?? 0) > 80 && (
            <View style={s.hotBadge}>
              <Text style={s.hotBadgeTxt}>🔥 熱門</Text>
            </View>
          )}
        </View>
        
        {/* ── Quick Plan Button ── */}
        <TouchableOpacity
          style={s.cardPlanBtn}
          onPress={(e) => {
            e.stopPropagation();
            setQuickPlanRecipe({ id: item.id, name: item.name, image: item.thumbnailUrl || item.image, ingredients: item.ingredients });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* ── Card Info ── */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
        {item.nameEn ? <Text style={s.cardNameEn} numberOfLines={1}>{item.nameEn}</Text> : null}
        
        <View style={s.cardMeta}>
          {item.cookTime ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={s.cardMetaTxt}>{item.cookTime}分</Text>
            </View>
          ) : null}
          {item.difficulty ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="flame-outline" size={12} color="#9CA3AF" />
              <Text style={s.cardMetaTxt}>{item.difficulty}</Text>
            </View>
          ) : null}
          {category?.emoji && (
            <View style={s.cardMetaItem}>
              <Text style={{ fontSize: 12 }}>{category.emoji}</Text>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <View style={s.cardTags}>
            {tags.slice(0, 2).map((tag) => {
              const isActive = activeTagFilters.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[s.cardTag, isActive && s.cardTagActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveTagFilters(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    );
                  }}
                >
                  <Text style={[s.cardTagTxt, isActive && s.cardTagTxtActive]}>#{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

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

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  cardImg: {
    width: "100%",
    height: CARD_WIDTH * 0.8,
    backgroundColor: "#F5F5F5",
  },
  cardImgPH: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 42,
    opacity: 0.8,
  },
  cardBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 6,
  },
  sourceBadge: {
    backgroundColor: "rgba(1, 62, 119, 0.9)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sourceBadgeTxt: {
    fontSize: 9,
    fontWeight: "800",
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
  hotBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.95)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  hotBadgeTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
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
});
