import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const GLOBAL_OFF_KEY = "hints_disabled";

export async function setHintsDisabled(disabled: boolean) {
  await AsyncStorage.setItem(GLOBAL_OFF_KEY, disabled ? "true" : "false");
}

export async function getHintsDisabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GLOBAL_OFF_KEY)) === "true";
  } catch {
    return false;
  }
}

type Props = {
  hintId: string;
  icon?: string;
  title: string;
  body: string;
};

// 可關閉嘅功能提示卡（方案 B）：per-hint dismiss + 全局開關
export default function HintBanner({ hintId, icon = "bulb", title, body }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const disabled = (await AsyncStorage.getItem(GLOBAL_OFF_KEY)) === "true";
        const dismissed = (await AsyncStorage.getItem(`hint_dismissed_${hintId}`)) === "true";
        setVisible(!disabled && !dismissed);
      } catch {
        setVisible(true);
      }
    })();
  }, [hintId]);

  if (!visible) return null;

  const dismiss = async () => {
    await AsyncStorage.setItem(`hint_dismissed_${hintId}`, "true");
    setVisible(false);
  };

  const disableAll = async () => {
    await setHintsDisabled(true);
    setVisible(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon as any} size={18} color="#B45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </Pressable>
      </View>
      <Pressable onPress={disableAll} hitSlop={6}>
        <Text style={styles.off}>{t("misc.hintBannerOff")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 10,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  body: {
    fontSize: 13,
    color: "#78350F",
    marginTop: 2,
    lineHeight: 18,
  },
  close: {
    padding: 2,
  },
  off: {
    fontSize: 12,
    color: "#B45309",
    textDecorationLine: "underline",
    alignSelf: "flex-start",
  },
});
