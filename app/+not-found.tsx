import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from "react-i18next";
import { Link, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BRAND = "#013E77";
const BG = "#FAFAF8";
const TEXT = "#1C1C1E";

/**
 * 兜底頁（+not-found）。
 *
 * 用戶永遠唔應該見到「頁面不存在」——尤其由 Share Sheet（kindcipe://dataUrl=…）
 * 或舊連結入嚟時。呢度唔顯示錯誤，而係**自動 redirect** 返主畫面。
 * （真正嘅分享處理喺 /share 中介頁 + ShareIntentBridge；呢個係最後一層保險。）
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // 自動返主畫面（唔留喺錯誤頁）
    const id = setTimeout(() => {
      try { router.replace("/(tabs)"); } catch { /* ignore */ }
    }, 50);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Ionicons name="hourglass-outline" size={40} color={BRAND} />
        </View>
        <Text style={styles.title}>{t("返回中…" as any)}</Text>
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
    marginBottom: 24,
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
