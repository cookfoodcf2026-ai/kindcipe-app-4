/**
 * Normalise the backend's typed plan/limit errors.
 *
 * Backend throws TRPCError({ code: "FORBIDDEN", message: "PRO_REQUIRED: …",
 * cause: { code: "PRO_REQUIRED", feature: "kol_plan" } }) and
 * TRPCError({ …, cause: { code: "LIMIT_REACHED", feature, limit, used } }).
 * tRPC versions differ slightly in where `cause` lands, so read every shape we
 * have seen and fall back to the message prefix.
 */

export type PlanErrorKind = "pro_required" | "limit_reached" | "other";

export interface ParsedPlanError {
  kind: PlanErrorKind;
  feature?: string;
  limit?: number;
  used?: number;
}

export interface MealPlanBatchItemResult {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  newPlanId?: number | null;
  recipeId?: string | null;
}

export interface MealPlanBatchResponse {
  count?: number;
  items?: MealPlanBatchItemResult[];
  skippedCount?: number;
}

export interface MealPlanBatchSummary {
  added: number;
  proRequired: number;
  skipped: number;
  total: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return asObject(value);
  try {
    return asObject(JSON.parse(value));
  } catch {
    return null;
  }
}

function readCause(err: unknown): Record<string, unknown> | null {
  const anyErr = asObject(err);
  if (!anyErr) return null;
  const data = asObject(anyErr.data);
  const shape = asObject(anyErr.shape);
  const shapeData = shape ? asObject(shape.data) : null;
  const candidates = [
    data?.cause,
    shapeData?.cause,
    anyErr.cause,
    data?.cause && asObject(data.cause)?.cause,
  ];
  for (const candidate of candidates) {
    const cause = parseJsonObject(candidate);
    if (cause) return cause;
  }
  return null;
}

function readMessage(err: unknown): string {
  const anyErr = asObject(err);
  const message = anyErr?.message;
  return typeof message === "string" ? message : "";
}

function toFeature(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function fromMessage(message: string): ParsedPlanError {
  if (/^\s*\[?PRO_REQUIRED\b/i.test(message)) {
    return { kind: "pro_required", feature: "kol_plan" };
  }
  if (/^\s*\[?LIMIT_REACHED\b/i.test(message)) {
    return { kind: "limit_reached" };
  }
  return { kind: "other" };
}

export function parsePlanError(err: unknown): ParsedPlanError {
  const cause = readCause(err);
  const code = typeof cause?.code === "string" ? cause.code.toUpperCase() : "";

  if (code === "PRO_REQUIRED") {
    return { kind: "pro_required", feature: toFeature(cause?.feature) };
  }
  if (code === "LIMIT_REACHED") {
    return {
      kind: "limit_reached",
      feature: toFeature(cause?.feature),
      limit: toNumber(cause?.limit),
      used: toNumber(cause?.used),
    };
  }

  return fromMessage(readMessage(err));
}

/** "8/5" — empty when the backend did not send both numbers. */
export function formatLimitUsage(value: { used?: number; limit?: number }): string {
  if (typeof value.used !== "number" || typeof value.limit !== "number") return "";
  return `${value.used}/${value.limit}`;
}

export function limitPaywallFeature(
  parsed: ParsedPlanError,
): "recipe_limit" | "import_limit" | "generic" {
  if (parsed.feature === "imports") return "import_limit";
  if (parsed.feature === "custom_recipes") return "recipe_limit";
  return "generic";
}

/**
 * mealPlan.addBatch comes back per item:
 * { items: [{ ok: false, skipped: true, reason: "pro_required" }, …] }
 * Count only ok && !skipped as added; never treat a skipped item as success.
 */
export function summarizeMealPlanBatch(
  result: unknown,
  requestedCount = 0,
): MealPlanBatchSummary {
  const total = Math.max(0, requestedCount);
  const res = asObject(result);
  const itemsValue = res?.items;
  const items = Array.isArray(itemsValue)
    ? (itemsValue as MealPlanBatchItemResult[])
    : null;

  if (items) {
    let added = 0;
    let proRequired = 0;
    for (const item of items) {
      if (!item) continue;
      if (item.ok === true && !item.skipped) added += 1;
      if (item.reason === "pro_required") proRequired += 1;
    }
    return {
      added,
      proRequired,
      skipped: Math.max(0, items.length - added),
      total: Math.max(total, items.length),
    };
  }

  const count = toNumber(res?.count);
  const added = count != null ? Math.max(0, count) : total;
  return {
    added,
    proRequired: 0,
    skipped: Math.max(0, total - added),
    total,
  };
}
