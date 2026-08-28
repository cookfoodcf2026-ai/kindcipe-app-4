import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import type { ComponentType, ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/app/styles/colors";
import { theme } from "@/app/styles/theme";
import { typography } from "@/app/styles/typography";
import {
  BookmarkIcon,
  RecipeIcon,
  ImportIcon,
  StarIcon,
  PlannerIcon,
  ShoppingIcon,
  HomeIcon,
  ReceiptIcon,
  ChefHatIcon,
  SettingsIcon,
  LogOutIcon,
  AddIcon,
  ChatBubbleIcon,
  BasketIcon,
  XIcon,
} from "@/src/components/icons";

type FeatureCardProps = {
  title: string;
  subtitle: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  accent?: "navy" | "copper";
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  compact?: boolean;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionMarker} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FeatureCard({
  title,
  subtitle,
  Icon,
  accent = "navy",
  onPress,
  accessibilityLabel,
  disabled = false,
}: FeatureCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        disabled && styles.cardDisabled,
      ]}
    >
      <View style={[styles.cardIconWrap, accent === "copper" && styles.cardIconWrapCopper]}>
        <Icon size={24} color={accent === "copper" ? colors.primary.copper : colors.primary.navy} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉" style={styles.closeBtn}>
              <XIcon size={18} color={colors.neutral.darkGray} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function MoreTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, isLoading, isAuthenticated, familyRole, logoutAsync, logoutPending, resetLogout } = useAuth();
  const navLockRef = useRef(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [logoutMsg, setLogoutMsg] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return "";
    return raw.split(/\s+/)[0];
  }, [user?.name]);

  const greetingName = firstName || "你";

  const cardWidth = useMemo(() => {
    const horizontal = 20;
    const gap = 12;
    return Math.floor((width - horizontal * 2 - gap) / 2);
  }, [width]);

  const navigate = (action: () => void) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    action();
    setTimeout(() => {
      navLockRef.current = false;
    }, 350);
  };

  const goToRecipes = (viewMode: "official" | "kol" | "user") => {
    navigate(() => {
      router.push({ pathname: "/recipes", params: { source: viewMode } } as any);
    });
  };

  const goToComingSoon = (title: string, subtitle: string, message: string) => {
    navigate(() => {
      router.push({ pathname: "/coming-soon", params: { title, subtitle, message } } as any);
    });
  };

  const handleLogoutConfirm = async () => {
    setLogoutMsg(null);
    try {
      await logoutAsync();
    } catch (e: any) {
      setLogoutMsg(e?.message || "登出失敗，請再試一次。");
    }
  };

  const recipeCards = [
    {
      title: "官方食譜",
      subtitle: "瀏覽平台精選食譜",
      Icon: RecipeIcon,
      onPress: () => goToRecipes("official"),
      accessibilityLabel: "官方食譜，瀏覽平台精選食譜",
    },
    {
      title: "網紅食譜",
      subtitle: "探索創作者熱門菜式",
      Icon: StarIcon,
      accent: "copper" as const,
      onPress: () => goToRecipes("kol"),
      accessibilityLabel: "網紅食譜，探索創作者熱門菜式",
    },
    {
      title: "我的食譜",
      subtitle: "管理你的自建與匯入食譜",
      Icon: BookmarkIcon,
      onPress: () => {
        if (!isAuthenticated) {
          Alert.alert("需要登入", "請先登入後再查看你的食譜。", [{ text: "取消", style: "cancel" }, { text: "登入", onPress: () => router.push("/login") }]);
          return;
        }
        goToRecipes("user");
      },
      accessibilityLabel: "我的食譜，管理你的自建與匯入食譜",
    },
    {
      title: "新增食譜",
      subtitle: "貼上連結或手動建立",
      Icon: AddIcon,
      onPress: () => setShowAddSheet(true),
      accessibilityLabel: "新增食譜，貼上連結或手動建立",
    },
  ];

  const smartCards = [
    {
      title: "AI 助手",
      subtitle: "AI Chef，解答煮食問題",
      Icon: ChatBubbleIcon,
      onPress: () => navigate(() => router.push("/ai-chef")),
      accessibilityLabel: "AI 助手，AI Chef，解答煮食問題",
    },
    {
      title: "今日餐單",
      subtitle: "查看今日菜式與煮食步驟",
      Icon: PlannerIcon,
      onPress: () => navigate(() => router.push("/(tabs)/planner")),
      accessibilityLabel: "今日餐單，查看今日菜式與煮食步驟",
    },
  ];

  const familyCards = [
    {
      title: "聚會買餸單",
      subtitle: "快速整理聚會購買",
      Icon: BasketIcon,
      onPress: () => navigate(() => router.push("/shopping-templates")),
      accessibilityLabel: "聚會買餸單，快速整理聚會購買",
    },
    {
      title: "管理廚房",
      subtitle: "管理廚房與成員",
      Icon: HomeIcon,
      onPress: () => navigate(() => router.push("/kitchen-settings")),
      accessibilityLabel: "管理廚房與成員",
    },
    {
      title: "購買記錄",
      subtitle: "查看過往購買內容",
      Icon: ReceiptIcon,
      onPress: () => navigate(() => router.push("/purchase-history")),
      accessibilityLabel: "購買記錄，查看過往購買內容",
    },
    {
      title: "廚房學堂",
      subtitle: "學識切、醃、炒、蒸、煮",
      Icon: ChefHatIcon,
      accent: "copper" as const,
      onPress: () => goToComingSoon("廚房學堂", "學識切、醃、炒、蒸、煮", "廚房學堂仍在準備中，之後會提供一步一步的烹飪教學。"),
      accessibilityLabel: "廚房學堂，學識切、醃、炒、蒸、煮",
    },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>更多功能</Text>
          <Text style={styles.headerSub}>嗨，{greetingName}，今天想煮什麼？</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 88, 112) }}
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary.navy} />
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.sectionBlock}>
            <SectionHeader title="食譜入口" />
            <View style={styles.grid}>
              {recipeCards.map((item) => (
                <View key={item.title} style={[styles.gridCell, { width: cardWidth }]}>
                  <FeatureCard {...item} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="智能與靈感" />
            <View style={styles.grid}>
              {smartCards.map((item) => (
                <View key={item.title} style={[styles.gridCell, { width: cardWidth }]}>
                  <FeatureCard {...item} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="購買與家庭" />
            <View style={styles.grid}>
              {familyCards.map((item) => (
                <View key={item.title} style={[styles.gridCell, { width: cardWidth }]}>
                  <FeatureCard {...item} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="帳戶" />
            <View style={styles.grid}>
              <View style={[styles.gridCell, { width: cardWidth }]}>
                <FeatureCard
                  title="設定"
                  subtitle="語言與帳戶設定"
                  Icon={SettingsIcon}
                  onPress={() => navigate(() => router.push("/settings"))}
                  accessibilityLabel="設定，語言與帳戶設定"
                />
              </View>
              <View style={[styles.gridCell, { width: cardWidth }]}>
                <FeatureCard
                  title="登出"
                  subtitle="安全登出目前帳戶"
                  Icon={LogOutIcon}
                  onPress={() => {
                    setLogoutMsg(null);
                    resetLogout();
                    setShowLogoutSheet(true);
                  }}
                  accessibilityLabel="登出，安全登出目前帳戶"
                  accent="copper"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <ModalSheet
        visible={showAddSheet}
        title="新增食譜"
        onClose={() => setShowAddSheet(false)}
      >
        <View style={styles.sheetBody}>
          <Pressable
            style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            onPress={() => {
              setShowAddSheet(false);
              navigate(() => router.push("/import"));
            }}
          >
            <ImportIcon size={22} color={colors.primary.navy} />
            <View style={styles.sheetOptionTextWrap}>
              <Text style={styles.sheetOptionTitle}>匯入和新增食譜</Text>
              <Text style={styles.sheetOptionSub}>貼上連結、文字或截圖</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            onPress={() => {
              setShowAddSheet(false);
              navigate(() => router.push("/recipe-editor"));
            }}
          >
            <RecipeIcon size={22} color={colors.primary.navy} />
            <View style={styles.sheetOptionTextWrap}>
              <Text style={styles.sheetOptionTitle}>新增空白食譜</Text>
              <Text style={styles.sheetOptionSub}>自己慢慢建立食譜內容</Text>
            </View>
          </Pressable>

          <Pressable style={styles.sheetCancel} onPress={() => setShowAddSheet(false)}>
            <Text style={styles.sheetCancelText}>取消</Text>
          </Pressable>
        </View>
      </ModalSheet>

      <ModalSheet
        visible={showLogoutSheet}
        title="確定要登出嗎？"
        onClose={() => {
          if (logoutPending) return;
          setLogoutMsg(null);
          setShowLogoutSheet(false);
        }}
      >
        <View style={styles.logoutBody}>
          <Text style={styles.logoutMsg}>登出後需要重新登入才能使用帳戶功能。</Text>
          {logoutMsg ? <Text style={styles.logoutError}>{logoutMsg}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.logoutConfirm, pressed && !logoutPending && styles.logoutConfirmPressed, logoutPending && styles.logoutConfirmDisabled]}
            disabled={logoutPending}
            onPress={handleLogoutConfirm}
          >
            {logoutPending ? (
              <ActivityIndicator color={colors.neutral.white} />
            ) : (
              <Text style={styles.logoutConfirmText}>登出</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sheetCancel, pressed && styles.sheetOptionPressed]}
            onPress={() => {
              if (logoutPending) return;
              setLogoutMsg(null);
              setShowLogoutSheet(false);
            }}
          >
            <Text style={styles.sheetCancelText}>取消</Text>
          </Pressable>
        </View>
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary.cream,
  },
  header: {
    backgroundColor: colors.primary.navy,
    paddingHorizontal: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.neutral.white,
  },
  headerSub: {
    ...typography.body,
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  loadingWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionMarker: {
    width: 18,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.primary.copper,
    marginRight: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.primary.darkGray,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridCell: {
    marginBottom: 0,
  },
  card: {
    width: "100%",
    minHeight: 146,
    backgroundColor: colors.neutral.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3ECF5",
    padding: 14,
    shadowColor: "#01213A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
    borderColor: "#C9D8E8",
    backgroundColor: "#F9FCFF",
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardIconWrapCopper: {
    backgroundColor: "#FFF4DC",
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "800",
    color: colors.primary.darkGray,
    marginBottom: 5,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.neutral.darkGray,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.neutral.white,
    borderRadius: 22,
    padding: 16,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D8E4F0",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.primary.darkGray,
  },
  sheetBody: {
    gap: 12,
  },
  sheetOption: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3ECF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FCFEFF",
  },
  sheetOptionPressed: {
    backgroundColor: "#F4F9FF",
    borderColor: "#C9D8E8",
  },
  sheetOptionTextWrap: {
    flex: 1,
  },
  sheetOptionTitle: {
    ...typography.body,
    fontWeight: "800",
    color: colors.primary.darkGray,
    marginBottom: 2,
  },
  sheetOptionSub: {
    ...typography.bodySmall,
    color: colors.neutral.darkGray,
  },
  sheetCancel: {
    minHeight: 52,
    marginTop: 2,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6FA",
  },
  sheetCancelText: {
    ...typography.body,
    fontWeight: "800",
    color: colors.primary.darkGray,
  },
  logoutBody: {
    gap: 12,
  },
  logoutMsg: {
    ...typography.body,
    color: colors.neutral.darkGray,
    lineHeight: 22,
  },
  logoutError: {
    ...typography.bodySmall,
    color: colors.status.error,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 10,
  },
  logoutConfirm: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.primary.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutConfirmPressed: {
    opacity: 0.92,
  },
  logoutConfirmDisabled: {
    opacity: 0.7,
  },
  logoutConfirmText: {
    ...typography.body,
    fontWeight: "800",
    color: colors.neutral.white,
  },
});
