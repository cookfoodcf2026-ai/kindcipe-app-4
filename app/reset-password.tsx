import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { clearAuthToken, FAMILY_ID_KEY } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BRAND = "#013E77";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const resetPasswordM = trpc.auth.resetPassword.useMutation();

  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token) {
      Alert.alert("連結無效", "缺少重設 token", [{ text: "返回登入", onPress: () => router.replace("/login") }]);
    }
  }, [token, router]);

  const handleSubmit = async () => {
    if (!token) return;
    if (!newPassword.trim()) {
      Alert.alert("請輸入新密碼");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("密碼太短", "新密碼至少需要 8 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("密碼不一致", "新密碼與確認密碼不一致");
      return;
    }

    try {
      await resetPasswordM.mutateAsync({ token, newPassword, confirmPassword });
      await clearAuthToken();
      await AsyncStorage.removeItem(FAMILY_ID_KEY);
      Alert.alert("已更新", "密碼已成功重設，請使用新密碼登入。", [
        { text: "返回登入", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert("重設失敗", err?.message || "請稍後再試");
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>重設密碼</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.title}>設定新密碼</Text>
            <Text style={styles.subtitle}>輸入新密碼兩次確認，完成後即可登入。</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="key-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="新密碼（至少 8 個字元）"
                placeholderTextColor="#9CA3AF"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} style={{ padding: 4 }}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="checkmark-done-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="確認新密碼"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.submitBtn, resetPasswordM.isPending && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={resetPasswordM.isPending || !token}>
              {resetPasswordM.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>重設密碼</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: BRAND, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "800" },
  body: { flex: 1, padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 8, color: "#6B7280", fontSize: 13, lineHeight: 19 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 12, marginTop: 14, minHeight: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#111827" },
  submitBtn: { marginTop: 18, backgroundColor: BRAND, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center" },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
