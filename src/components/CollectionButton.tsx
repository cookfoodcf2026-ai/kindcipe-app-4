import { useState } from "react";
import { TouchableOpacity, StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

interface CollectionButtonProps {
  recipeId: string;
  recipeType: "official" | "custom";
  initialCollected?: boolean;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

export function CollectionButton({
  recipeId,
  recipeType,
  initialCollected = false,
  size = "medium",
  showLabel = false,
}: CollectionButtonProps) {
  const [isCollected, setIsCollected] = useState(initialCollected);
  const [isPending, setIsPending] = useState(false);

  const toggleMutation = trpc.recipes.toggleCollection.useMutation({
    onSuccess: (data) => {
      setIsCollected(data.collected);
      setIsPending(false);
    },
    onError: () => {
      setIsPending(false);
    },
  });

  const handlePress = () => {
    if (isPending) return;
    setIsPending(true);
    toggleMutation.mutate({ recipeId, recipeType });
  };

  const iconSize = size === "small" ? 18 : size === "large" ? 28 : 24;
  const containerStyle = size === "small" ? s.containerSmall : size === "large" ? s.containerLarge : s.container;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isPending}
      activeOpacity={0.7}
      style={containerStyle}
      accessibilityLabel={isCollected ? "Remove from collections" : "Add to collections"}
      accessibilityRole="button"
    >
      {isPending ? (
        <ActivityIndicator size="small" color={isCollected ? "#013E77" : "#8E8E93"} />
      ) : (
        <View style={s.iconWrapper}>
          <Ionicons
            name={isCollected ? "bookmark" : "bookmark-outline"}
            size={iconSize}
            color={isCollected ? "#013E77" : "#8E8E93"}
          />
        </View>
      )}
      {showLabel && (
        <Text style={[s.label, { fontSize: size === "small" ? 12 : 14 }]}>
          {isCollected ? "已收藏" : "收藏"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 6,
  },
  containerSmall: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
  },
  containerLarge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 8,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "600",
    color: "#013E77",
  },
});
