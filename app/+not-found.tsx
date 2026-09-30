import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from "react-i18next";
import { Link, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BRAND = "#013E77";
const BG = "#FAFAF8";
const TEXT = "#1C1C1E";

/**
 * 兜底頁（+not-found）。
 *
 * 注意：**唔可以自動導航** —— 多個導航者會 race（之前 share timer 蓋走 /import 就係咁）。
 * 呢頁只顯示友善畫面 + 一個「返主畫面」按鈕，導航完全由用戶撳。
 * 分享 deep link 已由 +native-intent → /import、AuthGuard 統一處理，正常唔會落到呢頁。
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Ionicons name="compass-outline" size={40} color={BRAND} />
        </View>
        <Text style={styles.title}>{t("找不到頁面" as any)}</Text>
        <Text style={styles.subtitle}>{t("呢個頁面可能已經移咗位。" as any)}</Text>
        <Link href="/(tabs)" asChild>
          <TouchableOpacity style={styles.button}>
            <Ionicons name="home-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>{t("notFound.home")}</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: BG,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF4FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 21,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
