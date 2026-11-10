/**
 * PaywallModal — responsive paywall.
 *
 * Web: server-authoritative Stripe quote (regular or founding), C9T trial code,
 * and trial → founding conversion. Native: no purchase CTA until IAP/Play
 * Billing ships; trial redemption stays available.
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
import {
  purchaseSubscription,
  restorePurchases,
  getProducts,
  PRODUCT_IDS,
  manageSubscription,
  isStripeSupported,
  canPurchaseHere,
  type ProductId,
} from "../lib/purchase";
import { PRICING, YEARLY_SAVE_PCT } from "../lib/pricing";
import { perMonthFromYearly, yearlySavePct } from "../lib/pluralPrice";
import { PRIVACY_URL, TERMS_URL, openLegalPage } from "../lib/legal";
import { getWebappUrl, isIOS, isWeb } from "../lib/platform";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";

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
  | "kol_plan"
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
  kol_plan: { emoji: "⭐", key: "kol_plan" },
  generic: { emoji: "⭐", key: "generic" },
};

type Plan = "monthly" | "yearly";

const fmtCents = (n: number) =>
  `HK$${n % 100 === 0 ? n / 100 : (n / 100).toFixed(2)}`;
const fmtDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "";

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
  const { familyRole, switchFamily } = useAuth();
  const canManageBilling = familyRole === "owner" || familyRole === "admin";

  const [plan, setPlan] = useState<Plan>("yearly");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "done" | "error">("idle");
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [storePrices, setStorePrices] = useState<Partial<Record<ProductId, string>>>({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const subQuery = trpc.family.subscription.useQuery(undefined, {
    enabled: visible,
    retry: false,
    staleTime: 1000 * 30,
  });
  const quoteQuery = trpc.billing.previewCheckout.useQuery(
    { plan },
    { enabled: visible && isStripeSupported, retry: false, staleTime: 1000 * 30 }
  );

  const sub = subQuery.data;
  const promo = sub?.promo;
  const quote = quoteQuery.data;
  const active = sub ? sub.status === "active" : isPaid;
  const trial = sub?.status === "trial";
  const billingProvider = promo?.billingProvider ?? null;
  const managed = active || (trial && billingProvider === "stripe");
  const trialEligible = promo?.trialEligible === true && !promo?.foundingMember;
  const foundingMember = promo?.foundingMember === true;
  const founding = quote ? quote.tier === "founding" : foundingMember && active;
  const trialEnd = quote?.trialEnd ?? null;
  const trialDays =
    quote?.trialDays ??
    trialDaysLeft ??
    (sub?.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0);
  const fallbackAmount =
    plan === "yearly"
      ? Math.round((founding ? PRICING.promoYearly : PRICING.yearly) * 100)
      : Math.round((founding ? PRICING.promoMonthly : PRICING.monthly) * 100);
  const amount = quote?.amount ?? fallbackAmount;
  const chargeToday = quote?.chargeToday ?? amount;
  const claimEnd = founding ? quote?.discountExpiresAt ?? promo?.discountExpiresAt ?? null : null;
  const slotsRemaining = promo?.earlybirdSlotsRemaining ?? quote?.slotsRemaining;
  const selectedProductId = plan === "yearly" ? PRODUCT_IDS.YEARLY : PRODUCT_IDS.MONTHLY;
  // App Store 3.1.2: use the StoreKit price when IAP is live, otherwise the
  // single-source-of-truth price text from lib/pricing.ts.
  const periodPrice = storePrices[selectedProductId] ?? fmtCents(amount);
  const monthlyPrice =
    storePrices[PRODUCT_IDS.MONTHLY] ??
    fmtCents(founding ? PRICING.promoMonthly * 100 : PRICING.monthly * 100);
  const yearlyPrice =
    storePrices[PRODUCT_IDS.YEARLY] ??
    fmtCents(founding ? PRICING.promoYearly * 100 : PRICING.yearly * 100);
  // Locale-safe badge figures: derive both from the prices actually shown, so
  // a non-HK storefront never displays a hardcoded HK$ estimate.
  const savePerMonth = perMonthFromYearly(yearlyPrice);
  const savePct = yearlySavePct(monthlyPrice, yearlyPrice) ?? YEARLY_SAVE_PCT;
  // App Store 3.1.2: the StoreKit display price is the real charge; the
  // lib/pricing.ts figures are only a web fallback when IAP is not live.
  const displayAmount = storePrices[selectedProductId] ?? fmtCents(amount);
  const displayChargeToday = quote ? fmtCents(chargeToday) : displayAmount;
  // Never show a buy CTA unless the store actually returned the selected
  // product (web keeps using the Stripe quote).
  const hasStoreProduct = isStripeSupported || storePrices[selectedProductId] != null;
  const purchaseCtaAvailable = canPurchaseHere && hasStoreProduct;
  // Native must never offer a web purchase path (App Store 3.1.1 / Play policy).
  const nativeStoreUnavailable = !isWeb && !purchaseCtaAvailable;
  const periodLabel =
    plan === "yearly" ? t("paywall.periodYearly" as any) : t("paywall.periodMonthly" as any);
  // 已享有 Pro：用戶所屬另一個廚房已 active → 唔應該再賣
  const coveredBy = (sub as any)?.coveredBy as { familyId: number; name: string } | null | undefined;

  const redeemM = trpc.subscription.redeemTrialCode.useMutation({
    onSuccess: async (res: any) => {
      setRedeemState("done");
      setRedeemMsg(
        res?.status === "founding"
          ? t("paywall.foundingCodeDone" as any)
          : res?.expiresAt
            ? t("paywall.promoDone", { date: fmtDate(res.expiresAt) })
            : t("paywall.promoDoneShort")
      );
      await Promise.all([
        utils.family.subscription.invalidate(),
        utils.billing.previewCheckout.invalidate(),
        utils.family.usage.invalidate(),
        utils.auth.me.invalidate(),
      ]);
      track(Events.PromoRedeemed, {});
    },
    onError: (e: any) => {
      setRedeemState("error");
      setRedeemMsg(friendlyError(e));
    },
  });

  useEffect(() => {
    if (visible) track(Events.PaywallViewed, { feature });
  }, [visible, feature]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void getProducts()
      .then((products) => {
        if (!alive) return;
        const next: Partial<Record<ProductId, string>> = {};
        for (const product of products) next[product.productId] = product.price;
        setStorePrices(next);
      })
      .catch(() => {
        /* StoreKit unavailable — keep the lib/pricing.ts fallback */
      });
    return () => {
      alive = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setError(null);
      setRedeemState("idle");
      setRedeemMsg(null);
      setRedeemCode("");
      setRestoreMsg(null);
      setIsRestoring(false);
    }
  }, [visible]);

  const handleRedeem = () => {
    const code = redeemCode.trim();
    if (!code) return;
    setRedeemState("redeeming");
    setRedeemMsg(null);
    redeemM.mutate({ code });
  };

  const handlePurchase = async () => {
    const productId: ProductId = plan === "yearly" ? PRODUCT_IDS.YEARLY : PRODUCT_IDS.MONTHLY;
    setIsPurchasing(true);
    setError(null);
    try {
      const result = await purchaseSubscription(productId);
      if (result.success) onClose();
      else if (result.error !== "cancelled") {
        setError(result.error || friendlyError({ message: "" }, "error.purchaseFailed"));
      }
    } catch (err: any) {
      setError(friendlyError(err, "error.purchaseFailed"));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await manageSubscription(billingProvider as any);
    } catch (err) {
      console.error("[Paywall] manageSubscription failed:", err);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreMsg(null);
    try {
      const result = await restorePurchases();
      if (result.success) {
        setRestoreMsg(t("paywall.restoreSuccess" as any));
        await Promise.all([
          utils.family.subscription.invalidate(),
          utils.auth.me.invalidate(),
        ]);
      } else {
        setRestoreMsg(result.error || friendlyError({ message: "" }, "error.purchaseFailed"));
      }
    } catch (err: any) {
      setRestoreMsg(friendlyError(err, "error.purchaseFailed"));
    } finally {
      setIsRestoring(false);
    }
  };

  const openWeb = () => {
    Linking.openURL(`${getWebappUrl()}/settings?paywall=1`).catch(() => {});
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
          <View style={styles.saveBadge}>
            <Text style={styles.saveText}>
              {savePerMonth
                ? t("paywall.saveBadge" as any, { pct: savePct, price: savePerMonth })
                : t("paywall.saveBadgePct" as any, { pct: savePct })}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const trialCodeBox = (trialEligible || (promo?.promoEnabled && !active)) || redeemState === "done" ? (
    <View style={styles.promoBox}>
      <Text style={styles.promoTitle}>{t("paywall.trialCodeTitle" as any)}</Text>
      <Text style={styles.igDesc}>{t("paywall.trialCodeDesc" as any)}</Text>
      {redeemState === "done" ? (
        <Text style={styles.promoMsg}>{redeemMsg}</Text>
      ) : (
        <>
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
              onPress={handleRedeem}
              disabled={redeemState === "redeeming" || !redeemCode.trim()}
            >
              {redeemState === "redeeming"
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.promoBtnText}>{t("paywall.redeem" as any)}</Text>}
            </TouchableOpacity>
          </View>
          {redeemMsg ? <Text style={[styles.promoMsg, redeemState === "error" && { color: "#DC2626" }]}>{redeemMsg}</Text> : null}
          {INSTAGRAM_URL ? (
            <TouchableOpacity onPress={() => Linking.openURL(INSTAGRAM_URL).catch(() => {})} activeOpacity={0.8}>
              <Text style={styles.igHint}>{t("paywall.trialCodeHint" as any)}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  ) : null;

  const orderSummary = (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryTitle}>{t("paywall.summaryTitle" as any)}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{founding ? t("paywall.foundingLabel" as any) : plan === "yearly" ? t("paywall.yearlyLabel" as any) : t("paywall.monthlyLabel" as any)}</Text>
        <Text style={styles.summaryValue}>{displayAmount}</Text>
      </View>
      {trialEnd ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: "#16A34A" }]}>{t("paywall.freeToday" as any)}</Text>
          <Text style={[styles.summaryValue, { color: "#16A34A" }]}>HK$0</Text>
        </View>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <Text style={styles.totalLabel}>{t("paywall.total" as any)}</Text>
        <Text style={styles.totalValue}>{displayChargeToday}</Text>
      </View>
      {trialEnd ? <Text style={styles.infoText}>{t("paywall.afterTrial", { price: displayAmount })}</Text> : null}
      {founding && slotsRemaining != null ? <Text style={styles.infoText}>{t("paywall.slotsLeft", { n: slotsRemaining })}</Text> : null}
      {claimEnd ? <Text style={styles.infoText}>{t("paywall.claimBy", { date: fmtDate(claimEnd) })}</Text> : null}
    </View>
  );

  const legalBlock = (
    <View style={styles.legalBlock}>
      <Text style={styles.legalBlockLine}>
        {t("paywall.legalBlockLine" as any, {
          name: t("paywall.legalBlockName" as any),
          period: periodLabel,
          price: periodPrice,
        })}
      </Text>
      <Text style={styles.legalBlockNote}>
        {isStripeSupported
          ? t("paywall.autoRenewStripe" as any)
          : t("paywall.autoRenew" as any)}
      </Text>
      {isIOS ? (
        <Text style={styles.legalBlockNote}>{t("paywall.appleChargeNote" as any)}</Text>
      ) : null}
      <View style={styles.legalLinksRow}>
        <TouchableOpacity onPress={() => openLegalPage(TERMS_URL)} accessibilityRole="link">
          <Text style={styles.legalLink}>{t("paywall.termsLink" as any)}</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity onPress={() => openLegalPage(PRIVACY_URL)} accessibilityRole="link">
          <Text style={styles.legalLink}>{t("paywall.privacyLink" as any)}</Text>
        </TouchableOpacity>
      </View>
      {isIOS ? (
        <>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={isRestoring}
            accessibilityRole="button"
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={BRAND} />
            ) : (
              <Text style={styles.restoreBtnText}>{t("paywall.restore" as any)}</Text>
            )}
          </TouchableOpacity>
          {restoreMsg ? <Text style={styles.restoreMsg}>{restoreMsg}</Text> : null}
        </>
      ) : null}
    </View>
  );

  const cta = coveredBy ? (
    <View style={{ backgroundColor: "#ECFDF5", borderRadius: 12, padding: 14, marginTop: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: "800", color: "#065F46", marginBottom: 4 }}>
        {t("paywall.coveredTitle" as any)}
      </Text>
      <Text style={{ fontSize: 13, color: "#047857", lineHeight: 19 }}>
        {t("paywall.coveredBody" as any, { name: coveredBy.name })}
      </Text>
      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: "#047857", marginTop: 12 }]}
        onPress={async () => {
          try {
            await switchFamily(String(coveredBy.familyId));
            onClose();
          } catch (e) {
            console.error("[Paywall] switchFamily failed:", e);
          }
        }}
      >
        <Text style={styles.upgradeBtnText}>{t("paywall.coveredSwitch" as any, { name: coveredBy.name })}</Text>
      </TouchableOpacity>
    </View>
  ) : managed ? (
    canManageBilling ? (
      <TouchableOpacity style={styles.upgradeBtn} onPress={handleManageSubscription}>
        <Text style={styles.upgradeBtnText}>{t("paywall.manage" as any)}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={styles.infoText}>{t("settings.managedByOwner" as any)}</Text>
    )
  ) : purchaseCtaAvailable ? (
    <TouchableOpacity style={[styles.upgradeBtn, isPurchasing && styles.upgradeBtnDisabled]} onPress={handlePurchase} disabled={isPurchasing}>
      {isPurchasing ? <ActivityIndicator color="#FFFFFF" /> : (
        <Text style={styles.upgradeBtnText}>
          {trialEnd
            ? t("paywall.startTrialCta" as any, { date: fmtDate(trialEnd), price: displayAmount })
            : t("paywall.subscribeWithPrice" as any, { price: displayChargeToday })}
        </Text>
      )}
    </TouchableOpacity>
  ) : isWeb ? (
    <TouchableOpacity style={styles.upgradeBtn} onPress={openWeb}>
      <Text style={styles.upgradeBtnText}>{t("paywall.webOnlyCta" as any)}</Text>
    </TouchableOpacity>
  ) : (
    <Text style={styles.infoText}>{t("paywall.unavailableNative" as any)}</Text>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, isDesktop && styles.sheetDesktop]} activeOpacity={1} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />

            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  {founding ? (
                    <View style={styles.offerBadge}><Text style={styles.offerBadgeTxt}>{t("paywall.foundingBadge" as any)}</Text></View>
                  ) : null}
                  {trial ? (
                    <Text style={styles.offerNote}>{t("paywall.trialActiveNote", { n: Math.max(0, trialDays) })}</Text>
                  ) : null}
                </View>
                <Text style={styles.title}>{t(`paywall.feature.${msg.key}.title` as any)}</Text>
                <Text style={styles.desc}>{t(`paywall.feature.${msg.key}.desc` as any)}</Text>
              </View>
            </View>

            <View style={styles.featuresWrap}>
              {["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"].map((fk) => <FeatureRow key={fk} fk={fk} />)}
            </View>

            {!managed && !coveredBy ? (
              nativeStoreUnavailable ? (
                <View style={styles.promoBox}>
                  {trialCodeBox}
                  <Text style={styles.infoText}>{t("paywall.unavailableNative" as any)}</Text>
                </View>
              ) : (
              <View style={[isDesktop && styles.twoCol]}>
                <View style={isDesktop ? styles.colLeft : undefined}>
                  <Text style={styles.sectionTitle}>{t("paywall.choosePlan" as any)}</Text>
                  <View style={styles.planRow}>
                    <PlanCard
                      value="monthly"
                      price={monthlyPrice}
                      per={t("paywall.perMonth" as any)}
                      label={t("paywall.planMonthly" as any)}
                    />
                    <PlanCard
                      value="yearly"
                      price={yearlyPrice}
                      per={t("paywall.perYear" as any)}
                      label={t("paywall.planYearly" as any)}
                    />
                  </View>
                  {founding ? (
                    <Text style={[styles.infoText, { marginTop: 8 }]}>
                      {t("paywall.earlyBirdNote" as any, {
                        monthly: fmtCents(PRICING.monthly * 100),
                        yearly: fmtCents(PRICING.yearly * 100),
                      })}
                    </Text>
                  ) : null}
                  {trialCodeBox}
                </View>

                <View style={isDesktop ? styles.colRight : undefined}>
                  {purchaseCtaAvailable ? orderSummary : null}
                  {quoteQuery.isError ? <Text style={styles.errorText}>{friendlyError(quoteQuery.error, "error.purchaseFailed")}</Text> : null}
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  {legalBlock}
                  {cta}
                  {purchaseCtaAvailable ? (
                    <Text style={styles.legalNote}>
                      {isStripeSupported ? t("paywall.secureStripe" as any) : t("paywall.legalApple" as any)}
                    </Text>
                  ) : null}
                </View>
              </View>
              )
            ) : (
              <View style={styles.promoBox}>
                <Text style={styles.promoTitle}>{t("paywall.manage" as any)}</Text>
                {trialCodeBox}
                {cta}
              </View>
            )}

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

const BRAND = "#183B56";
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
  offerNote: { color: "#B45309", fontSize: 12, flexShrink: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 6 },
  desc: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
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
  summaryLabel: { fontSize: 14, color: "#6B7280", flex: 1, paddingRight: 8 },
  summaryValue: { fontSize: 14, color: "#111827", fontWeight: "600" },
  totalLabel: { fontSize: 15, fontWeight: "800", color: "#111827" },
  totalValue: { fontSize: 18, fontWeight: "900", color: BRAND },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  infoText: { fontSize: 12, color: "#6B7280", lineHeight: 17, marginTop: 4 },
  promoBox: { marginTop: 14 },
  promoTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827" },
  promoBtn: { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  promoBtnDisabled: { backgroundColor: "#6B7280" },
  promoBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  promoMsg: { color: "#16A34A", fontSize: 13, marginTop: 6 },
  igDesc: { fontSize: 13, color: "#6B7280", lineHeight: 19, marginBottom: 8 },
  igHint: { color: BRAND, fontSize: 12, marginTop: 8, textDecorationLine: "underline" },
  upgradeBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, width: "100%", alignItems: "center", marginTop: 16 },
  upgradeBtnDisabled: { backgroundColor: "#6B7280" },
  upgradeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", textAlign: "center" },
  legalNote: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 17 },
  legalBlock: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginTop: 14 },
  legalBlockLine: { fontSize: 13, fontWeight: "700", color: "#111827" },
  legalBlockNote: { fontSize: 11.5, color: "#6B7280", lineHeight: 17, marginTop: 6 },
  legalLinksRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  legalLink: { fontSize: 12, color: BRAND, fontWeight: "700", textDecorationLine: "underline" },
  legalDot: { fontSize: 12, color: "#9CA3AF" },
  restoreBtn: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 4 },
  restoreBtnText: { fontSize: 12, color: BRAND, fontWeight: "700", textDecorationLine: "underline" },
  restoreMsg: { fontSize: 11.5, color: "#6B7280", lineHeight: 16, marginTop: 4 },
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
