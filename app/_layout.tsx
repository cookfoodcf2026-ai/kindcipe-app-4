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
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState, useCallback, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTrpcClient } from "@/lib/trpc";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, TouchableOpacity, Text, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "@/lib/i18n";
import { I18nextProvider } from "react-i18next";
import { initLanguage } from "@/lib/i18n";
import KitchenSwitcher from "@/app/components/KitchenSwitcher";
import { authenticateBiometric, isBiometricAvailable, isBiometricEnabled, clearAuthToken } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { CrashScreen } from "@/src/components/CrashScreen";
import { initGlobalErrorHandler } from "@/lib/global-error-handler";
import { initIAP } from "@/lib/purchase";
import { onOfflineChange } from "@/lib/trpc";
import { ToastProvider } from "@/src/components/Toast";
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
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com") || u.includes("xhslink.cn")) return "小紅書";
  if (u.includes("threads.net")) return "Threads";
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return "Facebook";
  if (u.includes("tiktok.com") || u.includes("douyin.com")) return "TikTok/抖音";
  if (u.includes("weibo.com")) return "微博";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "B 站";
  return null;
}

// 高成功率平台清單（顯示提示）
const SUPPORTED_PLATFORMS = ["Instagram", "YouTube", "Threads", "Facebook"];

const safeParseClipboardHint = (raw: string): { url?: string; timestamp?: number } | null => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 分鐘
      gcTime: 1000 * 60 * 10, // 10 分鐘，避免 cache 無限累積
      refetchOnWindowFocus: false, // RN 由 useAppStateRefetch hook 手動觸發
      refetchOnReconnect: true, // 斷網重連自動 refetch
      refetchIntervalInBackground: false, // 背景不輪詢
    },
  },
});

const trpcClient = createTrpcClient();

/** Floating banner shown when the network is detected as offline. */
function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => onOfflineChange(setOffline), []);
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
        離線模式 — 部分功能可能需要網絡
      </Text>
    </View>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [showDevReset, setShowDevReset] = useState(true); // Always show for testing
  const [biometricPrompt, setBiometricPrompt] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const hasCheckedClipboard = useRef(false);

  // 載入 2 秒後顯示重置按鈕
  useEffect(() => {
    const timer = setTimeout(() => setShowDevReset(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDevReset = useCallback(async () => {
    await AsyncStorage.clear();
    Alert.alert("已清除", "App 資料已重置，請重新啟動 App");
    setShowDevReset(false);
  }, []);

  // 檢查 Biometric 並提示解鎖（在 trpc 查詢之前）
  useEffect(() => {
    (async () => {
      try {
        const available = await isBiometricAvailable();
        const enabled = await isBiometricEnabled();
        if (available && enabled) {
          setBiometricPrompt(true);
          const ok = await authenticateBiometric();
          if (ok) {
            setBiometricPrompt(false);
            setBiometricChecked(true);
          } else {
            await clearAuthToken();
            setBiometricFailed(true);
            setBiometricPrompt(false);
            setBiometricChecked(true);
          }
        } else {
          setBiometricChecked(true);
        }
      } finally {
        // 確保 bootstrap 不會永久卡在 loading（即使 biometric 檢查中途 throw）
        setBiometricChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    void initIAP();
  }, []);

  // 用 auth.me 確認登入狀態
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: biometricChecked && !biometricFailed,
  });

  // 在導航 useEffect 中重新檢查 AsyncStorage，確保 finishOnboarding 寫入後能立即反映
  const ensureOnboardingCheck = useCallback(async () => {
    try {
      const userId = meQuery.data?.id;
      if (!userId) {
        router.replace("/onboarding");
        return;
      }
      const key = getOnboardingKey(userId);
      const val = await AsyncStorage.getItem(key);
      if (val === "true") {
        setOnboardingDone(true);
        return;
      }
      // 若用戶已擁有 kitchen（activeFamilyId 已設定），視為已完成 onboarding。
      // 避免舊戶口／flag 遺失時被強制去「建立廚房」而看似「失去紀錄」。
      if (meQuery.data?.activeFamilyId) {
        await AsyncStorage.setItem(key, "true");
        setOnboardingDone(true);
        router.replace("/(tabs)");
        return;
      }
      router.replace("/onboarding");
    } catch {
      router.replace("/onboarding");
    }
  }, [meQuery.data?.id, meQuery.data?.activeFamilyId, router]);

  // 檢查是否已完成 Onboarding（以用戶 ID 為 key）
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const userId = meQuery.data?.id;
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
  }, [meQuery.data?.id]);
  
  // Global clipboard detection on app open (only after login, only on tabs page)
  const isLoggedIn = !!meQuery.data;
  const isTabsGroup = segments[0] === "(tabs)";
  useEffect(() => {
    if (meQuery.isLoading || !isLoggedIn) return;
    if (!isTabsGroup) return; // Only show clipboard alert on main tabs, not during login/onboarding
    if (hasCheckedClipboard.current) return;
    hasCheckedClipboard.current = true;
    
    const checkClipboardOnOpen = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text || !isValidUrl(text.trim())) {
          return;
        }
        
        const platform = detectPlatform(text);
        if (!platform) {
          return;
        }
        
        if (!SUPPORTED_PLATFORMS.includes(platform)) {
          return;
        }
        
        const hintedData = await AsyncStorage.getItem("kindcipe_clipboard_hinted");
        if (hintedData) {
          const parsed = safeParseClipboardHint(hintedData);
          const url = parsed?.url;
          const timestamp = parsed?.timestamp;
          const now = Date.now();
          const hours24 = 24 * 60 * 60 * 1000;
          if (url === text && typeof timestamp === "number" && now - timestamp < hours24) {
            return;
          }
        }
        
        Alert.alert(
          "偵測到食譜連結",
          `發現 ${platform} 連結，是否立即匯入？`,
          [
            { text: "取消", style: "cancel" },
            {
              text: "匯入食譜",
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
      } catch (e) {
        // Clipboard read failed, ignore
      }
    };
    
    checkClipboardOnOpen();
  }, [meQuery.isLoading, isLoggedIn, isTabsGroup]);

  useEffect(() => {
    (async () => {
      if (biometricFailed) {
        if (segments[0] !== "login") router.replace("/login");
        return;
      }
      if (meQuery.isLoading || !onboardingChecked) return;

      const inTabsGroup = segments[0] === "(tabs)";
      const inLoginPage = segments[0] === "login";
      const inForgotPassword = segments[0] === "forgot-password";
      const inResetPassword = segments[0] === "reset-password";
      const inOnboarding = segments[0] === "onboarding";
      const seg0 = segments[0] as string;
      const isLoggedIn = !!meQuery.data;

      // 未登入，跳轉到登入頁（admin 頁面走管理員登入模式）
      if (!isLoggedIn && !inLoginPage && !inForgotPassword && !inResetPassword) {
        if (seg0 === "admin") {
          router.replace("/login?mode=admin");
        } else {
          router.replace("/login");
        }
        return;
      }

      // 已登入
      if (isLoggedIn) {
        if (inForgotPassword || inResetPassword) {
          return;
        }

        const pendingAdminRedirect = await AsyncStorage.getItem(PENDING_ADMIN_REDIRECT_KEY);
        if (pendingAdminRedirect === "1") {
          await AsyncStorage.removeItem(PENDING_ADMIN_REDIRECT_KEY);
          if (seg0 !== "admin") router.replace("/admin");
          return;
        }

        if (!onboardingDone) {
          // 若用戶已擁有 kitchen，直接視為完成 onboarding 並返回 tabs，
          // 避免舊戶口／flag 遺失時被強制去「建立廚房」而看似「失去紀錄」。
          if (meQuery.data?.activeFamilyId) {
            const key = getOnboardingKey(meQuery.data.id);
            AsyncStorage.setItem(key, "true");
            setOnboardingDone(true);
            router.replace("/(tabs)");
          } else if (!inOnboarding && (inLoginPage || inTabsGroup)) {
            if (inTabsGroup) {
              ensureOnboardingCheck();
            } else {
              router.replace("/onboarding");
            }
          }
        } else {
          // 已完成 onboarding → 只在 login/onboarding 頁面時跳回 tabs
          // 不干擾 stack screens（如 recipe/[id]、ai-chef、pantry 等）
          if (inLoginPage || inForgotPassword || inResetPassword || inOnboarding || seg0 === "index") {
            router.replace("/(tabs)");
          }
        }
      }
    })();
  }, [meQuery.isLoading, meQuery.data, segments, onboardingChecked, onboardingDone]);

  const showLoading = !biometricFailed && (biometricPrompt || meQuery.isLoading || !onboardingChecked);

  useEffect(() => {
    if (!showLoading) {
      void SplashScreen.hideAsync();
    }
  }, [showLoading]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      <OfflineBanner />
      {showLoading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
          {biometricPrompt ? (
            <View style={{ alignItems: "center", gap: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="scan-outline" size={40} color="#013E77" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>解鎖 Kindcipe</Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>使用 Face ID 或指紋快速登入</Text>
              <ActivityIndicator color="#013E77" size="large" style={{ marginTop: 12 }} />
            </View>
          ) : (
            <ActivityIndicator color="#013E77" size="large" />
          )}
          {showDevReset && (
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

export default function RootLayout() {
  useEffect(() => { initLanguage(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary fallback={<CrashScreen />}>
        <I18nextProvider i18n={i18n}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <StatusBar style="light" />
                <AuthGuard>
                  <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: "#013E77" },
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
                  <Stack.Screen
                    name="coming-soon"
                    options={{
                      headerShown: false,
                      title: '',
                      gestureEnabled: true,
                    }}
                  />
                </Stack>
              </AuthGuard>
            </ToastProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </I18nextProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
