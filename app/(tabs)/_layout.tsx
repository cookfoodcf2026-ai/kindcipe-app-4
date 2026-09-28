import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, Slot, usePathname, useRouter } from "expo-router";
import { RecipeIcon, PlannerIcon, ShoppingIcon, GridIcon } from "@/src/components/icons";
import { usePendingCounts } from "@/hooks/usePendingCounts";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useTranslation } from "react-i18next";

const badgeLabel = (n: number) => (n > 99 ? "99+" : n > 0 ? String(n) : undefined);

const NAVY = "#013E77";
const ACTIVE_BG = "#E8F0F8";
const INACTIVE = "#5B6470";

type TabItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  badge?: number;
  badgeColor?: string;
};

function useTabItems(): TabItem[] {
  const { t } = useTranslation();
  const { plannerBadge, shoppingBadge } = usePendingCounts();
  return [
    { href: "/", label: t("tabs.recipes"), Icon: RecipeIcon },
    { href: "/planner", label: t("tabs.planner"), Icon: PlannerIcon, badge: plannerBadge, badgeColor: "#EF4444" },
    { href: "/shopping", label: t("tabs.shopping"), Icon: ShoppingIcon, badge: shoppingBadge, badgeColor: NAVY },
    { href: "/more", label: t("tabs.more"), Icon: GridIcon },
  ];
}

/** Desktop web: persistent left sidebar + slot-rendered screen. */
function DesktopTabsLayout() {
  const items = useTabItems();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={s.shell}>
      <View style={s.sidebar}>
        <Text style={s.brand}>Kindcipe</Text>
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(item.href);
          const color = active ? NAVY : INACTIVE;
          return (
            <TouchableOpacity
              key={item.href}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              onPress={() => router.push(item.href as never)}
              style={[s.item, active && s.itemActive]}
            >
              <View style={s.iconWrap}>
                <item.Icon size={22} color={color} />
              </View>
              <Text style={[s.label, { color }]} numberOfLines={1}>
                {item.label}
              </Text>
              {item.badge && item.badge > 0 ? (
                <View style={[s.badge, { backgroundColor: item.badgeColor ?? NAVY }]}>
                  <Text style={s.badgeTxt}>{badgeLabel(item.badge)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.content}>
        <Slot />
      </View>
    </View>
  );
}

/** Mobile / native: standard bottom tabs. */
function MobileTabsLayout() {
  const { t } = useTranslation();
  const { plannerBadge, shoppingBadge } = usePendingCounts();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NAVY,
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
          tabBarIcon: ({ color }) => <RecipeIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t("tabs.planner"),
          tabBarBadge: badgeLabel(plannerBadge),
          tabBarBadgeStyle: plannerBadge > 0 ? { backgroundColor: "#EF4444", color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => <PlannerIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: t("tabs.shopping"),
          tabBarBadge: badgeLabel(shoppingBadge),
          tabBarBadgeStyle: shoppingBadge > 0 ? { backgroundColor: NAVY, color: "#fff", fontSize: 10, fontWeight: "700" } : undefined,
          tabBarIcon: ({ color }) => <ShoppingIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: ({ color }) => <GridIcon size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isDesktop } = useBreakpoint();
  if (isDesktop) return <DesktopTabsLayout />;
  return <MobileTabsLayout />;
}

const s = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FAF8F5",
  },
  sidebar: {
    width: 240,
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#E8E8E8",
    paddingTop: 28,
    paddingHorizontal: 12,
    gap: 4,
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: ACTIVE_BG,
  },
  iconWrap: {
    width: 24,
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
});
