import { Tabs } from "expo-router";
import { RecipeIcon, PlannerIcon, ShoppingIcon, GridIcon } from "@/src/components/icons";

export default function TabLayout() {
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
          tabBarIcon: ({ color }) => (
            <PlannerIcon size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "購物",
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
