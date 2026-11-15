import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { getBilingualName, getLocalizedSteps } from "@/lib/bilingual";
import { enumT } from "@/lib/i18nEnums";
import { formatIngredientDisplay } from "@/src/lib/ingredientDisplay";
import { aiChefSourceLabelsEnabled } from "@/lib/featureFlags";
import { canva } from "@/app/styles/colors";

export type SheetIngredient = {
  name: string;
  nameEn?: string;
  nameFil?: string;
  nameId?: string;
  quantity: string;
  unit: string;
  category?: string;
};

export type SheetRecipe = {
  name: string;
  nameEn?: string;
  nameFil?: string;
  nameId?: string;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  ingredients: SheetIngredient[];
  steps: string[];
  stepsEn?: string[];
  stepsFil?: string[];
  stepsId?: string[];
  image?: string;
  thumbnailUrl?: string;
  source?: "official" | "custom" | "ai" | "library";
};

type Props = {
  visible: boolean;
  recipe: SheetRecipe | null;
  onClose: () => void;
  onAddToPlan?: () => void;
  onAddToShopping?: () => void;
  onFavorite?: () => void;
  favoritePending?: boolean;
  favoriteDisabled?: boolean;
};

export default function AiRecipeDetailSheet({
  visible,
  recipe,
  onClose,
  onAddToPlan,
  onAddToShopping,
  onFavorite,
  favoritePending,
  favoriteDisabled,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isZh = i18n.language === "zh";

  if (!recipe) return null;

  const name = getBilingualName(recipe.name, recipe.nameEn, recipe.nameFil, recipe.nameId);
  const steps = getLocalizedSteps(recipe.steps, recipe.stepsEn, recipe.stepsFil, recipe.stepsId);
  const sourceLabel = aiChefSourceLabelsEnabled
    ? recipe.source === "ai" ? "AI" : t("aiChef.sourceLibrary" as any)
    : recipe.source === "ai" ? "AI" : recipe.source === "custom" ? t("我的食譜" as any) : t("官方食譜" as any);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} testID="recipe-detail-sheet">
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={2}>{name.primary}</Text>
              {!isZh && name.secondary ? (
                <Text style={styles.titleSecondary} numberOfLines={1}>{name.secondary}</Text>
              ) : null}
              <View style={styles.metaRow}>
                {typeof recipe.cookTime === "number" && recipe.cookTime > 0 ? (
                  <Text style={styles.metaTxt}>{recipe.cookTime} {t("aiChef.unitMin" as any)}</Text>
                ) : null}
                {typeof recipe.servings === "number" && recipe.servings > 0 ? (
                  <Text style={styles.metaTxt}>{recipe.servings} {t("aiChef.unitServing" as any)}</Text>
                ) : null}
                {recipe.difficulty ? <Text style={styles.metaTxt}>{enumT.difficulty(recipe.difficulty)}</Text> : null}
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceTxt}>{sourceLabel}</Text>
                </View>
              </View>
            </View>
            {onFavorite ? (
              <Pressable
                testID="recipe-detail-favorite"
                onPress={onFavorite}
                disabled={favoriteDisabled || favoritePending}
                style={[styles.iconBtn, (favoriteDisabled || favoritePending) && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                {favoritePending ? <ActivityIndicator size="small" color={canva.primary} /> : <Ionicons name="heart-outline" size={22} color={canva.primary} />}
              </Pressable>
            ) : null}
            <Pressable testID="recipe-detail-close" onPress={onClose} style={styles.iconBtn} accessibilityRole="button">
              <Ionicons name="close" size={22} color={canva.primary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.sectionTitle}>{t("aiChef.ingredients" as any)}</Text>
            {recipe.ingredients.map((ing, i) => {
              const bn = getBilingualName(ing.name, ing.nameEn, ing.nameFil, ing.nameId);
              const amount = formatIngredientDisplay(ing.quantity, ing.unit);
              return (
                <View key={`ing-${i}`} style={styles.ingRow} testID={`recipe-detail-ingredient-${i}`}>
                  <View style={styles.dot} />
                  <Text style={styles.ingTxt}>
                    {bn.secondary && !isZh ? `${bn.primary} (${bn.secondary})` : bn.primary}
                    {amount ? `  ${amount}` : ""}
                  </Text>
                </View>
              );
            })}

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{t("aiChef.steps" as any)}</Text>
            {steps.length > 0 ? (
              steps.map((step, i) => (
                <View key={`step-${i}`} style={styles.stepRow} testID={`recipe-detail-step-${i}`}>
                  <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{i + 1}</Text></View>
                  <Text style={styles.stepTxt}>{step}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyTxt}>{t("aiChef.noSteps" as any)}</Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {onAddToShopping ? (
              <Pressable
                testID="recipe-detail-shopping"
                onPress={onAddToShopping}
                style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryTxt}>{t("aiChef.addToShoppingList" as any)}</Text>
              </Pressable>
            ) : null}
            {onAddToPlan ? (
              <Pressable
                testID="recipe-detail-plan"
                onPress={onAddToPlan}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryTxt}>{t("aiChef.addToPlan" as any)}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(24,59,86,0.32)", justifyContent: "flex-end" },
  backdropFill: { flex: 1 },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E6DED4", alignSelf: "center", marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: "900", color: canva.primary, lineHeight: 25 },
  titleSecondary: { fontSize: 12, color: canva.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 },
  metaTxt: { fontSize: 11, fontWeight: "700", color: canva.muted },
  sourceBadge: { backgroundColor: "#E8F0F4", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  sourceTxt: { fontSize: 9, fontWeight: "800", color: "#5F6F80" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { paddingTop: 8, paddingBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: canva.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  ingRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: canva.muted, marginTop: 8 },
  ingTxt: { flex: 1, fontSize: 13, color: "#183B56", lineHeight: 20 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F0F4", alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumTxt: { fontSize: 11, fontWeight: "800", color: canva.primary },
  stepTxt: { flex: 1, fontSize: 14, color: "#183B56", lineHeight: 21 },
  emptyTxt: { fontSize: 13, color: canva.muted },
  actions: { flexDirection: "row", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEE7DE" },
  secondary: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: canva.border },
  secondaryTxt: { fontSize: 14, fontWeight: "800", color: canva.muted, textAlign: "center" },
  primary: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, backgroundColor: canva.action },
  primaryTxt: { fontSize: 14, fontWeight: "900", color: canva.textOnAccent, textAlign: "center" },
});
