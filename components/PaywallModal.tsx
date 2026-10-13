/**
 * PaywallModal — 付費牆（響應式）
 *
 * Desktop (web ≥1024): two columns — left = hero + features + plan choice,
 * right = order summary + Instagram promo code + subscribe CTA.
 * Mobile/native: same content stacked in a full-height sheet.
 * iOS (no IAP yet): IG 7-day trial variant only (no purchase UI).
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
  ScrollView,
} from "react-native";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { track, Events } from "@/lib/analytics";
import { friendlyError } from "@/lib/errors";
import { purchaseSubscription, PRODUCT_IDS, manageSubscription, isStripeSupported, canPurchaseHere, type ProductId } from "../lib/purchase";
import { PRICE, YEARLY_SAVE_PCT } from "../lib/pricing";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { trpc } from "../lib/trpc";

const INSTAGRAM_URL =
  process.env.EXPO_PUBLIC_INSTAGRAM_URL ??
  (Constants.expoConfig?.extra as any)?.instagramUrl ??
  "";

type PaywallFeature =
  | "import_limit"
  | "recipe_limit"
  | "member_limit"
  | "screenshot"
  | "ingredient_search"
  | "multilang"
  | "generic";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: PaywallFeature;
  trialDaysLeft?: number;
  isPaid?: boolean;
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

type Plan = "monthly" | "yearly";

const fmtCents = (n: number) => `HK$${n % 100 === 0 ? n / 100 : (n / 100).toFixed(2)}`;

export default function PaywallModal({
  visible,
  onClose,
  feature = "generic",
  trialDaysLeft,
  isPaid = false,
}: PaywallModalProps) {
  const { t } = useTranslation();
  const { isDesktop } = useBreakpoint();
  const msg = FEATURE_MESSAGES[feature];
  const utils = trpc.useUtils();

  const [plan, setPlan] = useState<Plan>("yearly");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [applied, setApplied] = useState<{ valid: boolean; subtotal: number; discount: number; total: number; currency: string } | null>(null);
  const [promoState, setPromoState] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "done" | "error">("idle");
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const previewM = trpc.billing.previewPromoCode.useMutation({
    onSuccess: (res: any) => {
      if (res?.valid) {
        setApplied(res);
        setPromoState("done");
        setPromoMsg(t("paywall.codeApplied" as any));
      } else {
        setApplied(null);
        setPromoState("error");
        setPromoMsg(t("paywall.codeInvalid" as any));
      }
    },
    onError: (e: any) => { setPromoState("error"); setPromoMsg(friendlyError(e)); },
  });

  const redeemM = trpc.subscription.redeemTrialCode.useMutation({
    onSuccess: async (res: any) => {
      setRedeemState("done");
      setRedeemMsg(res?.expiresAt ? t("paywall.promoDone", { date: new Date(res.expiresAt).toLocaleDateString() }) : t("paywall.promoDoneShort"));
      await utils.invalidate();
      track(Events.PromoRedeemed, {});
    },
    onError: (e: any) => { setRedeemState("error"); setRedeemMsg(friendlyError(e)); },
  });

  useEffect(() => {
    if (visible) track(Events.PaywallViewed, { feature });
  }, [visible, feature]);

  // Re-preview the applied code when the plan changes.
  useEffect(() => {
    if (applied && promoCode.trim()) previewM.mutate({ plan, code: promoCode.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const regularTotal = plan === "yearly" ? Math.round(Number(PRICE.yearly.replace(/[^0-9]/g, "")) * 100) : Math.round(Number(PRICE.monthly.replace(/[^0-9]/g, "")) * 100);
  const subtotal = applied?.subtotal ?? regularTotal;
  const discount = applied?.discount ?? 0;
  const total = applied?.total ?? regularTotal;

  const handleApply = () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoState("checking");
    setPromoMsg(null);
    setApplied(null);
    previewM.mutate({ plan, code });
  };

  const handlePurchase = async () => {
    const productId: ProductId = plan === "yearly" ? PRODUCT_IDS.YEARLY : PRODUCT_IDS.MONTHLY;
    setIsPurchasing(true);
    setError(null);
    try {
      const result = await purchaseSubscription(productId, { promoCode: promoCode.trim() || undefined });
      if (result.success) onClose();
      else if (result.error === "cancelled") { /* noop */ }
      else setError(result.error || friendlyError({ message: "" }, "error.purchaseFailed"));
    } catch (err: any) {
      setError(friendlyError(err, "error.purchaseFailed"));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleManageSubscription = async () => {
    try { await manageSubscription(); } catch (err) { console.error('[Paywall] manageSubscription failed:', err); }
  };

  const FeatureRow = ({ fk }: { fk: string }) => (
    <View style={styles.featureRow}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.featureText}>{t(`paywall.${fk}` as any)}</Text>
    </View>
  );

  const PlanCard = ({ value, price, per, label }: { value: Plan; price: string; per: string; label: string }) => {
    const selected = plan === value;
    return (
      <TouchableOpacity style={[styles.planCard, selected && styles.planCardActive]} onPress={() => setPlan(value)} activeOpacity={0.85}>
        <View style={styles.planRadioRow}>
          <View style={[styles.radio, selected && styles.radioActive]}>{selected ? <View style={styles.radioDot} /> : null}</View>
          <Text style={styles.planName}>{label}</Text>
          {value === "yearly" ? (
            <View style={styles.mostPopularBadge}><Text style={styles.mostPopularText}>{t("paywall.recommended" as any)}</Text></View>
          ) : null}
        </View>
        <View style={styles.planPriceRow}>
          <Text style={styles.planPrice}>{price}</Text>
          <Text style={styles.planPer}>{per}</Text>
        </View>
        {value === "yearly" ? (
          <View style={styles.saveBadge}><Text style={styles.saveText}>{t("paywall.saveBadge" as any, { pct: YEARLY_SAVE_PCT })}</Text></View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const priceCard = (
    <View style={styles.priceCard}>
      <Text style={styles.priceStrike}>{plan === "yearly" ? `HK$${38 * 12}` : PRICE.monthly}</Text>
      <Text style={styles.priceBig}>{plan === "yearly" ? PRICE.yearly : PRICE.monthly}</Text>
      <Text style={styles.pricePer}>{plan === "yearly" ? t("paywall.perYear" as any) : t("paywall.perMonth" as any)}</Text>
    </View>
  );

  const orderSummary = (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryTitle}>{t("paywall.summaryTitle" as any)}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{plan === "yearly" ? t("paywall.yearlyLabel" as any) : t("paywall.monthlyLabel" as any)}</Text>
        <Text style={styles.summaryValue}>{fmtCents(subtotal)}</Text>
      </View>
      {discount > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: "#16A34A" }]}>{t("paywall.promoDiscount" as any)}</Text>
          <Text style={[styles.summaryValue, { color: "#16A34A" }]}>-{fmtCents(discount)}</Text>
        </View>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <Text style={styles.totalLabel}>{t("paywall.total" as any)}</Text>
        <Text style={styles.totalValue}>{fmtCents(total)}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[styles.sheet, isDesktop && styles.sheetDesktop]}
          activeOpacity={1}
          onPress={() => {}}
        >
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />

            {/* Hero */}
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <View style={styles.offerBadge}><Text style={styles.offerBadgeTxt}>{t("paywall.offerBadge" as any)}</Text></View>
                  <Text style={styles.offerNote}>{t("paywall.promoNote" as any, { promo: PRICE.promoMonthly })}</Text>
                </View>
                <Text style={styles.title}>{t(`paywall.feature.${msg.key}.title` as any)}</Text>
                <Text style={styles.desc}>{t(`paywall.feature.${msg.key}.desc` as any)}</Text>
              </View>
              {canPurchaseHere ? priceCard : null}
            </View>

            {/* Features */}
            <View style={styles.featuresWrap}>
              {["f1", "f2", "f3", "f4", "f6"].map((fk) => <FeatureRow key={fk} fk={fk} />)}
            </View>

            {canPurchaseHere ? (
              <View style={[isDesktop && styles.twoCol]}>
                {/* Left: plans */}
                <View style={isDesktop ? styles.colLeft : undefined}>
                  <Text style={styles.sectionTitle}>{t("paywall.choosePlan" as any)}</Text>
                  <View style={styles.planRow}>
                    <PlanCard value="monthly" price={PRICE.monthly} per={t("paywall.perMonth" as any)} label={t("paywall.planMonthly" as any)} />
                    <PlanCard value="yearly" price={PRICE.yearly} per={t("paywall.perYear" as any)} label={t("paywall.planYearly" as any)} />
                  </View>
                </View>

                {/* Right: order summary + code + CTA */}
                <View style={isDesktop ? styles.colRight : undefined}>
                  {orderSummary}

                  <View style={styles.promoBox}>
                    <Text style={styles.promoTitle}>{t("paywall.promoTitle" as any)}</Text>
                    <View style={styles.promoRow}>
                      <TextInput
                        style={styles.promoInput}
                        placeholder={t("paywall.promoPlaceholder" as any)}
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="characters"
                        value={promoCode}
                        onChangeText={setPromoCode}
                        editable={promoState !== "checking"}
                      />
                      <TouchableOpacity
                        style={[styles.promoBtn, (promoState === "checking" || !promoCode.trim()) && styles.promoBtnDisabled]}
                        onPress={handleApply}
                        disabled={promoState === "checking" || !promoCode.trim()}
                      >
                        {promoState === "checking" ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.promoBtnText}>{t("paywall.apply" as any)}</Text>}
                      </TouchableOpacity>
                    </View>
                    {promoMsg ? <Text style={[styles.promoMsg, promoState === "error" && { color: "#DC2626" }]}>{promoMsg}</Text> : null}
                    {INSTAGRAM_URL ? (
                      <TouchableOpacity onPress={() => Linking.openURL(INSTAGRAM_URL).catch(() => {})} activeOpacity={0.8}>
                        <Text style={styles.igHint}>{t("paywall.followIgHint" as any, { promo: PRICE.promoMonthly })}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={[styles.upgradeBtn, isPurchasing && styles.upgradeBtnDisabled]} onPress={handlePurchase} disabled={isPurchasing}>
                    {isPurchasing ? <ActivityIndicator color="#FFFFFF" /> : (
                      <Text style={styles.upgradeBtnText}>{t("paywall.subscribeWithPrice" as any, { price: fmtCents(total) })}</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.legalNote}>
                    {isStripeSupported ? t("paywall.secureStripe" as any) : t("paywall.legalApple" as any)}
                  </Text>
                  {isPaid ? (
                    <TouchableOpacity style={styles.restoreBtn} onPress={handleManageSubscription}>
                      <Text style={styles.restoreBtnText}>{t("paywall.manage" as any)}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : (
              /* iOS (no IAP yet): free 7-day trial via Instagram code */
              <View style={styles.igBox}>
                <Text style={styles.igTitle}>{t("paywall.igTitle" as any)}</Text>
                <Text style={styles.igDesc}>{t("paywall.igDesc" as any)}</Text>
                <View style={styles.promoRow}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder={t("paywall.promoPlaceholder" as any)}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    value={redeemCode}
                    onChangeText={setRedeemCode}
                    editable={redeemState !== "redeeming"}
                  />
                  <TouchableOpacity
                    style={[styles.promoBtn, (redeemState === "redeeming" || !redeemCode.trim()) && styles.promoBtnDisabled]}
                    onPress={() => { setRedeemState("redeeming"); redeemM.mutate({ code: redeemCode.trim() }); }}
                    disabled={redeemState === "redeeming" || !redeemCode.trim()}
                  >
                    {redeemState === "redeeming" ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.promoBtnText}>{t("paywall.redeem" as any)}</Text>}
                  </TouchableOpacity>
                </View>
                {redeemMsg ? <Text style={[styles.promoMsg, redeemState === "error" && { color: "#DC2626" }]}>{redeemMsg}</Text> : null}
                {INSTAGRAM_URL ? (
                  <TouchableOpacity style={styles.upgradeBtn} onPress={() => Linking.openURL(INSTAGRAM_URL).catch(() => {})}>
                    <Text style={styles.upgradeBtnText}>{t("paywall.igCta" as any)}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* FAQ */}
            <View style={styles.faqBox}>
              <Text style={styles.sectionTitle}>{t("paywall.faqTitle" as any)}</Text>
              {[["faq1q", "faq1a"], ["faq2q", "faq2a"], ["faq3q", "faq3a"]].map(([q, a], i) => (
                <View key={q} style={styles.faqItem}>
                  <TouchableOpacity onPress={() => setFaqOpen(faqOpen === i ? null : i)} style={styles.faqQ} activeOpacity={0.7}>
                    <Text style={styles.faqQTxt}>{t(`paywall.${q}` as any)}</Text>
                    <Text style={styles.faqChevron}>{faqOpen === i ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {faqOpen === i ? <Text style={styles.faqATxt}>{t(`paywall.${a}` as any)}</Text> : null}
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>
                {trialDaysLeft && trialDaysLeft > 0 ? t("paywall.continueTrial", { n: trialDaysLeft }) : t("paywall.later")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const BRAND = "#013E77";
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", maxHeight: "94%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetDesktop: { maxWidth: 960, borderRadius: 24, marginBottom: 40, maxHeight: "90%" },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  heroRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  offerBadge: { backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  offerBadgeTxt: { color: "#DC2626", fontSize: 12, fontWeight: "800" },
  offerNote: { color: "#6B7280", fontSize: 12, flexShrink: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 6 },
  desc: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
  priceCard: { backgroundColor: "#F3F4F6", borderRadius: 12, padding: 12, alignItems: "center", minWidth: 120 },
  priceStrike: { fontSize: 13, color: "#9CA3AF", textDecorationLine: "line-through" },
  priceBig: { fontSize: 24, fontWeight: "900", color: BRAND },
  pricePer: { fontSize: 12, color: "#6B7280" },
  featuresWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, marginBottom: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 150, flexGrow: 1 },
  checkmark: { fontSize: 14, color: BRAND, fontWeight: "800" },
  featureText: { fontSize: 13, color: "#374151" },
  twoCol: { flexDirection: "row", gap: 24, marginTop: 12 },
  colLeft: { flex: 1 },
  colRight: { width: 380 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 16, marginBottom: 10 },
  planRow: { flexDirection: "row", gap: 12 },
  planCard: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, padding: 14 },
  planCardActive: { borderColor: BRAND, backgroundColor: "#F8FAFF" },
  planRadioRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9CA3AF", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: BRAND },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: BRAND },
  planName: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  mostPopularBadge: { backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mostPopularText: { fontSize: 10, fontWeight: "800", color: "#B45309" },
  planPriceRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  planPrice: { fontSize: 22, fontWeight: "900", color: "#111827" },
  planPer: { fontSize: 13, color: "#6B7280" },
  saveBadge: { backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginTop: 8 },
  saveText: { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  summaryBox: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginTop: 16 },
  summaryTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 14, color: "#6B7280" },
  summaryValue: { fontSize: 14, color: "#111827", fontWeight: "600" },
  totalLabel: { fontSize: 15, fontWeight: "800", color: "#111827" },
  totalValue: { fontSize: 18, fontWeight: "900", color: BRAND },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  promoBox: { marginTop: 14 },
  promoTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827" },
  promoBtn: { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  promoBtnDisabled: { backgroundColor: "#6B7280" },
  promoBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  promoMsg: { color: "#16A34A", fontSize: 13, marginTop: 6 },
  igHint: { color: BRAND, fontSize: 12, marginTop: 8, textDecorationLine: "underline" },
  upgradeBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, width: "100%", alignItems: "center", marginTop: 16 },
  upgradeBtnDisabled: { backgroundColor: "#6B7280" },
  upgradeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  legalNote: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 17 },
  restoreBtn: { paddingVertical: 10, alignItems: "center" },
  restoreBtnText: { color: BRAND, fontSize: 14, fontWeight: "600" },
  igBox: { alignItems: "center", marginTop: 20 },
  igTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4 },
  igDesc: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 14, lineHeight: 19, paddingHorizontal: 8 },
  faqBox: { marginTop: 8 },
  faqItem: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  faqQ: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  faqQTxt: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1, paddingRight: 8 },
  faqChevron: { fontSize: 10, color: "#9CA3AF" },
  faqATxt: { fontSize: 13, color: "#6B7280", lineHeight: 19, paddingBottom: 12 },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center", marginTop: 12 },
  cancelBtn: { paddingVertical: 16, alignItems: "center" },
  cancelBtnText: { color: "#9CA3AF", fontSize: 14 },
});
