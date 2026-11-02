import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { canva } from "@/app/styles/colors";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  acceptLabel?: string;
  onAccept?: () => void;
  onDecline: () => void;
};

export default function NextDayPrompt({ visible, title, body, acceptLabel, onAccept, onDecline }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar-outline" size={24} color="#F37021" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onDecline}
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.secondaryTxt}>{t("夠喇" as any)}</Text>
            </Pressable>
            {onAccept ? (
              <Pressable
                onPress={onAccept}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.primaryTxt}>{acceptLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24,59,86,0.28)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#FFF8EF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FDE7D7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "900", color: "#183B56" },
  body: { fontSize: 14, lineHeight: 20, color: "#5F6F80", marginBottom: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  secondary: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DED4",
  },
  secondaryTxt: { fontSize: 15, fontWeight: "800", color: "#5F6F80" },
  primary: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: canva.action,
  },
  primaryTxt: { fontSize: 15, fontWeight: "900", color: canva.textOnAccent },
});
