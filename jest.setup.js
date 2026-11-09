// IAP is dark in production until App Store Connect has products. Tests opt in
// so the paywall CTA gating can be exercised.
process.env.EXPO_PUBLIC_IAP_ENABLED = "1";
