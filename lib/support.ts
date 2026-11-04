import { Linking } from "react-native";
import * as Sentry from "@sentry/react-native";
import { Events, track } from "./analytics";

/**
 * Everything the user can do when something feels wrong.
 *
 * Two separate jobs:
 *  1. a human door (support page) they can open themselves;
 *  2. a traceable signal for us when AI Chef fails to deliver (0 cards, error,
 *     truncated answer) so one report can be followed from PostHog to Sentry.
 *
 * Sentry is throttled per failure kind: a broken library + 50 requests must not
 * become 50 issues.
 */

export const SUPPORT_URL =
  process.env.EXPO_PUBLIC_SUPPORT_URL ?? "https://kindcipe.com/support/";

/** Open the support page and record that the user reached for help. */
export function openSupport(from: string, detail?: Record<string, unknown>): void {
  try {
    track(Events.SupportContactOpened, { from, ...(detail ?? {}) });
  } catch {
    /* analytics must never break the tap */
  }
  void Linking.openURL(SUPPORT_URL).catch(() => {
    /* no browser / bad URL — nothing to do */
  });
}

export type AiChefFailureKind = "zero_cards" | "error" | "truncated";

const THROTTLE_MS = 5 * 60 * 1000;
const lastSentAt = new Map<AiChefFailureKind, number>();

/**
 * Record an AI Chef "experience failure" — the cases where nothing crashed but
 * the user did not get what they asked for.
 */
export function reportAiChefFailure(
  kind: AiChefFailureKind,
  context: Record<string, unknown> = {},
): void {
  try {
    track(Events.AiChefFailure, { kind, ...context });
  } catch {
    /* swallow */
  }

  const now = Date.now();
  if (now - (lastSentAt.get(kind) ?? 0) < THROTTLE_MS) return;
  lastSentAt.set(kind, now);

  try {
    Sentry.captureMessage(`[AI Chef] ${kind}`, {
      level: "warning",
      tags: { area: "ai_chef", failure_kind: kind },
      extra: context,
    });
  } catch {
    /* Sentry disabled in dev */
  }
}

/** Test hook: reset the throttle between cases. */
export function __resetAiChefFailureThrottle(): void {
  lastSentAt.clear();
}
