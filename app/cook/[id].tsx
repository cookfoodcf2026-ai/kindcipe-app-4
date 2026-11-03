import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { trpc, resolveImageUrl } from "@/lib/trpc";
import { getBilingualName, getLocalizedSteps } from "@/lib/bilingual";
import StepTimer from "@/components/StepTimer";

const BRAND = "#183B56";
const COPPER = "#F37021";
const BG = "#FAFAF8";
const CARD = "#FFFFFF";
const TEXT = "#1C1C1E";
const SUB = "#8E8E93";
const BORDER = "#F0EDE8";
const PURPLE = "#9C27B0";

type CookStep = {
  instruction: string;
  tip: string | null;
  durationSeconds: number;
  stepMediaUrl: string | null;
};

function parseDurationSeconds(raw: unknown): number {
  if (!raw) return 0;
  const n = parseInt(String(raw));
  if (!n || isNaN(n)) return 0;
  return n * (n < 20 ? 60 : 1);
}

export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  useKeepAwake("cook-mode");

  const recipeQ = trpc.recipes.getById.useQuery({ id: id! }, { enabled: !!id });
  const recipe = recipeQ.data;
  const stepsEn = (recipe as any)?.stepsEn;
  const stepsFil = (recipe as any)?.stepsFil;
  const stepsId = (recipe as any)?.stepsId;
  const steps = useMemo<any[]>(
    () => getLocalizedSteps(recipe?.steps as any, stepsEn, stepsFil, stepsId) ?? [],
    [recipe?.steps, stepsEn, stepsFil, stepsId],
  );

  const cookSteps = useMemo<CookStep[]>(
    () =>
      steps.map((step: any) => {
        const isObject = step !== null && typeof step === "object";
        const instruction = isObject
          ? (step.instruction ?? step.description ?? step.step ?? "")
          : step;
        const tip = isObject ? (step.tip ?? step.tips ?? null) : null;
        return {
          instruction: String(instruction ?? ""),
          tip: tip ? String(tip) : null,
          durationSeconds: isObject ? parseDurationSeconds(step.duration) : 0,
          stepMediaUrl: isObject ? (step.stepMediaUrl ?? null) : null,
        };
      }),
    [steps],
  );

  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const rawImage = (recipe as any)?.thumbnailUrl || (recipe as any)?.image || (recipe as any)?.imageUrl || "";
  const imageUrl = rawImage ? resolveImageUrl(rawImage) : "";
  const recipeName = recipe ? getBilingualName(recipe.name, (recipe as any).nameEn, (recipe as any).nameFil, (recipe as any).nameId).primary : "";
  const total = cookSteps.length;

  useEffect(() => {
    const useNative = Platform.OS !== "web";
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 3000, useNativeDriver: useNative }),
        Animated.timing(scale, { toValue: 1, duration: 3000, useNativeDriver: useNative }),
      ]),
    );
    anim.start();
    return () => {
      anim.stop();
      scale.setValue(1);
    };
  }, [scale]);

  useEffect(() => {
    if (width > 0) {
      scrollRef.current?.scrollTo({ x: index * width, animated: false });
    }
  }, [width, index]);

  const goBackToRecipe = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/recipe/[id]", params: { id: id! } } as any);
  }, [router, id]);

  const confirmExit = useCallback(() => {
    if (finished) {
      goBackToRecipe();
      return;
    }
    Alert.alert(t("cook.exitTitle"), t("cook.exitBody"), [
      { text: t("cook.continueCooking"), style: "cancel" },
      { text: t("cook.leave"), style: "destructive", onPress: goBackToRecipe },
    ]);
  }, [finished, goBackToRecipe, t]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmExit();
      return true;
    });
    return () => sub.remove();
  }, [confirmExit]);

  const goToStep = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(total - 1, nextIndex));
      setIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    },
    [total, width],
  );

  const handleNext = useCallback(() => {
    if (index >= total - 1) {
      setFinished(true);
      return;
    }
    goToStep(index + 1);
  }, [index, total, goToStep]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [width, index, total],
  );

  const handleTimerEnd = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const renderHeader = (progressText: string) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.closeBtn} onPress={confirmExit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t("cook.exit")}>
        <Ionicons name="close" size={22} color={BRAND} />
      </TouchableOpacity>
      <Text style={styles.progressText}>{progressText}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (recipeQ.isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        {renderHeader("")}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={styles.centerText}>{t("cook.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe || total === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        {renderHeader("")}
        <View style={styles.center}>
          <Ionicons name="restaurant-outline" size={40} color={SUB} />
          <Text style={styles.centerText}>{recipe ? t("cook.noSteps") : t("cook.notFound")}</Text>
          <TouchableOpacity style={styles.secondaryWideBtn} onPress={goBackToRecipe} activeOpacity={0.85}>
            <Text style={styles.secondaryWideBtnText}>{t("cook.back")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.doneTitle}>{t("cook.allDone")}</Text>
          <Text style={styles.doneBody}>{t("cook.allDoneBody")}</Text>
          {!!recipeName && <Text style={styles.doneRecipe}>{recipeName}</Text>}
          <TouchableOpacity style={styles.primaryWideBtn} onPress={goBackToRecipe} activeOpacity={0.85}>
            <Text style={styles.primaryWideBtnText}>{t("cook.backToRecipe")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryWideBtn}
            onPress={() => {
              setFinished(false);
              goToStep(0);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryWideBtnText}>{t("cook.cookAgain")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageHeight = Math.max(120, Math.min(220, height * 0.24));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      {renderHeader(t("cook.stepProgress", { n: index + 1, total }))}

      <View style={styles.dotsRow}>
        {cookSteps.map((_: CookStep, i: number) => (
          <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={[styles.mediaWrap, { height: imageHeight }]}>
        {imageUrl ? (
          <Animated.View style={[styles.mediaInner, { transform: [{ scale }] }]}>
            <ExpoImage source={{ uri: imageUrl }} style={styles.mediaImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          </Animated.View>
        ) : (
          <View style={styles.mediaFallback}>
            <Ionicons name="restaurant-outline" size={36} color={SUB} />
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        snapToInterval={width}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        decelerationRate="fast"
        style={styles.pager}
      >
        {cookSteps.map((step: CookStep, i: number) => (
          <ScrollView key={i} style={{ width }} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepText}>{step.instruction}</Text>
            {step.tip && (
              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={14} color={PURPLE} />
                <Text style={styles.tipText}>{step.tip}</Text>
              </View>
            )}
            {step.durationSeconds > 0 && (
              <View style={styles.timerWrap}>
                <StepTimer defaultSeconds={step.durationSeconds} onTimerEnd={handleTimerEnd} />
              </View>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnSecondary, index === 0 && styles.navBtnDisabled]}
          onPress={() => goToStep(index - 1)}
          disabled={index === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color={index === 0 ? SUB : BRAND} />
          <Text style={[styles.navBtnSecondaryText, index === 0 && styles.navBtnDisabledText]}>{t("cook.previous")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.navBtnPrimaryText}>{index >= total - 1 ? t("cook.finish") : t("cook.next")}</Text>
          <Ionicons name={index >= total - 1 ? "checkmark" : "chevron-forward"} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  progressText: { fontSize: 14, fontWeight: "700", color: BRAND, textAlign: "center" },
  headerSpacer: { width: 40, height: 40 },
  dotsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 24, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D8D3CC" },
  dotActive: { width: 22, backgroundColor: COPPER },
  mediaWrap: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", backgroundColor: "#ECE8E1" },
  mediaInner: { flex: 1, width: "100%" },
  mediaImage: { width: "100%", height: "100%" },
  mediaFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ECE8E1" },
  pager: { flex: 1, marginTop: 12 },
  pageContent: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, flexGrow: 1, justifyContent: "center" },
  stepText: { fontSize: 28, lineHeight: 42, fontWeight: "600", color: TEXT },
  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F3E5F5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 20, borderLeftWidth: 3, borderLeftColor: PURPLE },
  tipText: { flex: 1, fontSize: 15, lineHeight: 22, color: PURPLE },
  timerWrap: { marginTop: 18, alignSelf: "flex-start" },
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: BG },
  navBtn: { flex: 1, height: 56, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  navBtnPrimary: { backgroundColor: BRAND },
  navBtnSecondary: { backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER },
  navBtnDisabled: { opacity: 0.5 },
  navBtnPrimaryText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  navBtnSecondaryText: { fontSize: 16, fontWeight: "800", color: BRAND },
  navBtnDisabledText: { color: SUB },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  centerText: { fontSize: 16, fontWeight: "600", color: SUB, textAlign: "center" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 10 },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#4CAF50", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  doneTitle: { fontSize: 30, fontWeight: "900", color: BRAND, textAlign: "center" },
  doneBody: { fontSize: 16, lineHeight: 24, color: SUB, textAlign: "center", marginBottom: 4 },
  doneRecipe: { fontSize: 15, fontWeight: "700", color: COPPER, textAlign: "center", marginBottom: 18 },
  primaryWideBtn: { width: "100%", height: 56, borderRadius: 14, backgroundColor: BRAND, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primaryWideBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  secondaryWideBtn: { width: "100%", height: 56, borderRadius: 14, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryWideBtnText: { fontSize: 15, fontWeight: "700", color: BRAND },
});
