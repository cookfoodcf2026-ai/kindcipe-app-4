import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "#013E77";

export default function KitchenSwitcher() {
  const router = useRouter();
  const { activeFamily, activeFamilyId, families, switchFamily, isAuthenticated } = useAuth();
  const [showSheet, setShowSheet] = useState(false);

  if (!isAuthenticated) return null;

  const handleSelect = async (family: any) => {
    await switchFamily(String(family.id));
    setShowSheet(false);
  };

  return (
    <>
      <TouchableOpacity
        style={s.trigger}
        onPress={() => setShowSheet(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="home-outline" size={14} color="#fff" />
        <Text style={s.triggerText} numberOfLines={1}>
          {activeFamily?.name || "廚房"}
        </Text>
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <Modal visible={showSheet} transparent animationType="slide">
        <View style={s.overlay}>
          <TouchableOpacity
            style={s.backdrop}
            activeOpacity={1}
            onPress={() => setShowSheet(false)}
          />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>切換廚房</Text>

            <FlatList
              data={families}
              keyExtractor={(item: any) => String(item.id)}
              contentContainerStyle={s.list}
              renderItem={({ item }: { item: any }) => {
                const isActive = String(item.id) === String(activeFamilyId);
                return (
                  <TouchableOpacity
                    style={[s.familyRow, isActive && s.familyRowActive]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={s.familyIcon}>
                      <Ionicons
                        name="home-outline"
                        size={20}
                        color={isActive ? "#fff" : BRAND}
                      />
                    </View>
                    <View style={s.familyInfo}>
                      <Text style={[s.familyName, isActive && s.familyNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={s.familyMemberCount}>
                        {item.memberCount ?? 0} 位成員
                      </Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyText}>尚未加入任何廚房</Text>
                </View>
              }
            />

            <TouchableOpacity
              style={s.createBtn}
              onPress={() => {
                setShowSheet(false);
                router.push("/family");
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={BRAND} />
              <Text style={s.createBtnText}>建立或加入廚房</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 140,
  },
  triggerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    maxWidth: 90,
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
  },
  familyRowActive: {
    backgroundColor: BRAND,
  },
  familyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(1,62,119,0.1)",
    alignItems: "center",
    justifyContent: "center",
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
    color: "#fff",
  },
  familyMemberCount: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
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
});
