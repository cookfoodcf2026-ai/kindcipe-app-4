/**
 * AppleRelayLinkPrompt — one-time, dismissable nudge for users whose only
 * sign-in method is "Sign in with Apple + Hide My Email" (a private relay).
 *
 * Rationale: a relay address can't be matched to a real email, so if such a
 * user switches to a non-Apple device and signs in with Google/email, they can
 * land in a new empty account and think their data is lost. We softly suggest
 * adding a second sign-in method (Google / email) — non-blocking, per Apple HIG.
 */
import { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { track, Events } from "@/lib/analytics";

const SEEN_KEY = "kindcipe_apple_relay_prompt_seen";

const isRelayEmail = (e?: string | null): boolean => {
  const host = String(e || "").toLowerCase().split("@")[1] || "";
  return (
    host === "privaterelay.appleid.com" ||
    host === "private.icloud.com" ||
    host.endsWith(".private.icloud.com")
  );
};

export function AppleRelayLinkPrompt({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const identitiesQuery = trpc.auth.identities.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen === "true" || cancelled) return;
        const ids = (identitiesQuery.data as any[]) ?? [];
        if (ids.length === 0) return;
        const hasPortable = ids.some(
          (id) => id.provider === "google" || id.provider === "email" || id.provider === "otp",
        );
        const hasAppleRelay = ids.some(
          (id) => id.provider === "apple" && isRelayEmail(id.email),
        );
        if (!hasPortable && hasAppleRelay) {
          setVisible(true);
          track(Events.AccountLinkPromptShown, { reason: "apple_relay_only" });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, identitiesQuery.data]);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(SEEN_KEY, "true").catch(() => {});
  };

  const goSettings = async () => {
    track(Events.AccountLinkPromptClicked, {});
    setVisible(false);
    await AsyncStorage.setItem(SEEN_KEY, "true").catch(() => {});
    router.push("/settings");
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="shield-checkmark" size={22} color="#013E77" />
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#1A1A1A", flex: 1 }}>
              {t("settings.accountLinkTitle" as any)}
            </Text>
          </View>
          <Text style={{ fontSize: 13.5, color: "#4B5563", lineHeight: 20 }}>
            {t("settings.accountLinkBody" as any)}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: "#013E77", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 16 }}
            onPress={goSettings}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {t("settings.accountLinkCta" as any)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 10, alignItems: "center" }} onPress={dismiss}>
            <Text style={{ color: "#9CA3AF" }}>{t("settings.accountLinkLater" as any)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
