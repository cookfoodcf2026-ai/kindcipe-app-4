import { Tabs } from "expo-router";
import { RecipeIcon, PlannerIcon, ShoppingIcon, GridIcon } from "@/src/components/icons";
import { usePendingCounts } from "@/hooks/usePendingCounts";

export default function TabLayout() {
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
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "食譜",
          tabBarIcon: ({ color }) => (
            <RecipeIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "排餐",
          tabBarBadge: plannerBadge > 0 ? plannerBadge : undefined,
          tabBarBadgeStyle: plannerBadge > 0 ? { backgroundColor: "#EF4444", color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => (
            <PlannerIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "購物",
          tabBarBadge: shoppingBadge > 0 ? shoppingBadge : undefined,
          tabBarBadgeStyle: shoppingBadge > 0 ? { backgroundColor: "#013E77", color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => (
            <ShoppingIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "更多",
          tabBarIcon: ({ color }) => (
            <GridIcon size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
