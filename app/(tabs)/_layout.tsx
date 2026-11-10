import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { RecipeIcon, PlannerIcon, ShoppingIcon, GridIcon } from "@/src/components/icons";
import { usePendingCounts } from "@/hooks/usePendingCounts";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useTranslation } from "react-i18next";
import { canva } from "@/app/styles/colors";
import KitchenSwitcher, { KITCHEN_BAR_HEIGHT } from "@/app/components/KitchenSwitcher";

const badgeLabel = (n: number) => (n > 99 ? "99+" : n > 0 ? String(n) : undefined);

const NAVY = canva.primary;
const ACTIVE_BG = canva.softBlue;
const INACTIVE = canva.muted;

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
    { href: "/", label: t("tabs.home"), Icon: RecipeIcon },
    { href: "/planner", label: t("tabs.planner"), Icon: PlannerIcon, badge: plannerBadge, badgeColor: "#EF4444" },
    { href: "/shopping", label: t("tabs.shopping"), Icon: ShoppingIcon, badge: shoppingBadge, badgeColor: NAVY },
    { href: "/more", label: t("tabs.more"), Icon: GridIcon },
  ];
}

/** Desktop web: persistent left sidebar, while the Tabs navigator stays mounted. */
function DesktopSidebar() {
  const items = useTabItems();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={s.sidebar}>
      <Text style={s.brand}>Kindcipe</Text>
      <KitchenSwitcher variant="sidebar" />
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
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { isDesktop } = useBreakpoint();
  const { plannerBadge, shoppingBadge } = usePendingCounts();

  return (
    <View style={s.shell}>
      {isDesktop ? <DesktopSidebar /> : <KitchenSwitcher variant="bar" />}
      <View style={[s.content, !isDesktop && { paddingTop: KITCHEN_BAR_HEIGHT }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: NAVY,
            tabBarInactiveTintColor: "#999",
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            tabBarStyle: isDesktop
              ? { display: "none" }
              : { borderTopColor: canva.border, backgroundColor: canva.bg },
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
              title: t("tabs.home"),
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: canva.bg,
  },
  sidebar: {
    width: 240,
    height: "100%",
    backgroundColor: canva.surface,
    borderRightWidth: 1,
    borderRightColor: canva.border,
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
