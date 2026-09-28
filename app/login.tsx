/**
 * 登入頁面 v6 — 極簡 Apple / Google 登入
 * - 只保留 Apple + Google 登入（確保資料跟隨用戶嘅 Apple/Google 帳戶）
 * - 隱藏管理員入口：連點 Logo 5 下 → 顯示 email/密碼管理員登入
 * - Email 登入：只供管理員用（trpc.auth.adminLogin）
 */
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TextInput,
  Platform, Image, KeyboardAvoidingView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { track, Events } from "@/lib/analytics";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc, BACKEND_URL } from "@/lib/trpc";
import { saveAuthTokenFromResponse, isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, FAMILY_ID_KEY } from "@/lib/auth";
import { getAppLogo } from "@/lib/logo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

// Check if native modules are available (dev build vs Expo Go)
import { NativeModules } from "react-native";
import { friendlyError } from "@/lib/errors";
const hasGoogleSignin = NativeModules.RNGoogleSignin != null;
const hasAppleAuth = NativeModules.ExpoAppleAuthentication != null;

const BRAND = "#1C2E4A";
const COPPER = "#C48A3A";
const BG = "#FAF8F5";
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://kindcipe.com/privacy/";
const APPLE_WEB_ENABLED = process.env.EXPO_PUBLIC_ENABLE_APPLE_WEB === "1";

// Google Sign In — Client IDs from Google Cloud Console (Kindcipe project)
try {
  const { GoogleSignin } = require("@react-native-google-signin/google-signin");
  GoogleSignin.configure({
    webClientId: "690207937492-7hfs5hkksd5heo78kcfmq294f19rgp6d.apps.googleusercontent.com",
    iosClientId: "690207937492-epsg13ch62s93cmav0nkfieeeoq6r3db.apps.googleusercontent.com",
  });
} catch {}

type Mode = "login" | "register" | "admin" | "otp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "admin" ? "admin" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<string>("");
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const utils = trpc.useUtils();

  // Apple Sign-In availability (async; native module may not register synchronously in the New Architecture).
  const [appleAvailable, setAppleAvailable] = useState<boolean>(hasAppleAuth);
  useEffect(() => {
    if (Platform.OS === "ios") {
      try {
        const AppleAuthentication = require("expo-apple-authentication");
        AppleAuthentication.isAvailableAsync?.().then((ok: boolean) => setAppleAvailable(Boolean(ok))).catch(() => {});
      } catch { /* ignore */ }
    }
  }, []);

  const emailLoginMutation = trpc.auth.emailLogin.useMutation();
  const emailRegisterMutation = trpc.auth.emailRegister.useMutation();
  const adminLoginMutation = trpc.auth.adminLogin.useMutation();
  const requestOtpM = trpc.auth.requestLoginOtp.useMutation();
  const verifyOtpM = trpc.auth.verifyLoginOtp.useMutation();
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMsg, setOtpMsg] = useState<string | null>(null);

  const handleSendOtp = async () => {
    const email = otpEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setOtpMsg(t("auth.invalidEmail") as any); return; }
    setOtpMsg(null); setIsLoading(true); setLoadingType("otp");
    try {
      await requestOtpM.mutateAsync({ email });
      setOtpStep("code");
    } catch (e: any) {
      setOtpMsg(friendlyError(e) || (t("auth.tryLater") as any));
    } finally { setIsLoading(false); setLoadingType(""); }
  };

  const handleVerifyOtp = async () => {
    const email = otpEmail.trim().toLowerCase();
    if (otpCode.trim().length < 4) { setOtpMsg(t("auth.enterCode") as any); return; }
    setOtpMsg(null); setIsLoading(true); setLoadingType("otp");
    try {
      const res = await verifyOtpM.mutateAsync({ email, code: otpCode.trim() });
      await saveAuthTokenFromResponse(res as any);
      await onLoginSuccess("otp");
    } catch (e: any) {
      setOtpMsg(friendlyError(e) || (t("auth.tryLater") as any));
    } finally { setIsLoading(false); setLoadingType(""); }
  };

  // ── After successful login ──────────────────────────────────────────────────
  const onLoginSuccess = async (method: string = "email") => {
    track(Events.LoginCompleted, { method });
    await AsyncStorage.removeItem(FAMILY_ID_KEY);
    await utils.invalidate();
    await utils.auth.me.invalidate();
    const [avail, enabled] = await Promise.all([
      isBiometricAvailable(),
      isBiometricEnabled(),
    ]);
    if (avail && !enabled) {
      setShowBiometricPrompt(true);
    }
  };

  const onAdminLoginSuccess = async () => {
    await AsyncStorage.removeItem(FAMILY_ID_KEY);
    await AsyncStorage.setItem("kindcipe_pending_admin_redirect", "1");
    await utils.invalidate();
    await utils.auth.me.invalidate();
    router.replace("/admin");
  };

  // ── Email Login / Register (admin only) ─────────────────────────────────────
  const handleEmailSubmit = async () => {
    if (!email.trim()) { Alert.alert(t("auth.enterEmail")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(t("auth.invalidEmail"), t("auth.invalidEmailMsg"));
      return;
    }
    if (!password.trim()) { Alert.alert(t("auth.enterPassword")); return; }
    if (mode === "register" && !name.trim()) { Alert.alert(t("auth.enterName")); return; }
    if (mode === "register" && password.length < 8) {
      Alert.alert(t("auth.passwordTooShort"), t("auth.passwordMin"));
      return;
    }

    setIsLoading(true);
    setLoadingType("email");
    try {
      let result: { token?: string };
      if (mode === "admin") {
        result = await adminLoginMutation.mutateAsync({ email: email.trim(), password });
      } else if (mode === "login") {
        result = await emailLoginMutation.mutateAsync({ email: email.trim(), password });
      } else {
        const reg = await emailRegisterMutation.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim(),
        }) as { token?: string; requiresVerification?: boolean; email?: string };
        if (reg?.requiresVerification) {
          router.push({ pathname: "/verify-email", params: { email: reg.email ?? email.trim() } } as any);
          return;
        }
        result = reg;
      }

      await saveAuthTokenFromResponse(result);
      if (mode === "admin") {
        await onAdminLoginSuccess();
      } else {
        await onLoginSuccess(mode === "register" ? "email_register" : "email_login");
      }
    } catch (err: any) {
      if (err?.data?.code === "PRECONDITION_FAILED") {
        setIsLoading(false);
        router.push({ pathname: "/verify-email", params: { email: email.trim() } } as any);
        return;
      }
      if (mode === "register" && err?.data?.code === "CONFLICT") {
        Alert.alert(t("auth.emailTaken"), friendlyError(err) || t("auth.emailTakenMsg"), [
          { text: t("知道了" as any), style: "cancel" },
          { text: t("去登入" as any), onPress: () => setMode("login") },
        ]);
      } else {
        const msg = mode === "register" ? (friendlyError(err) || "建立帳號失敗，請稍後再試") : (friendlyError(err) || "電郵或密碼錯誤");
        Alert.alert(mode === "register" ? t("註冊失敗" as any) : t("登入失敗" as any), msg);
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // ── Google Sign In ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!hasGoogleSignin) { Alert.alert(t("auth.googleSignin"), t("auth.googleSigninMsg")); return; }
    setIsLoading(true);
    setLoadingType("google");
    try {
      const { GoogleSignin } = require("@react-native-google-signin/google-signin");
      if (Platform.OS !== "ios") {
        await GoogleSignin.hasPlayServices();
      }

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
      await onLoginSuccess("google");
    } catch (err: any) {
      if (__DEV__) {
        console.error("Google login error:", err);
      }
      if (err.code !== "SIGN_IN_CANCELLED" && err.code !== "12501") {
        Alert.alert(t("auth.googleFailed"), t("auth.tryLater"));
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // ── Apple Sign In ───────────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    if (!appleAvailable) { Alert.alert(t("auth.appleSignin" as any), t("auth.googleSigninMsg" as any)); return; }
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
      await onLoginSuccess("apple");
    } catch (err: any) {
      if (__DEV__) {
        console.error("Apple login error:", err);
      }
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert(t("auth.appleFailed"), t("auth.tryLater"));
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // ── Apple Sign In (Web/Android OAuth) ────────────────────────────────────────
  const handleAppleWebSignIn = async () => {
    setIsLoading(true);
    setLoadingType("apple");
    try {
      const startUrl = `${BACKEND_URL}/api/auth/apple/web/start`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, "kindcipe://apple-login");
      if (result.type === "success" && result.url) {
        const tokenMatch = result.url.match(/[?&]token=([^&]+)/);
        if (tokenMatch) {
          await saveAuthTokenFromResponse({ token: decodeURIComponent(tokenMatch[1]) } as any);
          await onLoginSuccess("apple");
        } else {
          Alert.alert(t("auth.appleFailed"), t("auth.tryLater"));
        }
      }
    } catch (err) {
      if (__DEV__) console.error("Apple web login error:", err);
      Alert.alert(t("auth.appleFailed"), t("auth.tryLater"));
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="login-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo（連點 5 下 = 管理員入口） */}
          <View style={styles.logoSection}>
            <Image
              source={getAppLogo()}
              style={{ width: 220, height: 220, resizeMode: "contain" }}
            />
            <Text style={styles.appName}>{t("auth.appName" as any)}</Text>
            <Text style={styles.slogan}>{t("auth.slogan" as any)}</Text>
            <Text style={styles.dataNote}>{t("auth.dataFollowsLogin" as any)}</Text>
          </View>

          {mode === "admin" ? (
            /* 管理員登入（隱藏） */
            <View style={styles.form}>
              <Text style={styles.adminTitle}>{t("auth.adminLoginTitle" as any)}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  testID="login-email"
                  style={styles.input}
                  placeholder={t("auth.emailPlaceholder")}
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
                  testID="login-password"
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t("密碼" as any)}
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
              <TouchableOpacity
                testID="login-submit"
                style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                onPress={handleEmailSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading && loadingType === "email" ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text style={styles.submitBtnText}>{t("登入" as any)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/forgot-password")} style={{ alignItems: "center", marginTop: 4 }}>
                <Text style={{ fontSize: 13, color: COPPER, fontWeight: "600" }}>{t("auth.forgotPassword")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode("login")} style={{ alignItems: "center", marginTop: 6 }}>
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>{t("auth.backToUserLogin" as any)}</Text>
              </TouchableOpacity>
            </View>
          ) : mode === "otp" ? (
            /* 電郵 OTP 登入（萬能後備） */
            <View style={styles.form}>
              <Text style={styles.adminTitle}>{t("auth.otpTitle" as any)}</Text>
              {otpStep === "email" ? (
                <>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t("auth.emailPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={otpEmail}
                      onChangeText={setOtpEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handleSendOtp}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading && loadingType === "otp" ? <ActivityIndicator color="#fff" size="small" /> : null}
                    <Text style={styles.submitBtnText}>{t("auth.sendCode" as any)}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>{t("auth.codeSentTo" as any, { email: otpEmail })}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t("auth.enterCode" as any)}
                      placeholderTextColor="#9CA3AF"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading && loadingType === "otp" ? <ActivityIndicator color="#fff" size="small" /> : null}
                    <Text style={styles.submitBtnText}>{t("auth.verifyAndSignIn" as any)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendOtp} style={{ alignItems: "center", marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: COPPER, fontWeight: "600" }}>{t("auth.resendCode" as any)}</Text>
                  </TouchableOpacity>
                </>
              )}
              {otpMsg ? <Text style={{ fontSize: 12, color: "#B91C1C", textAlign: "center" }}>{otpMsg}</Text> : null}
              <TouchableOpacity onPress={() => { setMode("login"); setOtpMsg(null); }} style={{ alignItems: "center", marginTop: 6 }}>
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>{t("auth.backToUserLogin" as any)}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* 用戶：只留 Apple + Google */
            <View style={styles.socialSection}>
              {(Platform.OS === "ios" || APPLE_WEB_ENABLED) && (
                <TouchableOpacity
                  style={[styles.appleBtn, ((Platform.OS === "ios" && !appleAvailable) || isLoading) && styles.socialBtnDisabled]}
                  onPress={Platform.OS === "ios" ? handleAppleSignIn : handleAppleWebSignIn}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading && loadingType === "apple" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="logo-apple" size={22} color="#fff" />
                  )}
                  <Text style={styles.appleBtnText}>{t("auth.appleLogin")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.googleBtn, (!hasGoogleSignin || isLoading) && styles.socialBtnDisabled]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading && loadingType === "google" ? (
                  <ActivityIndicator color="#DB4437" size="small" />
                ) : (
                  <Ionicons name="logo-google" size={22} color="#DB4437" />
                )}
                <Text style={styles.googleBtnText}>{t("auth.googleLogin")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.googleBtn, isLoading && styles.socialBtnDisabled]}
                onPress={() => { setMode("otp"); setOtpStep("email"); setOtpMsg(null); setOtpCode(""); }}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="mail-outline" size={22} color={BRAND} />
                <Text style={styles.googleBtnText}>{t("auth.continueEmail" as any)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 私隱同意 */}
          <TouchableOpacity
            style={styles.privacyRow}
            onPress={() => { if (PRIVACY_URL) WebBrowser.openBrowserAsync(PRIVACY_URL); }}
          >
            <Text style={styles.privacyText}>{t("auth.privacyAgree" as any)}</Text>
          </TouchableOpacity>

          {/* 開發用：重置 App 資料（只喺 dev build 顯示） */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.clear();
                Alert.alert(t("auth.resetDone" as any), t("auth.resetDoneMsg" as any));
              }}
              style={{ marginTop: 12, alignItems: "center", paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 11, color: "#D1D5DB", textDecorationLine: "underline" }}>
                {t("auth.resetDev" as any)}
              </Text>
            </TouchableOpacity>
          )}
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
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A1A1A" }}>{t("auth.enableFaceId")}</Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>{t("auth.faceIdMsg")}</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: "#013E77", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}
              onPress={async () => {
                await setBiometricEnabled(true);
                setShowBiometricPrompt(false);
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{t("auth.enable")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: "center" }}
              onPress={() => setShowBiometricPrompt(false)}
              testID="biometric-skip"
            >
              <Text style={{ fontSize: 14, color: "#9CA3AF", fontWeight: "600" }}>{t("auth.notNow")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 40, paddingBottom: 28 },

  // Logo
  logoSection: { alignItems: "center", marginBottom: 32 },
  appName: { fontSize: 20, fontWeight: "800", color: BRAND, marginTop: 4 },
  slogan: { fontSize: 14, color: "#6B7280", marginTop: 10, textAlign: "center", lineHeight: 20, paddingHorizontal: 12 },
  dataNote: { fontSize: 11.5, color: "#9CA3AF", marginTop: 8, textAlign: "center", lineHeight: 16, paddingHorizontal: 16 },

  // Form (admin)
  form: { gap: 12 },
  adminTitle: { fontSize: 16, fontWeight: "800", color: BRAND, textAlign: "center", marginBottom: 4 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#1A1A1A" },

  // Submit (admin)
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 15, marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Social
  socialSection: { gap: 14 },
  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#000000", borderRadius: 12, paddingVertical: 16,
  },
  appleBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 12, paddingVertical: 16,
  },
  googleBtnText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  socialBtnDisabled: { opacity: 0.4 },

  // Privacy
  privacyRow: { marginTop: 28, alignItems: "center" },
  privacyText: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
});
