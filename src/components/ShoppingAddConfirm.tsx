import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  count: number;
  onGoShopping: () => void;
  onClose: () => void;
};

export default function ShoppingAddConfirm({ visible, count, onGoShopping, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={t(styles.title as any)}>{t("shopping.addedToCart")}</Text>
              <Text style={styles.sub}>{t("picker.addedCount", { n: count })}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.btnSecondaryTxt}>{t("picker.close")}</Text>
            </Pressable>
            <Pressable
              onPress={onGoShopping}
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.btnPrimaryTxt}>{t("picker.goShop")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  sub: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnSecondaryTxt: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B5563",
  },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#16A34A",
  },
  btnPrimaryTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
