import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  dateLabel: string;
  mealLabel: string;
  existingCount: number;
  newCount: number;
  maxCount?: number;
  canReplace: boolean;
  onReplace?: () => void;
  onViewPlan: () => void;
  onCancel: () => void;
};

export default function MealLimitPrompt({
  visible,
  dateLabel,
  mealLabel,
  existingCount,
  newCount,
  maxCount = 16,
  canReplace,
  onReplace,
  onViewPlan,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const total = existingCount + newCount;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
          </View>
          <Text style={styles.title}>{t("夠喇" as any)}</Text>
          <Text style={styles.body}>
            {t("{{date}} 已經有 {{existing}} 道{{meal}}。加入 {{newCount}} 道後會變成 {{total}} 道，超過上限 {{max}}。" as any, {
              date: dateLabel,
              existing: existingCount,
              meal: mealLabel,
              newCount,
              total,
              max: maxCount,
            })}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryTxt}>{t("取消" as any)}</Text>
            </Pressable>
            <Pressable onPress={onViewPlan} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryTxt}>{t("查看排餐" as any)}</Text>
            </Pressable>
            {canReplace && onReplace ? (
              <Pressable onPress={onReplace} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
                <Text style={styles.primaryTxt}>{t("取代現有{{meal}}" as any, { meal: mealLabel })}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(24,59,86,0.28)", justifyContent: "flex-end" },
  card: {
    backgroundColor: "#FFF8EF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: "#183B56" },
  body: { fontSize: 14, lineHeight: 20, color: "#5F6F80" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  secondary: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DED4",
  },
  secondaryTxt: { fontSize: 12, fontWeight: "800", color: "#5F6F80", textAlign: "center" },
  primary: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#DC2626" },
  primaryTxt: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", textAlign: "center" },
});
