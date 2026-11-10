function normalizeIngredientName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,。．.、!！?？:：;；/\\()（）【】\[\]{}<>《》'"“”‘’·—-]/g, "");
}

export function ingredientsSignature(ingredients: string[]): string {
  return ingredients
    .map(normalizeIngredientName)
    .filter(Boolean)
    .sort()
    .join("|");
}
