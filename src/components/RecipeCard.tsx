import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, useWindowDimensions } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";
import { getRecipeCardImageRatio } from "@/lib/recipe-card-layout";
import { getRecipeLocalImage } from "@/lib/recipe-local-images";
import { resolveImageUrl } from "@/lib/trpc";

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
  onPress?: () => void;
  /** 是否顯示快速排餐按鈕（日曆 icon）。設為 true 可重新啟用此功能。 */
  showQuickPlan?: boolean;
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
  onPress,
  showQuickPlan = false, // 預設隱藏快速排餐按鈕
}: RecipeCardProps) {
  const { height: screenHeight } = useWindowDimensions();
  const imageRatio = getRecipeCardImageRatio(screenHeight);
  const catColor = category ? getCategoryColor(category.key) : getCategoryColor("其他");

  // Remote image from backend (R2) is PRIMARY. Local require is only a fallback
  // when the backend has no thumbnailUrl (e.g. offline / older data).
  const localImage = getRecipeLocalImage(item.name);
  const imageUrl = resolveImageUrl(item.thumbnailUrl || item.image);
  const hasImage = imageUrl || !!localImage;

  // Track image load error to fall back to placeholder
  const [hasImageError, setHasImageError] = React.useState(false);

  return (
    <TouchableOpacity style={s.card} onPress={onPress ?? (() => navigateToRecipe(item))} activeOpacity={0.85}>
      {/* ── Image / Placeholder ── */}
      {hasImage && !hasImageError
        ? imageUrl
          ? <ExpoImage source={{ uri: imageUrl }} style={[s.cardImg, { height: CARD_WIDTH * imageRatio }]} contentFit="cover" cachePolicy="disk" onError={() => setHasImageError(true)} />
          : <ExpoImage source={localImage} style={[s.cardImg, { height: CARD_WIDTH * imageRatio }]} contentFit="cover" cachePolicy="disk" onError={() => setHasImageError(true)} />
        : (
          <View style={[s.cardImg, { height: CARD_WIDTH * imageRatio }, s.cardImgPH, { backgroundColor: catColor.bg }]}> 
            <View style={s.textCoverContent}>
              <Text style={s.textCoverTitle} numberOfLines={3}>{item.name}</Text>
              <Text style={s.textCoverSub}>{isAIGenerated ? "AI 生成" : isUser ? "我的" : "官方食譜"}</Text>
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
        {Boolean(item.isAd || item.isSponsored || item.sponsored || item.promoted || item.ad) && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeTxt}>🔥 熱門</Text>
          </View>
        )}
      </View>
      
      {/* ── Quick Plan Button ── 暫時隱藏（2026-08-09）：保留代碼方便將來重新啟用 */}
      {showQuickPlan && (
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
      )}

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
          {item.servings ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="people-outline" size={12} color="#9CA3AF" />
              <Text style={s.cardMetaTxt}>{item.servings}人</Text>
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
              const trimmedTag = tag.trim();
              if (!trimmedTag) return null;
              const isActive = activeTagFilters.includes(trimmedTag);
              return (
                <TouchableOpacity
                  key={trimmedTag}
                  style={[s.cardTag, isActive && s.cardTagActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveTagFilters(prev =>
                      prev.includes(trimmedTag) ? prev.filter(t => t !== trimmedTag) : [...prev, trimmedTag]
                    );
                  }}
                >
                  <Text style={[s.cardTagTxt, isActive && s.cardTagTxtActive]}>#{trimmedTag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
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
    backgroundColor: "#F5F5F5",
  },
  cardImgPH: {
    alignItems: "center",
    justifyContent: "center",
  },
  textCoverContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  textCoverTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND,
    textAlign: "center",
    lineHeight: 24,
  },
  textCoverSub: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: BRAND,
    opacity: 0.75,
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
