import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { DateUtil } from "@/src/lib/DateUtil";
import { getBilingualName } from "@/lib/bilingual";

const BRAND = "#183B56";
const CORAL = "#FF7A3D";
const MUTED = "#6B7280";

type Props = {
  router: ReturnType<typeof useRouter>;
};

export default function HomePlanHero({ router }: Props) {
  const { t } = useTranslation();
  const { familyRole } = useAuth();
  const today = DateUtil.todayISO();
  const tomorrow = DateUtil.addDays(today, 1);
  const dayAfter = DateUtil.addDays(today, 2);
  const queryEnd = DateUtil.addDays(today, 3);
  const dates = useMemo(() => [today, tomorrow, dayAfter], [today, tomorrow, dayAfter]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const { data: mealPlans = [] } = trpc.mealPlan.listByDateRange.useQuery(
    { startDate: today, endDate: queryEnd },
    { staleTime: 30_000 },
  );
  const { data: eatOutDates = [] } = trpc.eatOut.listByDateRange.useQuery(
    { startDate: today, endDate: queryEnd },
    { staleTime: 30_000 },
  );

  const coveredDates = useMemo(() => {
    const set = new Set<string>();
    for (const meal of mealPlans as any[]) {
      if (meal.mealType === "dinner" && meal.status === "confirmed") set.add(meal.date);
    }
    for (const date of eatOutDates as string[]) set.add(date);
    return set;
  }, [mealPlans, eatOutDates]);

  const nextMissing = dates.find((date) => !coveredDates.has(date)) ?? today;
  const startDate = selectedStart ?? nextMissing;
  const nextDate = DateUtil.addDays(startDate, 1);
  const startCovered = coveredDates.has(startDate);
  const nextCovered = coveredDates.has(nextDate);
  const canPlan = familyRole === "owner" || familyRole === "admin";

  const startMeal = (mealPlans as any[]).find(
    (meal) => meal.date === startDate && meal.mealType === "dinner" && meal.status === "confirmed",
  );
  const startMealName = startMeal
    ? getBilingualName(startMeal.recipeName, startMeal.recipeNameEn, startMeal.recipeNameFil, startMeal.recipeNameId).primary
    : "";

  const labelFor = (date: string) => {
    if (date === today) return t("shopping.today" as any);
    if (date === tomorrow) return t("shopping.tomorrow" as any);
    return t("後天" as any);
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("想安排邊日晚餐？" as any)}</Text>
          <Text style={s.subtitle}>{t("AI 會幫你排好呢晚＋下一晚" as any)}</Text>
        </View>
      </View>

      <View style={s.chips}>
        {dates.map((date) => {
          const active = date === startDate;
          const covered = coveredDates.has(date);
          return (
            <TouchableOpacity
              key={date}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setSelectedStart(date)}
              activeOpacity={0.8}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{labelFor(date)}</Text>
              {covered ? <View style={[s.dot, active && s.dotActive]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {startCovered || nextCovered ? (
        <View style={s.planSummary}>
          <Text style={s.summaryTitle}>
            {startCovered ? t("已排好" as any) : t("已有計劃，請去 Planner 修改" as any)}
          </Text>
          {startMealName ? (
            <Text style={s.summaryLine} numberOfLines={1}>
              {`${labelFor(startDate)} · ${startMealName}`}
            </Text>
          ) : null}
          <TouchableOpacity
            style={s.primary}
            onPress={() => router.push("/(tabs)/planner" as any)}
            activeOpacity={0.85}
          >
            <Text style={s.primaryText}>{t("睇 2 日計劃" as any)}</Text>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : canPlan ? (
        <TouchableOpacity
          style={s.primary}
          onPress={() =>
            router.push({
              pathname: "/ai-plan",
              params: { startDate },
            } as any)
          }
          activeOpacity={0.85}
        >
          <Text style={s.primaryText}>{t("AI 幫我排餐" as any)}</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </TouchableOpacity>
      ) : familyRole == null ? (
        <View style={s.waiting}>
          <ActivityIndicator size="small" color={BRAND} />
          <Text style={s.waitingText}>{t("載入中" as any)}</Text>
        </View>
      ) : (
        <View style={s.waiting}>
          <Ionicons name="lock-closed-outline" size={14} color={MUTED} />
          <Text style={s.waitingText}>{t("等 owner 安排" as any)}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8F0",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3E3D2",
    shadowColor: "#8A4B2A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: CORAL,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "900", color: "#2C1A0E" },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 18 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EADBCB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, fontWeight: "800", color: BRAND },
  chipTextActive: { color: "#fff" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#22C55E" },
  dotActive: { backgroundColor: "#BBF7D0" },
  primary: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: CORAL,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  primaryText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  planSummary: { gap: 5 },
  summaryTitle: { fontSize: 14, fontWeight: "800", color: "#2C1A0E" },
  summaryLine: { fontSize: 12, color: MUTED, marginBottom: 6 },
  waiting: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  waitingText: { fontSize: 12, color: MUTED, fontWeight: "600" },
});
