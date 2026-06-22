/**
 * 登入頁面 v5 — 真實 Email / Google / Apple 登入
 * - Email 登入：直接呼叫後端 trpc.auth.emailLogin
 * - Email 註冊：直接呼叫後端 trpc.auth.emailRegister
 * - Google 登入：@react-native-google-signin/google-signin → POST /api/auth/google
 * - Apple 登入：expo-apple-authentication → POST /api/auth/apple
 */
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TextInput,
  Platform, Image, KeyboardAvoidingView,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { saveAuthTokenFromResponse, isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, FAMILY_ID_KEY } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

// Check if native modules are available (dev build vs Expo Go)
import { TurboModuleRegistry } from "react-native";
const hasGoogleSignin = TurboModuleRegistry.get("RNGoogleSignin") != null;
const hasAppleAuth = TurboModuleRegistry.get("ExpoAppleAuthentication") != null;

// Kindcipe 後端已部署到 Railway
const BACKEND_URL = "https://kindcipe-backend-production.up.railway.app";
const BRAND = "#1C2E4A";
const COPPER = "#C48A3A";
const BG = "#FFFFFF";

// Google Sign In — Client IDs from Google Cloud Console (Kindcipe project)
try {
  const { GoogleSignin } = require("@react-native-google-signin/google-signin");
  GoogleSignin.configure({
    webClientId: "690207937492-7hfs5hkksd5heo78kcfmq294f19rgp6d.apps.googleusercontent.com",
    iosClientId: "690207937492-epsg13ch62s93cmav0nkfieeeoq6r3db.apps.googleusercontent.com",
  });
} catch {}

type Mode = "login" | "register";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<string>("");
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const utils = trpc.useUtils();

  const emailLoginMutation = trpc.auth.emailLogin.useMutation();
  const emailRegisterMutation = trpc.auth.emailRegister.useMutation();

  // ── After successful login ──────────────────────────────────────────────────
  // 登入後不直接跳到 tabs，讓 _layout.tsx 的 AuthGuard 根據 onboarding 狀態決定路由
  // 如果是新用戶（未完成 onboarding）→ 自動跳到 /onboarding
  // 如果是舊用戶（已完成 onboarding）→ 自動跳到 /(tabs)
  const onLoginSuccess = async () => {
    await AsyncStorage.removeItem(FAMILY_ID_KEY);
    await utils.auth.me.invalidate();
    const [avail, enabled] = await Promise.all([
      isBiometricAvailable(),
      isBiometricEnabled(),
    ]);
    if (avail && !enabled) {
      setShowBiometricPrompt(true);
    }
  };

  // ── Email Login / Register ──────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    if (!email.trim()) { Alert.alert("請輸入電郵地址"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("電郵格式不正確", "請輸入有效的電郵地址");
      return;
    }
    if (!password.trim()) { Alert.alert("請輸入密碼"); return; }
    if (mode === "register" && !name.trim()) { Alert.alert("請輸入你的名字"); return; }
    if (mode === "register" && password.length < 8) {
      Alert.alert("密碼太短", "密碼至少需要 8 個字元");
      return;
    }

    setIsLoading(true);
    setLoadingType("email");
    try {
      let result: { token?: string };
      if (mode === "login") {
        result = await emailLoginMutation.mutateAsync({ email: email.trim(), password });
      } else {
        result = await emailRegisterMutation.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim(),
        });
      }

      await saveAuthTokenFromResponse(result);
      await onLoginSuccess();
    } catch (err: any) {
      if (mode === "register" && err?.data?.code === "CONFLICT") {
        Alert.alert("電郵已被註冊", err.message || "此電郵已被使用，請直接登入", [
          { text: "知道了", style: "cancel" },
          { text: "去登入", onPress: () => setMode("login") },
        ]);
      } else {
        const msg = mode === "login" ? "電郵或密碼錯誤" : err?.message || "建立帳號失敗，請稍後再試";
        Alert.alert(mode === "login" ? "登入失敗" : "註冊失敗", msg);
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // ── Google Sign In ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!hasGoogleSignin) { Alert.alert("Google 登入", "請使用電郵登入或更新 App"); return; }
    setIsLoading(true);
    setLoadingType("google");
    try {
      const { GoogleSignin } = require("@react-native-google-signin/google-signin");
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error("No ID token");

      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Google login failed");
      const data = await res.json();
      await saveAuthTokenFromResponse(data);
      await onLoginSuccess();
    } catch (err: any) {
      if (err.code !== "SIGN_IN_CANCELLED" && err.code !== "12501") {
        Alert.alert("Google 登入失敗", "請稍後再試");
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // ── Apple Sign In ───────────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    if (!hasAppleAuth) { Alert.alert("Apple 登入", "請使用電郵登入或更新 App"); return; }
    setIsLoading(true);
    setLoadingType("apple");
    try {
      const AppleAuthentication = require("expo-apple-authentication");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) throw new Error("No ID token");

      const name = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
        : undefined;

      const res = await fetch(`${BACKEND_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken, name }),
      });
      if (!res.ok) throw new Error("Apple login failed");
      const data = await res.json();
      await saveAuthTokenFromResponse(data);
      await onLoginSuccess();
    } catch (err: any) {
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple 登入失敗", "請稍後再試");
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };
  
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image
              source={require("../assets/logo-full.png")}
              style={{ width: 192, height: 192, resizeMode: "contain" }}
            />
            <Text style={styles.tagline}>— 家人的食譜筆記 ・ 家庭的味道 —</Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "login" && styles.modeBtnActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.modeBtnText, mode === "login" && styles.modeBtnTextActive]}>
                登入
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "register" && styles.modeBtnActive]}
              onPress={() => setMode("register")}
            >
              <Text style={[styles.modeBtnText, mode === "register" && styles.modeBtnTextActive]}>
                建立帳號
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Form */}
          <View style={styles.form}>
            {mode === "register" && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="你的名字"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="電郵地址"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={mode === "register" ? "密碼（至少 8 個字元）" : "密碼"}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleEmailSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>

            {mode === "login" && (
              <TouchableOpacity style={styles.forgotRow}>
                <Text style={styles.forgotText}>忘記密碼？</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleEmailSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading && loadingType === "email" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : null}
              <Text style={styles.submitBtnText}>
                {mode === "login" ? "登入" : "建立帳號"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或使用以下方式</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Buttons */}
          <View style={styles.socialSection}>
            <View>
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={[styles.socialBtn, !hasAppleAuth && styles.socialBtnDisabled]}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading && loadingType === "apple" ? (
                    <ActivityIndicator color={BRAND} size="small" />
                  ) : (
                    <Ionicons name="logo-apple" size={20} color={BRAND} />
                  )}
                  <Text style={styles.socialBtnText}>使用 Apple 登入</Text>
                </TouchableOpacity>
              )}
            </View>

            <View>
              <TouchableOpacity
                style={[styles.socialBtn, !hasGoogleSignin && styles.socialBtnDisabled]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading && loadingType === "google" ? (
                  <ActivityIndicator color="#DB4437" size="small" />
                ) : (
                  <Ionicons name="logo-google" size={20} color="#DB4437" />
                )}
                <Text style={styles.socialBtnText}>使用 Google 登入</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            登入即表示你同意我們的服務條款及私隱政策
          </Text>

          {/* 開發用：重置 App 資料 */}
          <TouchableOpacity
            onPress={async () => {
              await AsyncStorage.clear();
              Alert.alert("已清除", "App 資料已重置，請重新啟動 App");
            }}
            style={{ marginTop: 12, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 11, color: "#D1D5DB", textDecorationLine: "underline" }}>
              重置 App 資料（開發用）
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showBiometricPrompt && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }]}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 20 }} />
            <View style={{ alignItems: "center", gap: 8, marginBottom: 24 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="scan-outline" size={32} color="#013E77" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>啟用 Face ID 解鎖？</Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>下次開啟 App 時可使用 Face ID 或指紋快速登入，不需再輸入密碼</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: "#013E77", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}
              onPress={async () => {
                await setBiometricEnabled(true);
                setShowBiometricPrompt(false);
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>啟用</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: "center" }}
              onPress={() => setShowBiometricPrompt(false)}
            >
              <Text style={{ fontSize: 14, color: "#9CA3AF", fontWeight: "600" }}>暫時不要</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 32 },

  // Logo
  logoSection: { alignItems: "center", marginBottom: 28 },
  tagline: { fontSize: 12, color: "#9CA3AF", marginTop: 6, letterSpacing: 0.5 },

  // Mode Toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
  },
  modeBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },
  modeBtnTextActive: { color: BRAND, fontWeight: "800" },

  // Form
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#1A1A1A" },
  forgotRow: { alignItems: "flex-end" },
  forgotText: { fontSize: 13, color: COPPER, fontWeight: "600" },

  // Submit Button
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 15, marginTop: 4,
    shadowColor: BRAND, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Divider
  divider: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 12, color: "#9CA3AF" },

  // Social
  socialSection: { gap: 12 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 12, paddingVertical: 13,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  socialBtnText: { fontSize: 15, fontWeight: "700", color: BRAND },
  socialBtnDisabled: { opacity: 0.4 },

  // Disclaimer
  disclaimer: {
    fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 20,
    lineHeight: 16,
  },
});
