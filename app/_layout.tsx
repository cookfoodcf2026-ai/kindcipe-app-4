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
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTrpcClient } from "@/lib/trpc";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "@/lib/i18n";
import { I18nextProvider } from "react-i18next";

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

  // 用 auth.me 確認登入狀態
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

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
    if (meQuery.isLoading || !onboardingChecked) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const inLoginPage = segments[0] === "login";
    const inOnboarding = segments[0] === "onboarding";
    const isLoggedIn = !!meQuery.data;

    // 未登入，跳轉到登入頁
    if (!isLoggedIn && !inLoginPage) {
      router.replace("/login");
      return;
    }

    // 已登入
    if (isLoggedIn) {
      // 如果已完成 onboarding，確保在 (tabs) 頁面
      if (onboardingDone && !inTabsGroup) {
        router.replace("/(tabs)");
      }
      // 如果未完成 onboarding，確保在 onboarding 頁面
      else if (!onboardingDone && !inOnboarding && !inLoginPage) {
        router.replace("/onboarding");
      }
    }
  }, [meQuery.isLoading, meQuery.data, segments, onboardingChecked, onboardingDone]);

  // 初始載入時顯示 loading
  if (meQuery.isLoading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#013E77" }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
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
              name="login"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen name="recipe/[id]" options={{ title: "食譜詳情" }} />
            <Stack.Screen name="import" options={{ title: "匯入食譜" }} />
            <Stack.Screen name="family" options={{ title: "家庭管理" }} />
          </Stack>
        </AuthGuard>
        </QueryClientProvider>
      </trpc.Provider>
    </I18nextProvider>
  );
}
