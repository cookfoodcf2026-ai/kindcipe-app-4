/**
 * Onboarding 新用戶引導流程（按產品文件 v1.2）
 * 
 * 第一屏：Sign In（登入）
 * 第二屏：你想做什麼？（建立 vs 加入廚房）
 * 第三屏 A：建立廚房（廚房名字 + 你的名字）
 * 第三屏 B：加入廚房（輸入邀請碼）
 * 第四屏：匯入食譜（平台選擇 → URL/文字輸入 → 預覽 + 分類選擇 → 保存）
 */

import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { track, Events } from "@/lib/analytics";
import { getAppLogo } from "@/lib/logo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc, apiClient } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/errors";

const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;

type OnboardingStep = "signin" | "choice" | "create" | "join" | "plan" | "import";

export default function OnboardingScreen(
  ) {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout, switchFamily } = useAuth();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<OnboardingStep>("signin");
  const [loading, setLoading] = useState(false);
  // Onboarding quick-plan（OpenCode 鎖定設計：自動計劃 → 開始使用）
  const [planLoading, setPlanLoading] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptConflict, setAcceptConflict] = useState(false);
  const [swapCount, setSwapCount] = useState(0);
  const [pool, setPool] = useState<any[][] | null>(null);
  const [slotPick, setSlotPick] = useState<number[]>([0, 0, 0, 0]);
  // 16:30 之後買餸＋煮飯已經趕唔切今晚 → 預設排聽日（用戶仍可切換）
  const autoTomorrow = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() >= 16 * 60 + 30;
  })();
  const [forceTomorrow, setForceTomorrow] = useState<boolean | null>(null);
  const planIsTomorrow = forceTomorrow ?? autoTomorrow;
  const planWord = planIsTomorrow ? "聽晚" : "今晚";
  const planCta = `幫我計劃${planWord}`;
  const [selection, setSelection] = useState<any[] | null>(null);

  // 建立廚房表單
  const [kitchenName, setKitchenName] = useState("");
  const [userName, setUserName] = useState("");
   
  // 加入廚房表單
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // 用戶資料（用於存儲 onboarding 狀態）
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  // 完成 Onboarding（以用戶 ID 為 key，確保不同帳號都會看到 onboarding）
  const finishOnboarding = async () => {
    track(Events.OnboardingCompleted);
    try {
      setLoading(true);
      const userId = meQuery.data?.id;
      if (userId) {
        const key = getOnboardingKey(userId);
        await AsyncStorage.setItem(key, "true");
      }
      // 等待一下確保狀態更新
      await new Promise(resolve => setTimeout(resolve, 200));
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Onboarding 完成失敗:", error);
      setLoading(false);
    }
  };

  /** 用戶揀完日數才真正配餐（1 = 今晚，2 = 今晚＋聽晚） */
  const runQuickPlan = async (opts?: { swap?: boolean }) => {
    setPlanLoading(true);
    setPlanError(null);
    setAcceptError(null);
    setAcceptConflict(false);
    try {
      const base = new Date();
      if (planIsTomorrow) base.setDate(base.getDate() + 1);
      const startDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
      const excludeNames = opts?.swap ? (planData?.days?.[0]?.recipes ?? []).map((r: any) => r.name) : undefined;
      const res: any = await apiClient.quickPlan.suggest.mutate({
        startDate,
        days: 1,
        servings: 4,
        starter: true,
        // swap 時要跳去下一組（A→B→C）；唔加 1 會一直抽返 A 再被 excludeNames 清空 → fallback 亂抽
        starterVariant: Math.min(2, swapCount + (opts?.swap ? 1 : 0)),
        ...(excludeNames ? { excludeNames } : {}),
      });
      setPlanData(res);
      setSelection(res?.days?.[0]?.recipes ?? null);
      setSlotPick([0, 0, 0, 0]);
      if (!pool) {
        try {
          const sets: any = await (apiClient.quickPlan as any).starterPool.query();
          if (Array.isArray(sets) && sets.length) setPool(sets);
        } catch {}
      }
    } catch (e: any) {
      setPlanError(String(e?.message ?? ""));
    } finally {
      setPlanLoading(false);
    }
  };

  /** 逐道換：每格記住自己嘅組別索引，A→B→C 輪換（唔靠比對 recipeId，避免名字/ref 差異） */
  const swapDish = (idx: number) => {
    if (!pool || !selection || swapCount >= 2) return;
    const setCount = pool.length;
    if (setCount < 2) return;
    const nextSet = (slotPick[idx] + 1) % setCount;
    const next = pool[nextSet]?.[idx];
    if (!next) return;
    const ns = selection.slice();
    ns[idx] = next;
    setSelection(ns);
    setSlotPick((prev) => {
      const cp = prev.slice();
      cp[idx] = nextSet;
      return cp;
    });
    setSwapCount((c) => c + 1);
  };

  /** 揀指定日子：清走現有結果，返回未生成狀態，等用戶重新撳「幫我計劃」 */
  const pickPlanDay = (tomorrow: boolean) => {
    setForceTomorrow(tomorrow);
    setPlanData(null);
    setSelection(null);
    setPlanError(null);
    setAcceptError(null);
    setAcceptConflict(false);
    setSwapCount(0);
    setSlotPick([0, 0, 0, 0]);
  };

  /** 換日重排：切換到另一日 */
  const switchPlanDay = () => {
    pickPlanDay(!planIsTomorrow);
  };

  const dateToggle = (
    <TouchableOpacity onPress={switchPlanDay} style={{ paddingVertical: 10, alignItems: "center" }}>
      <Text style={{ color: "#2F5D7C", fontSize: 13, fontWeight: "700" }}>
        {planIsTomorrow ? "改為今晚 ›" : "改為聽晚 ›"}
      </Text>
    </TouchableOpacity>
  );

  const acceptQuickPlan = async () => {
    if (!planData?.days?.length) return;
    setPlanLoading(true);
    setAcceptError(null);
    setAcceptConflict(false);
    try {
      const dayRecipes = selection && selection.length ? selection : (planData.days[0]?.recipes ?? []);
      const items = planData.days.flatMap((d: any, di: number) =>
        (di === 0 && selection ? dayRecipes : (d.recipes ?? [])).map((r: any) => ({
          date: d.date,
          buyDate: d.date,
          recipeId: r.recipeId,
          recipeName: r.name,
          recipeNameEn: r.nameEn ?? null,
          recipeNameFil: r.nameFil ?? null,
          recipeNameId: r.nameId ?? null,
          recipeImage: r.thumbnailUrl ?? r.image ?? null,
          ingredients: (r.ingredients ?? []).map((i: any) => ({
            name: i.name,
            nameEn: i.nameEn,
            nameFil: i.nameFil,
            nameId: i.nameId,
            quantity: String(i.quantity ?? ""),
            unit: String(i.unit ?? ""),
            category: i.category ?? "",
          })),
        })),
      );
      await apiClient.quickPlan.accept.mutate({ clientRequestId: `onboarding-${Date.now()}`, items });
      await finishOnboarding();
    } catch (e: any) {
      const code = e?.data?.code ?? e?.code;
      setAcceptConflict(code === "CONFLICT");
      setAcceptError(String(e?.message ?? "") || t("儲存計劃失敗" as any));
      setPlanLoading(false);
    }
  };
  

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    setInviteCode(data);
  };

  // QR Code Scanner modal
  if (showScanner) {
    return (
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>{t("onboarding.scanQrCode")}</Text>
          <TouchableOpacity
            style={styles.scannerCloseButton}
            onPress={() => { setShowScanner(false); scannedRef.current = false; }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    );
  }

  // 第一屏：Sign In
  if (step === "signin") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { flex: 0 }]}>
            <Image
              source={getAppLogo()}
              style={styles.logoImageSmall}
              resizeMode="contain"
            />
            <View style={styles.heroImageWrap}>
              <Image
                source={require("../assets/onbardingcard-v1.jpeg")}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.heroTitle}>{t("onboarding.heroTitle")}</Text>
            <Text style={styles.heroSubtitle}>{t("onboarding.heroSubtitle")}</Text>
            <Text style={styles.heroDesc}>{t("onboarding.heroDesc")}</Text>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { track(Events.SignupStarted); setStep("choice"); }}
          >
            <Text style={styles.primaryBtnText}>{t("onboarding.start")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={logout}
          >
            <Text style={styles.secondaryBtnText}>{t("onboarding.backToLogin")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第二屏：你想做什麼？
  if (step === "choice") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("signin")}>
            <Text style={styles.backBtn}>{t("onboarding.back")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { flex: 0, paddingVertical: 24 }]}>
            <Image
              source={getAppLogo()}
              style={styles.logoImageSmall}
              resizeMode="contain"
            />
            <Text style={styles.title}>{t("onboarding.startTitle")}</Text>
            <Text style={styles.subtitle}>{t("onboarding.startSubtitle")}</Text>
          </View>

          <View style={styles.choiceContainer}>
            <TouchableOpacity
              style={[styles.choiceBtn, styles.choiceBtnPrimary]}
              onPress={() => setStep("create")}
            >
              <View style={styles.choiceIconWrapper}>
                <View style={styles.choiceIconCircle}>
                  <Text style={styles.choiceIconText}>+</Text>
                </View>
              </View>
              <Text style={styles.choiceTitle}>{t("kitchen.createKitchen")}</Text>
              <Text style={styles.choiceDesc}>
                建立你的家庭廚房{"\n"}
                設定廚房名稱，邀請家人加入{"\n"}
                {t("一起規劃餐單、同步購物清單" as any)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceBtn, styles.choiceBtnSecondary]}
              onPress={() => setStep("join")}
            >
              <View style={styles.choiceIconWrapper}>
                <View style={styles.choiceIconCircleSecondary}>
                  <Text style={styles.choiceIconTextSecondary}>←</Text>
                </View>
              </View>
              <Text style={styles.choiceTitle}>{t("kitchen.joinKitchen")}</Text>
              <Text style={styles.choiceDesc}>
                輸入家人給你的邀請碼{"\n"}
                加入已有廚房，與家人共享{"\n"}
                {t("食譜、餐單、購買即時同步" as any)}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 第三屏 A：建立廚房
  if (step === "create") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("choice")}>
            <Text style={styles.backBtn}>{t("onboarding.back")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>{t("onboarding.setupKitchen")}</Text>
          <Text style={styles.formSubtitle}>{t("onboarding.setupKitchenSub")}</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("onboarding.kitchenNameLabel")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("onboarding.kitchenNamePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={kitchenName}
              onChangeText={setKitchenName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("onboarding.yourName")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("onboarding.yourNamePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={userName}
              onChangeText={setUserName}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!kitchenName || !userName) && styles.disabledBtn,
            ]}
                onPress={async () => {
              try {
                setLoading(true);
                if (meQuery.data?.activeFamilyId) {
                  setStep("plan");
                  return;
                }
                const created: any = await apiClient.family.create.mutate({ name: kitchenName, nickname: userName.trim() || undefined });
                // 將用戶填嘅名寫入真正嘅顯示名（users.name）——同 Settings 同一條正式路徑。
                const trimmedName = userName.trim();
                if (trimmedName) {
                  try { await apiClient.auth.updateProfile.mutate({ name: trimmedName }); } catch { /* 唔阻塞建廚房 */ }
                }
                // 建立後即刻切換到新廚房，否則 Settings 會停留喺「未加入廚房」＋ 睇唔到 quota。
                const newId = created?.id != null ? String(created.id) : null;
                if (newId) {
                  await switchFamily(newId);
                } else {
                  await utils.family.list.invalidate();
                }
                await Promise.all([
                  utils.family.list.invalidate(),
                  utils.family.get.invalidate(),
                  utils.family.usage.invalidate(),
                  utils.auth.me.invalidate(),
                ]);
                setStep("plan");
              } catch (err: any) {
                const msg = friendlyError(err) || err?.data?.message || "";
                console.error("建立廚房失敗:", err);
                Alert.alert(t("建立廚房失敗" as any), msg || t("請重試" as any));
              } finally {
                setLoading(false);
              }
            }}
            disabled={!kitchenName || !userName || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#183B56" size={18} />
                <Text style={styles.parseProgressText}>{t("onboarding.creating")}</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{t("kitchen.createKitchen")}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.formNote}>{t("onboarding.formNote")}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 第三屏 B：加入廚房
  if (step === "join") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("choice")}>
            <Text style={styles.backBtn}>{t("onboarding.back")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{t("onboarding.joinFamilyKitchen")}</Text>
          <Text style={styles.formSubtitle}>{t("onboarding.joinFamilyKitchenSub")}</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t("kitchen.inviteCode")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("onboarding.invitePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.scanQrButton}
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  const perm = await requestCameraPermission();
                  if (!perm.granted) {
                    Alert.alert(t("需要相機權限" as any), t("請在設定中允許 Kindcipe 使用相機以掃描 QR Code" as any));
                    return;
                  }
                }
                scannedRef.current = false;
                setShowScanner(true);
              }}
            >
              <Ionicons name="camera-outline" size={18} color="#183B56" />
              <Text style={styles.scanQrButtonText}>{t("onboarding.scanQrBtn")}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !inviteCode && styles.disabledBtn,
            ]}
            onPress={async () => {
              try {
                setLoading(true);
                setJoinError(null);
                const joined: any = await apiClient.family.join.mutate({ inviteCode: inviteCode.trim() });
                // 加入後即刻切換到該廚房，否則 Settings 會停留喺「未加入廚房」＋ 睇唔到 quota。
                // 後端 family.join 回傳 { success, family }（亦有舊格式回傳 id）→ 兩種都支援。
                const joinedId = joined?.family?.id != null ? String(joined.family.id)
                  : (joined?.id != null ? String(joined.id) : null);
                if (joinedId) {
                  await switchFamily(joinedId);
                } else {
                  await utils.family.list.invalidate();
                }
                await Promise.all([
                  utils.family.list.invalidate(),
                  utils.family.get.invalidate(),
                  utils.family.usage.invalidate(),
                  utils.auth.me.invalidate(),
                ]);
                // 加入廚房後直接入「排餐」一頁，唔再行 guide。
                setStep("plan");
              } catch (err: any) {
                const msg = friendlyError(err) || err?.data?.message || "";
                console.error("加入廚房失敗:", err);
                setJoinError(msg || t("請重試" as any));
              } finally {
                setLoading(false);
              }
            }}
            disabled={!inviteCode.trim() || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#183B56" size={18} />
                <Text style={styles.parseProgressText}>{t("onboarding.joining")}</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{t("kitchen.joinKitchen")}</Text>
            )}
          </TouchableOpacity>

          {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

          <Text style={styles.formNote}>{t("onboarding.inviteNote")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 第四屏：匯入食譜（跳轉到完整匯入頁面）
  if (step === "plan") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            padding: 20,
            paddingBottom: 12,
            justifyContent: !planData && !planLoading ? "center" : "flex-start",
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#183B56", marginBottom: 6 }}>
            {planData
              ? (planData.days?.length ?? 1) > 1
                ? `幫你排好 ${planData.days.length} 日`
                : `${planWord}食呢 4 道`
              : `想我幫你計劃${planWord}晚餐？`}
          </Text>
          <Text style={{ fontSize: 14, color: "#5F6F80", marginBottom: 16 }}>
            {planData
              ? (() => {
                  const dishes = selection ?? planData.days?.[0]?.recipes ?? [];
                  const maxMin = Math.max(0, ...dishes.map((r: any) => Number(r.cookTime) || 0));
                  const ingCount = new Set(
                    dishes.flatMap((r: any) => (r.ingredients ?? []).map((i: any) => String(i.name ?? "").trim()).filter(Boolean)),
                  ).size;
                  const parts = ["3 餸 1 湯"];
                  if (maxMin > 0) parts.push(`同時煮約 ${maxMin} 分鐘`);
                  if (ingCount > 0) parts.push(`${ingCount} 樣食材已合併成一張清單`);
                  return parts.join(" · ");
                })()
              : t("onboarding.planSubtitle")}
          </Text>

          {planLoading && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator color="#183B56" />
              <Text style={{ marginTop: 10, color: "#5F6F80" }}>正在配餐…</Text>
            </View>
          )}

          {!!planError && !planLoading && (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <Text style={{ color: "#92400E", fontWeight: "700", marginBottom: 4 }}>暫時配唔到</Text>
              <Text style={{ color: "#92400E", fontSize: 13 }}>你可以先入 app，之後喺「計劃」再試。</Text>
            </View>
          )}

          {!planLoading && planData?.days?.map((d: any) => (
            <View key={d.date} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#183B56", marginBottom: 8 }}>{d.date}</Text>
              {(d.recipes ?? []).map((r0: any, idx: number) => {
                const r = selection && idx < selection.length ? selection[idx] : r0;
                const canSwap = !!pool && swapCount < 2;
                return (
                  <View key={`${r.recipeId}-${idx}`} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E6DED4", flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#183B56" }}>{r.name}</Text>
                      <Text style={{ fontSize: 12, color: "#5F6F80", marginTop: 2 }}>
                        {r.cookTime ? `${r.cookTime} 分鐘` : ""}{r.servings ? ` · ${r.servings} 人` : ""}
                      </Text>
                    </View>
                    {canSwap && (
                      <TouchableOpacity
                        onPress={() => swapDish(idx)}
                        style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "transparent", borderWidth: 1, borderColor: "#E0D8CE" }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "600", color: "#8A8A8E" }}>換</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {!planLoading && !planData && !planError && (
            <>
              <TouchableOpacity
                style={[styles.genPill, { marginTop: 8 }]}
                onPress={() => runQuickPlan()}
              >
                <View style={styles.genPillIcon}><Ionicons name="moon-outline" size={16} color="#fff" /></View>
                <Text style={styles.genPillText}>{planCta}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              {dateToggle}
            </>
          )}

          {!planLoading && !!planData && (
            <Text style={{ color: swapCount >= 2 ? "#92400E" : "#5F6F80", fontSize: swapCount >= 2 ? 13 : 12, marginTop: 4, marginBottom: 6, textAlign: "center", lineHeight: swapCount >= 2 ? 20 : 16 }}>
              {swapCount >= 2
                ? "你已經換咗 2 次食譜 —— 不如直接開始，入到 APP 可以睇更多食譜、自己排餐同加自己嘅菜。"
                : `每道菜都可以撳「換」，仲可以換 ${2 - swapCount} 次`}
            </Text>
          )}
        </ScrollView>

        {!planLoading && !!planData && (
          <View style={styles.planFooter}>
            {acceptError ? (
              <View style={styles.acceptErrorCard}>
                {acceptConflict ? (
                  <>
                    <Text style={styles.acceptErrorTitle}>
                      {t("當日已有{{meal}}" as any, { meal: t("晚餐" as any) })}
                    </Text>
                    <View style={styles.conflictDateRow}>
                      <TouchableOpacity onPress={() => pickPlanDay(false)} style={styles.conflictDateBtn}>
                        <Text style={styles.conflictDateBtnText}>今晚</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => pickPlanDay(true)} style={styles.conflictDateBtn}>
                        <Text style={styles.conflictDateBtnText}>聽晚</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.acceptErrorTitle}>{t("儲存計劃失敗" as any)}</Text>
                    <Text style={styles.acceptErrorBody}>{acceptError}</Text>
                    <TouchableOpacity onPress={() => setAcceptError(null)} style={styles.acceptErrorBack}>
                      <Text style={styles.acceptErrorBackText}>{t("onboarding.back")}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.genPill}
                onPress={acceptQuickPlan}
                disabled={!planData}
              >
                <View style={styles.genPillIcon}><Ionicons name="checkmark" size={16} color="#fff" /></View>
                <Text style={styles.genPillText}>
                  {swapCount >= 2 ? "開始使用，查看更多食譜" : "開始使用"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (step === "import") {
    router.replace("/import?onboarding=true");
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#183B56" />
          <Text style={{ fontSize: 16, color: "#183B56", marginTop: 16, fontWeight: "700" }}>
            正在載入完整匯入功能...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8EF",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    color: "#183B56",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  logoImage: {
    width: 168,
    height: 168,
    marginBottom: 16,
  },
  logoImageSmall: {
    width: 126,
    height: 126,
    minHeight: 126,
    flexShrink: 0,
    marginBottom: 12,
  },
  heroImageWrap: {
    width: "92%",
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTitle: {
    maxWidth: "100%",
    paddingHorizontal: 4,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    color: "#183B56",
    textAlign: "center",
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#183B56",
    textAlign: "center",
    marginBottom: 12,
  },
  heroDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#183B56",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 40,
  },
  formNote: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
  desc: {
    fontSize: 16,
    color: "#333D4B",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#183B56",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#183B56",
  },
  secondaryBtnText: {
    color: "#183B56",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  choiceContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  choiceBtn: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  choiceBtnPrimary: {
    borderWidth: 2,
    borderColor: "#183B56",
  },
  choiceBtnSecondary: {
    borderWidth: 2,
    borderColor: "#EBEBEB",
  },
  choiceEmoji: {
    fontSize: 48,
  },
  choiceIconWrapper: {
    marginBottom: 4,
  },
  choiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#183B56",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  choiceIconCircleSecondary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconTextSecondary: {
    fontSize: 24,
    fontWeight: "700",
    color: "#183B56",
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#183B56",
    textAlign: "center",
  },
  choiceDesc: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  formContainer: {
    flex: 1,
    paddingVertical: 24,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#183B56",
    marginBottom: 12,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333D4B",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333D4B",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  scrollContent: {
    flexGrow: 1,
  },
  guideWrap: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  guideHeader: {
    alignItems: "center",
    paddingTop: 16,
  },
  guideLogo: {
    width: 70,
    height: 70,
    marginBottom: 8,
  },
  benefitList: {
    gap: 10,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  benefitIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#183B56",
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
  },
  carouselWrap: {
    flex: 1,
    justifyContent: "center",
    marginHorizontal: -20,
  },
  slide: {
    width: Dimensions.get("window").width,
    height: "100%",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F5F1EA",
  },
  slideImg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  slideScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: "rgba(255,251,240,0.55)",
  },
  slideTop: {
    position: "absolute",
    top: 24,
    left: 22,
    right: 22,
    zIndex: 10,
  },
  slideTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 26,
    fontWeight: "900",
    color: "#4A3728",
    lineHeight: 34,
  },
  slideCaption: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    color: "#7A6553",
    marginTop: 6,
    fontWeight: "600",
  },
  slideUI: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 84,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    gap: 12,
    zIndex: 5,
  },
  uiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uiCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  uiWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  uiDay: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
  },
  uiDayActive: {
    backgroundColor: "#183B56",
  },
  uiDayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  uiDayTextActive: {
    color: "#fff",
  },
  uiDayMeal: {
    fontSize: 9,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  uiDayMealActive: {
    color: "#D1D5DB",
  },
  uiList: {
    gap: 8,
  },
  uiItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uiCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  uiItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  trialCodeLink: { alignSelf: "center", marginTop: 14, paddingVertical: 8 },
  trialCodeLinkText: { color: "#183B56", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  slideCTA: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 22,
    alignItems: "center",
    zIndex: 20,
  },
  genPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#B96A50",
    borderRadius: 40,
    minHeight: 58,
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  genPillIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  genPillText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#183B56",
    width: 20,
  },
  webNavRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 14,
  },
  webNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  webNavBtnDisabled: {
    opacity: 0.5,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipBtnText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  platformContainer: {
    gap: 12,
    paddingVertical: 20,
  },
  importMethodTabs: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  importMethodTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  importMethodTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  importMethodTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  importMethodTabTextActive: {
    color: "#183B56",
    fontWeight: "800",
  },
  supportedPlatforms: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  platformBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformBadgeText: {
    fontSize: 12,
    color: "#183B56",
    fontWeight: "600",
  },
  textAreaInput: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#F5F5F5",
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#183B56",
    marginBottom: 16,
  },
  previewInfoContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  previewInfo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  previewInfoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  previewInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#183B56",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    overflow: "hidden",
  },
  picker: {
    color: "#183B56",
    backgroundColor: "#FFFFFF",
  },
  ingredientListContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    padding: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  ingredientCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#183B56",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientCheckmark: {
    fontSize: 12,
    color: "#183B56",
    fontWeight: "700",
  },
  ingredientItem: {
    flex: 1,
    fontSize: 14,
    color: "#333D4B",
    lineHeight: 20,
  },
  parseProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  parseProgressText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scanQrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: "#183B56",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  scanQrButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#183B56",
  },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  scannerText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 24,
  },
  scannerCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  planFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: "#FFF8EF",
  },
  acceptErrorCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  acceptErrorTitle: {
    color: "#92400E",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  acceptErrorBody: {
    color: "#92400E",
    fontSize: 13,
    lineHeight: 19,
  },
  conflictDateRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  conflictDateBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D97706",
  },
  conflictDateBtnText: {
    color: "#92400E",
    fontSize: 14,
    fontWeight: "800",
  },
  acceptErrorBack: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D97706",
  },
  acceptErrorBackText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
  },
});
