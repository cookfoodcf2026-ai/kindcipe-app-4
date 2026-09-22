import { Tabs } from "expo-router";
import { RecipeIcon, PlannerIcon, ShoppingIcon, GridIcon } from "@/src/components/icons";
import { usePendingCounts } from "@/hooks/usePendingCounts";
import { useTranslation } from "react-i18next";

const badgeLabel = (n: number) => (n > 99 ? "99+" : n > 0 ? String(n) : undefined);

export default function TabLayout() {
  const { t } = useTranslation();
  const { plannerBadge, shoppingBadge } = usePendingCounts();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#013E77",
        tabBarInactiveTintColor: "#999",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { borderTopColor: "#E8E8E8" },
      }}
      screenListeners={{
        tabPress: () => {
          // 防止 tabs 組別名稱洩漏
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.recipes"),
          tabBarIcon: ({ color }) => (
            <RecipeIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t("tabs.planner"),
          tabBarBadge: badgeLabel(plannerBadge),
          tabBarBadgeStyle: plannerBadge > 0 ? { backgroundColor: "#EF4444", color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => (
            <PlannerIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: t("tabs.shopping"),
          tabBarBadge: badgeLabel(shoppingBadge),
          tabBarBadgeStyle: shoppingBadge > 0 ? { backgroundColor: "#013E77", color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => (
            <ShoppingIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: ({ color }) => (
            <GridIcon size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
