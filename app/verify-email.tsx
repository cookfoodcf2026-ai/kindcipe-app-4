import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { saveAuthTokenFromResponse } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { track, Events } from "@/lib/analytics";

const BRAND = "#013E77";
const COPPER = "#F5A823";
const TEXT = "#1F2937";
const SUB = "#6B7280";

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = String(params.email ?? "");

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const verifyM = trpc.auth.verifyEmail.useMutation({
    onSuccess: async (data: any) => {
      await saveAuthTokenFromResponse(data);
      track(Events.LoginCompleted, { method: "email_verified" });
      Alert.alert(t("verify.success" as any), t("verify.successMsg" as any), [
        { text: t("知道了" as any), onPress: () => router.replace("/(tabs)" as any) },
      ]);
    },
    onError: (e: any) => setError(friendlyError(e) || t("verify.failed" as any)),
  });

  const resendM = trpc.auth.resendVerificationCode.useMutation({
    onSuccess: () => {
      setCooldown(60);
      setError(null);
      Alert.alert(t("verify.resent" as any), t("verify.resentMsg" as any));
    },
    onError: (e: any) => setError(friendlyError(e) || t("verify.failed" as any)),
  });

  const canSubmit = code.trim().length >= 4 && !verifyM.isPending;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.content, { paddingTop: Math.max(insets.top + 24, 48) }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={BRAND} />
        </TouchableOpacity>

        <View style={s.iconWrap}>
          <Ionicons name="mail-unread-outline" size={30} color={BRAND} />
        </View>

        <Text style={s.title}>{t("verify.title" as any)}</Text>
        <Text style={s.subtitle}>{t("verify.subtitle" as any, { email })}</Text>

        <TextInput
          ref={inputRef}
          style={s.codeInput}
          value={code}
          onChangeText={(v) => { setCode(v.replace(/[^0-9]/g, "").slice(0, 6)); setError(null); }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          placeholder="------"
          placeholderTextColor="#C7CDD6"
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity
          style={[s.primaryBtn, { opacity: canSubmit ? 1 : 0.5 }]}
          disabled={!canSubmit}
          onPress={() => verifyM.mutate({ email, code: code.trim() })}
        >
          {verifyM.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnTxt}>{t("verify.submit" as any)}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={cooldown > 0 || resendM.isPending}
          onPress={() => resendM.mutate({ email })}
          style={s.resendBtn}
        >
          <Text style={[s.resendTxt, { opacity: cooldown > 0 ? 0.5 : 1 }]}>
            {cooldown > 0
              ? t("verify.resendIn" as any, { s: cooldown })
              : t("verify.resend" as any)}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF8F5" },
  content: { flex: 1, paddingHorizontal: 28 },
  back: { marginBottom: 12 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: "#E8F0FE",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "800", color: TEXT, marginBottom: 8 },
  subtitle: { fontSize: 14, color: SUB, lineHeight: 21, marginBottom: 28 },
  codeInput: {
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14,
    paddingVertical: 16, fontSize: 30, letterSpacing: 10, textAlign: "center",
    color: TEXT, fontWeight: "800",
  },
  error: { color: "#DC2626", fontSize: 13, marginTop: 10, textAlign: "center" },
  primaryBtn: {
    backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 20,
  },
  primaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  resendBtn: { alignItems: "center", marginTop: 18 },
  resendTxt: { color: COPPER, fontSize: 14, fontWeight: "700" },
});
