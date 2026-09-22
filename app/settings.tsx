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
  Alert, Switch, TextInput, Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { enumT } from "@/lib/i18nEnums";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import i18n from "@/lib/i18n";
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from "@/lib/auth";
import { clearAuthToken, FAMILY_ID_KEY } from "@/lib/auth";
import { getMealReminderSetting, saveMealReminderSetting, applyMealReminder, type MealReminderSetting } from "@/lib/notifications";
import PaywallModal from "@/components/PaywallModal";
import { ChatBubbleIcon } from "@/src/components/icons";
import { getHintsDisabled, setHintsDisabled } from "@/src/components/HintBanner";
import { getAppLogo } from "@/lib/logo";
import { friendlyError } from "@/lib/errors";

const LANGUAGES = [
  { code: "zh-TW", label: "繁體中文", flag: "🇭🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "id", label: "Indonesia", flag: "🇮🇩" },
];

const LANG_STORAGE_KEY = "kindcipe_language";

function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, familyRole, activeFamily, families } = useAuth();
  const [selectedLang, setSelectedLang] = useState(i18n.language || "zh-TW");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [expandedUsageMonths, setExpandedUsageMonths] = useState<Record<string, boolean>>({});

  // BUG#7 FIX: load persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then(lang => {
      if (lang) setSelectedLang(lang);
    });
  }, []);

  const handleLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: t("取消" as any), style: "cancel" },
      {
        text: t("登出" as any),
        style: "destructive",
        onPress: () => logout(),
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
      Alert.alert("已刪除", "帳戶已永久刪除。");
    },
    onError: (e) => Alert.alert("刪除失敗", friendlyError(e)),
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      "刪除帳戶",
      "呢個操作會永久刪除你嘅帳戶同所有資料（食譜、排餐、購物清單、訂閱等），無法復原。確定要刪除嗎？",
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
      Alert.alert("通知權限", "未能取得通知權限，提醒未開啟。請到系統設定開啟通知。", [
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
      Alert.alert("時間格式", "請輸入 HH:MM（例如 19:30）", [{ text: t("確定" as any) }]);
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
  const subscriptionQuery = trpc.family.subscription.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const usageQuery = trpc.family.usage.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const usageHistoryByMemberQuery = trpc.family.usageHistoryByMember.useQuery({ months: 6 }, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const sub = subscriptionQuery.data;
  const usage = usageQuery.data;
  const usageHistoryByMember = usageHistoryByMemberQuery.data ?? [];
  const hasFamily = families.length > 0;
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const currentUsageMonth = usageHistoryByMember.find((row) => row.yearMonth === currentYearMonth);
  const currentUsageMembers = currentUsageMonth?.members ?? [];
  const currentUsageMax = Math.max(1, ...currentUsageMembers.map((m) => m.aiChat + m.imports));

  const getSubscriptionLabel = () => {
    if (!sub) return null;
    if (sub.status === "trial") {
      const daysLeft = sub.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
        : 0;
      return { label: `試用中（剩餘 ${daysLeft} 天）`, color: "#F59E0B", isPaid: true, daysLeft };
    }
    if (sub.status === "active") return { label: t("settings.subActive"), color: "#16A34A", isPaid: true, daysLeft: 0 };
    if (sub.status === "expired") return { label: t("settings.subExpired"), color: "#EF4444", isPaid: false, daysLeft: 0 };
    return { label: "免費版", color: "#6B7280", isPaid: false, daysLeft: 0 };
  };
  const subInfo = getSubscriptionLabel();

  return (
    <View style={styles.container}>
      {/* 頭部 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
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
              <Text style={styles.profileName}>{user.name || t("dyn.user")}</Text>
              <Text style={styles.profileEmail}>{user.email || ""}</Text>
              {user.role && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {familyRole === "owner" ? "廚房主人"
                     : familyRole === "admin" ? "廚房管理員"
                     : familyRole === "helper" ? "幫手"
                     : familyRole === "member" ? "家庭成員"
                     : user.role === "admin" ? "管理員"
                     : "家庭成員"}
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
            <Ionicons name="person-circle-outline" size={48} color="#013E77" />
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
                <View style={[styles.settingIcon, { backgroundColor: "#EEF4FB" }]}> 
                  <Ionicons name="home-outline" size={20} color="#013E77" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kitchenName}>{activeFamily?.name || t("settings.notInKitchen")}</Text>
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
            {!subInfo.isPaid && (
              <TouchableOpacity
                style={styles.upgradeSmallBtn}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.upgradeSmallBtnText}>{t("settings.upgrade")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

              <View style={styles.usageMetricRow}>
                <Text style={styles.usageMetricLabel}>{t("settings.aiChat")}</Text>
                <Text style={styles.usageMetricValue}>{t("dyn.times", { n: `${usage.aiChat.used}/${usage.aiChat.limit}` })}</Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${Math.min(100, Math.round((usage.aiChat.used / Math.max(usage.aiChat.limit, 1)) * 100))}%`,
                      backgroundColor: "#7C3AED",
                    },
                  ]}
                />
              </View>

              <View style={[styles.usageMetricRow, { marginTop: 14 }]}>
                <Text style={styles.usageMetricLabel}>{t("settings.recipeImport")}</Text>
                <Text style={styles.usageMetricValue}>{t("dyn.times", { n: `${usage.imports.used}/${usage.imports.limit}` })}</Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${Math.min(100, Math.round((usage.imports.used / Math.max(usage.imports.limit, 1)) * 100))}%`,
                      backgroundColor: "#013E77",
                    },
                  ]}
                />
              </View>

              <View style={{ height: 12 }} />

              <Text style={styles.usageMemberSectionTitle}>{t("settings.memberUsage")}</Text>
              {currentUsageMembers.length > 0 ? (
                <View style={styles.usageMemberList}>
                  {currentUsageMembers.map((member) => {
                    const total = member.aiChat + member.imports;
                    const width = `${Math.max(6, Math.round((total / currentUsageMax) * 100))}%` as `${number}%`;
                    return (
                      <View key={member.userId} style={styles.usageMemberRow}>
                        <View style={styles.usageMemberTopRow}>
                          <Text style={styles.usageMemberName} numberOfLines={1}>
                            {member.name}
                          </Text>
                          <Text style={styles.usageMemberCount}>
                            {total} 次
                          </Text>
                        </View>
                        <View style={styles.usageMemberBarTrack}>
                          <View
                            style={[
                              styles.usageMemberBarFill,
                              { width, backgroundColor: member.familyRole === "owner" ? "#013E77" : member.familyRole === "admin" ? "#7C3AED" : "#0F766E" },
                            ]}
                          />
                        </View>
                        <Text style={styles.usageMemberSub}>
                          AI {member.aiChat} · 匯入 {member.imports}
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
                  color="#013E77"
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
                              AI {row.aiChat} 次 · 匯入 {row.imports} 次
                            </Text>
                          </View>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={isCurrent ? "#013E77" : "#9CA3AF"}
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.usageMonthMembers}>
                            <View style={styles.usageTableHeader}>
                              <Text style={[styles.usageTableCell, styles.usageTableMember]}>{t("settings.member")}</Text>
                              <Text style={[styles.usageTableCell, styles.usageTableValue]}>AI</Text>
                              <Text style={[styles.usageTableCell, styles.usageTableValue]}>{t("settings.importLabel")}</Text>
                            </View>
                            {row.members.map((member) => (
                              <View key={`${row.yearMonth}-${member.userId}`} style={styles.usageTableRow}>
                                <Text style={[styles.usageTableCell, styles.usageTableMember]}>
                                  {member.name}
                                  <Text style={styles.usageTableMemberRole}>
                                    {member.familyRole === "owner" ? " · 主人" : member.familyRole === "admin" ? " · 管理員" : member.familyRole === "helper" ? " · 幫手" : " · 成員"}
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
                <Ionicons name="language-outline" size={20} color="#013E77" />
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
                color="#9CA3AF"
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
                    // BUG#7 FIX: actually apply and persist language change
                    setSelectedLang(lang.code);
                    setShowLangPicker(false);
                    await i18n.changeLanguage(lang.code);
                    await AsyncStorage.setItem(LANG_STORAGE_KEY, lang.code);
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
                    <Ionicons name="checkmark" size={18} color="#013E77" />
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
                <View style={[styles.settingIcon, { backgroundColor: "#EEF4FB" }]}>
                  <Ionicons name="scan-outline" size={20} color="#013E77" />
                </View>
                <View>
                  <Text style={styles.settingLabel}>{t("settings.faceId")}</Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{t("settings.faceIdSub")}</Text>
                </View>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: "#D1D5DB", true: "#013E77" + "60" }}
                thumbColor={biometricOn ? "#013E77" : "#F9FAFB"}
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
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{t("settings.updatePassword")}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* 每日提醒 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.reminder")}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="alarm-outline" size={20} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.settingLabel}>{t("settings.dailyReminder")}</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {reminderEnabled ? t("settings.reminderOn") : t("settings.reminderOff")}
                </Text>
              </View>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: "#D1D5DB", true: "#013E77" + "60" }}
              thumbColor={reminderEnabled ? "#013E77" : "#F9FAFB"}
            />
          </View>

          {reminderEnabled && (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#6B7280", marginTop: 16, marginBottom: 8 }}>{t("settings.reminderTime")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" }}>
                  <Ionicons name="time-outline" size={18} color="#013E77" />
                  <TextInput
                    value={reminderTimeText}
                    onChangeText={handleReminderTimeChange}
                    placeholder="HH:MM"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={5}
                    onSubmitEditing={applyReminderTimeText}
                    style={{ flex: 1, fontSize: 16, fontWeight: "800", color: "#013E77" }}
                  />
                </View>
                <TouchableOpacity
                  onPress={applyReminderTimeText}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: "#013E77", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{t("settings.apply")}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{t("settings.reminderHint", { time: loadedTimeLabel || "--:--" })}</Text>

              <Text style={{ fontSize: 12, fontWeight: "700", color: "#6B7280", marginTop: 16, marginBottom: 8 }}>{t("settings.repeat")}</Text>
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
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

            <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/ai-chef")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F5F3FF" }]}> 
                <ChatBubbleIcon size={20} color="#013E77" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.aiChef")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/markets")}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="storefront-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.marketGuide")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

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
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* BUG#8 FIX: only show admin panel if user role is admin */}
          {user?.role === "admin" && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push("/admin")}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="server-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.settingLabel}>{t("settings.adminPanel")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
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
              trackColor={{ false: "#D1D5DB", true: "#013E77" + "60" }}
              thumbColor={hintsEnabled ? "#013E77" : "#F9FAFB"}
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
              <View style={[styles.settingIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.version")}</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => WebBrowser.openBrowserAsync(process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://cookfoodcf2026-ai.github.io/kindcipe-app-4/privacy/', {
              toolbarColor: '#013E77',
              controlsColor: '#ffffff',
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            })}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.settingLabel}>{t("settings.privacyPolicy")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
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
        feature="generic"
        trialDaysLeft={subInfo?.daysLeft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8F5" },

  header: {
    backgroundColor: "#FAF8F5",
    flexDirection: "row", alignItems: "center",
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: "#1A1A1A" },

  // 用戶資料
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#013E77", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  profileEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  roleBadge: {
    backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignSelf: "flex-start", marginTop: 6,
  },
  roleText: { fontSize: 11, color: "#013E77", fontWeight: "700" },

  loginCard: {
    alignItems: "center", backgroundColor: "#fff",
    margin: 16, padding: 24, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  loginCardTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginTop: 8 },
  loginCardSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  // 設定區塊
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", marginBottom: 8, letterSpacing: 0.5 },
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
    backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center",
  },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 13, color: "#6B7280" },

  // 語言選擇
  langPicker: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 2, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  langOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  langOptionActive: { backgroundColor: "#EFF6FF" },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "600" },
  langLabelActive: { color: "#013E77" },

  // 訂閱狀態卡片
  subCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderRadius: 16, borderLeftWidth: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  subCardLeft: { flex: 1 },
  subCardTitle: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  subCardStatus: { fontSize: 16, fontWeight: "800" },
  upgradeSmallBtn: {
    backgroundColor: "#013E77", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  upgradeSmallBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // 使用統計
  usageCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  usageHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  usageTitle: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  usageSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  usageMonthBadge: {
    backgroundColor: "#EEF4FB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  usageMonthBadgeText: { fontSize: 11, fontWeight: "800", color: "#013E77" },
  usageMetricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageMetricLabel: { fontSize: 13, fontWeight: "700", color: "#374151" },
  usageMetricValue: { fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
  usageBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EEF2F7",
    overflow: "hidden",
    marginTop: 8,
  },
  usageBarFill: { height: "100%", borderRadius: 999 },
  usageMemberSectionTitle: { fontSize: 13, fontWeight: "800", color: "#1A1A1A", marginBottom: 10 },
  usageMemberList: { gap: 12 },
  usageMemberRow: {
    backgroundColor: "#FAFBFD",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  usageMemberTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageMemberName: { flex: 1, fontSize: 13, fontWeight: "800", color: "#1A1A1A", marginRight: 8 },
  usageMemberCount: { fontSize: 12, fontWeight: "800", color: "#013E77" },
  usageMemberBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E8EEF5",
    overflow: "hidden",
    marginTop: 10,
  },
  usageMemberBarFill: { height: "100%", borderRadius: 999 },
  usageMemberSub: { fontSize: 11, color: "#6B7280", marginTop: 8 },
  usageMemberEmpty: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  usageTableCard: {
    backgroundColor: "#fff",
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  usageTableToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  usageTableToggleTitle: { fontSize: 14, fontWeight: "800", color: "#1A1A1A" },
  usageTableToggleSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  usageMonthCard: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  usageMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  usageMonthTitle: { fontSize: 14, fontWeight: "800" },
  usageMonthSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  usageMonthMembers: {
    backgroundColor: "#FAFBFD",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  usageTableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  usageTableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  usageTableRowCurrent: { backgroundColor: "#EEF4FB" },
  usageTableCell: { fontSize: 12, fontWeight: "700", color: "#374151" },
  usageTableCellCurrent: { color: "#013E77" },
  usageTableMonth: { flex: 1.6 },
  usageTableMember: { flex: 1.5 },
  usageTableValue: { flex: 0.7, textAlign: "center" },
  usageTableMemberRole: { fontSize: 11, color: "#6B7280" },

  // 廚房狀態
  kitchenCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0EAF4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kitchenCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  kitchenName: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  kitchenSub: { fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 17 },
  kitchenActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  kitchenPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#013E77",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  kitchenPrimaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  kitchenSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F3F6FA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  kitchenSecondaryBtnText: { color: "#013E77", fontSize: 13, fontWeight: "800" },

  // 登出
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FEF2F2", padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutBtnText: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
});

const chipStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#D1D5DB",
  backgroundColor: "#F9FAFB",
  minWidth: 52,
};
const chipActive = { backgroundColor: "#013E77", borderColor: "#013E77" };
const chipTxt = { fontSize: 14, fontWeight: "700" as const, color: "#4B5563" };
const chipTxtActive = { color: "#fff" };
