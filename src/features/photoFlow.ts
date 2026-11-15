export type VisionScene = "dish" | "fridge";

export type VisionAnalysis = {
  scene: VisionScene;
  dishName: string;
  ingredients: string[];
  requestId?: string;
};

export type VisionQuickReply = { actionId: string; labelKey: string };

// Backend quickReplies are rendered verbatim. Keep a whitelist so retired actions
// (similar_ai / similar_library) can't leak back into the UI before their handlers
// are removed in the next release.
const VISIBLE_QUICK_REPLY_ACTION_IDS = new Set([
  "ai_generate",
  "closest_library",
  "import_recipe",
  "text_ingredients",
  "restart",
  "photo_retry",
  "photo_regenerate",
]);

export function filterQuickReplies(input: unknown): VisionQuickReply[] {
  if (!Array.isArray(input)) return [];
  return input.filter((q): q is VisionQuickReply =>
    !!q &&
    typeof q.actionId === "string" &&
    typeof q.labelKey === "string" &&
    VISIBLE_QUICK_REPLY_ACTION_IDS.has(q.actionId),
  );
}

export type VisionOutcome =
  | {
      kind: "cards";
      messageKey: string;
      vars: { n: number; items: string };
      cards: any[];
      analysis: VisionAnalysis;
      imageKey: string;
      imageUrl: string;
    }
  | {
      kind: "ai";
      messageKey: string;
      vars: { items: string };
      quickReplies: VisionQuickReply[];
      analysis: VisionAnalysis;
      imageKey: string;
      imageUrl: string;
    }
  | {
      kind: "failed";
      messageKey: string;
      analysis: null;
      imageKey?: string;
      imageUrl?: string;
    };

export const MAX_PHOTO_BASE64_LENGTH = 5_500_000;

export function isPhotoLimitError(error: unknown): boolean {
  const value = error as any;
  const code = value?.data?.code ?? value?.shape?.data?.code ?? value?.code;
  return code === "TOO_MANY_REQUESTS";
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object") return input as Record<string, unknown>;
  if (typeof input !== "string") return null;
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(input.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseVisionAnalysis(input: unknown): VisionAnalysis | null {
  const record = asRecord(input);
  if (!record) return null;
  const scene = record.scene === "dish" ? "dish" : record.scene === "fridge" ? "fridge" : null;
  if (!scene) return null;
  const dishName = typeof record.dishName === "string" ? record.dishName.trim() : "";
  const ingredients = Array.isArray(record.ingredients)
    ? record.ingredients
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length <= 20 && !/[。！？\n]/.test(item))
      .slice(0, 12)
    : [];
  const requestId = typeof record.requestId === "string" ? record.requestId : undefined;
  return { scene, dishName, ingredients, requestId };
}

export function visionItems(vision: VisionAnalysis): string[] {
  return vision.ingredients.length > 0 ? vision.ingredients : vision.dishName ? [vision.dishName] : [];
}

export function buildVisionOutcome(
  vision: VisionAnalysis,
  cards: any[],
  imageKey: string,
  imageUrl: string,
): VisionOutcome {
  const items = visionItems(vision);
  if (items.length === 0) {
    return { kind: "failed", messageKey: "aiChef.pantryRecognizeFailed", analysis: null, imageKey, imageUrl };
  }
  const vars = { n: cards.length, items: items.join("、") };
  if (cards.length > 0) {
    return {
      kind: "cards",
      messageKey: vision.scene === "dish" ? "aiChef.visionDishLibraryHit" : "aiChef.visionFridgeLibraryHit",
      vars,
      cards,
      analysis: vision,
      imageKey,
      imageUrl,
    };
  }
  return {
    kind: "ai",
    messageKey: vision.scene === "dish" ? "aiChef.visionDishLibraryMiss" : "aiChef.pantrySeenNoLibrary",
    vars: { items: items.join("、") },
    quickReplies: [{ actionId: "ai_generate", labelKey: "aiChef.aiGenerateCredit" }],
    analysis: vision,
    imageKey,
    imageUrl,
  };
}

export async function analyzePhoto(
  api: any,
  input: { storageKey?: string; base64?: string; mimeType?: string; lang?: string },
): Promise<VisionAnalysis> {
  const result = await api.aiRecipe.analyzeImage.mutate(input.storageKey
    ? { storageKeys: [input.storageKey], lang: input.lang }
    : { base64: input.base64, mimeType: input.mimeType, lang: input.lang });
  const parsed = parseVisionAnalysis(result);
  if (!parsed) throw new Error("invalid_vision_analysis");
  return parsed;
}

export type VisionSearchResult = {
  cards: any[];
  query1Count: number;
  query2Count: number;
  queryCounts: number[];
};

// 只做 exact match，避免「醬油雞」等菜名被子字串誤中。
const QUERY_ALIASES: Record<string, string[]> = {
  "醬油": ["豉油", "生抽"],
};

const MAX_SEARCH_QUERIES = 8;
const MAX_INGREDIENT_QUERIES = 5;
const MAX_ALIAS_QUERIES = 2;
const QUERY_TIMEOUT_MS = 4_000;
const MAX_SCORED_CARDS = 12;
const MAX_CARDS = 6;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("query_timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function searchVisionLibrary(api: any, vision: VisionAnalysis): Promise<VisionSearchResult> {
  const items = visionItems(vision);
  if (items.length === 0) return { cards: [], query1Count: 0, query2Count: 0, queryCounts: [] };

  // 1 條 combined（精確命中優先）＋ 最多 5 條逐樣食材 ＋ 最多 2 條 alias = 上限 8 條。
  const queries: string[] = [];
  const pushQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || queries.includes(trimmed) || queries.length >= MAX_SEARCH_QUERIES) return;
    queries.push(trimmed);
  };

  pushQuery(items.join(" "));
  for (const item of items.slice(0, MAX_INGREDIENT_QUERIES)) pushQuery(item);

  let aliasCount = 0;
  for (const item of items) {
    const aliases = QUERY_ALIASES[item];
    if (!aliases) continue;
    for (const alias of aliases) {
      if (aliasCount >= MAX_ALIAS_QUERIES) break;
      if (queries.includes(alias)) continue;
      pushQuery(alias);
      aliasCount += 1;
    }
    if (aliasCount >= MAX_ALIAS_QUERIES) break;
  }

  const runSearch = async (query: string): Promise<any[]> => {
    try {
      const result = await withTimeout(
        Promise.resolve(api.recipes.search.query({ query, limit: 6 })),
        QUERY_TIMEOUT_MS,
      );
      return Array.isArray(result?.recipes) ? result.recipes : [];
    } catch {
      // 單條失敗／timeout 唔可以清零其他 query 嘅結果。
      return [];
    }
  };

  // 同步建立所有 promise（httpBatchLink 會合併同一 tick 嘅 query），再一次等齊。
  const settled = await Promise.allSettled(queries.map(runSearch));
  const queryCounts = settled.map((r) => (r.status === "fulfilled" ? r.value.length : 0));

  // Overlap 排序：同一張卡被越多條唔同 query 命中，分數越高；
  // 同分先用 combined（query index 0），再按 query index，最後保留原 response 次序。
  type Scored = { card: any; hits: number; minQueryIndex: number; firstSeq: number };
  const scored = new Map<string, Scored>();
  let seq = 0;
  settled.forEach((result, queryIndex) => {
    if (result.status !== "fulfilled") return;
    const seenInQuery = new Set<string>();
    for (const card of result.value) {
      const key = String(card?.id ?? card?.recipeId ?? card?.name ?? "").trim();
      if (!key || seenInQuery.has(key)) continue;
      seenInQuery.add(key);
      const existing = scored.get(key);
      if (existing) {
        existing.hits += 1;
        if (queryIndex < existing.minQueryIndex) existing.minQueryIndex = queryIndex;
        continue;
      }
      scored.set(key, { card, hits: 1, minQueryIndex: queryIndex, firstSeq: seq });
      seq += 1;
    }
  });

  const cards = [...scored.values()]
    .sort((a, b) => b.hits - a.hits || a.minQueryIndex - b.minQueryIndex || a.firstSeq - b.firstSeq)
    .slice(0, MAX_SCORED_CARDS)
    .map((entry) => entry.card)
    .slice(0, MAX_CARDS);

  return {
    cards,
    query1Count: queryCounts[0] ?? 0,
    query2Count: queryCounts[1] ?? 0,
    queryCounts,
  };
}

export async function processPhoto(
  api: any,
  input: {
    uri: string;
    mimeType?: string;
    lang?: string;
    compress: (uri: string) => Promise<{ base64: string; mimeType: string }>;
    normalizeCards?: (cards: any[]) => any[];
    onProgress?: (phase: "uploading" | "analyzing") => void;
  },
): Promise<{ analysis: VisionAnalysis; outcome: VisionOutcome; imageKey: string; imageUrl: string }> {
  input.onProgress?.("uploading");
  const compressed = await input.compress(input.uri);
  if (!compressed.base64) throw new Error("empty_image");
  if (compressed.base64.length > MAX_PHOTO_BASE64_LENGTH) throw new Error("image_too_large");
  const uploaded = await api.recipes.uploadRecipeImage.mutate({
    base64: compressed.base64,
    mimeType: compressed.mimeType,
  });
  const imageKey = typeof uploaded?.key === "string" ? uploaded.key : "";
  const imageUrl = typeof uploaded?.url === "string" ? uploaded.url : "";
  if (!imageKey || !imageUrl) throw new Error("upload_failed");
  input.onProgress?.("analyzing");
  const analysis = await analyzePhoto(api, { storageKey: imageKey, lang: input.lang });
  const searchResult = await searchVisionLibrary(api, analysis);
  const cards = input.normalizeCards ? input.normalizeCards(searchResult.cards) : searchResult.cards;
  const outcome = buildVisionOutcome(analysis, cards, imageKey, imageUrl);
  const branch = outcome.kind === "cards" ? "library_hit" : outcome.kind === "ai" ? "library_miss" : "recognize_failed";
  console.log(`[photoFlow] request=${analysis.requestId ?? "none"} scene=${analysis.scene} items=${visionItems(analysis).length} query1=${searchResult.query1Count} query2=${searchResult.query2Count} queryCounts=${searchResult.queryCounts.join(",")} library=${cards.length} branch=${branch}`);
  return { analysis, outcome, imageKey, imageUrl };
}

export async function compressImageForWeb(uri: string): Promise<{ base64: string; mimeType: string }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = uri;
  });
  const maxSide = 1440;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_PHOTO_BASE64_LENGTH && quality > 0.5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("image_encode_failed");
  if (base64.length > MAX_PHOTO_BASE64_LENGTH) throw new Error("image_too_large");
  return { base64, mimeType: "image/jpeg" };
}

export async function pickWebImageFile(timeoutMs = 15_000): Promise<{ uri: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    document.body.appendChild(input);
    let settled = false;
    const cleanup = () => { try { input.remove(); } catch { /* ignore */ } };
    const finish = (value: { uri: string; mimeType: string } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      const reader = new FileReader();
      reader.onload = () => finish({ uri: String(reader.result), mimeType: file.type || "image/jpeg" });
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    };
    input.oncancel = () => finish(null);
    input.click();
  });
}
