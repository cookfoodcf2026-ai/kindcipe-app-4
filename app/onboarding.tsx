/**
 * Onboarding 新用戶引導流程（按產品文件 v1.2）
 * 
 * 第一屏：Sign In（登入）
 * 第二屏：你想做什麼？（建立 vs 加入廚房）
 * 第三屏 A：建立廚房（廚房名字 + 你的名字）
 * 第三屏 B：加入廚房（輸入邀請碼）
 * 第四屏：空廚房引導（三步說明）
 * 第五屏：匯入食譜（平台選擇 → URL/文字輸入 → 預覽 + 分類選擇 → 保存）
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

const { width, height } = Dimensions.get("window");
const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;

type OnboardingStep = "signin" | "choice" | "create" | "join" | "guide" | "import";

const GUIDE_SLIDES = [
  { img: require("../assets/slide1.jpg"), title: "今晚食咩？AI 一鍵搞定", caption: "自動配好三餸一湯，唔使再煩", ui: null as string | null },
  { img: require("../assets/slide2.jpg"), title: "家庭排餐，一目了然", caption: "僱主與工人姐姐即時同步", ui: "mealplan" as string | null },
  { img: require("../assets/slide3.jpg"), title: "自動生成雙語買餸單", caption: "一鍵 Send 畀姐姐，買餸零錯漏", ui: "shopping" as string | null },
  { img: require("../assets/slide4.jpg"), title: "家人溝通零時差", caption: "排餐、清單、買餸，一個 App 搞掂", ui: null as string | null },
];

export default function OnboardingScreen(
  ) {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("signin");
  const [guidePage, setGuidePage] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // 建立廚房表單
  const [kitchenName, setKitchenName] = useState("");
  const [userName, setUserName] = useState("");
   
  // 加入廚房表單
  const [inviteCode, setInviteCode] = useState("");
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
        <View style={styles.content}>
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
          <Text style={styles.heroTitle} adjustsFontSizeToFit numberOfLines={1}>{t("onboarding.heroTitle")}</Text>
          <Text style={styles.heroSubtitle}>{t("onboarding.heroSubtitle")}</Text>
          <Text style={styles.heroDesc}>{t("onboarding.heroDesc")}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setStep("choice")}
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

        <View style={styles.content}>
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
                  setStep("guide");
                  return;
                }
                await apiClient.family.create.mutate({ name: kitchenName, nickname: userName.trim() || undefined });
                setStep("guide");
              } catch (err: any) {
                const msg = friendlyError(err) || err?.data?.message || "";
                console.error("建立廚房失敗:", err);
                Alert.alert("建立廚房失敗", msg || "請重試");
              } finally {
                setLoading(false);
              }
            }}
            disabled={!kitchenName || !userName || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#013E77" size={18} />
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
                    Alert.alert("需要相機權限", "請在設定中允許 Kindcipe 使用相機以掃描 QR Code");
                    return;
                  }
                }
                scannedRef.current = false;
                setShowScanner(true);
              }}
            >
              <Ionicons name="camera-outline" size={18} color="#013E77" />
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
                if (meQuery.data?.activeFamilyId) {
                  setStep("guide");
                  return;
                }
                await apiClient.family.join.mutate({ inviteCode: inviteCode.trim() });
                setStep("guide");
              } catch (err: any) {
                const msg = friendlyError(err) || err?.data?.message || "";
                console.error("加入廚房失敗:", err);
                Alert.alert("加入廚房失敗", msg || "請重試");
              } finally {
                setLoading(false);
              }
            }}
            disabled={!inviteCode.trim() || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#013E77" size={18} />
                <Text style={styles.parseProgressText}>{t("onboarding.joining")}</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{t("kitchen.joinKitchen")}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.formNote}>{t("onboarding.inviteNote")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 第四屏：空廚房引導
  if (step === "guide") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guideWrap}>
          <View style={styles.guideHeader}>
            <Image
              source={getAppLogo()}
              style={styles.guideLogo}
              resizeMode="contain"
            />
          </View>

          {/* Full-bleed 混合式 Carousel：AI 背景 + 覆蓋標題 + (app UI) + 浮動 CTA */}
          <View style={styles.carouselWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={width}
              snapToAlignment="start"
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => setGuidePage(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))}
            >
              {GUIDE_SLIDES.map((slide, i) => (
                <View key={i} style={styles.slide}>
                  <Image source={slide.img} style={styles.slideImg} resizeMode="cover" />
                  <View style={styles.slideScrim} />

                  <View style={styles.slideTop}>
                    <Text style={styles.slideTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{t(slide.title as any)}</Text>
                    <Text style={styles.slideCaption} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{t(slide.caption as any)}</Text>
                  </View>

                  {slide.ui === "mealplan" && (
                    <View style={styles.slideUI}>
                      <View style={styles.uiCardHeader}>
                        <Ionicons name="calendar-outline" size={16} color="#013E77" />
                        <Text style={styles.uiCardTitle}>{t("onboarding.uiWeekMenu")}</Text>
                      </View>
                      <View style={styles.uiWeekRow}>
                        {[
                          { d: t("一" as any), meal: t("湯" as any) },
                          { d: t("二" as any), meal: t("魚" as any) },
                          { d: t("三" as any), meal: t("3餸1湯" as any), active: true },
                          { d: t("四" as any), meal: t("菜" as any) },
                          { d: t("五" as any), meal: t("肉" as any) },
                          { d: t("六" as any), meal: t("外出" as any) },
                          { d: t("日" as any), meal: t("湯" as any) },
                        ].map((x) => (
                          <View key={x.d} style={[styles.uiDay, x.active && styles.uiDayActive]}>
                            <Text style={[styles.uiDayText, x.active && styles.uiDayTextActive]}>{x.d}</Text>
                            <Text style={[styles.uiDayMeal, x.active && styles.uiDayMealActive]} numberOfLines={1}>{x.meal}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {slide.ui === "shopping" && (
                    <View style={styles.slideUI}>
                      <View style={styles.uiCardHeader}>
                        <Ionicons name="cart-outline" size={16} color="#013E77" />
                        <Text style={styles.uiCardTitle}>{t("onboarding.uiShoppingList")}</Text>
                      </View>
                      <View style={styles.uiList}>
                        {["番茄", "馬鈴薯", "青蔥"].map((it) => (
                          <View key={it} style={styles.uiItem}>
                            <View style={styles.uiCheck}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                            <Text style={styles.uiItemText}>{it}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {i === GUIDE_SLIDES.length - 1 && (
                    <View style={styles.slideCTA}>
                      <TouchableOpacity
                        style={styles.genPill}
                        activeOpacity={0.85}
                        onPress={finishOnboarding}
                        disabled={loading}
                      >
                        <View style={styles.genPillIcon}><Ionicons name="sparkles" size={16} color="#fff" /></View>
                        <Text style={styles.genPillText}>{t("onboarding.startUsing")}</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.dotsRow}>
              {GUIDE_SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, guidePage === i && styles.dotActive]} />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={finishOnboarding}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#9CA3AF" size="small" />
            ) : (
              <Text style={styles.skipBtnText}>{t("onboarding.skip")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第五屏：匯入食譜（跳轉到完整匯入頁面）
  if (step === "import") {
    router.replace("/import?onboarding=true");
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#013E77" />
          <Text style={{ fontSize: 16, color: "#013E77", marginTop: 16, fontWeight: "700" }}>
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
    backgroundColor: "#FAF8F5",
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
    color: "#013E77",
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
    fontSize: 32,
    fontWeight: "900",
    color: "#013E77",
    textAlign: "center",
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#013E77",
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
    color: "#013E77",
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
    backgroundColor: "#013E77",
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
    borderColor: "#013E77",
  },
  secondaryBtnText: {
    color: "#013E77",
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
    borderColor: "#013E77",
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
    backgroundColor: "#013E77",
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
    color: "#013E77",
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#013E77",
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
    color: "#013E77",
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
    color: "#013E77",
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
    backgroundColor: "#013E77",
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
    paddingVertical: 14,
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
    fontSize: 17,
    fontWeight: "800",
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
    backgroundColor: "#013E77",
    width: 20,
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
    color: "#013E77",
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
    color: "#013E77",
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
    color: "#013E77",
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
    color: "#013E77",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    overflow: "hidden",
  },
  picker: {
    color: "#013E77",
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
    borderColor: "#013E77",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientCheckmark: {
    fontSize: 12,
    color: "#013E77",
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
    borderColor: "#013E77",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  scanQrButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
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
});
