import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { CollectionButton } from "@/src/components/CollectionButton";

type SourceType = "official" | "kol" | "user" | "all";

interface RecipeCard {
  id: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  image?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  source?: "official" | "user";
  sourceType?: string;
  sourceAuthor?: string | null;
}

export default function RecipesPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const source = ((params.source as SourceType) || "all") as SourceType;
  const [refreshing, setRefreshing] = useState(false);

  // Fetch KOL recipes
  const {
    data: kolRecipes = [],
    isLoading: isKolLoading,
    refetch: refetchKol,
  } = trpc.recipes.listKol.useQuery(
    { limit: 50 },
    { enabled: source === "kol" }
  );

  // Fetch official recipes
  const {
    data: officialRecipes = [],
    isLoading: isOfficialLoading,
    refetch: refetchOfficial,
  } = trpc.recipes.listOfficial.useQuery(
    { limit: 50 },
    { enabled: source === "official" }
  );

  // Fetch user recipes
  const {
    data: userRecipes = [],
    isLoading: isUserLoading,
    refetch: refetchUser,
  } = trpc.recipes.listUser.useQuery(
    { limit: 50 },
    { enabled: source === "user" }
  );

  const recipes = source === "kol" ? kolRecipes : source === "official" ? officialRecipes : source === "user" ? userRecipes : [];
  const isLoading = source === "kol" ? isKolLoading : source === "official" ? isOfficialLoading : source === "user" ? isUserLoading : false;

  const onRefresh = () => {
    setRefreshing(true);
    if (source === "kol") refetchKol();
    else if (source === "official") refetchOfficial();
    else if (source === "user") refetchUser();
    setTimeout(() => setRefreshing(false), 500);
  };

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

  const renderRecipeCard = ({ item }: { item: RecipeCard }) => {
    const recipeType = item.source === "official" ? "official" : "custom";
    const idStr = String(item.id);
    const recipeId = idStr.startsWith("official_") || idStr.startsWith("user_")
      ? idStr.split("_")[1]
      : idStr;

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/recipe/${idStr}`)}
        activeOpacity={0.8}
      >
        <View style={s.cardImageWrap}>
          <Image
            source={{ uri: (item.thumbnailUrl || item.image || "")! }}
            style={s.cardImage}
            contentFit="cover"
          />
          {item.sourceType && item.sourceType !== "manual" && item.sourceType !== "kol" && (
            <View style={s.sourceBadge}>
              <Text style={s.sourceBadgeText}>
                {item.sourceType === "instagram" ? "IG" : item.sourceType === "youtube" ? "YT" : item.sourceType === "xiaohongshu" ? "小紅書" : item.sourceType}
              </Text>
            </View>
          )}
          {item.sourceType === "kol" && (
            <View style={s.kolBadge}>
              <Text style={s.kolBadgeText}>🌟 網紅</Text>
            </View>
          )}
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>
          {item.sourceAuthor && (
            <Text style={s.cardAuthor} numberOfLines={1}>
              👨‍🍳 {item.sourceAuthor}
            </Text>
          )}
          <View style={s.cardMeta}>
            {item.cookTime && (
              <Text style={s.cardMetaItem}>⏱ {item.cookTime} 分鐘</Text>
            )}
            {item.servings && (
              <Text style={s.cardMetaItem}>🍽️ {item.servings} 人</Text>
            )}
          </View>
          <View style={s.cardActions}>
            <CollectionButton
              recipeId={recipeId}
              recipeType={recipeType}
              size="small"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
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

      {/* List */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#013E77" />
        </View>
      ) : recipes.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="restaurant-outline" size={64} color="#D1D5DB" />
          <Text style={s.emptyTxt}>{getEmptyMessage()}</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRecipeCard}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#013E77"
            />
          }
        />
      )}
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
    paddingVertical: 16,
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
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageWrap: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 180,
  },
  sourceBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  kolBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#FFF3D6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  kolBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#013E77",
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    lineHeight: 22,
  },
  cardAuthor: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  cardMetaItem: {
    fontSize: 12,
    color: "#8E8E93",
  },
  cardActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0EDE8",
  },
});
