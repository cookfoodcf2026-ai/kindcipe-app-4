import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { colors } from "@/app/styles/colors";
import { typography } from "@/app/styles/typography";
import { GridIcon, ChevronLeftIcon } from "@/src/components/icons";

export default function ComingSoonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; subtitle?: string; message?: string }>();

  const title = params.title || "Coming Soon";
  const subtitle = params.subtitle || "";
  const message = params.message || "呢個功能仍在準備中，之後會逐步上線。";

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.topBar, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="返回">
          <ChevronLeftIcon size={22} color={colors.neutral.white} />
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <View style={s.iconWrap}>
          <GridIcon size={28} color={colors.primary.copper} />
        </View>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <Text style={s.message}>{message}</Text>

        <TouchableOpacity style={s.cta} onPress={() => router.back()}>
          <Text style={s.ctaTxt}>返回更多功能</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary.cream,
  },
  topBar: {
    backgroundColor: colors.primary.navy,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#FFF4DC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    ...typography.h2,
    color: colors.primary.darkGray,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.primary.navy,
    textAlign: "center",
    marginTop: 8,
  },
  message: {
    ...typography.body,
    color: colors.neutral.darkGray,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  cta: {
    marginTop: 22,
    minWidth: 180,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.primary.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: {
    ...typography.body,
    fontWeight: "800",
    color: colors.neutral.white,
  },
});
