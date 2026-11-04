/**
 * 用戶設定頁面
 * 功能：
 * - 用戶資料顯示
 * - 使用統計（本月 + 歷史月份）
 * - 語言切換（繁體中文、English、Filipino、Indonesian）
 * - 購買紀錄入口
 * - 家庭管理入口
 * - 登出
 */
 import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Switch, TextInput, Image, Modal, ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { enumT } from "@/lib/i18nEnums";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { openSupport } from "@/lib/support";
import { confirmStripeCheckout } from "@/lib/purchase";
import { useAuth } from "@/hooks/useAuth";
import i18n from "@/lib/i18n";
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, clearAuthToken, FAMILY_ID_KEY } from "@/lib/auth";
import { getMealReminderSetting, saveMealReminderSetting, applyMealReminder, type MealReminderSetting } from "@/lib/notifications";
import PaywallModal from "@/components/PaywallModal";
import { ChatBubbleIcon } from "@/src/components/icons";
import { getHintsDisabled, setHintsDisabled } from "@/src/components/HintBanner";
import { getAppLogo } from "@/lib/logo";
import { friendlyError } from "@/lib/errors";
import { aiChefQuickPlanEnabled } from "@/lib/featureFlags";
import { typography } from "@/app/styles/typography";
import { isWeb } from "@/lib/platform";
import { signInWithGoogleWeb } from "@/lib/socialAuth";
import { track, Events, loadAnalyticsOptOut, setAnalyticsOptOut } from "@/lib/analytics";

const LANGUAGES = [
  { code: "zh-TW", label: "繁體中文", flag: "🇭🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "id", label: "Indonesia", flag: "🇮🇩" },
];

const LANG_STORAGE_KEY = "kindcipe_language";

function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return i18n.t("dyn.yearMonth" as any, { year, month: Number(month) });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { billing: billingReturn, session_id: billingSessionId, paywall, code: codeParam } = useLocalSearchParams<{
    billing?: string;
    session_id?: string;
    paywall?: string;
    /** IG 派發嘅創始會員碼：/settings?code=C9F-XXXXXXXX */
    code?: string;
  }>();
  const utils = trpc.useUtils();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, familyRole, activeFamily, activeFamilyId, families } = useAuth();
  const canManageBilling = familyRole === "owner" || familyRole === "admin";
  const [selectedLang, setSelectedLang] = useState(i18n.language || "zh-TW");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [expandedUsageMonths, setExpandedUsageMonths] = useState<Record<string, boolean>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // BUG#7 FIX: load persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then(lang => {
      if (lang) setSelectedLang(lang);
    });
  }, []);

  const handleLogout = () => {
    Alert.alert(t("登出" as any), t("確定要登出嗎？" as any), [
      { text: t("取消" as any), style: "cancel" },
      {
        text: t("登出" as any),
        style: "destructive",
        onPress: () => {
          track(Events.Logout);
          logout();
        },
      },
    ]);
  };

  // 刪除帳戶（Apple 5.1.1(v) / Google Play 要求 app 內提供）
  const deleteAccountM = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      await clearAuthToken();
      await AsyncStorage.removeItem(FAMILY_ID_KEY);
      await utils.invalidate();
      await utils.auth.me.invalidate();
      router.replace("/login");
      Alert.alert(t("已刪除" as any), t("帳戶已永久刪除。" as any));
    },
    onError: (e) => Alert.alert(t("刪除失敗" as any), friendlyError(e)),
  });

  // 修改用戶名稱（BUG#14）
  const updateProfileM = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      setEditingName(false);
      await utils.auth.me.invalidate();
      Alert.alert(t("settings.editNameUpdated"), t("settings.editNameUpdatedMsg"));
    },
    onError: (e) => Alert.alert(t("settings.nameUpdatedFailed"), friendlyError(e)),
  });

  const handleSaveName = () => {
    const name = nameDraft.trim();
    if (!name) {
      Alert.alert(t("settings.editNameEmpty"));
      return;
    }
    updateProfileM.mutate({ name });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("刪除帳戶" as any),
      t("呢個操作會永久刪除你嘅帳戶同所有資料（食譜、排餐、購物清單、訂閱等），無法復原。確定要刪除嗎？" as any),
      [
        { text: t("取消" as any), style: "cancel" },
        {
          text: t("永久刪除" as any),
          style: "destructive",
          onPress: () => deleteAccountM.mutate(),
        },
      ],
    );
  };

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    (async () => {
      const avail = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();
      setBiometricAvailable(avail);
      setBiometricOn(enabled);
    })();
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    await setBiometricEnabled(value);
    setBiometricOn(value);
  };

  // ─── Meal reminder (self-set time + frequency) ─────────────────────────────
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(17);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [reminderWeekdays, setReminderWeekdays] = useState<number[]>([]);
  const [reminderTimeText, setReminderTimeText] = useState("");
  const [loadedTimeLabel, setLoadedTimeLabel] = useState("");
  const [hintsEnabled, setHintsEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const disabled = await getHintsDisabled();
      setHintsEnabled(!disabled);
    })();
  }, []);

  const handleToggleHints = async (value: boolean) => {
    setHintsEnabled(value);
    await setHintsDisabled(!value);
  };

  const [analyticsOn, setAnalyticsOn] = useState(true);
  useEffect(() => {
    void loadAnalyticsOptOut().then((out) => setAnalyticsOn(!out));
  }, []);
  const handleToggleAnalytics = async (value: boolean) => {
    setAnalyticsOn(value);
    await setAnalyticsOptOut(!value);
  };

  useEffect(() => {
    (async () => {
      const s = await getMealReminderSetting();
      setReminderEnabled(s.enabled);
      setReminderHour(s.hour);
      setReminderMinute(s.minute);
      setReminderWeekdays(s.weekdays);
      setLoadedTimeLabel(`${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`);
    })();
  }, []);

  const reminderSetting = (): MealReminderSetting => ({
    enabled: reminderEnabled,
    hour: reminderHour,
    minute: reminderMinute,
    weekdays: reminderWeekdays,
  });

  const commitReminder = async (next: MealReminderSetting) => {
    setReminderEnabled(next.enabled);
    setReminderHour(next.hour);
    setReminderMinute(next.minute);
    setReminderWeekdays(next.weekdays);
    await saveMealReminderSetting(next);
    const ok = await applyMealReminder(next);
    if (next.enabled && !ok) {
      Alert.alert(t("通知權限" as any), t("未能取得通知權限，提醒未開啟。請到系統設定開啟通知。" as any), [
        { text: t("確定" as any) },
      ]);
      setReminderEnabled(false);
      await saveMealReminderSetting({ ...next, enabled: false });
    }
  };

  const handleToggleReminder = async (value: boolean) => {
    await commitReminder({ ...reminderSetting(), enabled: value });
  };

  const handleReminderTimeChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    const masked = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    setReminderTimeText(masked);
  };

  const applyReminderTimeText = () => {
    const m = reminderTimeText.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      Alert.alert(t("時間格式" as any), t("請輸入 HH:MM（例如 19:30）" as any), [{ text: t("確定" as any) }]);
      return;
    }
    const hour = Math.min(23, Math.max(0, Number(m[1])));
    const minute = Math.min(59, Math.max(0, Number(m[2])));
    setReminderTimeText(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    setLoadedTimeLabel(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    void commitReminder({ ...reminderSetting(), hour, minute });
  };

  const toggleReminderWeekday = (jsDay: number) => {
    const has = reminderWeekdays.includes(jsDay);
    const next = has ? reminderWeekdays.filter(d => d !== jsDay) : [...reminderWeekdays, jsDay].sort((a, b) => a - b);
    void commitReminder({ ...reminderSetting(), weekdays: next });
  };

  const weekdayLabels: { jsDay: number; label: string }[] = [
    { jsDay: 1, label: enumT.weekday(1) },
    { jsDay: 2, label: enumT.weekday(2) },
    { jsDay: 3, label: enumT.weekday(3) },
    { jsDay: 4, label: enumT.weekday(4) },
    { jsDay: 5, label: enumT.weekday(5) },
    { jsDay: 6, label: enumT.weekday(6) },
    { jsDay: 0, label: enumT.weekday(0) },
  ];

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<"generic" | "multilang">("generic");
  useEffect(() => {
    if (paywall === "1") setShowPaywall(true);
  }, [paywall]);
  const [promoCode, setPromoCode] = useState("");
  // 由 IG DM 帶入嘅 code：自動填入（用戶只需撳「兌換」）
  useEffect(() => {
    if (codeParam) setPromoCode(String(codeParam).trim().toUpperCase());
  }, [codeParam]);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoState, setPromoState] = useState<"idle" | "redeeming" | "done">("idle");

  const redeemPromoM = trpc.subscription.redeemTrialCode.useMutation({
    onSuccess: async (res) => {
      setPromoState("done");
      setPromoMsg(res.expiresAt ? t("settings.promoDone", { date: new Date(res.expiresAt).toLocaleDateString(i18n.language) }) : t("settings.promoDoneShort"));
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.family.subscription.invalidate(),
        utils.family.usage.invalidate(),
        utils.billing.previewCheckout.invalidate(),
      ]);
    },
    onError: (e) => setPromoMsg(`${t("settings.promoFailed")}: ${friendlyError(e)}`),
  });

  const handleRedeemPromo = () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoState("redeeming");
    setPromoMsg(null);
    redeemPromoM.mutate({ code });
  };

  // ── Stripe checkout return (?billing=success&session_id=...) ──────────────
  // Activate Pro immediately on return so the user doesn't wait for the webhook.
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  useEffect(() => {
    if (billingReturn !== "success" && billingReturn !== "cancel") return;
    if (billingReturn === "cancel") {
      setBillingNotice(t("settings.billingCancelled" as any));
      return;
    }
    const sid = Array.isArray(billingSessionId) ? billingSessionId[0] : billingSessionId;
    if (!sid) {
      // No session id → rely on webhook; just refresh.
      void Promise.all([
        utils.auth.me.invalidate(),
        utils.family.subscription.invalidate(),
        utils.billing.previewCheckout.invalidate(),
      ]);
      return;
    }
    (async () => {
      const status = await confirmStripeCheckout(sid);
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.family.subscription.invalidate(),
        utils.billing.previewCheckout.invalidate(),
      ]);
      setBillingNotice(
        status === "active"
          ? t("settings.billingSuccess" as any)
          : status === "trial"
            ? t("settings.billingTrialStarted" as any)
            : t("settings.billingPending" as any)
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingReturn, billingSessionId]);
  const subscriptionQuery = trpc.family.subscription.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated && !!activeFamilyId,
  });
  const usageQuery = trpc.family.usage.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated && !!activeFamilyId,
  });
  const usageHistoryByMemberQuery = trpc.family.usageHistoryByMember.useQuery({ months: 6 }, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated && !!activeFamilyId,
  });
  const identitiesQuery = trpc.auth.identities.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: isAuthenticated,
  });

  // ── 手動連結登入方式（Apple relay 帳號唯一解法）──
  const [linkEmailOpen, setLinkEmailOpen] = useState(false);
  const [linkEmailAddr, setLinkEmailAddr] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkStep, setLinkStep] = useState<"email" | "code">("email");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const linkGoogleM = trpc.auth.linkGoogle.useMutation();
  const linkEmailStartM = trpc.auth.linkEmailStart.useMutation();
  const linkEmailVerifyM = trpc.auth.linkEmailVerify.useMutation();
  const linkedProviders = new Set(((identitiesQuery.data as any[]) ?? []).map((i: any) => i.provider));
  const hasEmailLinked = linkedProviders.has("otp") || linkedProviders.has("email");
  const showMergeAccounts = Boolean(
    linkedProviders.has("apple") ||
    user?.email?.toLowerCase().includes("privaterelay.appleid.com")
  );

  const handleLinkGoogle = async () => {
    try {
      let idToken: string | undefined;
      if (isWeb) {
        idToken = await signInWithGoogleWeb();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { GoogleSignin } = require("@react-native-google-signin/google-signin");
        const userInfo = await GoogleSignin.signIn();
        idToken = userInfo?.data?.idToken ?? userInfo?.idToken;
      }
      if (!idToken) throw new Error("no idToken");
      await linkGoogleM.mutateAsync({ idToken });
      await utils.auth.identities.invalidate();
      Alert.alert(t("連結成功" as any));
    } catch (e: any) {
      Alert.alert(t("連結失敗" as any), friendlyError(e));
    }
  };

  const handleLinkEmailStart = async () => {
    const email = linkEmailAddr.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLinkMsg(t("請輸入有效電郵" as any)); return; }
    setLinkBusy(true); setLinkMsg(null);
    try {
      await linkEmailStartM.mutateAsync({ email });
      setLinkStep("code");
    } catch (e: any) { setLinkMsg(friendlyError(e)); }
    finally { setLinkBusy(false); }
  };

  const handleLinkEmailVerify = async () => {
    const email = linkEmailAddr.trim().toLowerCase();
    if (linkCode.trim().length < 4) { setLinkMsg(t("請輸入驗證碼" as any)); return; }
    setLinkBusy(true); setLinkMsg(null);
    try {
      await linkEmailVerifyM.mutateAsync({ email, code: linkCode.trim() });
      await utils.auth.identities.invalidate();
      setLinkEmailOpen(false); setLinkEmailAddr(""); setLinkCode(""); setLinkStep("email");
      Alert.alert(t("連結成功" as any));
    } catch (e: any) { setLinkMsg(friendlyError(e)); }
    finally { setLinkBusy(false); }
  };

  // ── 自助合併帳號（將另一個帳號嘅資料搬入當前帳號）──
  const mergeAccountM = trpc.auth.mergeAccount.useMutation();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeStep, setMergeStep] = useState<"email" | "code">("email");
  const [mergeEmail, setMergeEmail] = useState("");
  const [mergeCode, setMergeCode] = useState("");
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);

  const handleMergeEmailStart = async () => {
    const email = mergeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMergeMsg(t("請輸入有效電郵" as any)); return; }
    if (email === (identitiesQuery.data as any[] ?? []).find((i: any) => i.provider === "otp" || i.provider === "email")?.email) {
      setMergeMsg(t("呢個已經係你嘅電郵" as any)); return;
    }
    setMergeBusy(true); setMergeMsg(null);
    try {
      await linkEmailStartM.mutateAsync({ email });
      setMergeStep("code");
    } catch (e: any) { setMergeMsg(friendlyError(e)); }
    finally { setMergeBusy(false); }
  };

  const handleMergeEmailVerify = async () => {
    const email = mergeEmail.trim().toLowerCase();
    if (mergeCode.trim().length < 4) { setMergeMsg(t("請輸入驗證碼" as any)); return; }
    setMergeBusy(true); setMergeMsg(null);
    try {
      const res: any = await mergeAccountM.mutateAsync({ method: "email", email, code: mergeCode.trim() });
      await utils.auth.identities.invalidate();
      setMergeOpen(false); setMergeEmail(""); setMergeCode(""); setMergeStep("email");
      Alert.alert(t("合併成功" as any), t("已將 {{n}} 個家庭搬入你嘅帳號" as any, { n: String(res?.movedFamilies ?? 0) }));
    } catch (e: any) { setMergeMsg(friendlyError(e)); }
    finally { setMergeBusy(false); }
  };

  const handleMergeGoogle = async () => {
    setMergeBusy(true); setMergeMsg(null);
    try {
      let idToken: string | undefined;
      if (isWeb) {
        idToken = await signInWithGoogleWeb();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { GoogleSignin } = require("@react-native-google-signin/google-signin");
        const userInfo = await GoogleSignin.signIn();
        idToken = userInfo?.data?.idToken ?? userInfo?.idToken;
      }
      if (!idToken) throw new Error("no idToken");
      const res: any = await mergeAccountM.mutateAsync({ method: "google", idToken });
      await utils.auth.identities.invalidate();
      setMergeOpen(false);
      Alert.alert(t("合併成功" as any), t("已將 {{n}} 個家庭搬入你嘅帳號" as any, { n: String(res?.movedFamilies ?? 0) }));
    } catch (e: any) { setMergeMsg(friendlyError(e)); }
    finally { setMergeBusy(false); }
  };
  const sub = subscriptionQuery.data;
  // 已享有 Pro（同一用戶另一個廚房 active）→ 唔顯示升級掣
  const coveredBy = (sub as any)?.coveredBy as { familyId: number; name: string } | null | undefined;
  const usage = usageQuery.data;
  const usageHistoryByMember = usageHistoryByMemberQuery.data ?? [];
  const hasFamily = families.length > 0;
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const currentUsageMonth = usageHistoryByMember.find((row) => row.yearMonth === currentYearMonth);
  const currentUsageMembers = currentUsageMonth?.members ?? [];
  const currentUsageMax = Math.max(1, ...currentUsageMembers.map((m) => m.aiChat));

  const getSubscriptionLabel = () => {
    if (!sub) return null;
    if (sub.status === "trial") {
      const daysLeft = sub.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
        : 0;
      return { label: t("paywall.trialActiveNote" as any, { n: daysLeft }), color: "#F59E0B", isPaid: false, isTrial: true, daysLeft, canManage: canManageBilling };
    }
    if (sub.status === "active") return { label: t("settings.subActive"), color: "#16A34A", isPaid: true, isTrial: false, daysLeft: 0, canManage: canManageBilling };
    if (sub.status === "expired") return { label: t("settings.subExpired"), color: "#EF4444", isPaid: false, isTrial: false, daysLeft: 0, canManage: false };
    return { label: "免費版", color: "#5F6F80", isPaid: false, isTrial: false, daysLeft: 0, canManage: false };
  };
  const subInfo = getSubscriptionLabel();

  return (
    <View style={styles.container}>
      {/* 頭部 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#183B56" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 用戶資料 */}
        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{user.name || user.email?.split("@")[0] || t("dyn.user")}</Text>
                <TouchableOpacity
                  style={styles.editNameButton}
                  onPress={() => {
                    setNameDraft(user.name || "");
                    setEditingName(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil" size={14} color="#183B56" />
                </TouchableOpacity>
              </View>
              <Text style={styles.profileEmail}>{user.email || ""}</Text>
              {user.role && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {familyRole === "owner" ? t("廚房主人" as any)
                     : familyRole === "admin" ? t("廚房管理員" as any)
                     : familyRole === "helper" ? t("幫手" as any)
                     : familyRole === "member" ? t("家庭成員" as any)
                     : user.role === "admin" ? t("管理員" as any)
                     : t("家庭成員" as any)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginCard}
            onPress={() => router.push("/login")}
          >
            <Ionicons name="person-circle-outline" size={48} color="#183B56" />
            <Text style={styles.loginCardTitle}>{t("settings.notLoggedIn")}</Text>
            <Text style={styles.loginCardSubtitle}>{t("settings.loginPrompt")}</Text>
          </TouchableOpacity>
        )}

        {/* 廚房狀態 */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("settings.kitchen")}</Text>
            <View style={styles.kitchenCard}>
              <View style={styles.kitchenCardHeader}>
                <View style={[styles.settingIcon, { backgroundColor: "#E8F0F4" }]}>
                  <Ionicons name="home-outline" size={20} color="#183B56" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kitchenName}>{activeFamily?.name || families[0]?.name || t("settings.notInKitchen")}</Text>
                  <Text style={styles.kitchenSub}>
                    {hasFamily
                      ? t("settings.onlyOneKitchen", { role: t(`settings.role_${familyRole || "member"}` as any) })
                      : t("settings.kitchenSyncHint")}
                  </Text>
                </View>
              </View>
              <View style={styles.kitchenActions}>
                <TouchableOpacity style={styles.kitchenPrimaryBtn} onPress={() => router.push("/kitchen-settings")}>
                  <Text style={styles.kitchenPrimaryBtnText}>{hasFamily ? t("settings.manageKitchen") : t("settings.createOrJoinKitchen")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 訂閱狀態卡片 */}
        {isAuthenticated && subInfo && (
          <View style={[styles.subCard, { borderLeftColor: subInfo.color }]}>
            <View style={styles.subCardLeft}>
              <Text style={styles.subCardTitle}>{t("settings.subscriptionStatus")}</Text>
              <Text style={[styles.subCardStatus, { color: subInfo.color }]}>{t(subInfo.label as any)}</Text>
            </View>
            {!subInfo.isPaid && !subInfo.isTrial && coveredBy ? (
              <Text style={[styles.subManagedNote, { color: "#047857" }]}>
                {t("paywall.coveredTitle" as any)}
              </Text>
            ) : !subInfo.isPaid && !subInfo.isTrial ? (
              <TouchableOpacity
                style={styles.upgradeSmallBtn}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.upgradeSmallBtnText}>{t("settings.upgrade")}</Text>
              </TouchableOpacity>
            ) : subInfo.canManage ? (
              // Already Pro: offer a way to manage/cancel. On web/Android this
              // opens the Stripe Billing Portal; elsewhere it's a no-op-safe
              // upgrade view (Apple IAP path is unchanged).
              <TouchableOpacity
                style={styles.manageSmallBtn}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.manageSmallBtnText}>
                  {subInfo.isTrial && sub?.promo?.billingProvider !== "stripe"
                    ? t("settings.upgrade")
                    : t("settings.manage" as any)}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.subManagedNote}>{t("settings.managedByOwner" as any)}</Text>
            )}
          </View>
        )}

        {billingNotice ? (
          <Text style={styles.billingNotice}>{billingNotice}</Text>
        ) : null}

        {/* 兌換試用碼（IG follow 7日） */}
        {isAuthenticated && (sub?.promo?.trialEligible || promoState === "done") && (
          <View style={styles.promoCard}>
            {promoState === "done" ? (
              <Text style={styles.promoDoneText}>{promoMsg}</Text>
            ) : (
              <>
                {process.env.EXPO_PUBLIC_INSTAGRAM_URL ? (
                  <TouchableOpacity
                    style={[styles.promoBtn, { marginBottom: 10 }]}
                    onPress={() => WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_INSTAGRAM_URL as string)}
                  >
                    <Text style={styles.promoBtnText}>{t("settings.followIg")}</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.promoRow}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder={t("settings.promoPlaceholder")}
                    placeholderTextColor="#8A99A8"
                    autoCapitalize="characters"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    editable={promoState !== "redeeming"}
                  />
                  <TouchableOpacity
                    style={[styles.promoBtn, (promoState === "redeeming" || !promoCode.trim()) && styles.promoBtnDisabled]}
                    onPress={handleRedeemPromo}
                    disabled={promoState === "redeeming" || !promoCode.trim()}
                  >
                    {promoState === "redeeming" ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.promoBtnText}>{t("settings.promoRedeem")}</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {promoMsg ? <Text style={styles.promoErrorText}>{promoMsg}</Text> : null}
              </>
            )}
          </View>
        )}

        {/* 已連結登入方式 + 手動連結 */}
        {isAuthenticated && (
          <View style={styles.promoCard}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#183B56", marginBottom: 8 }}>{t("settings.loginMethods" as any)}</Text>
            {(identitiesQuery.data as any[] ?? []).map((id: any) => {
              const icon = id.provider === "apple" ? "logo-apple" : id.provider === "google" ? "logo-google" : id.provider === "otp" ? "key-outline" : "mail-outline";
              const label = id.provider === "apple" ? t("settings.providerApple" as any) : id.provider === "google" ? t("settings.providerGoogle" as any) : id.provider === "otp" ? t("settings.providerOtp" as any) : t("settings.providerEmail" as any);
              return (
                <View key={id.provider} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                  <Ionicons name={icon as any} size={18} color="#183B56" />
                  <Text style={{ fontSize: 14, color: "#183B56" }}>{label}</Text>
                  {id.email ? <Text style={{ fontSize: 12, color: "#8A99A8", flex: 1, textAlign: "right" }} numberOfLines={1}>{id.email}</Text> : null}
                </View>
              );
            })}
            {/* 未連結 → 提供手動連結 */}
            {!linkedProviders.has("google") && (
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, marginTop: 4 }} onPress={handleLinkGoogle}>
                <Ionicons name="logo-google" size={18} color="#DB4437" />
                <Text style={{ fontSize: 14, color: "#183B56", fontWeight: "700" }}>{t("連結 Google" as any)}</Text>
              </TouchableOpacity>
            )}
            {!hasEmailLinked && (
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }} onPress={() => { setLinkEmailOpen(true); setLinkStep("email"); setLinkMsg(null); }}>
                <Ionicons name="mail-outline" size={18} color="#183B56" />
                <Text style={{ fontSize: 14, color: "#183B56", fontWeight: "700" }}>{t("連結電郵" as any)}</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 11.5, color: "#8A99A8", marginTop: 8, lineHeight: 16 }}>{t("settings.linkHint" as any)}</Text>
          </View>
        )}

        {/* 合併帳號：只喺 Apple relay / 需要救援帳號時顯示 */}
        {isAuthenticated && showMergeAccounts && (
          <View style={styles.promoCard}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#183B56", marginBottom: 4 }}>{t("settings.mergeTitle" as any)}</Text>
            <Text style={{ fontSize: 12, color: "#5F6F80", marginBottom: 10, lineHeight: 17 }}>{t("settings.mergeHint" as any)}</Text>
            <TouchableOpacity
              style={{ backgroundColor: "#183B56", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
              onPress={() => { setMergeOpen(true); setMergeStep("email"); setMergeMsg(null); setMergeEmail(""); setMergeCode(""); }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>{t("settings.mergeCta" as any)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 合併帳號 Modal */}
        <Modal visible={mergeOpen} transparent animationType="fade" onRequestClose={() => setMergeOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#183B56", marginBottom: 6 }}>{t("settings.mergeTitle" as any)}</Text>
              <Text style={{ fontSize: 12, color: "#5F6F80", marginBottom: 14, lineHeight: 17 }}>{t("settings.mergeHint" as any)}</Text>
              {mergeStep === "email" ? (
                <>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#183B56" }}
                    placeholder={t("auth.emailPlaceholder" as any)}
                    placeholderTextColor="#8A99A8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={mergeEmail}
                    onChangeText={setMergeEmail}
                  />
                  {mergeMsg ? <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{mergeMsg}</Text> : null}
                  <TouchableOpacity style={{ backgroundColor: "#183B56", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 }} onPress={handleMergeEmailStart} disabled={mergeBusy}>
                    {mergeBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>{t("auth.sendCode" as any)}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 12 }} onPress={handleMergeGoogle} disabled={mergeBusy}>
                    <Ionicons name="logo-google" size={18} color="#DB4437" />
                    <Text style={{ color: "#183B56", fontWeight: "700" }}>{t("settings.mergeViaGoogle" as any)}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: "#5F6F80", marginBottom: 8 }}>{t("auth.codeSentTo" as any, { email: mergeEmail })}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#183B56", letterSpacing: 4, textAlign: "center" }}
                    placeholder="------"
                    placeholderTextColor="#8A99A8"
                    keyboardType="number-pad"
                    value={mergeCode}
                    onChangeText={setMergeCode}
                  />
                  {mergeMsg ? <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{mergeMsg}</Text> : null}
                  <TouchableOpacity style={{ backgroundColor: "#183B56", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 }} onPress={handleMergeEmailVerify} disabled={mergeBusy}>
                    {mergeBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>{t("settings.mergeConfirm" as any)}</Text>}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={{ paddingVertical: 10, alignItems: "center" }} onPress={() => setMergeOpen(false)}>
                <Text style={{ color: "#8A99A8" }}>{t("取消" as any)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 連結電郵 Modal */}
        <Modal visible={linkEmailOpen} transparent animationType="fade" onRequestClose={() => setLinkEmailOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#183B56", marginBottom: 12 }}>{t("連結電郵" as any)}</Text>
              {linkStep === "email" ? (
                <>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#183B56" }}
                    placeholder={t("auth.emailPlaceholder" as any)}
                    placeholderTextColor="#8A99A8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={linkEmailAddr}
                    onChangeText={setLinkEmailAddr}
                  />
                  {linkMsg ? <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{linkMsg}</Text> : null}
                  <TouchableOpacity style={{ backgroundColor: "#183B56", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 }} onPress={handleLinkEmailStart} disabled={linkBusy}>
                    {linkBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>{t("auth.sendCode" as any)}</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: "#5F6F80", marginBottom: 8 }}>{t("auth.codeSentTo" as any, { email: linkEmailAddr })}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#183B56", letterSpacing: 4, textAlign: "center" }}
                    placeholder="------"
                    placeholderTextColor="#8A99A8"
                    keyboardType="number-pad"
                    value={linkCode}
                    onChangeText={setLinkCode}
                  />
                  {linkMsg ? <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{linkMsg}</Text> : null}
                  <TouchableOpacity style={{ backgroundColor: "#183B56", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 }} onPress={handleLinkEmailVerify} disabled={linkBusy}>
                    {linkBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>{t("確定" as any)}</Text>}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={{ paddingVertical: 10, alignItems: "center" }} onPress={() => setLinkEmailOpen(false)}>
                <Text style={{ color: "#8A99A8" }}>{t("取消" as any)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 使用統計 */}
        {isAuthenticated && activeFamily && usage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("settings.usageStats")}</Text>
            <View style={styles.usageCard}>
              <View style={styles.usageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.usageTitle}>{t("settings.monthUsage")}</Text>
                  <Text style={styles.usageSubtitle}>{t("settings.kitchenQuota")}</Text>
                </View>
                <View style={styles.usageMonthBadge}>
                  <Text style={styles.usageMonthBadgeText}>{t("settings.thisMonth")}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                <Text style={{ fontSize: 36, lineHeight: 40, fontWeight: "900", color: "#183B56" }}>
                  {usage.aiChat.used + usage.imports.used}
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#9CA3AF" }}>
                    {" / "}
                    {usage.aiChat.limit + usage.imports.limit}
                  </Text>
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#5F6F80" }}>{t("settings.creditsUsed" as any)}</Text>
              </View>

              <View style={styles.usageMetricRow}>
                <Text style={styles.usageMetricLabel}>{t("settings.aiChat")}</Text>
                <Text style={styles.usageMetricValue}>{usage.aiChat.used} / {usage.aiChat.limit}</Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${Math.min(100, Math.round((usage.aiChat.used / Math.max(usage.aiChat.limit, 1)) * 100))}%`,
                      backgroundColor: "#183B56",
                    },
                  ]}
                />
              </View>

              <View style={[styles.usageMetricRow, { marginTop: 14 }]}>
                <Text style={styles.usageMetricLabel}>{t("settings.recipeImport")}</Text>
                <Text style={styles.usageMetricValue}>{usage.imports.used} / {usage.imports.limit}</Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${Math.min(100, Math.round((usage.imports.used / Math.max(usage.imports.limit, 1)) * 100))}%`,
                      backgroundColor: "#183B56",
                    },
                  ]}
                />
              </View>

              <View style={{ height: 12 }} />

              <Text style={styles.usageMemberSectionTitle}>{t("settings.memberUsage")}</Text>
              {currentUsageMembers.length > 0 ? (
                <View style={styles.usageMemberList}>
                  {currentUsageMembers.map((member) => {
                    const total = member.aiChat;
                    const width = `${Math.max(6, Math.round((total / currentUsageMax) * 100))}%` as `${number}%`;
                    return (
                      <View key={member.userId} style={styles.usageMemberRow}>
                        <View style={styles.usageMemberTopRow}>
                          <Text style={styles.usageMemberName} numberOfLines={1}>
                            {member.name}
                          </Text>
                          <Text style={styles.usageMemberCount}>
                            {t("dyn.times" as any, { n: total })}
                          </Text>
                        </View>
                        <View style={styles.usageMemberBarTrack}>
                          <View
                            style={[
                              styles.usageMemberBarFill,
                              { width, backgroundColor: member.familyRole === "owner" ? "#183B56" : member.familyRole === "admin" ? "#183B56" : "#183B56" },
                            ]}
                          />
                        </View>
                        <Text style={styles.usageMemberSub}>
                          {t("settings.memberUsageBreak", { ai: member.aiChat, imports: member.imports })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.usageMemberEmpty}>{t("settings.noMemberUsage")}</Text>
              )}
            </View>

            <View style={styles.usageTableCard}>
              <TouchableOpacity
                style={styles.usageTableToggle}
                onPress={() => setShowUsageHistory((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.usageTableToggleTitle}>{t("settings.monthsTable")}</Text>
                  <Text style={styles.usageTableToggleSubtitle}>{t("settings.monthsTableSub")}</Text>
                </View>
                <Ionicons
                  name={showUsageHistory ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#183B56"
                />
              </TouchableOpacity>

              {showUsageHistory && (
                <>
                  {usageHistoryByMember.map((row) => {
                    const isCurrent = row.yearMonth === currentYearMonth;
                    const isExpanded = expandedUsageMonths[row.yearMonth] ?? false;
                    return (
                      <View key={row.yearMonth} style={styles.usageMonthCard}>
                        <TouchableOpacity
                          style={styles.usageMonthHeader}
                          onPress={() =>
                            setExpandedUsageMonths((prev) => ({
                              ...prev,
                              [row.yearMonth]: !isExpanded,
                            }))
                          }
                          activeOpacity={0.8}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.usageTableCell, styles.usageMonthTitle, isCurrent && styles.usageTableCellCurrent]}>
                              {formatYearMonthLabel(row.yearMonth)}
                            </Text>
                            <Text style={styles.usageMonthSubtitle}>
                              {t("settings.memberUsageBreak", { ai: row.aiChat, imports: row.imports })}
                            </Text>
                          </View>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={isCurrent ? "#183B56" : "#8A99A8"}
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.usageMonthMembers}>
                            <View style={styles.usageTableHeader}>
                              <Text style={[styles.usageTableCell, styles.usageTableMember]}>{t("settings.member")}</Text>
                              <Text style={[styles.usageTableCell, styles.usageTableValue]}>{t("settings.aiChat")}</Text>
                              <Text style={[styles.usageTableCell, styles.usageTableValue]}>{t("settings.importLabel")}</Text>
                            </View>
                            {row.members.map((member) => (
                              <View key={`${row.yearMonth}-${member.userId}`} style={styles.usageTableRow}>
                                <Text style={[styles.usageTableCell, styles.usageTableMember]}>
                                  {member.name}
                                  <Text style={styles.usageTableMemberRole}>
                                    {member.familyRole === "owner" ? t(" · 主人" as any) : member.familyRole === "admin" ? t(" · 管理員" as any) : member.familyRole === "helper" ? t(" · 幫手" as any) : t(" · 成員" as any)}
                                  </Text>
                                </Text>
                                <Text style={styles.usageTableValue}>{member.aiChat}</Text>
                                <Text style={styles.usageTableValue}>{member.imports}</Text>
                              </View>
                            ))}
                          </View>
            )}
          </View>
                    );
                  })}
                </>
              )}
            </View>
          </View>
        )}

        {/* 語言設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowLangPicker(!showLangPicker)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="language-outline" size={20} color="#183B56" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.displayLanguage")}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {currentLang.flag} {t(currentLang.label as any)}
              </Text>
              <Ionicons
                name={showLangPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color="#8A99A8"
              />
            </View>
          </TouchableOpacity>

          {showLangPicker && (
            <View style={styles.langPicker}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    selectedLang === lang.code && styles.langOptionActive,
                  ]}
                  onPress={async () => {
                    // Fil/Ind are Pro languages; free users see the paywall instead.
                    if ((lang.code === "fil" || lang.code === "id") && !(sub as any)?.multiLang) {
                      setShowLangPicker(false);
                      setPaywallFeature("multilang");
                      setShowPaywall(true);
                      return;
                    }
                    // BUG#7 FIX: actually apply and persist language change
                    setSelectedLang(lang.code);
                    setShowLangPicker(false);
                    await i18n.changeLanguage(lang.code);
                    await AsyncStorage.setItem(LANG_STORAGE_KEY, lang.code);
                    track(Events.LanguageChanged, { language: lang.code });
                  }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langLabel,
                      selectedLang === lang.code && styles.langLabelActive,
                    ]}
                  >
                    {t(lang.label as any)}
                  </Text>
                  {selectedLang === lang.code && (
                    <Ionicons name="checkmark" size={18} color="#183B56" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 安全設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.security")}</Text>
          {biometricAvailable && (
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: "#E8F0F4" }]}>
                  <Ionicons name="scan-outline" size={20} color="#183B56" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>{t("settings.faceId")}</Text>
                  <Text style={{ fontSize: 11, color: "#8A99A8", marginTop: 1 }}>{t("settings.faceIdSub")}</Text>
                </View>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: "#E6DED4", true: "#183B56" + "60" }}
                thumbColor={biometricOn ? "#183B56" : "#FFF8EF"}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/change-password")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#DC2626" />
              </View>
              <View>
                <Text style={styles.settingLabel}>{t("settings.changePassword")}</Text>
                <Text style={{ fontSize: 11, color: "#8A99A8", marginTop: 1 }}>{t("settings.updatePassword")}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>
        </View>

        {/* 每日提醒 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.reminder")}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="alarm-outline" size={20} color="#F37021" />
              </View>
              <View>
                <Text style={styles.settingLabel}>{t("settings.dailyReminder")}</Text>
                <Text style={{ fontSize: 11, color: "#8A99A8", marginTop: 1 }}>
                  {reminderEnabled ? t("settings.reminderOn") : t("settings.reminderOff")}
                </Text>
              </View>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: "#E6DED4", true: "#183B56" + "60" }}
              thumbColor={reminderEnabled ? "#183B56" : "#FFF8EF"}
            />
          </View>

          {reminderEnabled && (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#5F6F80", marginTop: 16, marginBottom: 8 }}>{t("settings.reminderTime")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E6DED4", backgroundColor: "#FFF8EF" }}>
                  <Ionicons name="time-outline" size={18} color="#183B56" />
                  <TextInput
                    value={reminderTimeText}
                    onChangeText={handleReminderTimeChange}
                    placeholder="HH:MM"
                    placeholderTextColor="#8A99A8"
                    keyboardType="number-pad"
                    maxLength={5}
                    onSubmitEditing={applyReminderTimeText}
                    style={{ flex: 1, fontSize: 16, fontWeight: "800", color: "#183B56" }}
                  />
                </View>
                <TouchableOpacity
                  onPress={applyReminderTimeText}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: "#183B56", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{t("settings.apply")}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: "#8A99A8", marginTop: 6 }}>{t("settings.reminderHint", { time: loadedTimeLabel || "--:--" })}</Text>

              <Text style={{ fontSize: 12, fontWeight: "700", color: "#5F6F80", marginTop: 16, marginBottom: 8 }}>{t("settings.repeat")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { void commitReminder({ ...reminderSetting(), weekdays: [] }); }}
                  style={[chipStyle, reminderWeekdays.length === 0 && chipActive]}
                >
                  <Text style={[chipTxt, reminderWeekdays.length === 0 && chipTxtActive]}>{t("settings.daily")}</Text>
                </TouchableOpacity>
                {weekdayLabels.map((d) => {
                  const active = reminderWeekdays.includes(d.jsDay);
                  return (
                    <TouchableOpacity
                      key={d.jsDay}
                      onPress={() => toggleReminderWeekday(d.jsDay)}
                      style={[chipStyle, active && chipActive]}
                    >
                      <Text style={[chipTxt, active && chipTxtActive]}>{t(d.label as any)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* 功能入口 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.features")}</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/purchase-history")}
          >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="receipt-outline" size={20} color="#22C55E" />
                </View>
                <Text style={styles.settingLabel}>{t("settings.purchaseHistory")}</Text>
              </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>

            <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/ai-chef")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#E8F0F4" }]}>
                <ChatBubbleIcon size={20} color="#183B56" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.aiChef")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>

          {/* 遇到問題：用戶唔會報錯，只會走 —— 要有一道門 */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => openSupport("settings")}
            accessibilityRole="button"
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FDECEA" }]}>
                <Ionicons name="help-buoy-outline" size={20} color="#B42318" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.support" as any)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>

          {aiChefQuickPlanEnabled && (
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/meal-preferences")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FDE7D7" }]}>
                <Ionicons name="options-outline" size={20} color="#F37021" />
              </View>
              <Text style={styles.settingLabel}>{t("AI 排餐偏好" as any)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/recipe-editor")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FEF9C3" }]}>
                <Ionicons name="create-outline" size={20} color="#CA8A04" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.addCustomRecipe")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>

          {/* BUG#8 FIX: only show admin panel if user role is admin */}
          {user?.role === "admin" && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push("/admin")}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: "#E8F0F4" }]}>
                  <Ionicons name="server-outline" size={20} color="#183B56" />
                </View>
                <Text style={styles.settingLabel}>{t("settings.adminPanel")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
            </TouchableOpacity>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FFFBEB" }]}>
                <Ionicons name="bulb-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.hintToggle")}</Text>
            </View>
            <Switch
              value={hintsEnabled}
              onValueChange={handleToggleHints}
              trackColor={{ false: "#E6DED4", true: "#183B56" + "60" }}
              thumbColor={hintsEnabled ? "#183B56" : "#FFF8EF"}
            />
          </View>
        </View>

        {/* 關於 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.about")}</Text>

          <View style={styles.aboutLogoWrap}>
            <Image source={getAppLogo()} style={styles.aboutLogo} resizeMode="contain" />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F8F1E7" }]}>
                <Ionicons name="information-circle-outline" size={20} color="#5F6F80" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.version")}</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="stats-chart-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.analyticsToggle")}</Text>
            </View>
            <Switch
              value={analyticsOn}
              onValueChange={handleToggleAnalytics}
              trackColor={{ false: "#E6DED4", true: "#183B56" + "60" }}
              thumbColor={analyticsOn ? "#183B56" : "#FFF8EF"}
            />
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://cookfoodcf2026-ai.github.io/kindcipe-app-4/privacy/', {
              toolbarColor: '#183B56',
              controlsColor: '#ffffff',
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            })}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F8F1E7" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#5F6F80" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.privacyPolicy")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_SUPPORT_URL || 'https://cookfoodcf2026-ai.github.io/kindcipe-app-4/support/', {
              toolbarColor: '#183B56',
              controlsColor: '#ffffff',
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            })}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F8F1E7" }]}>
                <Ionicons name="help-circle-outline" size={20} color="#5F6F80" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.support" as any)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A99A8" />
          </TouchableOpacity>
        </View>

        {/* 登出按鈕 */}
        {isAuthenticated && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutBtnText}>{t("settings.logout")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutBtn, { marginTop: 12, borderColor: "#FECACA" }]}
              onPress={handleDeleteAccount}
              disabled={deleteAccountM.isPending}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={[styles.logoutBtnText, { color: "#DC2626" }]}>
                {deleteAccountM.isPending ? t("settings.deleting") : t("settings.deleteAccount")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={paywallFeature}
        trialDaysLeft={subInfo?.daysLeft}
        isPaid={!!subInfo?.isPaid}
      />

      {/* 修改名稱 Modal（BUG#14） */}
      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <View style={styles.nameModalOverlay}>
          <View style={styles.nameModalCard}>
            <Text style={styles.nameModalTitle}>{t("settings.editNameTitle")}</Text>
            <TextInput
              style={styles.nameModalInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t("settings.editNamePlaceholder")}
              placeholderTextColor="#8A99A8"
              maxLength={64}
              autoFocus
            />
            <View style={styles.nameModalRow}>
              <TouchableOpacity
                style={[styles.nameModalBtn, styles.nameModalCancel]}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.nameModalCancelText}>{t("settings.editNameCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nameModalBtn, styles.nameModalSave, updateProfileM.isPending && styles.nameModalSaveDisabled]}
                onPress={handleSaveName}
                disabled={updateProfileM.isPending}
              >
                {updateProfileM.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.nameModalSaveText}>{t("settings.editNameSave")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8EF" },

  header: {
    backgroundColor: "#FFF8EF",
    flexDirection: "row", alignItems: "center",
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, flex: 1, textAlign: "center", color: "#183B56" },

  // 用戶資料
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#183B56", alignItems: "center", justifyContent: "center",
  },
  avatarText: { ...typography.h1, color: "#fff" },
  profileInfo: { flex: 1 },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  editNameButton: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F0F4",
    alignItems: "center", justifyContent: "center",
  },
  profileName: { ...typography.h3, color: "#183B56" },
  profileEmail: { ...typography.caption, color: "#5F6F80", marginTop: 2 },
  roleBadge: {
    backgroundColor: "#E8F0F4", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignSelf: "flex-start", marginTop: 6,
  },
  roleText: { ...typography.caption, color: "#183B56" },

  loginCard: {
    alignItems: "center", backgroundColor: "#fff",
    margin: 16, padding: 24, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  loginCardTitle: { ...typography.h3, color: "#183B56", marginTop: 8 },
  loginCardSubtitle: { ...typography.caption, color: "#5F6F80", marginTop: 4 },

  // 設定區塊
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { ...typography.sectionLabel, color: "#8A99A8", marginBottom: 8, letterSpacing: 0.5 },
  aboutLogoWrap: { alignItems: "center", paddingVertical: 20 },
  aboutLogo: { width: 120, height: 120, resizeMode: "contain" },

  settingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#E8F0F4", alignItems: "center", justifyContent: "center",
  },
  settingLabel: { ...typography.label, color: "#183B56" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { ...typography.caption, color: "#5F6F80" },

  // 語言選擇
  langPicker: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 2, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  langOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#F8F1E7",
  },
  langOptionActive: { backgroundColor: "#E8F0F4" },
  langFlag: { fontSize: 22 },
  langLabel: { ...typography.label, flex: 1, color: "#5F6F80" },
  langLabelActive: { color: "#183B56" },

  // 訂閱狀態卡片
  subCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderRadius: 16, borderLeftWidth: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  subCardLeft: { flex: 1 },
  subCardTitle: { fontSize: 12, color: "#8A99A8", marginBottom: 4 },
  subCardStatus: { ...typography.body, fontWeight: "800" },
  subManagedNote: { fontSize: 12, color: "#5F6F80", maxWidth: 130, textAlign: "right" },
  billingNotice: { fontSize: 13, color: "#183B56", marginTop: 8, marginBottom: 4 },
  upgradeSmallBtn: {
    backgroundColor: "#183B56", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  upgradeSmallBtnText: { ...typography.button, color: "#fff" },
  manageSmallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#183B56",
  },
  manageSmallBtnText: { ...typography.button, color: "#183B56" },

  // 使用統計
  usageCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6DED4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  usageHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  usageTitle: { ...typography.h3, color: "#183B56" },
  usageSubtitle: { fontSize: 11, color: "#5F6F80", marginTop: 3 },
  usageMonthBadge: {
    backgroundColor: "#E8F0F4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  usageMonthBadgeText: { fontSize: 11, fontWeight: "800", color: "#183B56" },
  usageMetricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageMetricLabel: { ...typography.caption, fontWeight: "700", color: "#5F6F80" },
  usageMetricValue: { ...typography.caption, fontWeight: "800", color: "#183B56" },
  usageBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E8F0F4",
    overflow: "hidden",
    marginTop: 8,
  },
  usageBarFill: { height: "100%", borderRadius: 999 },
  usageMemberSectionTitle: { ...typography.caption, fontWeight: "800", color: "#183B56", marginBottom: 10 },
  usageMemberList: { gap: 12 },
  usageMemberRow: {
    backgroundColor: "#FFF8EF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8F0F4",
  },
  usageMemberTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageMemberName: { ...typography.caption, flex: 1, fontWeight: "800", color: "#183B56", marginRight: 8 },
  usageMemberCount: { ...typography.caption, fontWeight: "800", color: "#183B56" },
  usageMemberBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E6DED4",
    overflow: "hidden",
    marginTop: 10,
  },
  usageMemberBarFill: { height: "100%", borderRadius: 999 },
  usageMemberSub: { fontSize: 11, color: "#5F6F80", marginTop: 8 },
  usageMemberEmpty: { fontSize: 12, color: "#8A99A8", marginTop: 4 },
  usageTableCard: {
    backgroundColor: "#fff",
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6DED4",
  },
  usageTableToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  usageTableToggleTitle: { ...typography.label, fontWeight: "800", color: "#183B56" },
  usageTableToggleSubtitle: { fontSize: 11, color: "#5F6F80", marginTop: 3 },
  usageMonthCard: {
    borderTopWidth: 1,
    borderTopColor: "#F8F1E7",
  },
  usageMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  usageMonthTitle: { fontSize: 14, fontWeight: "800" },
  usageMonthSubtitle: { fontSize: 11, color: "#5F6F80", marginTop: 4 },
  usageMonthMembers: {
    backgroundColor: "#FFF8EF",
    borderTopWidth: 1,
    borderTopColor: "#F8F1E7",
  },
  usageTableHeader: {
    flexDirection: "row",
    backgroundColor: "#FFF8EF",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  usageTableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#F8F1E7",
  },
  usageTableRowCurrent: { backgroundColor: "#E8F0F4" },
  usageTableCell: { ...typography.caption, fontWeight: "700", color: "#5F6F80" },
  usageTableCellCurrent: { color: "#183B56" },
  usageTableMonth: { flex: 1.6 },
  usageTableMember: { flex: 1.5 },
  usageTableValue: { flex: 0.7, textAlign: "center" },
  usageTableMemberRole: { fontSize: 11, color: "#5F6F80" },

  // 廚房狀態
  kitchenCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6DED4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kitchenCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  kitchenName: { ...typography.h3, color: "#183B56" },
  kitchenSub: { fontSize: 12, color: "#8A99A8", marginTop: 4, lineHeight: 17 },
  kitchenActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  kitchenPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#183B56",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  kitchenPrimaryBtnText: { ...typography.caption, color: "#fff", fontWeight: "800" },
  kitchenSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  kitchenSecondaryBtnText: { ...typography.caption, color: "#183B56", fontWeight: "800" },

  // 登出
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FEF2F2", padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutBtnText: { ...typography.label, color: "#EF4444" },

  nameModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  nameModalCard: {
    width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 16,
    padding: 20,
  },
  nameModalTitle: { ...typography.h3, color: "#183B56", marginBottom: 14 },
  nameModalInput: {
    borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#183B56", marginBottom: 16,
  },
  nameModalRow: { flexDirection: "row", gap: 10 },
  nameModalBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  nameModalCancel: { backgroundColor: "#F8F1E7" },
  nameModalCancelText: { ...typography.button, color: "#5F6F80" },
  nameModalSave: { backgroundColor: "#183B56" },
  nameModalSaveDisabled: { backgroundColor: "#5F6F80" },
  nameModalSaveText: { ...typography.button, color: "#FFFFFF" },

  promoCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: "#E6DED4",
  },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: {
    flex: 1, borderWidth: 1, borderColor: "#E6DED4", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#183B56",
  },
  promoBtn: {
    backgroundColor: "#183B56", borderRadius: 10, paddingHorizontal: 18,
    paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  promoBtnDisabled: { backgroundColor: "#5F6F80" },
  promoBtnText: { ...typography.button, color: "#FFFFFF" },
  promoErrorText: { color: "#DC2626", fontSize: 13, marginTop: 6 },
  promoDoneText: { ...typography.label, color: "#16A34A", textAlign: "center" },
});

const chipStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#E6DED4",
  backgroundColor: "#FFF8EF",
  minWidth: 52,
};
const chipActive = { backgroundColor: "#183B56", borderColor: "#183B56" };
const chipTxt = { fontSize: 14, fontWeight: "700" as const, color: "#5F6F80" };
const chipTxtActive = { color: "#fff" };
