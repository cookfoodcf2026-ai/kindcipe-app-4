/**
 * 根佈局
 *
 * 認證策略：Token-based 模式
 * - 登入後 token 存於 AsyncStorage（kindcipe_auth_token）
 * - tRPC 請求透過 Authorization: Bearer header 附帶 token
 *
 * Onboarding 策略：
 * - onboarding 狀態以用戶 ID 為 key 存儲
 * - 確保不同帳戶都會看到 onboarding
 * - 同一帳戶完成後不再重複顯示
 */
import { GestureHandlerRootView } from "react-native-gesture-handler";
// web OAuth 回程 token 必須喺 router mount 前擷取
import "../lib/webAuthCapture";
import "@/lib/webAlertShim";
import { useEffect, useState, useCallback, useRef } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState, usePathname } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { PendingShareProvider, usePendingShare } from "@/lib/pendingShare";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { trpc, createTrpcClient, onOfflineChange } from "@/lib/trpc";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, TouchableOpacity, Text, Alert, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { initLanguage } from "@/lib/i18n";
import { useTranslation, I18nextProvider } from "react-i18next";
import { authenticateBiometric, isBiometricAvailable, isBiometricEnabled } from "@/lib/auth";
import { authGuardRedirect } from "@/lib/authGuardRedirect";
import { getLoginNext } from "@/lib/loginNext";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { CrashScreen } from "@/src/components/CrashScreen";
import { initGlobalErrorHandler } from "@/lib/global-error-handler";
import { initIAP } from "@/lib/purchase";
import NetInfo from "@react-native-community/netinfo";
import { maybeRequestReview } from "@/lib/review";
import { initAnalytics, identifyUser, resetAnalytics, track, Events, loadAnalyticsOptOut, analyticsEnabled } from "@/lib/analytics";
import { ToastProvider } from "@/src/components/Toast";
import { AppleRelayLinkPrompt } from "@/src/components/AppleRelayLinkPrompt";
import { AnalyticsConsentCard } from "@/src/components/AnalyticsConsentCard";
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !__DEV__ && SENTRY_DSN.length > 0,
  debug: __DEV__ && SENTRY_DSN.length > 0,
  tracesSampleRate: __DEV__ ? 0 : 0.1,
});

initGlobalErrorHandler();
void SplashScreen.preventAutoHideAsync();

// 以用戶 ID 為 key，確保不同帳戶都有獨立的 onboarding 狀態
const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;
const PENDING_ADMIN_REDIRECT_KEY = "kindcipe_pending_admin_redirect";
const LOGIN_NEXT_KEY = "kindcipe_login_next";

// Helper functions for clipboard detection
function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("instagram.com") || u.includes("ig.me")) return "Instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return "Facebook";
  if (u.includes("tiktok.com") || u.includes("douyin.com")) return "TikTok/抖音";
  if (u.includes("weibo.com")) return "微博";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "B 站";
  return null;
}

// 高成功率平台清單（顯示提示）
const SUPPORTED_PLATFORMS = ["Instagram", "YouTube", "Facebook"];

const safeParseClipboardHint = (raw: string): { url?: string; timestamp?: number } | null => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * 接收系統 Share Sheet（IG / YouTube / 小紅書 / Safari…）分享過嚟嘅內容。
 *
 * 單一導航擁有者原則：呢度**只負責把分享資料寫入 AsyncStorage（pendingShare）**，
 * 完全唔做 router.push —— 導航一律交由 AuthGuard 呢個唯一負責人處理。
 * （避免多個導航者互相爭奪 → 之前 /share timer 蓋走 /import 就係 race。）
 */
const PENDING_SHARE_KEY = "kindcipe_pending_share";

function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { setPending } = usePendingShare();

  useEffect(() => {
    if (!hasShareIntent) return;
    try {
      const rawText = String(shareIntent.text ?? "").trim();
      // webUrl 可能係 shareIntent.webUrl，或 text 內含嘅 URL
      const webUrl = shareIntent.webUrl || (rawText && isValidUrl(rawText) ? rawText : "");
      // Path A 關鍵：分享時 OS 通常一併提供 caption（rawText）。即使有 URL，
      // 都要保留 caption 做 sharedText —— IG/Threads/TikTok/小紅書 好多時 caption 先有食譜內容。
      const caption = rawText && rawText !== webUrl ? rawText : "";
      const imgFile = (shareIntent.files ?? []).find((f: any) =>
        String(f?.mimeType ?? "").startsWith("image/"),
      );
      const sharedImageUri = imgFile?.path ? String(imgFile.path) : "";
      const hasPayload = !!(webUrl || caption || sharedImageUri);
      const params: Record<string, string> = {
        ...(webUrl ? { clipboardUrl: webUrl, autoParse: "1" } : {}),
        ...(caption ? { sharedText: caption } : {}),
        ...(sharedImageUri ? { sharedImageUri } : {}),
        _ts: String(Date.now()),
      };
      const kind = sharedImageUri && !webUrl ? "image" : webUrl ? (caption ? "url+caption" : "url") : caption ? "text" : "empty";
      track(Events.ShareReceived, {
        kind,
        platform: webUrl ? (detectPlatform(webUrl) ?? "unknown") : "",
      });
      if (hasPayload) {
        // 暫停被動剪貼板偵測，避免舊剪貼板連結蓋過分享來源
        AsyncStorage.setItem("kindcipe_clipboard_snooze", String(Date.now() + 60000)).catch(() => {});
        // 持久 fallback（冷啟／未登入後登入）
        AsyncStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(params)).catch(() => {});
        // ★ 單一 writer：即時 push 入 store → import reactive reader 立即反應（唔理 focus/timing）
        setPending(params as any);
      } else {
        track(Events.ShareFailed, { reason: "no_payload" });
      }
    } catch (e) {
      console.warn("[ShareIntent] handle failed:", e);
      track(Events.ShareFailed, { reason: "exception" });
    } finally {
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, setPending]);

  return null;
}

// queryClient 已抽出至 lib/queryClient.ts（logout 需要 queryClient.clear()）


const trpcClient = createTrpcClient();

/** Floating banner shown when the network is detected as offline. */
function OfflineBanner() {
  const { t } = useTranslation();
  const [apiOffline, setApiOffline] = useState(false);
  const [netOffline, setNetOffline] = useState(false);
  useEffect(() => onOfflineChange(setApiOffline), []);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setNetOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsub();
  }, []);
  const offline = apiOffline || netOffline;
  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: "#B91C1C",
        paddingVertical: 6,
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
        {t("common.offline" as any)}
      </Text>
    </View>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;
  const { pending: pendingShare } = usePendingShare();
  const { user, authStatus, isLoading: authLoading, refreshAuth } = useAuth();
  // segments 最新值（供非同步 callback 讀取，避免 stale closure）
  const segmentsRef = useRef<string[]>([]);
  segmentsRef.current = segments as unknown as string[];
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [showDevReset, setShowDevReset] = useState(true); // Always show for testing
  const [biometricPrompt, setBiometricPrompt] = useState(false);
  // Unlock failed, but the session is NOT invalid: keep the token and let the user retry.
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const hasCheckedClipboard = useRef(false);

  // 載入 2 秒後顯示重置按鈕
  useEffect(() => {
    const timer = setTimeout(() => setShowDevReset(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDevReset = useCallback(async () => {
    await AsyncStorage.clear();
    Alert.alert(t("已清除" as any), t("App 資料已重置，請重新啟動 App" as any));
    setShowDevReset(false);
  }, [t]);

  // 檢查 Biometric 並提示解鎖。失敗時**唔可以**清 token：biometric 失敗 ≠ session 失效，
  // 一律當 "unknown" 並讓用戶重試。
  const unlockWithBiometric = useCallback(async () => {
    setBiometricPrompt(true);
    try {
      const ok = await authenticateBiometric();
      if (ok) {
        setBiometricLocked(false);
        await refreshAuth();
      } else {
        setBiometricLocked(true);
      }
    } catch {
      setBiometricLocked(true);
    } finally {
      setBiometricPrompt(false);
      setBiometricChecked(true);
    }
  }, [refreshAuth]);

  useEffect(() => {
    (async () => {
      try {
        const available = await isBiometricAvailable();
        const enabled = await isBiometricEnabled();
        if (available && enabled) {
          await unlockWithBiometric();
        }
      } finally {
        // 確保 bootstrap 不會永久卡在 loading（即使 biometric 檢查中途 throw）
        setBiometricChecked(true);
      }
    })();
  }, [unlockWithBiometric]);

  useEffect(() => {
    void initIAP();
  }, []);

  // Identify the signed-in user (or reset on logout) for analytics.
  // Traits are deliberately non-PII (no email/name) to keep analytics clean.
  const analyticsUserId = user?.id ? String(user.id) : null;
  const analyticsRole = (user as any)?.role as string | undefined;
  const analyticsCreatedAt = (user as any)?.createdAt as string | Date | undefined;
  const analyticsFamilyRole = (user as any)?.activeFamilyRole as string | undefined;
  useEffect(() => {
    if (analyticsUserId) {
      identifyUser(analyticsUserId, {
        role: analyticsRole ?? "user",
        family_role: analyticsFamilyRole ?? null,
        signup_at: analyticsCreatedAt ? new Date(analyticsCreatedAt).toISOString() : null,
        language: i18n.language,
      });
    } else {
      resetAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsUserId, analyticsRole, analyticsFamilyRole]);

  // Persist the app language to the backend (for localized push/email), on login + whenever it changes.
  const setLanguageM = trpc.auth.setLanguage.useMutation();
  useEffect(() => {
    if (!analyticsUserId) return;
    const send = () => { try { setLanguageM.mutate({ language: i18n.language }); } catch { /* ignore */ } };
    send();
    const h = () => send();
    i18n.on("languageChanged", h);
    return () => { i18n.off("languageChanged", h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsUserId]);

  // 檢查是否已完成 Onboarding（以用戶 ID 為 key）
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const userId = user?.id;
        if (!userId) {
          // 未登入，不需要檢查
          setOnboardingChecked(true);
          return;
        }
        // 以用戶 ID 為 key，確保不同帳戶都有獨立的 onboarding 狀態
        const key = getOnboardingKey(userId);
        const val = await AsyncStorage.getItem(key);
        setOnboardingDone(val === "true");
      } catch (error) {
        console.error("檢查 onboarding 狀態失敗:", error);
      } finally {
        setOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, [user?.id]);
  
  // Global clipboard detection：開 app 時 + 由背景返前台（例如去完 IG 複製連結返嚟）都偵測
  const isLoggedIn = authStatus === "authenticated";
  const isTabsGroup = segments[0] === "(tabs)";
  const lastClipboardCheck = useRef(0);

  const promptClipboardImport = useCallback(async () => {
    try {
      const snooze = await AsyncStorage.getItem("kindcipe_clipboard_snooze");
      if (snooze && Date.now() < Number(snooze)) return;
      const text = await Clipboard.getStringAsync();
      if (!text || !isValidUrl(text.trim())) return;
      const platform = detectPlatform(text);
      if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) return;
      if (Date.now() - lastClipboardCheck.current < 3000) return;
      lastClipboardCheck.current = Date.now();

      const hintedData = await AsyncStorage.getItem("kindcipe_clipboard_hinted");
      if (hintedData) {
        const parsed = safeParseClipboardHint(hintedData);
        const url = parsed?.url;
        const timestamp = parsed?.timestamp;
        const now = Date.now();
        const hours24 = 24 * 60 * 60 * 1000;
        if (url === text && typeof timestamp === "number" && now - timestamp < hours24) return;
      }

      Alert.alert(
        t("偵測到食譜連結" as any),
        t("發現 {{platform}} 連結，是否立即匯入？" as any, { platform }),
        [
          { text: t("取消" as any), style: "cancel" },
          {
            text: t("匯入食譜" as any),
            onPress: () => {
              AsyncStorage.setItem(
                "kindcipe_clipboard_hinted",
                JSON.stringify({ url: text, timestamp: Date.now() })
              );
              router.push({
                pathname: "/import",
                params: { clipboardUrl: text },
              });
            }
          }
        ]
      );
    } catch {
      // Clipboard read failed, ignore
    }
  }, [router, t]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    if (!isTabsGroup) return; // Only show clipboard alert on main tabs, not during login/onboarding
    if (hasCheckedClipboard.current) return;
    hasCheckedClipboard.current = true;
    void promptClipboardImport();
  }, [authLoading, isLoggedIn, isTabsGroup, promptClipboardImport]);

  // 由背景返前台 → 再偵測剪貼板（節流 3 秒）
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!isLoggedIn || !isTabsGroup) return;
      void promptClipboardImport();
    });
    return () => sub.remove();
  }, [isLoggedIn, isTabsGroup, promptClipboardImport]);

  // ── 分享導航：唯一負責人（Single Navigator Owner）──────────────────────────
  // ShareIntentBridge 只寫 pendingShare；呢度係**唯一**會 push /import 嘅地方。
  // 好處：冇其他頁／timer 爭導航 → 唔會再出現「分析完彈返 home」。
  // ── 分享導航：唯一負責人（Single Navigator Owner）──────────────────────────
  // 反應兩種來源：
  //   1) context pending（reactive，bridge 一收到即觸發）→ 主要
  //   2) AsyncStorage pending（冷啟／未登入後登入 fallback）
  // 只有呢度會 push /import；已喺 /import 就唔做（交 import reader 處理）。
  useEffect(() => {
    if (!isLoggedIn || !onboardingDone) return;
    if (!navigationReady) return;
    const onImportAlready = segmentsRef.current[0] === "import"; // 冷啟：+native-intent 已帶入 /import
    // context pending（reactive）
    if (pendingShare) {
      // 冷啟時 route 已經係 /import → 唔重複 push，但都要 track（修正 telemetry 盲點）
      track(Events.ShareConsumed, { via: onImportAlready ? "context-coldstart" : "context" });
      if (!onImportAlready) router.push({ pathname: "/import", params: {} });
      return;
    }
    if (onImportAlready) return; // 已喺 import → 交 reader
    // AsyncStorage fallback（冷啟／未登入）
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem("kindcipe_pending_share");
        if (!raw) return;
        if (segmentsRef.current[0] === "import") return;
        track(Events.ShareConsumed, { via: "storage" });
        router.push({ pathname: "/import", params: {} });
      } catch { /* ignore */ }
    })();
  }, [isLoggedIn, onboardingDone, navigationReady, pendingShare, router]);

  useEffect(() => {
    (async () => {
      // Unlock failed → "unknown". Do not navigate to /login and do not clear the token.
      if (biometricLocked) return;
      if (authLoading || !onboardingChecked) return;
      // Transient auth failure → keep the user where they are.
      if (authStatus === "unknown") return;

      const inTabsGroup = segments[0] === "(tabs)";
      const inLoginPage = segments[0] === "login";
      const inForgotPassword = segments[0] === "forgot-password";
      const inResetPassword = segments[0] === "reset-password";
      const inVerifyEmail = segments[0] === "verify-email";
      const inOnboarding = segments[0] === "onboarding";
      const seg0 = segments[0] as string;
      const inVisualTest = seg0 === "visual-typography" && process.env.EXPO_PUBLIC_VISUAL_TEST === "1";
      const isLoggedIn = authStatus === "authenticated";

      // Admin redirect (preserved — not part of authGuardRedirect)
      if (isLoggedIn) {
        const pendingAdminRedirect = await AsyncStorage.getItem(PENDING_ADMIN_REDIRECT_KEY);
        if (pendingAdminRedirect === "1") {
          await AsyncStorage.removeItem(PENDING_ADMIN_REDIRECT_KEY);
          if (seg0 !== "admin") router.replace("/admin");
          return;
        }
      }

      // Onboarding key side-effect (preserved)
      // ⚠️ 唔可以喺 /onboarding 期間設定：用戶一建立廚房就會有 activeFamilyId，
      // 若即刻標記完成，AuthGuard 會踢去 tabs，guide + quick-plan 永遠唔會出現。
      const inOnboardingRoute = seg0 === "onboarding";
      if (isLoggedIn && !onboardingDone && user?.activeFamilyId && !inOnboardingRoute) {
        const key = getOnboardingKey(user.id);
        await AsyncStorage.setItem(key, "true");
        setOnboardingDone(true);
      }

      // Check for pending next-redirect (stored by login.tsx synchronously during render,
      // or by unauth redirect in AsyncStorage). MUST be checked BEFORE authGuardRedirect
      // because authGuardRedirect returns "/(tabs)" for logged-in users on /login.
      const nextFromRender = isLoggedIn && inLoginPage ? getLoginNext() : null;
      const pendingNext = isLoggedIn ? await AsyncStorage.getItem(LOGIN_NEXT_KEY) : null;
      const effectiveNext = nextFromRender || pendingNext;
      if (effectiveNext) {
        if (pendingNext) await AsyncStorage.removeItem(LOGIN_NEXT_KEY);
        const target = effectiveNext.startsWith("/") ? effectiveNext : `/${effectiveNext}`;
        router.replace(target as any);
        return;
      }

      const redirectTarget = authGuardRedirect({
        authStatus,
        isLoggedIn,
        onboardingDone,
        activeFamilyId: user?.activeFamilyId,
        inLoginPage,
        inOnboarding,
        inForgotPassword,
        inResetPassword,
        inVerifyEmail,
        inTabsGroup,
        seg0,
      });

      if (redirectTarget) {
        if (redirectTarget === "/login" && !inLoginPage && !inVisualTest && !inForgotPassword && !inResetPassword && !inVerifyEmail) {
          // Unauthenticated: preserve current path for post-login redirect
          const pathParts = segments.filter((s) => s !== "(tabs)");
          const fallbackPath = pathParts.length > 0 ? "/" + pathParts.join("/") : "/";
          const currentPath =
            pathname && pathname !== "/" && !pathname.startsWith("/login")
              ? pathname
              : fallbackPath;
          if (currentPath !== "/login" && currentPath !== "/") {
            await AsyncStorage.setItem(LOGIN_NEXT_KEY, currentPath);
            router.replace(`/login?next=${encodeURIComponent(currentPath)}` as any);
          } else if (seg0 === "admin") {
            router.replace("/login?mode=admin");
          } else {
            router.replace("/login");
          }
          return;
        }
        router.replace(redirectTarget as any);
        return;
      }
    })();
  }, [authLoading, authStatus, user, segments, onboardingChecked, onboardingDone, biometricLocked, pathname, router]);

  const showLoading = !biometricLocked && (biometricPrompt || !biometricChecked || authLoading || !onboardingChecked);

  useEffect(() => {
    if (!showLoading) {
      void SplashScreen.hideAsync();
    }
  }, [showLoading]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      <ShareIntentBridge />
      <OfflineBanner />
      <AppleRelayLinkPrompt enabled={isLoggedIn && onboardingDone && isTabsGroup} />
      <AnalyticsConsentCard enabled={analyticsEnabled && isLoggedIn && onboardingDone && isTabsGroup} />
      {(showLoading || biometricLocked) && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
          {biometricLocked ? (
            <View style={{ alignItems: "center", gap: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="lock-closed-outline" size={40} color="#183B56" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>{t("lock.unlock")}</Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 32 }}>{t("lock.unlockFailed")}</Text>
              <TouchableOpacity
                onPress={() => void unlockWithBiometric()}
                style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, backgroundColor: "#183B56" }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{t("lock.retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : biometricPrompt ? (
            <View style={{ alignItems: "center", gap: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="scan-outline" size={40} color="#183B56" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>{t("lock.unlock")}</Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>{t("lock.unlockHint")}</Text>
              <ActivityIndicator color="#183B56" size="large" style={{ marginTop: 12 }} />
            </View>
          ) : (
            <ActivityIndicator color="#183B56" size="large" />
          )}
          {showDevReset && !biometricLocked && (
            <TouchableOpacity onPress={handleDevReset} style={{ marginTop: 40, paddingVertical: 10, paddingHorizontal: 20 }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecorationLine: "underline" }}>
                重置 App 資料（開發用）
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function RootLayout() {
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { initLanguage().then(() => setLangReady(true)).catch(() => setLangReady(true)); }, []);
  const router = useRouter();

  // Meal reminder: re-apply on launch + handle notification tap → home tab
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        // Dynamic import: avoids running expo-notifications module init at root
        // load (before the native module is ready), which can throw on cold start.
        const [{ getMealReminderSetting, applyMealReminder }, Notifications] = await Promise.all([
          import("@/lib/notifications"),
          import("expo-notifications"),
        ]);
        const setting = await getMealReminderSetting();
        if (setting.enabled) await applyMealReminder(setting);
        sub = Notifications.addNotificationResponseReceivedListener((resp: any) => {
          const route = resp?.notification?.request?.content?.data?.route;
          if (typeof route === "string" && route.startsWith("/")) {
            router.push(route as any);
          }
        });
      } catch (e) {
        console.warn("[MealReminder] setup skipped:", e);
      }
    })();
    return () => { sub?.remove(); };
  }, [router]);

  useEffect(() => {
    void maybeRequestReview();
    void loadAnalyticsOptOut().then(() => initAnalytics());
  }, []);

  if (!langReady) return null;
  return (
    <ShareIntentProvider
      options={{
        debug: __DEV__,
        resetOnBackground: false,
      }}
    >
      <PendingShareProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary fallback={<CrashScreen />}>
          <I18nextProvider i18n={i18n}>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                <ToastProvider>
                  <StatusBar style="light" />
                  <AuthGuard>
                    <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: "#183B56" },
                    headerTintColor: "#fff",
                    headerTitleStyle: { fontWeight: "bold" },
                  }}
                >
                  <Stack.Screen
                    name="(tabs)"
                    options={{
                      headerShown: false,
                      title: '',
                    }}
                  />
                  <Stack.Screen
                    name="recipe/[id]"
                    options={{
                      headerShown: false,
                      title: '',
                      headerBackTitle: '',
                    }}
                  />
                  <Stack.Screen
                    name="cook/[id]"
                    options={{
                      headerShown: false,
                      title: '',
                      gestureEnabled: false,
                    }}
                  />
                  <Stack.Screen
                    name="login"
                    options={{ headerShown: false, gestureEnabled: false }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false, gestureEnabled: false }}
                  />
                  <Stack.Screen
                    name="import"
                    options={{
                      headerShown: false,
                      title: "",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="ai-plan"
                    options={{
                      headerShown: false,
                      title: "",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="meal-preferences"
                    options={{
                      headerShown: false,
                      title: "",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="recipe-editor"
                    options={{
                      headerShown: false,
                      title: "",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{
                      headerShown: false,
                      title: '',
                      headerBackTitle: '',
                    }}
                  />
                </Stack>
              </AuthGuard>
            </ToastProvider>
                </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </I18nextProvider>
      </ErrorBoundary>
      </GestureHandlerRootView>
      </PendingShareProvider>
    </ShareIntentProvider>
  );
}

export default Sentry.wrap(RootLayout);
