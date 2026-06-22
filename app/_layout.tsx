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
import { useEffect, useState, useCallback } from "react";
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

// 以用戶 ID 為 key，確保不同帳戶都有獨立的 onboarding 狀態
const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 分鐘
    },
  },
});

const trpcClient = createTrpcClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [showDevReset, setShowDevReset] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricPrompt, setBiometricPrompt] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

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
    })();
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
      } else {
        router.replace("/onboarding");
      }
    } catch {
      router.replace("/onboarding");
    }
  }, [meQuery.data?.id, router]);

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

  useEffect(() => {
    if (biometricFailed) {
      if (segments[0] !== "login") router.replace("/login");
      return;
    }
    if (meQuery.isLoading || !onboardingChecked) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const inLoginPage = segments[0] === "login";
    const inOnboarding = segments[0] === "onboarding";
    const seg0 = segments[0] as string;
    const isLoggedIn = !!meQuery.data;

    // 未登入，跳轉到登入頁（但不干擾已登入後的 stack screens）
    if (!isLoggedIn && !inLoginPage) {
      router.replace("/login");
      return;
    }

    // 已登入
    if (isLoggedIn) {
      if (!onboardingDone) {
        // 未完成 onboarding → 只在 login/tabs 頁面時跳轉到 onboarding
        // 不干擾其他 stack screens（如 recipe/[id]、ai-chef 等）
        if (!inOnboarding && (inLoginPage || inTabsGroup)) {
          if (inTabsGroup) {
            ensureOnboardingCheck();
          } else {
            router.replace("/onboarding");
          }
        }
      } else {
        // 已完成 onboarding → 只在 login/onboarding 頁面時跳回 tabs
        // 不干擾 stack screens（如 recipe/[id]、ai-chef、pantry 等）
        if (inLoginPage || inOnboarding || seg0 === "index") {
          router.replace("/(tabs)");
        }
      }
    }
  }, [meQuery.isLoading, meQuery.data, segments, onboardingChecked, onboardingDone]);

  const showLoading = !biometricFailed && (biometricPrompt || meQuery.isLoading || !onboardingChecked);

  return (
    <View style={{ flex: 1 }}>
      {children}
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
    <I18nextProvider i18n={i18n}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
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
              options={{ header: () => null }}
            />
            <Stack.Screen
              name="login"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen name="recipe/[id]" options={{ title: "食譜詳情", headerRight: () => <KitchenSwitcher /> }} />
            <Stack.Screen name="import" options={{ title: "匯入食譜", headerRight: () => <KitchenSwitcher /> }} />
            <Stack.Screen name="family" options={{ title: "家庭管理", headerRight: () => <KitchenSwitcher /> }} />
            <Stack.Screen name="markets" options={{ title: "街市指南", headerRight: () => <KitchenSwitcher /> }} />
            <Stack.Screen name="ai-chef" options={{ title: "AI 食譜助手", headerShown: false }} />
            <Stack.Screen name="admin" options={{ title: "Admin Dashboard", headerShown: false }} />
            <Stack.Screen name="pantry" options={{ title: "家中儲備", headerShown: false }} />
            <Stack.Screen name="weekly-menu" options={{ title: "晚餐推薦", headerShown: false }} />
            <Stack.Screen name="purchase-history" options={{ title: "採購記錄", headerShown: false }} />
            <Stack.Screen name="recipe-editor" options={{ title: "自訂食譜", headerShown: false }} />
            <Stack.Screen name="settings" options={{ title: "設定", headerRight: () => <KitchenSwitcher /> }} />
            <Stack.Screen name="restock" options={{ title: "智能補貨", headerShown: false }} />
            <Stack.Screen name="category-manager" options={{ title: "分類管理" }} />
            <Stack.Screen name="kitchen-settings" options={{ title: "廚房設定", headerRight: () => <KitchenSwitcher /> }} />
          </Stack>
        </AuthGuard>
        </QueryClientProvider>
      </trpc.Provider>
    </I18nextProvider>
  );
}
