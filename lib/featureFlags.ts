export const aiPlanEnabled = process.env.EXPO_PUBLIC_AI_PLAN_ENABLED === "1";

export const aiChefQuickPlanEnabled = process.env.EXPO_PUBLIC_AI_CHEF_QUICK_PLAN !== "0";

export const approvalUiEnabled = false;

export const aiChefNoodleRoleEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_NOODLE_ROLE !== "0";

export const aiChefMultiRoleEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_MULTI_ROLE !== "0";

export const aiChefSourceLabelsEnabled =
  process.env.EXPO_PUBLIC_AI_CHEF_SOURCE_LABELS !== "0";
