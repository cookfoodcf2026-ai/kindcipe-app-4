/**
 * 換卡決策（pure，唔靠 UI / network）。
 *
 * 輸入：backend response（cards / recipes / status）、當前卡、已見名字、
 * 同畫面其他卡、relaxRole。輸出只有 swap / panel / noop。
 *
 * 規則（AI_CHEF_SWAP_V2）：
 * - 硬排除只限：當前卡自己、同畫面其他卡。session 已見卡只降排序權重（unseen 優先），仍然可以出。
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
  swapFailed?: boolean | null;
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
  /** session 已見 / 今輪已換過嘅名字（只用作排序：unseen 優先，seen 排後，但仍可被選中）。 */
  seenNames?: Iterable<string> | null;
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
    isValidCandidate = defaultIsValid,
    isCandidateAllowed,
    getDishType = defaultDishType,
  } = input;

  if (response?.swapFailed === true) {
    return { action: "noop", reason: "swap_failed" };
  }

  const currentName = normalizeName(String(currentCard?.name ?? ""));
  const blocked = new Set<string>();
  if (currentName) blocked.add(currentName);
  for (const name of input.otherCardNames ?? []) {
    const n = normalizeName(String(name ?? ""));
    if (n) blocked.add(n);
  }

  // session 已見只做排序權重，唔再硬排除（硬排除只限現卡＋枱上其他餸）。
  const seen = new Set<string>();
  for (const name of input.seenNames ?? []) {
    const n = normalizeName(String(name ?? ""));
    if (n) seen.add(n);
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

  const pickPreferred = (pool: T[]): T | undefined => {
    if (preferredDishType) {
      const sameType = pool.find((card) => getDishType(card) === preferredDishType);
      if (sameType) return sameType;
    }
    if (preferredCategory) {
      const sameCategory = pool.find(
        (card) => String(card?.recipeCategory ?? "").trim() === preferredCategory,
      );
      if (sameCategory) return sameCategory;
    }
    return pool[0];
  };

  const isSeen = (card: T): boolean => seen.has(normalizeName(String(card?.name ?? "")));
  const unseen = usable.filter((card) => !isSeen(card));
  const seenPool = usable.filter(isSeen);

  // unseen 先用完，seen 只排後；兩邊內部照舊按 dishType / category 偏好。
  const pickup = pickPreferred(unseen) ?? pickPreferred(seenPool);
  if (!pickup) return { action: "panel", reasons: ["no_candidates"] };

  const match: SwapMatch =
    preferredDishType && getDishType(pickup) === preferredDishType
      ? "same_dish_type"
      : "similar";
  return { action: "swap", candidate: pickup, match };
}
