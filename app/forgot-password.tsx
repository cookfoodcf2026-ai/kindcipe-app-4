import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

const BRAND = "#013E77";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const requestResetM = trpc.auth.requestPasswordReset.useMutation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const value = email.trim();
    if (!value) {
      Alert.alert("請輸入電郵地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      Alert.alert("電郵格式不正確");
      return;
    }

    setIsLoading(true);
    try {
      await requestResetM.mutateAsync({ email: value });
      Alert.alert("已送出", "如果此電郵存在，我們已寄出重設密碼連結。", [
        { text: "返回登入", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert("失敗", err?.message || "請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>忘記密碼</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.title}>重設登入密碼</Text>
            <Text style={styles.subtitle}>輸入你註冊用的電郵，我們會寄出重設連結。</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="電郵地址"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <TouchableOpacity style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>寄出重設連結</Text>}
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
