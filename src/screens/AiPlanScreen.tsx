import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { apiClient, resolveImageUrl, trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { DateUtil } from "@/src/lib/DateUtil";
import { aiPlanEnabled } from "@/lib/featureFlags";
import { calcAdjustedQty } from "@/constants/ingredients";
import { sanitizeIngredients } from "@/lib/ingredientSanitize";
import { friendlyError } from "@/lib/errors";
import type { QuickPlanRecipe, QuickPlanSuggestOutput } from "@/lib/router-types";

const BRAND = "#013E77";
const CORAL = "#FF7A3D";
const TEXT = "#1A1A1A";
const SUB = "#6B7280";
const BORDER = "#E8E1D6";

function keyOf(date: string, recipe: QuickPlanRecipe, index: number) {
  return `${date}:${recipe.recipeId ?? recipe.name}:${index}`;
}

export default function AiPlanScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ startDate?: string }>();
  const { familyRole, activeFamily } = useAuth();
  const utils = trpc.useUtils();
  const today = DateUtil.todayISO();
  const startDate = params.startDate && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
    ? params.startDate
    : today;
  const servings = Math.max(2, Math.min(8, activeFamily?.members?.length ?? 4));
  const [data, setData] = useState<QuickPlanSuggestOutput | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<{ date: string; recipe: QuickPlanRecipe } | null>(null);
  const requestId = useRef(0);
  const canPlan = familyRole === "owner" || familyRole === "admin";

  const load = useCallback(async () => {
    if (!aiPlanEnabled || !canPlan) return;
    const id = ++requestId.current;
    const startedAt = Date.now();
    setLoading(true);
    setError("");
    try {
      const result = (await apiClient.quickPlan.suggest.mutate({
        startDate,
        days: 2,
        servings,
      })) as QuickPlanSuggestOutput;
      if (id !== requestId.current) return;
      console.log(`[AiPlan] suggestMs=${Date.now() - startedAt} days=${result.days.length}`);
      setData(result);
      const next = new Set<string>();
      result.days.forEach((day) => {
        day.recipes.forEach((recipe, index) => next.add(keyOf(day.date, recipe, index)));
      });
      setSelected(next);
    } catch (e) {
      if (id !== requestId.current) return;
      setData(null);
      setError(friendlyError(e) || i18n.t("排餐失敗" as any));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [canPlan, servings, startDate]);

  useEffect(() => {
    if (!aiPlanEnabled) {
      router.replace("/(tabs)" as any);
      return;
    }
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load, router]);

  const allKeys = useMemo(() => {
    if (!data) return [];
    const keys: string[] = [];
    data.days.forEach((day) => {
      day.recipes.forEach((recipe, index) => keys.push(keyOf(day.date, recipe, index)));
    });
    return keys;
  }, [data]);

  const selectedRecipes = useMemo(() => {
    if (!data) return [];
    return data.days.flatMap((day) =>
      day.recipes
        .map((recipe, index) => ({ date: day.date, recipe, key: keyOf(day.date, recipe, index) }))
        .filter((item) => selected.has(item.key)),
    );
  }, [data, selected]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDay = (date: string) => {
    if (!data) return;
    const day = data.days.find((item) => item.date === date);
    if (!day) return;
    const keys = day.recipes.map((recipe, index) => keyOf(date, recipe, index));
    const allOn = keys.every((key) => selected.has(key));
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => (allOn ? next.delete(key) : next.add(key)));
      return next;
    });
  };

  const accept = async () => {
    if (!data || accepting || selectedRecipes.length === 0) return;
    setAccepting(true);
    try {
      const items = selectedRecipes.map(({ date, recipe }) => {
        if (!recipe.recipeId) throw new Error("Invalid recipe");
        const ratio = data.requestedServings / (recipe.servings || data.requestedServings);
        const ingredients = sanitizeIngredients(recipe.ingredients).map((ing) => ({
          name: ing.name,
          nameEn: ing.nameEn,
          nameFil: ing.nameFil,
          nameId: ing.nameId,
          quantity: calcAdjustedQty(ing.quantity, ing.unit, ing.category, ratio),
          unit: ing.unit,
          category: ing.category,
        }));
        const buyDate = DateUtil.getDayBefore(date);
        return {
          date,
          buyDate: buyDate < today ? today : buyDate,
          recipeId: recipe.recipeId,
          recipeName: recipe.name,
          recipeNameEn: recipe.nameEn ?? null,
          recipeNameFil: recipe.nameFil ?? null,
          recipeNameId: recipe.nameId ?? null,
          recipeImage: resolveImageUrl(recipe.image || recipe.thumbnailUrl) || null,
          ingredients,
        };
      });
      await apiClient.quickPlan.accept.mutate({
        clientRequestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        items,
      });
      await Promise.all([
        utils.mealPlan.listByDateRange.invalidate(),
        utils.mealPlan.list.invalidate(),
        utils.shopping.list.invalidate(),
      ]);
      Alert.alert(
        t("已排好" as any),
        undefined,
        [
          {
            text: t("睇購物清單" as any),
            onPress: () => router.replace("/(tabs)/shopping" as any),
          },
          {
            text: t("返回首頁" as any),
            onPress: () => router.replace("/(tabs)" as any),
          },
        ],
      );
    } catch (e) {
      Alert.alert(t("排餐失敗" as any), friendlyError(e) || t("再試一次" as any));
    } finally {
      setAccepting(false);
    }
  };

  if (!aiPlanEnabled) return null;

  if (!canPlan && familyRole == null) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={CORAL} />
        <Text style={s.loadingText}>{t("載入中" as any)}</Text>
      </View>
    );
  }

  if (!canPlan) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={36} color={SUB} />
        <Text style={s.errorTitle}>{t("等 owner 安排" as any)}</Text>
        <TouchableOpacity style={s.secondary} onPress={() => router.replace("/(tabs)" as any)}>
          <Text style={s.secondaryText}>{t("返回首頁" as any)}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allSelected = allKeys.length > 0 && selectedRecipes.length === allKeys.length;
  const footerLabel = allSelected
    ? t("全部加入（{{n}} 道）" as any, { n: selectedRecipes.length })
    : t("加入已選（{{n}} 道）" as any, { n: selectedRecipes.length });

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={20} color={BRAND} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("AI 幫我排餐" as any)}</Text>
          <Text style={s.subtitle}>
            {DateUtil.formatDateLabel(startDate)} · {t("AI 會幫你排好呢晚＋下一晚" as any)}
          </Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => void load()} disabled={loading || accepting}>
          <Ionicons name="refresh" size={18} color={BRAND} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={CORAL} />
          <Text style={s.loadingText}>{t("載入中" as any)}</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={SUB} />
          <Text style={s.errorTitle}>{error}</Text>
          <TouchableOpacity style={s.primary} onPress={() => void load()}>
            <Text style={s.primaryText}>{t("再試一次" as any)}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 130 }]}>
          {data.days.map((day) => {
            const dayKeys = day.recipes.map((recipe, index) => keyOf(day.date, recipe, index));
            const dayAll = dayKeys.every((key) => selected.has(key));
            return (
              <View key={day.date} style={s.daySection}>
                <View style={s.dayHeader}>
                  <View>
                    <Text style={s.dayTitle}>{DateUtil.formatDateLabel(day.date)}</Text>
                    <Text style={s.dayDate}>{day.date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleDay(day.date)} style={s.selectAll}>
                    <Ionicons name={dayAll ? "checkbox" : "square-outline"} size={17} color={BRAND} />
                    <Text style={s.selectAllText}>{t("全選" as any)}</Text>
                  </TouchableOpacity>
                </View>
                {day.recipes.map((recipe, index) => {
                  const key = keyOf(day.date, recipe, index);
                  const on = selected.has(key);
                  const image = resolveImageUrl(recipe.image || recipe.thumbnailUrl);
                  return (
                    <View key={key} style={s.row}>
                      <TouchableOpacity onPress={() => toggle(key)} style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                        <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={25} color={on ? CORAL : "#C9C2B8"} />
                      </TouchableOpacity>
                      {image ? (
                        <Image source={{ uri: image }} style={s.image} />
                      ) : (
                        <View style={[s.image, s.imageEmpty]}>
                          <Ionicons name="restaurant-outline" size={20} color={SUB} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.recipeName} numberOfLines={2}>{recipe.name}</Text>
                        <Text style={s.meta} numberOfLines={1}>
                          {recipe.cookTime} {t("分鐘" as any)} · {recipe.source === "custom" ? t("我的食譜" as any) : t("官方食譜" as any)}
                        </Text>
                        <TouchableOpacity onPress={() => setPreview({ date: day.date, recipe })}>
                          <Text style={s.ingredientsLink}>
                            {t("aiChef.viewIngredients" as any, { n: sanitizeIngredients(recipe.ingredients).length })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {data ? (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={s.count}>{t("已選 {{n}}/{{total}} 道" as any, { n: selectedRecipes.length, total: allKeys.length })}</Text>
          <TouchableOpacity
            style={[s.primary, (selectedRecipes.length === 0 || accepting) && s.disabled]}
            onPress={() => void accept()}
            disabled={selectedRecipes.length === 0 || accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.primaryText}>{footerLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={!!preview} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{preview?.recipe.name}</Text>
                <Text style={s.modalSub}>{preview ? DateUtil.formatDateLabel(preview.date) : ""}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreview(null)} style={s.iconBtn}>
                <Ionicons name="close" size={20} color={BRAND} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {preview ? sanitizeIngredients(preview.recipe.ingredients).map((ing, index) => (
                <View key={`${ing.name}-${index}`} style={s.ingredientRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ingredientName}>{ing.name}</Text>
                    <Text style={s.ingredientCategory}>{ing.category}</Text>
                  </View>
                  <Text style={s.ingredientQty}>{[ing.quantity, ing.unit].filter(Boolean).join(" ")}</Text>
                </View>
              )) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF8F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FAF8F5",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F1EEE8", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "900", color: TEXT },
  subtitle: { fontSize: 11, color: SUB, marginTop: 2 },
  scroll: { padding: 14, gap: 12 },
  daySection: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#F8F5F0" },
  dayTitle: { fontSize: 14, fontWeight: "900", color: TEXT },
  dayDate: { fontSize: 11, color: SUB, marginTop: 2 },
  selectAll: { flexDirection: "row", alignItems: "center", gap: 5 },
  selectAllText: { fontSize: 12, fontWeight: "700", color: BRAND },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderTopWidth: 1, borderTopColor: "#F4F0EA" },
  check: { width: 28, alignItems: "center", justifyContent: "center" },
  image: { width: 62, height: 62, borderRadius: 10, backgroundColor: "#F1EEE8" },
  imageEmpty: { alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: 14, fontWeight: "800", color: TEXT },
  meta: { fontSize: 11, color: SUB, marginTop: 3 },
  ingredientsLink: { fontSize: 11, color: BRAND, fontWeight: "700", marginTop: 5 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: BORDER, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  count: { fontSize: 11, color: SUB, textAlign: "center" },
  primary: { minHeight: 46, borderRadius: 13, backgroundColor: CORAL, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { fontSize: 15, fontWeight: "900", color: "#fff" },
  disabled: { opacity: 0.5 },
  secondary: { marginTop: 16, minHeight: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#F1EEE8", alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 13, fontWeight: "700", color: BRAND },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  loadingText: { fontSize: 12, color: SUB },
  errorTitle: { fontSize: 14, fontWeight: "700", color: TEXT, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: "78%" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: "900", color: TEXT },
  modalSub: { fontSize: 11, color: SUB, marginTop: 2 },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F0EA" },
  ingredientName: { fontSize: 13, fontWeight: "700", color: TEXT },
  ingredientCategory: { fontSize: 10, color: SUB, marginTop: 2 },
  ingredientQty: { fontSize: 12, color: SUB },
});
