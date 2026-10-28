export type AppendableCard = {
  cardId?: string;
  name?: string;
  source?: string;
  officialId?: number;
  customId?: number;
  _identityFallback?: boolean;
};

function normalizedName(card: AppendableCard): string {
  return String(card.name ?? "").trim().toLowerCase();
}

export function cardIdentity(card: AppendableCard): string {
  if (card.cardId) return `card:${card.cardId}`;
  if (card.officialId != null) return `official:${card.officialId}`;
  if (card.customId != null) return `custom:${card.customId}`;
  return `name:${normalizedName(card)}`;
}

/**
 * Append new cards without replacing prior cards. Prefer the server cardId;
 * only mark a card as identityFallback when no stable identity exists.
 */
export function mergeAppendedCards<T extends AppendableCard>(prev: T[], next: T[]): T[] {
  if (!Array.isArray(next) || next.length === 0) return prev;
  const seen = new Set(prev.map(cardIdentity));
  const out = [...prev];
  for (const card of next) {
    const identity = cardIdentity(card);
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(card.cardId || card.officialId != null || card.customId != null
      ? card
      : { ...card, _identityFallback: true });
  }
  return out;
}
