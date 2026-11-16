export const aiPlanEnabled = process.env.EXPO_PUBLIC_AI_PLAN_ENABLED === "1";

export const aiChefQuickPlanEnabled = process.env.EXPO_PUBLIC_AI_CHEF_QUICK_PLAN !== "0";

export const approvalUiEnabled = false;

export const aiChefNoodleRoleEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_NOODLE_ROLE !== "0";

export const aiChefMultiRoleEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_MULTI_ROLE !== "0";

export const aiChefSourceLabelsEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_SOURCE_LABELS !== "0";

// 換卡流程 V2：每次 tap 最多 1 個 backend 請求、library 先行、AI 只由用戶明確觸發。
// 預設 ON（2026-11-16 車主批准上線）；Cloudflare Workers Builds 由 repo push 自動 build，
// 唔會帶本機 env，所以唔可以用「=== "1"」，否則每次 push 之後自動 build 會靜靜關返。
// Kill switch：設 EXPO_PUBLIC_AI_CHEF_SWAP_V2=0 再 build 即回舊換卡路徑。
export const aiChefSwapV2Enabled =
  process.env.EXPO_PUBLIC_AI_CHEF_SWAP_V2 !== "0";
