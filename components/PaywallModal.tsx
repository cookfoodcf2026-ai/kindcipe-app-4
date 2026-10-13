/**
 * PaywallModal — 付費牆 Modal
 * 當免費用戶嘗試使用付費功能時彈出
 *
 * 使用方式：
 * <PaywallModal
 *   visible={showPaywall}
 *   onClose={() => setShowPaywall(false)}
 *   feature="import"  // 觸發的功能類型
 * />
 */
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Linking,
} from "react-native";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { track, Events } from "@/lib/analytics";
import { friendlyError } from "@/lib/errors";
import { purchaseSubscription, PRODUCT_IDS, manageSubscription, isStripeSupported, canPurchaseHere, type ProductId } from "../lib/purchase";
import { PRICE, YEARLY_SAVE_PCT } from "../lib/pricing";
import { trpc } from "../lib/trpc";

const INSTAGRAM_URL =
  process.env.EXPO_PUBLIC_INSTAGRAM_URL ??
  (Constants.expoConfig?.extra as any)?.instagramUrl ??
  "";

type PaywallFeature =
  | "import_limit"    // 匯入次數超出
  | "recipe_limit"    // 食譜數量超出
  | "member_limit"    // 成員數量超出
  | "screenshot"      // 截圖匯入（付費功能）
  | "ingredient_search" // 食材搜尋（付費功能）
  | "multilang"       // 多語言（付費功能）
  | "generic";        // 通用

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: PaywallFeature;
  trialDaysLeft?: number; // 試用期剩餘天數（如果在試用中）
}

const FEATURE_MESSAGES: Record<PaywallFeature, { emoji: string; key: PaywallFeature }> = {
  import_limit: { emoji: "📥", key: "import_limit" },
  recipe_limit: { emoji: "📚", key: "recipe_limit" },
  member_limit: { emoji: "👨‍👩‍👧", key: "member_limit" },
  screenshot: { emoji: "📸", key: "screenshot" },
  ingredient_search: { emoji: "🔍", key: "ingredient_search" },
  multilang: { emoji: "🌏", key: "multilang" },
  generic: { emoji: "⭐", key: "generic" },
};

export default function PaywallModal({
  visible,
  onClose,
  feature = "generic",
  trialDaysLeft,
}: PaywallModalProps) {
  const { t } = useTranslation();
  const msg = FEATURE_MESSAGES[feature];
  const [isPurchasing, setIsPurchasing] = useState<"monthly" | "yearly" | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "redeeming" | "done" | "error">("idle");
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const redeemM = trpc.subscription.redeemTrialCode.useMutation({
    onSuccess: async (res) => {
      setPromoState("done");
      setPromoMsg(res.expiresAt ? t("paywall.promoDone", { date: new Date(res.expiresAt).toLocaleDateString() }) : t("paywall.promoDoneShort"));
      await utils.invalidate();
      track(Events.PromoRedeemed, {});
    },
    onError: (e) => {
      setPromoState("error");
      setPromoMsg(friendlyError(e));
    },
  });

  const handleRedeem = () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoState("redeeming");
    setPromoMsg(null);
    redeemM.mutate({ code });
  };

  useEffect(() => {
    if (visible) track(Events.PaywallViewed, { feature });
  }, [visible, feature]);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (productId: ProductId) => {
    setIsPurchasing(productId === PRODUCT_IDS.MONTHLY ? "monthly" : "yearly");
    setError(null);

    try {
      const result = await purchaseSubscription(productId);
      if (result.success) {
        // 購買成功，關閉 Modal
        onClose();
      } else if (result.error === 'cancelled') {
        // 用戶取消，唔使做嘢
      } else {
        setError(result.error || friendlyError({ message: "" }, "error.purchaseFailed"));
      }
    } catch (err: any) {
      setError(friendlyError(err, "error.purchaseFailed"));
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await manageSubscription();
    } catch (err) {
      console.error('[Paywall] manageSubscription failed:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.sheet}
          activeOpacity={1}
          onPress={() => {}} // 防止點擊內容關閉
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Content */}
          <Text style={styles.emoji}>{msg.emoji}</Text>
          <Text style={styles.title}>{t(`paywall.feature.${msg.key}.title` as any)}</Text>
          <Text style={styles.desc}>{t(`paywall.feature.${msg.key}.desc` as any)}</Text>

          {/* Pricing（只有真係買到先顯示，避免 iOS 死按鈕） */}
          {canPurchaseHere ? (
          <>
          <View style={styles.pricingBox}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>{t("paywall.monthlyLabel" as any)}</Text>
              <View style={styles.pricingRight}>
                <Text style={styles.priceStrike}>{PRICE.monthlyRegular}</Text>
                <Text style={styles.price}>{PRICE.monthly}</Text>
                <Text style={styles.pricePer}>{t("paywall.perMonth" as any)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.pricingRow}>
              <View style={styles.pricingLabelRow}>
                <Text style={styles.pricingLabel}>{t("paywall.yearlyLabel" as any)}</Text>
                <View style={styles.mostPopularBadge}>
                  <Text style={styles.mostPopularText}>{t("paywall.mostPopular" as any)}</Text>
                </View>
              </View>
              <View style={styles.pricingRight}>
                <View style={styles.priceWrap}>
                  <Text style={styles.priceStrike}>{PRICE.yearlyRegular}</Text>
                  <Text style={styles.price}>{PRICE.yearly}</Text>
                  <Text style={styles.pricePer}>{t("paywall.perYear" as any)}</Text>
                </View>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>{t("paywall.saveBadge" as any, { pct: YEARLY_SAVE_PCT })}</Text>
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.earlyBirdNote}>
            {t("paywall.earlyBirdNote" as any, { monthly: PRICE.monthlyRegular, yearly: PRICE.yearlyRegular })}
          </Text>
          </>
          ) : null}

          {/* Error message */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Promo code (IG follow 7-day trial) */}
          {promoState !== "done" ? (
            <View style={styles.promoBox}>
              <View style={styles.promoRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder={t("paywall.promoPlaceholder" as any)}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  editable={promoState !== "redeeming"}
                />
                <TouchableOpacity
                  style={[styles.promoBtn, promoState === "redeeming" && styles.promoBtnDisabled]}
                  onPress={handleRedeem}
                  disabled={promoState === "redeeming" || !promoCode.trim()}
                >
                  {promoState === "redeeming" ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.promoBtnText}>{t("paywall.redeem" as any)}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {promoMsg ? <Text style={styles.promoError}>{promoMsg}</Text> : null}
            </View>
          ) : (
            promoMsg ? <Text style={styles.promoDone}>{promoMsg}</Text> : null
          )}

          {/* Features list */}
          <View style={styles.featuresList}>
            {["f1", "f2", "f3", "f4", "f6"].map((fk) => (
              <View key={fk} style={styles.featureRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.featureText}>{t(`paywall.${fk}` as any)}</Text>
              </View>
            ))}
          </View>

          {/* CTA buttons */}
          {canPurchaseHere ? (
            <>
              <TouchableOpacity
                style={[styles.upgradeBtn, isPurchasing === 'monthly' && styles.upgradeBtnDisabled]}
                onPress={() => handlePurchase(PRODUCT_IDS.MONTHLY)}
                disabled={!!isPurchasing}
              >
                {isPurchasing === 'monthly' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.upgradeBtnText}>
                    {isStripeSupported ? t("paywall.ctaMonthlyStripe" as any, { price: PRICE.monthly }) : t("paywall.ctaMonthly" as any, { price: PRICE.monthly })}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.yearlyBtn, isPurchasing === 'yearly' && styles.upgradeBtnDisabled]}
                onPress={() => handlePurchase(PRODUCT_IDS.YEARLY)}
                disabled={!!isPurchasing}
              >
                {isPurchasing === 'yearly' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.yearlyBtnText}>{t("paywall.ctaYearly" as any, { price: PRICE.yearly })}</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.legalNote}>
                {isStripeSupported
                  ? t("paywall.legalStripe" as any)
                  : t("paywall.legalApple" as any)}
              </Text>
            </>
          ) : null}

          {/* Always show the follow-IG 7-day trial path:
              iOS → primary (no IAP yet); web/Android → secondary to subscribing. */}
          <View style={styles.igBox}>
            <Text style={styles.igTitle}>{t("paywall.igTitle" as any)}</Text>
            <Text style={styles.igDesc}>{t("paywall.igDesc" as any)}</Text>
            {INSTAGRAM_URL ? (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => { Linking.openURL(INSTAGRAM_URL).catch(() => {}); }}
              >
                <Text style={styles.upgradeBtnText}>{t("paywall.igCta" as any)}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>
              {trialDaysLeft && trialDaysLeft > 0
                ? t("paywall.continueTrial", { n: trialDaysLeft })
                : t("paywall.later")}
            </Text>
          </TouchableOpacity>

          {canPurchaseHere ? (
            <TouchableOpacity style={styles.restoreBtn} onPress={handleManageSubscription}>
              <Text style={styles.restoreBtnText}>{t("paywall.manage" as any)}</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  pricingBox: {
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  pricingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#013E77",
  },
  priceStrike: {
    fontSize: 13,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    marginRight: 6,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  pricePer: {
    fontSize: 13,
    color: "#6B7280",
  },
  earlyBirdNote: {
    fontSize: 12,
    color: "#B45309",
    textAlign: "center",
    marginTop: -6,
    marginBottom: 14,
    lineHeight: 17,
  },
  pricingLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mostPopularBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mostPopularText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  saveBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  saveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  featuresList: {
    width: "100%",
    marginBottom: 20,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkmark: {
    fontSize: 14,
    color: "#013E77",
    fontWeight: "800",
    width: 20,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
  },
  upgradeBtn: {
    backgroundColor: "#013E77",
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  upgradeBtnDisabled: {
    backgroundColor: "#6B7280",
  },
  yearlyBtn: {
    backgroundColor: "#013E77",
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  yearlyBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  restoreBtn: {
    paddingVertical: 10,
    marginTop: 5,
  },
  restoreBtnText: {
    color: "#013E77",
    fontSize: 14,
    fontWeight: "600",
  },
  legalNote: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 17,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  promoBox: {
    width: "100%",
    marginBottom: 16,
  },
  promoRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  promoBtn: {
    backgroundColor: "#013E77",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  promoBtnDisabled: {
    backgroundColor: "#6B7280",
  },
  promoBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  promoError: {
    color: "#DC2626",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  promoDone: {
    color: "#16A34A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  igBox: {
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  igTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  igDesc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 19,
  },
});
