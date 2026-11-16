/**
 * 換卡決策（pure，唔靠 UI / network）。
 *
 * 輸入：backend response（cards / recipes / status）、當前卡、已見名字、
 * 同畫面其他卡、relaxRole。輸出只有 swap / panel / noop。
 *
 * 規則（AI_CHEF_SWAP_V2）：
 * - 已見卡、同畫面其他卡、當前卡自己一律排除。
 * - 先揀同 dishType，再揀同 recipeCategory（相近），最後才接受其他類別。
 * - 唔要求 backend 一定回同 role；角色只係偏好。
 * - 0 候選一律回 panel，永遠唔會自動回 AI —— AI 只可以由用戶喺面板明確觸發。
 */

import { inferDishTypeKeyFromName, normalizeDishType, type DishTypeKey } from "./dishType";

export type SwapCardLike = {
  name?: string;
  dishType?: string;
  recipeCategory?: string;
};

export type SwapResponse<T extends SwapCardLike> = {
  cards?: T[] | null;
  recipes?: T[] | null;
  status?: string | null;
};

export type SwapPanelReason =
  | "no_cards"
  | "no_candidates"
  | "all_excluded"
  | "request_failed"
  | "needs_relax";

export type SwapMatch = "same_dish_type" | "similar";

export type SwapDecision<T extends SwapCardLike> =
  | { action: "swap"; candidate: T; match: SwapMatch }
  | { action: "panel"; reasons: SwapPanelReason[] }
  | { action: "noop"; reason: string };

export type DecideSwapInput<T extends SwapCardLike> = {
  response?: SwapResponse<T> | null;
  currentCard: T;
  /** session 已見 / 今輪已換過嘅名字（client-side 過濾，唔會送往 backend 收窄 pool）。 */
  seenNames?: Iterable<string> | null;
  /** true = 用戶明確要求重用已見卡（「再出之前見過嘅卡」）；現卡／同畫面卡仍然排除。 */
  allowSeen?: boolean;
  /** 同畫面其他卡嘅名字。 */
  otherCardNames?: Iterable<string> | null;
  /** true = 用戶要求放寬類別（再搵）；唔再偏好原 dishType。 */
  relaxRole?: boolean;
  /** false = 原 dishType 命中 avoid（例如唔要海鮮但卡係 seafood），唔可以再偏好原類別。 */
  roleAllowed?: boolean;
  isValidCandidate?: (card: T) => boolean;
  /** 額外候選護欄（例如候選 dishType 命中 avoid 就唔收）。 */
  isCandidateAllowed?: (card: T) => boolean;
  getDishType?: (card: T) => DishTypeKey;
};

const normalizeName = (name: string): string =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,。．.、!！?？:：;；/\\()（）【】\[\]{}<>《》'"“”‘’·—-]/g, "");

const defaultDishType = (card: SwapCardLike): DishTypeKey => {
  const explicit = String(card?.dishType ?? "").trim();
  if (explicit) return normalizeDishType(explicit);
  return inferDishTypeKeyFromName(String(card?.name ?? ""));
};

const defaultIsValid = (card: SwapCardLike): boolean =>
  !!card && String(card.name ?? "").trim().length > 0;

// dishType → 對應 avoid 關鍵詞（避免用家講「唔要海鮮」都仍然被派 seafood role）。
const ROLE_AVOID_TOKENS: Record<DishTypeKey, string[]> = {
  seafood: ["海鮮", "海鲜", "魚", "鱼", "蝦", "虾", "蟹", "貝", "贝", "蠔", "蚝", "魷魚", "鱿鱼", "帶子", "带子", "蜆", "蚬", "龍蝦", "龙虾"],
  meat: ["肉", "豬", "猪", "牛", "雞", "鸡", "羊", "鴨", "鸭", "鵝", "鹅"],
  vegetable: ["蔬菜", "菜", "素"],
  soup: ["湯", "汤"],
  carb: ["飯", "饭", "麵", "面", "粉", "粥", "餃", "饺"],
  appetizer: ["前菜", "小食", "小吃"],
  dessert: ["甜品", "甜點", "甜点"],
  drink: ["飲品", "饮品", "飲料", "饮料"],
  other: [],
};

const avoidTermMatches = (term: string, token: string): boolean => {
  const a = String(term ?? "").trim().toLowerCase();
  const b = String(token ?? "").trim().toLowerCase();
  if (!a || !b) return false;
  // 只當 avoid 係「類別級」詞（海鮮／蝦／湯…）才封鎖整個 role；
  // 「牛肉」唔應該連雞肉都封鎖，所以唔用 term.includes(token)。
  return a === b || b.includes(a);
};

/** 原卡 dishType 係咪命中用戶 avoid（命中就唔應該再送 role marker / 偏好原類別）。 */
export const roleBlockedByAvoid = (
  dishType: string | null | undefined,
  avoid: Iterable<string> | null | undefined,
): boolean => {
  const key = normalizeDishType(dishType);
  const tokens = [...(ROLE_AVOID_TOKENS[key] ?? []), key];
  if (tokens.length === 0) return false;
  const terms = Array.from(avoid ?? []).filter(Boolean);
  return terms.some((term) => tokens.some((token) => avoidTermMatches(term, token)));
};

/** AI 換卡只可以由用戶明確要求；0 候選 / flag 本身都唔會自動觸發。 */
export const isAiSwapRequested = (
  opts: { userRequestedAi?: boolean; aiCanGenerate?: boolean } = {},
): boolean => opts.userRequestedAi === true && opts.aiCanGenerate !== false;

const collectCandidates = <T extends SwapCardLike>(
  response: SwapResponse<T> | null | undefined,
): T[] => {
  const raw = [
    ...(Array.isArray(response?.cards) ? response!.cards! : []),
    ...(Array.isArray(response?.recipes) ? response!.recipes! : []),
  ];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const card of raw) {
    const name = normalizeName(String(card?.name ?? ""));
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(card);
  }
  return out;
};

export function decideSwap<T extends SwapCardLike>(
  input: DecideSwapInput<T>,
): SwapDecision<T> {
  const {
    response,
    currentCard,
    relaxRole = false,
    roleAllowed = true,
    allowSeen = false,
    isValidCandidate = defaultIsValid,
    isCandidateAllowed,
    getDishType = defaultDishType,
  } = input;

  const currentName = normalizeName(String(currentCard?.name ?? ""));
  const blocked = new Set<string>();
  if (currentName) blocked.add(currentName);
  for (const name of input.otherCardNames ?? []) {
    const n = normalizeName(String(name ?? ""));
    if (n) blocked.add(n);
  }
  if (!allowSeen) {
    for (const name of input.seenNames ?? []) {
      const n = normalizeName(String(name ?? ""));
      if (n) blocked.add(n);
    }
  }

  const rawCandidates = collectCandidates(response);
  const usable = rawCandidates.filter((card) => {
    if (!isValidCandidate(card)) return false;
    if (isCandidateAllowed && !isCandidateAllowed(card)) return false;
    const n = normalizeName(String(card?.name ?? ""));
    return !!n && !blocked.has(n);
  });

  if (usable.length === 0) {
    const reasons: SwapPanelReason[] = [];
    if (!response) reasons.push("request_failed");
    else if (response.status === "no_cards") reasons.push("no_cards");
    if (rawCandidates.length > 0 && usable.length === 0) reasons.push("all_excluded");
    if (reasons.length === 0) reasons.push("no_candidates");
    if (!relaxRole) reasons.push("needs_relax");
    return { action: "panel", reasons };
  }

  const preferredDishType =
    relaxRole || !roleAllowed ? null : getDishType(currentCard);
  const preferredCategory = String(currentCard?.recipeCategory ?? "").trim();

  const sameType = preferredDishType
    ? usable.find((card) => getDishType(card) === preferredDishType)
    : undefined;
  if (sameType) return { action: "swap", candidate: sameType, match: "same_dish_type" };

  if (preferredCategory) {
    const sameCategory = usable.find(
      (card) => String(card?.recipeCategory ?? "").trim() === preferredCategory,
    );
    if (sameCategory) return { action: "swap", candidate: sameCategory, match: "similar" };
  }

  return { action: "swap", candidate: usable[0], match: "similar" };
}
