import { ingredientsSignature } from "./recipeSignature";

export const MAX_CARD_HISTORY = 3;

export type HistoryCard = {
  name?: string;
  ingredients?: ({ name?: string } | null)[] | null;
};

export type CardHistoryEntry<T extends HistoryCard = HistoryCard> = {
  id: string;
  key: string;
  names: string[];
  at: number;
  cards?: T[];
  version?: number;
};

export type HistorySession<T extends HistoryCard = HistoryCard> = {
  cards?: T[] | null;
  createdAt?: number;
};

type BuildEntryOptions<T extends HistoryCard> = {
  isValid?: (card: T) => boolean;
  idFactory?: () => string;
  now?: number;
};

export type PushCardHistoryOptions<T extends HistoryCard> = BuildEntryOptions<T> & {
  max?: number;
  operation?: "append";
};

const normalizeRecipeName = (name: string) =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,。．.、!！?？:：;；/\\()（）【】\[\]{}<>《》'"“”‘’·—-]/g, "");

const isCardLike = (card: unknown): card is HistoryCard => {
  if (!card || typeof card !== "object") return false;
  return String((card as HistoryCard).name ?? "").trim().length > 0;
};

const cardIdentity = (card: HistoryCard): string => {
  const ingredientNames = (card.ingredients ?? []).map((ingredient) => String(ingredient?.name ?? ""));
  return `${normalizeRecipeName(String(card.name ?? ""))}::${ingredientsSignature(ingredientNames)}`;
};

const namesOnlyKey = (names: string[]): string =>
  names
    .map(normalizeRecipeName)
    .filter(Boolean)
    .sort()
    .join("|");

export function cardSetKey(cards: HistoryCard[]): string {
  return (cards ?? [])
    .filter(isCardLike)
    .map(cardIdentity)
    .sort()
    .join("|");
}

export function buildEntry<T extends HistoryCard>(
  cards: T[],
  opts: BuildEntryOptions<T> = {},
): CardHistoryEntry<T> | null {
  const valid = (Array.isArray(cards) ? cards : []).filter((card) =>
    opts.isValid ? opts.isValid(card) : isCardLike(card),
  );
  if (valid.length === 0) return null;
  const names = Array.from(
    new Set(valid.map((card) => String(card.name ?? "").trim()).filter(Boolean)),
  );
  if (names.length === 0) return null;
  const idFactory = opts.idFactory ?? (() => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  return {
    id: idFactory(),
    key: cardSetKey(valid),
    names,
    at: opts.now ?? Date.now(),
    cards: valid,
    version: 2,
  };
}

function containsAllCards<T extends HistoryCard>(next: T[] | undefined, prev: T[] | undefined): boolean {
  if (!next || !prev || prev.length === 0) return false;
  const nextIdentities = new Set(next.map(cardIdentity));
  return prev.every((card) => nextIdentities.has(cardIdentity(card)));
}

export function pushCardHistory<T extends HistoryCard>(
  prev: CardHistoryEntry<T>[] | null | undefined,
  cards: T[],
  opts: PushCardHistoryOptions<T> = {},
): CardHistoryEntry<T>[] {
  const list = Array.isArray(prev) ? prev : [];
  const max = Math.max(1, opts.max ?? MAX_CARD_HISTORY);
  const entry = buildEntry(cards, opts);
  if (!entry) return list;

  const top = list[0];
  if (opts.operation === "append" && top) {
    if (top.key === entry.key) return list;
    if (containsAllCards(entry.cards, top.cards)) {
      return [{ ...entry, id: top.id, at: top.at }, ...list.slice(1)].slice(0, max);
    }
  } else if (top && top.key === entry.key) {
    return list;
  }

  return [entry, ...list].slice(0, max);
}

export function sanitizeCardHistory<T extends HistoryCard>(raw: unknown): CardHistoryEntry<T>[] {
  if (!Array.isArray(raw)) return [];
  const out: CardHistoryEntry<T>[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<CardHistoryEntry<T>>;
    const at = Number(entry.at);

    const cards = Array.isArray(entry.cards)
      ? entry.cards.filter((card): card is T => isCardLike(card))
      : [];
    const hasCards = cards.length > 0;
    const names = Array.from(
      new Set(
        (hasCards
          ? cards.map((card) => String(card.name ?? "").trim())
          : Array.isArray(entry.names)
            ? entry.names.map((name) => String(name ?? "").trim())
            : []
        ).filter(Boolean),
      ),
    );
    if (names.length === 0 || !Number.isFinite(at)) continue;

    out.push({
      id: typeof entry.id === "string" && entry.id ? entry.id : `legacy_${at}_${index}`,
      key: hasCards ? cardSetKey(cards) : namesOnlyKey(names),
      names,
      at,
      ...(hasCards ? { cards } : {}),
      version: hasCards ? 2 : 1,
    });

    if (out.length >= MAX_CARD_HISTORY) break;
  }

  return out;
}

export function updateHistoryEntryCards<T extends HistoryCard>(
  prev: CardHistoryEntry<T>[] | null | undefined,
  key: string,
  cards: T[],
  opts: { isValid?: (card: T) => boolean } = {},
): CardHistoryEntry<T>[] {
  const list = Array.isArray(prev) ? prev : [];
  if (!key) return list;
  const index = list.findIndex((entry) => entry.key === key);
  if (index < 0) return list;

  const valid = (Array.isArray(cards) ? cards : []).filter((card) =>
    opts.isValid ? opts.isValid(card) : isCardLike(card),
  );
  if (valid.length === 0) return list.filter((_, itemIndex) => itemIndex !== index);

  const names = Array.from(
    new Set(valid.map((card) => String(card.name ?? "").trim()).filter(Boolean)),
  );
  if (names.length === 0) return list;

  const next = list.slice();
  next[index] = {
    ...next[index],
    key: cardSetKey(valid),
    names,
    cards: valid,
    version: 2,
  };
  return next;
}

function normalizedNamesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(normalizeRecipeName).sort();
  const right = b.map(normalizeRecipeName).sort();
  return left.every((name, index) => name === right[index]);
}

export function matchCardsFromSessions<T extends HistoryCard>(
  entryNames: string[],
  sessions: readonly HistorySession<T>[] | null | undefined,
  isValid?: (card: T) => boolean,
  entryAt = 0,
): T[] | null {
  if (!Array.isArray(entryNames) || entryNames.length === 0) return null;

  const candidates: { cards: T[]; createdAt: number; key: string }[] = [];
  for (const session of sessions ?? []) {
    const cards = Array.isArray(session?.cards) ? session.cards : [];
    if (cards.length !== entryNames.length) continue;
    if (!cards.every((card) => (isValid ? isValid(card) : isCardLike(card)))) continue;
    const sessionNames = cards.map((card) => String(card?.name ?? ""));
    if (!normalizedNamesEqual(entryNames, sessionNames)) continue;
    candidates.push({
      cards,
      createdAt: Number(session.createdAt) || 0,
      key: cardSetKey(cards),
    });
  }

  if (candidates.length === 0) return null;
  const distinctKeys = new Set(candidates.map((candidate) => candidate.key));
  if (distinctKeys.size !== 1) return null;

  const sameCardSet = candidates.filter((candidate) => candidate.key === candidates[0].key);
  sameCardSet.sort((a, b) => {
    const distance = Math.abs(a.createdAt - entryAt) - Math.abs(b.createdAt - entryAt);
    if (distance !== 0) return distance;
    return b.createdAt - a.createdAt;
  });
  return sameCardSet[0].cards;
}
