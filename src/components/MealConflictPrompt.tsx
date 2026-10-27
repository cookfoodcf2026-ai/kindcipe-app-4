import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  dateLabel: string;
  mealLabel?: string;
  mealNames: string[];
  hint?: string;
  onReplace: () => void;
  onAdd: () => void;
  onCancel: () => void;
};

export default function MealConflictPrompt({ visible, dateLabel, mealLabel, mealNames, hint, onReplace, onAdd, onCancel }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const subject = mealLabel || t("晚餐" as any);
  const previewNames = mealNames.length > 3
    ? `${mealNames.slice(0, 3).join("、")}${t(" 等 {{n}} 道" as any, { n: mealNames.length - 3 })}`
    : mealNames.join("、");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={24} color="#F47B3A" />
          </View>
          <Text style={styles.title}>{t("當日已有{{meal}}" as any, { meal: subject })}</Text>
          <Text style={styles.body}>
            {t("{{date}} 已經有：{{names}}" as any, { date: dateLabel, names: previewNames })}
          </Text>
          <Text style={styles.hint}>{hint || t("你想取代，定係加入埋一齊？" as any)}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryTxt}>{t("取消" as any)}</Text>
            </Pressable>
            <Pressable onPress={onAdd} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryTxt}>{t("繼續加入" as any)}</Text>
            </Pressable>
            <Pressable onPress={onReplace} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              <Text style={styles.primaryTxt}>{t("取代現有{{meal}}" as any, { meal: subject })}</Text>
            </Pressable>
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
    gap: 9,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDE7D7", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: "#183B56" },
  body: { fontSize: 14, lineHeight: 20, color: "#5F6F80" },
  hint: { fontSize: 13, lineHeight: 19, color: "#183B56", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
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
  primary: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#F47B3A" },
  primaryTxt: { fontSize: 12, fontWeight: "900", color: "#183B56", textAlign: "center" },
});
