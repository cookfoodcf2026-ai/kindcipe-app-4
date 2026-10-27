import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, useWindowDimensions } from "react-native";
import { typography } from "@/app/styles/typography";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";
import { getRecipeCardImageRatio } from "@/lib/recipe-card-layout";
import { getRecipeLocalImage } from "@/lib/recipe-local-images";
import { getBilingualName } from "@/lib/bilingual";
import { useTranslation } from "react-i18next";
import { useEnum } from "@/lib/i18nEnums";
import { resolveImageUrl } from "@/lib/trpc";
import { canva } from "@/app/styles/colors";

const BRAND = canva.primary;
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
  setQuickPlanRecipe: (recipe: { id: string; name: string; nameEn?: string; nameFil?: string; nameId?: string; image?: string; ingredients?: any[] } | null) => void;
  navigateToRecipe: (item: any) => void;
  onPress?: () => void;
  /** 是否顯示快速排餐按鈕（日曆 icon）。設為 true 可重新啟用此功能。 */
  showQuickPlan?: boolean;
  /** Optional responsive width; defaults to the legacy two-column width. */
  width?: number;
}

export default function RecipeCard(
  {
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
  width,
}: RecipeCardProps) {
  const { t } = useTranslation();
  const enu = useEnum();
  const { height: screenHeight } = useWindowDimensions();
  const imageRatio = getRecipeCardImageRatio(screenHeight);
  const cardWidth = width ?? CARD_WIDTH;
  const catColor = category ? getCategoryColor(category.key) : getCategoryColor("其他");
  const visibleTags = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => ({ raw: tag, label: enu.tag(tag) }))
    .filter((tag) => !!tag.label)
    .slice(0, 2);

  // Remote image from backend (R2) is PRIMARY. Local require is only a fallback
  // when the backend has no thumbnailUrl (e.g. offline / older data).
  const localImage = getRecipeLocalImage(item.name);
  const imageUrl = resolveImageUrl(item.thumbnailUrl || item.image);
  const hasImage = imageUrl || !!localImage;

  // Track image load error to fall back to placeholder
  const [hasImageError, setHasImageError] = React.useState(false);

  // Use memory-disk cache for aggressive offline caching
  const imageProps = {
    contentFit: "cover" as const,
    cachePolicy: "memory-disk" as const,
    transition: 200,
    recyclingKey: item.id || item.name,
  };

  return (
    <TouchableOpacity style={[s.card, { width: cardWidth }]} onPress={onPress ?? (() => navigateToRecipe(item))} activeOpacity={0.85}>
      {/* ── Image / Placeholder ── */}
      {hasImage && !hasImageError
        ? imageUrl
          ? (
            <ExpoImage
              source={{ uri: imageUrl }}
              style={[s.cardImg, { width: cardWidth, height: cardWidth * imageRatio }]}
              {...imageProps}
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ExpoImage
              source={localImage}
              style={[s.cardImg, { width: cardWidth, height: cardWidth * imageRatio }]}
              {...imageProps}
              onError={() => setHasImageError(true)}
            />
          )
        : (
          <View style={[s.cardImg, { width: cardWidth, height: cardWidth * imageRatio }, s.cardImgPH, { backgroundColor: catColor.bg }]}>
            <View style={s.textCoverContent}>
              <Text style={s.textCoverTitle} numberOfLines={3}>{getBilingualName(item.name, item.nameEn, item.nameFil, item.nameId).primary}</Text>
              <Text style={s.textCoverSub}>{isAIGenerated ? t("dyn.aiGen") : isUser ? t("card.mine") : t("dyn.officialRecipe")}</Text>
            </View>
          </View>
        )
      }

      {/* ─ Badges ── */}
      <View style={s.cardBadges}>
        {isUser && !(item as any).isKol && (
          <View style={s.sourceBadge}>
            <Text style={s.sourceBadgeTxt}>{t("card.mine")}</Text>
          </View>
        )}
        {(item as any).isKol && (
          <View style={s.kolBadge}>
            <Text style={s.kolBadgeTxt}>{t("card.kol")}</Text>
          </View>
        )}
        {isAIGenerated && (
          <View style={s.aiBadgeCorner}>
            <Text style={s.aiBadgeCornerTxt}>AI</Text>
          </View>
        )}
        {Boolean(item.isAd || item.isSponsored || item.sponsored || item.promoted || item.ad) && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeTxt}>{t("card.hot")}</Text>
          </View>
        )}
      </View>

      {/* ── Quick Plan Button ── 暫時隱藏（2026-08-09）：保留代碼方便將來重新啟用 */}
      {showQuickPlan && (
        <TouchableOpacity
          style={s.cardPlanBtn}
          onPress={(e) => {
            e.stopPropagation();
            setQuickPlanRecipe({ id: item.id, name: item.name, nameEn: item.nameEn, nameFil: item.nameFil, nameId: item.nameId, image: item.thumbnailUrl || item.image, ingredients: item.ingredients });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Card Info ── */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={2}>{getBilingualName(item.name, item.nameEn, item.nameFil, item.nameId).primary}</Text>
        {(() => { const sec = getBilingualName(item.name, item.nameEn, item.nameFil, item.nameId).secondary; return sec ? <Text style={s.cardNameEn} numberOfLines={1}>{sec}</Text> : null; })()}
        {item.sourceAuthor ? (
          <Text style={s.cardAuthor} numberOfLines={1}>by {item.sourceAuthor}</Text>
        ) : null}

        <View style={s.cardMeta}>
          {item.cookTime ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="time-outline" size={12} color="#8A99A8" />
              <Text style={s.cardMetaTxt}>{item.cookTime}{t("recipe.min")}</Text>
            </View>
          ) : null}
          {item.difficulty ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="flame-outline" size={12} color="#8A99A8" />
              <Text style={s.cardMetaTxt}>{enu.difficulty(item.difficulty)}</Text>
            </View>
          ) : null}
          {item.servings ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="people-outline" size={12} color="#8A99A8" />
              <Text style={s.cardMetaTxt}>{item.servings}{t("recipe.servingsUnit")}</Text>
            </View>
          ) : null}
          {category?.emoji && (
            <View style={s.cardMetaItem}>
              <Text style={{ fontSize: 12 }}>{category.emoji}</Text>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        {visibleTags.length > 0 && (
          <View style={s.cardTags}>
            {visibleTags.map((tag) => {
              const isActive = activeTagFilters.includes(tag.raw);
              return (
                <TouchableOpacity
                  key={tag.raw}
                  style={[s.cardTag, isActive && s.cardTagActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveTagFilters(prev =>
                      prev.includes(tag.raw) ? prev.filter(t => t !== tag.raw) : [...prev, tag.raw]
                    );
                  }}
                >
                  <Text style={[s.cardTagTxt, isActive && s.cardTagTxtActive]}>#{tag.label}</Text>
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
  "西餐": { bg: "#EFF6FF", text: "#183B56" },
  "日式": { bg: "#FFF0F6", text: "#BE185D" },
  "韓式": { bg: "#FFF7ED", text: "#C2410C" },
  "東南亞": { bg: "#F0FDF4", text: "#15803D" },
  "甜品": { bg: "#FEFCE8", text: "#A16207" },
  "飲品": { bg: "#E8F0F4", text: "#183B56" },
  "其他": { bg: "#F8F1E7", text: "#5F6F80" },
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
    borderColor: "#E6DED4",
  },
  cardImg: {
    width: "100%",
    backgroundColor: "#FFF8EF",
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
    ...typography.h3,
    color: BRAND,
    textAlign: "center",
  },
  textCoverSub: {
    ...typography.meta,
    marginTop: 8,
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
    color: "#fff",    letterSpacing: 0.5,
  },
  kolBadge: {
    backgroundColor: "rgba(124, 58, 237, 0.92)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  kolBadgeTxt: {
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
    ...typography.cardTitle,
    color: "#183B56",
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
    ...typography.meta,
    color: "#8A99A8",
    marginBottom: 6,
    fontStyle: "italic",
  },
  cardAuthor: { ...typography.meta, color: "#183B56", fontWeight: "600", marginBottom: 6 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    rowGap: 4,
    marginBottom: 6,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardMetaTxt: {
    ...typography.meta,
    color: "#5F6F80",
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
    backgroundColor: "#E8F0F4",
    borderWidth: 1,
    borderColor: "#E6DED4",
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
    ...typography.meta,
    color: BRAND,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardTagTxtActive: {
    color: "#fff",
    letterSpacing: 0.3,
  },
});
