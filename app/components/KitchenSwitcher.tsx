import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/src/components/Toast";

const BRAND = "#183B56";

/** Height of the mobile bar body (excludes the status-bar inset). */
export const KITCHEN_BAR_HEIGHT = 44;

type Variant = "bar" | "sidebar";

export default function KitchenSwitcher({ variant = "bar" }: { variant?: Variant }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { activeFamily, activeFamilyId, families, switchFamily, isAuthenticated } = useAuth();
  const [showSheet, setShowSheet] = useState(false);

  if (!isAuthenticated) return null;

  const isBar = variant === "bar";
  const hasMultipleKitchens = families.length > 1;
  const activeName = activeFamily?.name || t("settings.kitchen");
  const chevronIcon = hasMultipleKitchens ? "chevron-down" : "settings-outline";

  const openSettings = () => {
    setShowSheet(false);
    router.push("/kitchen-settings");
  };

  const handleTriggerPress = () => {
    if (hasMultipleKitchens) {
      setShowSheet(true);
      return;
    }
    openSettings();
  };

  const handleSelect = async (family: any) => {
    setShowSheet(false);
    if (String(family.id) === String(activeFamilyId)) return;
    await switchFamily(String(family.id));
    // switchFamily() invalidates every tRPC query, so list/planner/shopping refetch.
    showToast(t("switcher.switched", { kitchen: family.name }));
  };

  const sheet = (
    <Modal visible={showSheet && hasMultipleKitchens} transparent animationType="slide">
      <View style={s.overlay}>
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setShowSheet(false)}
        />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{t("switcher.title")}</Text>

          <FlatList
            data={families}
            keyExtractor={(item: any) => String(item.id)}
            contentContainerStyle={s.list}
            renderItem={({ item }: { item: any }) => {
              const isActive = String(item.id) === String(activeFamilyId);
              const roleLabel = item.role === "owner"
                ? t("switcher.roleOwner")
                : t("switcher.roleMember");
              return (
                <TouchableOpacity
                  style={[s.familyRow, isActive && s.familyRowActive]}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[s.familyIcon, isActive && s.familyIconActive]}>
                    <Ionicons
                      name="home-outline"
                      size={20}
                      color={isActive ? BRAND : "#fff"}
                    />
                  </View>
                  <View style={s.familyInfo}>
                    <Text style={[s.familyName, isActive && s.familyNameActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[s.familyMeta, isActive && s.familyMetaActive]}>
                      {roleLabel} · {t("dyn.memberCount", { n: item.memberCount ?? 0 })}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={BRAND} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>{t("kitchen.noKitchen")}</Text>
              </View>
            }
          />

          <TouchableOpacity style={s.createBtn} onPress={openSettings}>
            <Ionicons name="add-circle-outline" size={18} color={BRAND} />
            <Text style={s.createBtnText}>{t("switcher.addKitchen")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.manageBtn} onPress={openSettings}>
            <Ionicons name="settings-outline" size={18} color="#fff" />
            <Text style={s.manageBtnText}>{t("settings.manageKitchen")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const triggerIconColor = isBar ? "#fff" : BRAND;
  const triggerTextColor = isBar ? "#fff" : BRAND;
  const chevronColor = isBar ? "rgba(255,255,255,0.75)" : "#6B7280";

  const trigger = (
    <TouchableOpacity
      style={isBar ? s.barTrigger : s.sidebarTrigger}
      onPress={handleTriggerPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t("switcher.title")}
      accessibilityValue={{ text: activeName }}
    >
      <Ionicons name="home" size={isBar ? 16 : 18} color={triggerIconColor} />
      <Text
        style={[isBar ? s.barTriggerText : s.sidebarTriggerText, { color: triggerTextColor }]}
        numberOfLines={1}
      >
        {activeName}
      </Text>
      <Ionicons name={chevronIcon} size={isBar ? 14 : 16} color={chevronColor} />
    </TouchableOpacity>
  );

  if (isBar) {
    return (
      <>
        <View style={[s.bar, { paddingTop: insets.top }]}>
          <View style={s.barInner}>{trigger}</View>
        </View>
        {sheet}
      </>
    );
  }

  return (
    <>
      {trigger}
      {sheet}
    </>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: BRAND,
  },
  barInner: {
    height: KITCHEN_BAR_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  barTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 260,
  },
  barTriggerText: {
    fontSize: 15,
    fontWeight: "700",
    maxWidth: 200,
  },
  sidebarTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  sidebarTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E0D8",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
  },
  familyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  familyRowActive: {
    backgroundColor: "#EAF1F8",
    borderColor: BRAND,
  },
  familyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  familyIconActive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BRAND,
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  familyNameActive: {
    color: BRAND,
  },
  familyMeta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  familyMetaActive: {
    color: "#5F6F80",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BRAND,
    borderStyle: "dashed",
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: BRAND,
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
