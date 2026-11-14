import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Platform, Modal, ScrollView, Alert, Keyboard, Image, ActionSheetIOS,
  ActivityIndicator, Animated, Dimensions, TouchableWithoutFeedback,
  KeyboardAvoidingView, Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { trpc, apiClient, resolveImageUrl } from "@/lib/trpc";
import { getLastPlanDate, rememberPlanDate } from "@/lib/recentPlanDate";
import { getRecipeLocalImage } from "@/lib/recipe-local-images";
import { useAuth } from "@/hooks/useAuth";
import { useAiChatCloudSync } from "@/hooks/ai-chef/useAiChatCloudSync";
import { useInvalidateMealPlanAndCart } from "@/hooks/useInvalidateMealPlanAndCart";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { useInvalidateRecipesAndWeekly } from "@/hooks/useInvalidateRecipesAndWeekly";
import { compressImage } from "@/lib/image-utils";
import { getBilingualName, getDisplayName, getLocalizedSteps } from "@/lib/bilingual";
import { useTranslation } from "react-i18next";
import { track, Events } from "@/lib/analytics";
import { buyDateForMeal } from "@/lib/shoppingDate";
import { summarizeShoppingBatch, resolveShoppingPlannedDate } from "@/lib/shoppingBatch";
import {
  applyPlannedDateToCachedItems,
  buildShoppingBatchPayload,
  withItemPlannedDate,
} from "@/lib/shoppingPayload";
import { compressImageForWeb, filterQuickReplies, isPhotoLimitError, pickWebImageFile, processPhoto, type VisionAnalysis } from "@/src/features/photoFlow";
import { decidePhotoRecipe, isAcceptedRecipeShape } from "@/src/features/recipeQuality";
import { openSupport, reportAiChefFailure } from "@/lib/support";
import i18n from "@/lib/i18n";
import { enumT } from "@/lib/i18nEnums";
import { formatIngredientDisplay } from "@/src/lib/ingredientDisplay";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import ShoppingAddConfirm from "@/src/components/ShoppingAddConfirm";
import NextDayPrompt from "@/src/components/NextDayPrompt";
import MealConflictPrompt from "@/src/components/MealConflictPrompt";
import MealLimitPrompt from "@/src/components/MealLimitPrompt";
import AdSlot from "@/src/components/AdSlot";
import PaywallModal from "@/components/PaywallModal";
import FreeUpsellModal from "@/src/components/FreeUpsellModal";
import { canPurchaseHere, getProducts, PRODUCT_IDS } from "@/lib/purchase";
import { categorizeIngredient, calcAdjustedQty, isSeasoning, isWaterIngredient } from "@/constants/ingredients";
import { todayISO, toISODate, formatDateLabel, getDayBefore, getDayAfter } from "@/src/lib/date";
import { friendlyError } from "@/lib/errors";
import {
  formatLimitUsage,
  limitPaywallFeature,
  parsePlanError,
  summarizeMealPlanBatch,
} from "@/lib/limitErrors";
import { normalizeDishType, inferDishTypeKeyFromName, dishTypeLabel, type DishTypeKey } from "@/lib/dishType";
import { normalizeMealPreferences, type MealPreferenceTime } from "@/lib/mealPreferences";
import { aiChefQuickPlanEnabled, aiChefNoodleRoleEnabled, aiChefSourceLabelsEnabled } from "@/lib/featureFlags";
import { canva } from "@/app/styles/colors";
import { mergeAppendedCards } from "@/lib/appendCards";
import { ingredientsSignature } from "@/lib/recipeSignature";
import {
  MAX_CARD_HISTORY,
  cardSetKey,
  matchCardsFromSessions,
  pushCardHistory,
  sanitizeCardHistory,
  updateHistoryEntryCards,
} from "@/lib/cardHistory";
import { chatSessionSignature } from "@/lib/chatSessionSignature";
import { detectMealIntent, detectFlavorConstraint } from "@/lib/mealIntent";

type MsgContent = string | (
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
)[];
type Message = { role: "user" | "assistant"; content: MsgContent };
type BackendMessage = { role: "user" | "assistant"; content: MsgContent };
type AIRecipe = {
  id?: string;
  cardId?: string;
  _identityFallback?: boolean;
  name: string; description: string;
  nameEn?: string; nameFil?: string; nameId?: string;
  cookTime: number; servings: number;
  difficulty: string; recipeCategory?: string;
  dishType?: string;
  ingredients: { name: string; nameEn?: string; nameFil?: string; nameId?: string; quantity: string; unit: string; category?: string }[];
  steps: string[]; stepsEn?: string[]; stepsFil?: string[]; stepsId?: string[];
  tags: string[];
  image?: string; thumbnailUrl?: string;
  source?: "official" | "custom" | "ai" | "library";
  officialId?: number;
  customId?: number;
  _savedId?: number;
  _libraryRecipeId?: string;
  _serverQualified?: boolean;
};

type MealPlanStep = "idle" | "people" | "audience" | "time" | "dislike" | "generating" | "result";
type NextDayPromptData = {
  targetDate: string;
  title: string;
  body: string;
  acceptLabel?: string;
};
type MealPlanPreferences = {
  people: number;
  hasKids: boolean;
  hasElderly: boolean;
  time: MealPreferenceTime | null;
  timeModes: MealPreferenceTime[];
  dislikes: string;
  allergens: string;
};

const EMPTY_PREFS: MealPlanPreferences = { people: 0, hasKids: false, hasElderly: false, time: null, timeModes: [], dislikes: "", allergens: "" };
const EMPTY_RECIPE_LIST: AIRecipe[] = [];
const splitAvoidList = (value: string) => value.split("、").map((item) => item.trim()).filter(Boolean);
// 食譜庫換卡 watchdog：實測 ~0.5 秒，20 秒係保守上限，卡住就解鎖。
const LIBRARY_SWAP_TIMEOUT_MS = 15_000;
// AI 換卡 watchdog：實測 15–25 秒，太短會喺生成途中解鎖。
const AI_SWAP_TIMEOUT_MS = 60_000;

// ─── Recipe Validation ───────────────────────────────────
// Chat AI cards keep the legacy strict floor (main 5 / soup+dessert 4).
// Only cards stamped `_serverQualified` by the photo generateFromImage path
// bypass it, while still keeping name/ingredient/step render safety.
const isValidRecipe = (r: AIRecipe): boolean => isAcceptedRecipeShape(r);

// ─── Normalizers（防呆：step / ingredient 形狀可能來自不同來源）────
// DB / search API 嘅 steps 可能係 {instruction, duration} object；
// AI 文字 parse 出嚟係 string。統一轉做 string。
const normalizeStep = (s: unknown): string => {
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    const o = s as { instruction?: unknown; text?: unknown; step?: unknown };
    const v = o.instruction ?? o.text ?? o.step;
    if (typeof v === "string") return v;
  }
  return String(s ?? "");
};

// 由步驟文字抽出「（第 X-Y 分鐘）」嘅終點 Y（以分鐘計），俾一步步計時器用
const parseStepDuration = (step: unknown): number => {
  const text = normalizeStep(step);
  const m = text.match(/第\s*[0-9一二三四五六七八九十]+[-–—~至到]\s*([0-9一二三四五六七八九十]+)\s*分鐘/);
  if (!m) return 0;
  const cn = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 } as Record<string, number>;
  const y = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : cn[m[1]] ?? 0;
  return y;
};

// Ingredients 保證有 { name, quantity, unit } 形狀（AI 可能缺 quantity/unit）
const PLACEHOLDER_INGREDIENT_NAMES = new Set([
  "適量",
  "少許",
  "些許",
  "若干",
  "適宜",
  "適當",
  "隨意",
  "視乎口味",
  "依個人喜好",
  "各",
  "各適量",
  "每樣",
  "各樣",
  "各式各樣",
  "其他",
  "食材",
  "未知食材",
]);

// Helper: Filter out placeholder ingredients for accurate count
const getValidIngredients = (ingredients: AIRecipe["ingredients"]) => {
  if (!ingredients || ingredients.length === 0) return [];
  return ingredients.filter(ing => {
    const name = (ing.name || "").trim();
    if (!name) return false;
    return !isPlaceholderIngredientName(name);
  });
};

const INGREDIENT_UNIT_WORDS = "克|毫升|公升|升|ml|l|L|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb|角|副";
const QUANTITY_WORDS = "[\\d.]+(?:[\\d.-]*[\\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許";
const APPROX_PREFIX = "(?:約|大約|大概|近約|左右)\\s*";
const ONLY_QUANTITY_RE = new RegExp(`^${APPROX_PREFIX}(${QUANTITY_WORDS})\\s*(?:(${INGREDIENT_UNIT_WORDS}))?\\s*$`, "i");
const NAME_QTY_RE = new RegExp(`^(.+?)\\s+${APPROX_PREFIX}(${QUANTITY_WORDS})\\s*(?:(${INGREDIENT_UNIT_WORDS}))?\\s*$`, "i");
const INGREDIENT_NOTE_KEYWORDS = ["潤肺", "止咳", "平喘", "唔好落太多", "唔好落", "不要落太多", "不要落", "少落", "少放", "可選", "建議", "功效", "養生", "清熱", "去濕", "補氣", "止咳平喘", "洗淨", "切片", "切碎", "切段", "切絲", "去皮", "去核", "浸泡", "泡發", "攪拌", "備用", "斬件", "拍扁"];
const GENERIC_INGREDIENT_GROUP_NAMES = new Set(["食材", "材料", "原料", "配料", "調味料", "湯底", "湯料", "主料", "主材料", "餸料", "ingredients"]);
const WATER_INGREDIENT_HINTS = /(?:^|[^A-Za-z\u4e00-\u9fa5])(?:清水|水|開水|滾水|熱水|凍水|上湯|高湯|雞湯|魚湯|湯底|清湯)(?:$|[^A-Za-z\u4e00-\u9fa5])/;

const normalizeIngredientText = (text: string) =>
  String(text ?? "")
    .replace(/（[^）]*）/g, "")
    .replace(/^[\s,，。．.!！？?、\-–—*•·]+|[\s,，。．.!！？?、\-–—*•·]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isGenericIngredientGroupName = (name: string) => GENERIC_INGREDIENT_GROUP_NAMES.has(normalizeRecipeName(name));

const isPlaceholderIngredientName = (name: string) => {
  const n = String(name ?? "").trim();
  return PLACEHOLDER_INGREDIENT_NAMES.has(n) || PLACEHOLDER_INGREDIENT_NAMES.has(normalizeRecipeName(n));
};

const normalizeIngredient = (ing: any): { name: string; nameEn?: string; nameFil?: string; nameId?: string; quantity: string; unit: string } | null => {
  const rawName = normalizeIngredientText(ing?.name ?? "");
  const rawQuantity = ing?.quantity != null ? normalizeIngredientText(String(ing.quantity)) : "";
  const rawUnit = ing?.unit != null ? normalizeIngredientText(String(ing.unit)) : "";
  if (!rawName || isPlaceholderIngredientName(rawName) || isIngredientNoteFragment(rawName)) return null;

  const qtyOnlyMatch = rawName.match(ONLY_QUANTITY_RE);
  if (qtyOnlyMatch) {
    return null;
  }

  const nameQtyMatch = rawName.match(NAME_QTY_RE);
  if (nameQtyMatch) {
    const cleanedName = normalizeIngredientText(nameQtyMatch[1]);
    if (!cleanedName || isPlaceholderIngredientName(cleanedName) || isIngredientNoteFragment(cleanedName)) return null;
    return {
      name: cleanedName,
      nameEn: ing?.nameEn ? String(ing.nameEn) : undefined,
      nameFil: ing?.nameFil ? String(ing.nameFil) : undefined,
      nameId: ing?.nameId ? String(ing.nameId) : undefined,
      quantity: nameQtyMatch[2] || rawQuantity,
      unit: nameQtyMatch[3] || rawUnit,
    };
  }

  if (!rawQuantity && !rawUnit && /^(?:約|大約|大概|近約|左右)?\s*[\d.]+(?:[\d.-]*[\d.]+)?\s*(?:克|毫升|公升|升|ml|l|L|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb|角|副)\s*$/i.test(rawName)) {
    return null;
  }

  return {
    name: rawName,
    nameEn: ing?.nameEn ? String(ing.nameEn) : undefined,
    nameFil: ing?.nameFil ? String(ing.nameFil) : undefined,
    nameId: ing?.nameId ? String(ing.nameId) : undefined,
    quantity: rawQuantity,
    unit: rawUnit,
  };
};

// 拆開「一欄多樣」食材（保險）：name 用 / 、 ； 分隔咗多樣 → 每樣一個獨立 ingredient
const splitMultiIngredient = (ing: { name: string; quantity?: string; unit?: string }): { name: string; quantity: string; unit: string }[] => {
  const rawName = String(ing?.name ?? "").trim();
  if (!rawName) return [];
  // 保護括號入面，避免「滷包（八角/花椒）」被拆
  const protectedParts: string[] = [];
  const noParens = rawName.replace(/（[^）]*）|\([^)]*\)/g, (m) => { protectedParts.push(m); return `\u0000${protectedParts.length - 1}\u0000`; });
  const parts = noParens.split(/[/、；;|，]/).map(s => s.trim().replace(/\u0000(\d+)\u0000/g, (_, i) => protectedParts[Number(i)])).filter(Boolean);
  if (parts.length <= 1) return [{ name: rawName, quantity: String(ing?.quantity ?? ""), unit: String(ing?.unit ?? "") }];
  // quantity「各30克」→ 每樣 30 克；「少許」→ 每樣少許
  const q = String(ing?.quantity ?? "").trim();
  const perQty = /^各/.test(q) ? q.replace(/^各/, "").trim() : q;
  return parts.map((p) => ({ name: p, quantity: perQty, unit: String(ing?.unit ?? "") }));
};

const isQuantityOnlyIngredientLine = (text: string) => ONLY_QUANTITY_RE.test(normalizeIngredientText(String(text ?? "")));
const isIngredientNoteFragment = (text: string) => {
  const t = normalizeIngredientText(String(text ?? ""));
  if (!t) return false;
  if (INGREDIENT_NOTE_KEYWORDS.some((kw) => t.includes(kw))) return true;
  return /[，,。．.!！？?]/.test(t);
};

const parseIngredientEntry = (text: string, parentName = ""): { name: string; quantity: string; unit: string } | null => {
  const il = normalizeIngredientText(text);
  if (!il || isIngredientNoteFragment(il)) return null;

  const qtyOnlyMatch = il.match(ONLY_QUANTITY_RE);
  if (qtyOnlyMatch) {
    const parent = normalizeIngredientText(parentName);
    if (parent && !isGenericIngredientGroupName(parent) && !isPlaceholderIngredientName(parent) && !isIngredientNoteFragment(parent)) {
      return { name: parent, quantity: qtyOnlyMatch[1] || "適量", unit: qtyOnlyMatch[2] || "" };
    }
    return null;
  }

  const qMatch = il.match(NAME_QTY_RE);
  if (qMatch) {
    const name = normalizeIngredientText(qMatch[1]);
    if (!name || isPlaceholderIngredientName(name) || isIngredientNoteFragment(name) || isGenericIngredientGroupName(name)) return null;
    return { name, quantity: qMatch[2] || "適量", unit: qMatch[3] || "" };
  }

  if (/^(?:約|大約|大概|近約|左右)?\s*[\d.]+(?:[\d.-]*[\d.]+)?\s*(?:克|毫升|公升|升|ml|l|L|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb|角|副)\s*$/i.test(il)) {
    return null;
  }

  return { name: il, quantity: "", unit: "" };
};

const hasWaterIngredient = (ingredients: { name: string; quantity: string; unit: string }[]) =>
  ingredients.some((ing) => WATER_INGREDIENT_HINTS.test(normalizeIngredientText(ing.name)));

const inferSoupWaterIngredient = (
  recipeCategory: string,
  ingredients: { name: string; quantity: string; unit: string }[],
  description: string,
  steps: string[],
) => {
  if (recipeCategory !== "湯水" || hasWaterIngredient(ingredients)) return ingredients;

  const text = `${description} ${steps.join(" ")}`;
  const qtyMatch = text.match(/(約|大約|大概|近約|左右)?\s*(\d+(?:\.\d+)?)\s*(公升|升|毫升|ml|l|L)/i);
  if (qtyMatch) {
    const unit = /^(ml|毫升)$/i.test(qtyMatch[3]) ? "毫升" : /^(l|L|升)$/i.test(qtyMatch[3]) ? "升" : qtyMatch[3];
    return [{ name: "清水", quantity: qtyMatch[2], unit }, ...ingredients];
  }

  if (/加水|落水|注入水|煲滾|煮滾|加湯|加入湯底|倒入湯底/.test(text)) {
    return [{ name: "清水", quantity: "適量", unit: "" }, ...ingredients];
  }

  return ingredients;
};

const normalizeLibraryRecipeId = (raw?: string | null): string => {
  const id = String(raw ?? "").trim();
  if (!id) return "";
  if (/^(official|user)_/.test(id)) return id;
  if (/^\d+$/.test(id)) return `official_${id}`;
  return "";
};

// 將任何來源嘅食譜 steps/ingredients 統一 normalize 成 string[] / 標準 ingredient[]
// 防呆：如果 AI 返回空嘅 ingredients/steps，嘗試修復
const normalizeRecipe = (r: any): AIRecipe => {
  // source fallback：後端圖書館結果可能冇帶 source，但帶住 library ref（official_/user_/officialId…）
  // 收窄判斷：只有肯定 signal 先當 library，其餘保持原本 "ai"（唔影響曖昧個案）
  const explicitSource = r?.source;
  const hasLibraryRef =
    typeof r?._libraryRecipeId === "string" ||
    typeof r?.officialId === "number" ||
    typeof r?.customId === "number" ||
    (typeof r?.id === "string" && (r.id.startsWith("official_") || r.id.startsWith("user_")));
  const source = explicitSource === "library"
    ? "library"
    : (explicitSource === "official" || explicitSource === "custom")
      ? explicitSource
      : hasLibraryRef
        ? "library"
        : (explicitSource ?? "ai");
  const normalized = {
    ...r,
    steps: Array.isArray(r?.steps) ? r.steps.map(normalizeStep).filter(Boolean) : [],
    ingredients: Array.isArray(r?.ingredients)
      ? r.ingredients.map(normalizeIngredient).filter((v: { name: string; quantity: string; unit: string } | null): v is { name: string; quantity: string; unit: string } => !!v)
      : [],
    tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t ?? "").trim()).filter(Boolean) : [],
    source: source as AIRecipe["source"],
    // Only the photo path may stamp this after accepting the server quality gate.
    _serverQualified: undefined,
  };
  if (normalized.source === "library" && !normalized._libraryRecipeId && typeof r?.id === "string") {
    const libId = normalizeLibraryRecipeId(r.id);
    if (libId) normalized._libraryRecipeId = libId;
  }
  
  // Fallback: if ingredients/steps are empty but we have description, try to extract
  if (normalized.ingredients.length === 0 && r.description) {
    // Try to extract ingredients from description (simple fallback)
  }
  if (normalized.steps.length === 0 && r.description) {
    // Use description as a single step (better than nothing)
    normalized.steps = [r.description];
  }
  
  return normalized;
};

const normalizeRecipeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,。．.、!！?？:：;；/\\()（）【】\[\]{}<>《》'"“”‘’·—-]/g, "");

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
};

const recipeNameSimilarity = (a: string, b: string) => {
  const na = normalizeRecipeName(a);
  const nb = normalizeRecipeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - levenshteinDistance(na, nb) / maxLen;
};

const isDuplicateRecipeName = (candidate: string, historyNames: string[]) => {
  const normalized = normalizeRecipeName(candidate);
  if (!normalized) return false;
  return historyNames.some((n) => {
    const other = normalizeRecipeName(n);
    if (!other) return false;
    if (normalized === other) return true;
    // Only check for near-exact matches (avoid false positives like "雞" vs "豉油雞")
    return recipeNameSimilarity(normalized, other) >= 0.95;
  });
};

// 由 AI 助手所有過往 session 嘅 assistant 訊息抽「食譜名稱」（來源 B：歷史生成紀錄）
// 只計最近 30 日內嘅 session，避免無限累積、避免過度保守
const RECIPE_HEADER_NAME_RE = /食譜[一二三四五六七八九十\d]+[：:][^\n]*?[——\-—|｜]\s*([^\n（(]+)/g;
const AI_HISTORY_DAYS = 30;
const extractAiHistoryRecipeNames = (sessions: ChatSession[]): string[] => {
  const cutoff = Date.now() - AI_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const names = new Set<string>();
  for (const s of sessions) {
    if ((s.createdAt ?? 0) < cutoff) continue;
    for (const m of s.messages) {
      if (m.role !== "assistant") continue;
      const text = contentToText(m.content);
      if (!text) continue;
      let mm: RegExpExecArray | null;
      RECIPE_HEADER_NAME_RE.lastIndex = 0;
      while ((mm = RECIPE_HEADER_NAME_RE.exec(text)) !== null) {
        const n = (mm[1] || "").replace(/^[—\-]+\s*/, "").trim();
        if (n && n.length >= 2 && n.length <= 50) names.add(n);
      }
    }
  }
  return [...names];
};

// 按目標份量縮放食材（用於批次/單張加入排餐 → 連帶落購物清單）
const scaleIngredients = (r: AIRecipe, overrideServings?: number | null): AIRecipe["ingredients"] => {
  if (!overrideServings || overrideServings <= 0 || !r.servings || r.servings <= 0 || overrideServings === r.servings) {
    return r.ingredients;
  }
  const ratio = overrideServings / r.servings;
  return r.ingredients.map((ing) => ({
    ...ing,
    quantity: calcAdjustedQty(String(ing.quantity ?? ""), ing.unit ?? "", categorizeIngredient(ing.name), ratio),
  }));
};

const QUICK_ACTIONS = [
  { id: "daily", icon: "restaurant-outline", emoji: "🍱", label: "AI 助手一鍵生成 3 餸一湯", subtitle: "AI 助手幫你諗好今晚食咩", group: "hero", tint: "#F37021", color: "#FFFFFF" },
  { id: "fridge", icon: "camera-outline", emoji: "📷", label: "影相搵食譜", group: "tools", tint: "#E8F0F4", color: "#183B56" },
  { id: "random", icon: "shuffle-outline", emoji: "📚", label: "食譜庫隨機抽", group: "tools", tint: "#FDEAD9", color: "#D97706" },
  { id: "ai", icon: "sparkles-outline", emoji: "✨", label: "AI 生成食譜", group: "tools", tint: "#E8F0F4", color: "#183B56" },
  { id: "pantry", icon: "basket-outline", emoji: "🧺", label: "用雪櫃食材", group: "tools", tint: "#E8F0E4", color: "#4F6F4F" },
  { id: "quick", icon: "time-outline", emoji: "⏱️", label: "快手", subtitle: "收工即煮，快手搞定", image: require("../assets/recipes/scene-quick.png"), group: "scenario", tint: "#FFFFFF", color: "#183B56" },
  { id: "healthy", icon: "heart-outline", emoji: "🥦", label: "清淡", subtitle: "少油少鹽，食得輕盈", image: require("../assets/recipes/scene-healthy.png"), group: "scenario", tint: "#FFFFFF", color: "#183B56" },
  { id: "ricecooker", icon: "hardware-chip-outline", emoji: "🍲", label: "電飯煲", subtitle: "一鍋搞掂，慳力慳時", image: require("../assets/recipes/scene-ricecooker.png"), group: "scenario", tint: "#FFFFFF", color: "#183B56" },
  { id: "kids", icon: "happy-outline", emoji: "😄", label: "小朋友啱食", subtitle: "口味溫和，全家都愛", image: require("../assets/recipes/scene-kids.png"), group: "scenario", tint: "#FFFFFF", color: "#183B56" },
  { id: "guest", icon: "wine-outline", emoji: "🥂", label: "宴客", subtitle: "體面大菜，招呼朋友", image: require("../assets/recipes/scene-guest.png"), group: "scenario", tint: "#FFFFFF", color: "#183B56" },
  { id: "highProtein", icon: "barbell-outline", emoji: "💪", image: require("../assets/recipes/scene-protein.jpg"), label: "蛋白/健身", subtitle: "健身前後都夠蛋白、夠飽", group: "scenario", tint: "#FFF1E6", color: "#183B56" },
  { id: "vegetarian", icon: "leaf-outline", emoji: "🥬", image: require("../assets/recipes/scene-vegetarian.jpg"), label: "素食", subtitle: "蛋奶素・無肉無海鮮", group: "scenario", tint: "#EAF5E6", color: "#183B56" },
];

const HOT_KEY_CONFIG: Record<string, {
  search?: { query?: string; tags?: string[]; cookTimeMax?: number; category?: string; scenario?: string };
  rank?: "shortestTime" | "default";
  aiPrompt: string;
  // single: true → 唔行「三餸一湯」角色組合，直接由食譜庫出 1 張卡
  // （素食／高蛋白池冇「肉」角色，行角色組合會 served=0）
  single?: boolean;
}> = {
  quick: {
    search: { cookTimeMax: 30, scenario: "quick" },
    rank: "shortestTime",
    aiPrompt: "aiChef.hk_quickPrompt",
  },
  healthy: {
    search: { query: "清淡", scenario: "healthy" },
    rank: "default",
    aiPrompt: "aiChef.hk_healthyPrompt",
  },
  ricecooker: {
    search: { query: "電飯煲", scenario: "ricecooker" },
    rank: "default",
    aiPrompt: "aiChef.hk_ricecookerPrompt",
  },
  kids: {
    search: { tags: ["小朋友"], scenario: "kids" },
    rank: "default",
    aiPrompt: "aiChef.hk_kidsPrompt",
  },
  guest: {
    search: { query: "宴客", scenario: "guest" },
    rank: "default",
    aiPrompt: "aiChef.hk_guestPrompt",
  },
  highProtein: {
    search: { query: "蛋白質", scenario: "highProtein" },
    rank: "default",
    aiPrompt: "aiChef.hk_highProteinPrompt",
    single: true,
  },
  vegetarian: {
    search: { query: "素食", scenario: "vegetarian" },
    rank: "default",
    aiPrompt: "aiChef.hk_vegetarianPrompt",
    single: true,
  },
};

const PEOPLE_OPTIONS = ["1", "2", "3", "4", "5", "6+"];
const AUDIENCE_OPTIONS = [
  { key: "none", label: "普通大人" },
  { key: "kids", label: "有小朋友" },
  { key: "elderly", label: "有老人家" },
  { key: "both", label: "小朋友+老人家" },
];
const TIME_OPTIONS = [
  { key: "quick", label: "快手（30分鐘內）" },
  { key: "normal", label: "普通（約1小時）" },
  { key: "leisure", label: "慢煮/想慢慢煮" },
];

// 統一同類別判定：優先使用卡上已分類嘅 dishType，其次靠菜名推斷（canonical key）
const getDishType = (r: any): DishTypeKey => {
  const explicit = String(r?.dishType ?? "").trim();
  if (explicit) return normalizeDishType(explicit);
  return inferDishTypeKeyFromName(String(r?.name ?? ""));
};

// 將 dishType key 轉做中文搜尋 keyword（後端食譜庫係中文，用英文搜唔到嘢）
const dishTypeKeyword = (t: string): string => {
  switch (normalizeDishType(t)) {
    case "soup": return "湯水";
    case "meat": return "肉";
    case "seafood": return "海鮮";
    case "vegetable": return "蔬菜";
    case "carb": return "飯";
    case "appetizer": return "前菜";
    case "dessert": return "甜品";
    case "drink": return "飲品";
    default: return "";
  }
};

// ─── 「X 餸 Y 湯」意圖偵測（自由對話安全網）──────────────
// 只喺高信心時 intercept；唔確定就回 null，交由後端自由對話處理（零回歸）。
// 覆蓋：餸／送／菜 互通、中文或阿拉伯數字、可選「同/加」連接詞。
const soupStyleLabel = (time: MealPlanPreferences["time"]): string => {
  if (time === "quick") return "滾湯/例湯（30–40 分鐘內）";
  if (time === "leisure") return "老火湯（90 分鐘以上）";
  return "煲湯（約 1 小時）";
};
const soupStyleLabelFromModes = (modes: MealPreferenceTime[], fallback: MealPlanPreferences["time"] = null): string => {
  if (modes.includes("quick")) return "滾湯/例湯優先（30–40 分鐘內）";
  if (modes.includes("normal")) return "煲湯（約 1 小時）";
  if (modes.includes("leisure")) return "老火湯（90 分鐘以上）";
  return soupStyleLabel(fallback);
};

// ─── Helpers ──────────────────────────────────────────────

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  cards?: AIRecipe[];
  mealResult?: AIRecipe[] | null;
};

function compactLegacyMealPrompt(message: Message): Message {
  if (message.role !== "user" || typeof message.content !== "string") return message;
  const text = message.content;
  if (!text.includes("請為我設計今晚") || !text.includes("請提供完整")) return message;
  const title = text.match(/今晚「([^」]+)」/)?.[1]?.trim();
  return { ...message, content: title ? `請為我設計今晚「${title}」晚餐。` : "請為我設計今晚晚餐。" };
}

const SESSIONS_KEY = (uid: string | number) => `kindcipe_ai_sessions_${uid}`;
const ACTIVE_KEY = (uid: string | number) => `kindcipe_ai_active_${uid}`;
const OLD_CHAT_KEY = (uid: string | number) => `kindcipe_ai_chat_${uid}`;

const MAX_IMAGES_PER_SESSION = 3;
type PhotoFlowStatus =
  | { stage: "uploading" | "analyzing"; slow: boolean; retryUri: string; retryMimeType?: string }
  | { stage: "error"; message: string; retryUri: string; retryMimeType?: string }
  | null;
const LOADING_STEPS = [
  "aiChef.thinking",
  "aiChef.loadingStep1",
  "aiChef.loadingStep2",
];

const BRAND = canva.primary;
const BG = canva.bg;
const CARD = canva.surface;
const TEXT = canva.primary;
const SUB = canva.muted;
const HINT = "#8A99A8";
const BORDER = canva.border;
const GREEN = canva.greenText;
const RED = "#EF4444";

const MEAL_TYPES = [
  { id: "breakfast", label: "早餐" }, { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" }, { id: "snack", label: "小食" },
];

// NOTE: System prompt is now managed on the backend (kindcipe-backend/server/routers/aiRecipe.ts)
// The backend adds its own SYSTEM_PROMPT to each chat request.


// ─── Session Helpers ───────────────────────────────────

function contentToText(c: MsgContent): string {
  if (typeof c === "string") return c;
  return c.filter((b): b is { type: "text"; text: string } => b.type === "text").map(b => b.text).join(" ");
}

function parseAssistantResponse(content: string) {
  // Strip JSON artifacts if backend accidentally returned raw JSON
  // This handles cases where {"replyText":"...","recipes":[...]} leaks into content
  let text = content.trim();
  
  // Remove leading JSON objects that might have leaked
  if (text.startsWith('{') && text.includes('"replyText"')) {
    try {
      // Try to find and extract clean replyText from JSON
      const replyTextMatch = text.match(/"replyText"\s*:\s*"([^"]*)"/);
      if (replyTextMatch) {
        text = replyTextMatch[1];
      } else {
        // Fallback: remove JSON-like patterns
        text = text.replace(/^\s*\{[\s\S]*?\}\s*/, "");
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }
  
  // Remove trailing incomplete JSON
  text = text.replace(/\{[\s\S]*$/, "").trim();
  
  const idx = text.indexOf("---next-steps---");
  if (idx === -1) return { mainText: text, nextSteps: [] as string[] };
  const mainText = text.slice(0, idx).trim();
  const stepsBlock = text.slice(idx + "---next-steps---".length).trim();
  const nextSteps = stepsBlock
    .split("\n")
    .map(line => line.replace(/^[-\d\.\)\s]+/, "").trim())
    .filter(line => line.length > 0 && !/^[-\d\.\)\s]*$/.test(line));
  return { mainText, nextSteps };
}

function makeSessionTitle(msgs: Message[]): string {
  const firstUser = msgs.find(m => m.role === "user");
  if (!firstUser) return i18n.t("新對話" as any);
  const t = contentToText(firstUser.content).trim();
  // 內部系統提示（app 自動推送、唔係用戶打字）→ 唔好攞嚟做標題，用通用標題（避免中文標題）
  if (/^(請為我設計|請從食譜庫|請再提供|我雪櫃有|提供 ?1 ?個|請設計|庫內搜尋|請換|幫我設計)/.test(t)) {
    return i18n.t("新對話" as any);
  }
  return t.length > 30 ? t.slice(0, 30) + "..." : t;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function chatRequestFingerprint(payload: Record<string, any>): string {
  const rest: Record<string, any> = { ...(payload ?? {}) };
  delete rest.clientMessageId;
  return JSON.stringify(rest);
}

function resolveClientMessageId(
  payload: Record<string, any>,
  failed: { fingerprint: string; clientMessageId: string } | null,
  pending: Record<string, string> = {},
): { fingerprint: string; clientMessageId: string; isRetry: boolean } {
  const fingerprint = chatRequestFingerprint(payload);
  const retryClientMessageId = failed?.fingerprint === fingerprint ? failed.clientMessageId : null;
  const pendingClientMessageId = typeof pending[fingerprint] === "string" ? pending[fingerprint] : null;
  return {
    fingerprint,
    clientMessageId: payload.clientMessageId ?? pendingClientMessageId ?? retryClientMessageId ?? `cm_${generateId()}`,
    isRetry: !!retryClientMessageId,
  };
}

function isQuotaBlocked(quota: any): boolean {
  if (!quota || typeof quota !== "object") return false;
  const used = Number(quota.used);
  const limit = Number(quota.limit);
  return quota.nearLimit === true || (Number.isFinite(used) && Number.isFinite(limit) && limit > 0 && used >= limit);
}

// 拆「食譜一…\n---\n食譜二…」做獨立 recipe blocks；普通對話（無 ---）回空
const splitRecipeBlocks = (text: string): string[] => {
  const clean = text.replace(/---next-steps---[\s\S]*$/, "").trim();
  if (!clean.includes("---")) return [];
  return clean
    .split(/\n?\s*---\s*\n?/)
    .map(b => b.trim())
    .filter(Boolean);
};

// Detect if text contains recipe-like content (has recipe headers)
const hasRecipeContent = (text: string): boolean => {
  const recipeHeaderPattern = /^(?:食譜[一二三四五六七八九十\d]+[：:]\s*|[\d]+[.、．]\s*)?(?:中菜|西餐|日式|韓式|東南亞|甜品|飲品|其他|中式|西式|韓式|東南亞式|家常|菜|川菜|湘菜|素菜|湯水|小炒|主食|麵食|飯類)[^\n]*[——\-—|｜][^\n]*（?約?\d+分鐘）?/m;
  return recipeHeaderPattern.test(text);
};


// ─── Lightweight Markdown Renderer ─────────────────────
// Renders the specific format used by AI 助手:
// - Recipe headers: 食譜一：類別 —— 名稱（約XX分鐘）
// - Section headers: 🛒 食材：, 🍳 步驟：
// - Bullet lists: - item
// - Numbered lists: 1. item
// - Bold: **text**
// - Horizontal rules: ---

const stripInlineMarkdown = (value: string): string =>
  value.replace(/\*\*/g, "").replace(/__/g, "").replace(/`/g, "").trim();

const stripListLabel = (value: string): string =>
  stripInlineMarkdown(value).replace(
    /^(?:Main Dish|Seafood\/Protein|Seafood|Protein|Vegetable|Soup|肉類|海鮮|蔬菜|湯)[：:]\s*/i,
    "",
  );

function renderMarkdown(text: string, styles: any): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines but add spacing
    if (!trimmed) {
      elements.push(<View key={key++} style={{ height: 8 }} />);
      continue;
    }

    // Horizontal rule
    if (trimmed === "---") {
      elements.push(<View key={key++} style={{ height: 1, backgroundColor: BORDER, marginVertical: 12 }} />);
      continue;
    }

    // Recipe header: 食譜一：類別 —— 名稱（約XX分鐘）
    // 注意：bullet 行（- / • 等）唔可以當 recipe header，否則會誤 render。
    // 只認「食譜N：」前綴 或「——」雙破折號；唔可以用單一 ASCII "-"，
    // 否則英文／菲文句入面嘅 hyphen（例如 "mag-type"、"self-service"）會被誤判並截斷。
    const isBulletLine = /^[-–—*•·]\s/.test(trimmed);
    const withPrefix = isBulletLine
      ? null
      : trimmed.match(/^食譜\s*[一二三四五六七八九十\d]+\s*[：:]\s*(.+?)\s*(?:——|—|--|：)\s*(.+?)(?:[（(]約?\s*(\d+)\s*分鐘[）)])?$/);
    const noPrefix = !withPrefix && !isBulletLine && trimmed.includes("——")
      ? trimmed.match(/^(.+?)\s*——\s*(.+?)(?:[（(]約?\s*(\d+)\s*分鐘[）)])?$/)
      : null;
    const recipeHeaderMatch = withPrefix || noPrefix;
    if (recipeHeaderMatch) {
      const recipeTitle = (recipeHeaderMatch[2]?.trim() || trimmed).replace(/^[—\-]+\s*/, "");
      elements.push(
        <View key={key++} style={{ marginTop: 12, marginBottom: 4 }}>
          <Text selectable style={[styles.mdRecipeTitle, { color: BRAND, fontWeight: "700", fontSize: 16 }]}>
            {recipeTitle}
          </Text>
          {recipeHeaderMatch[3] && (
            <Text selectable style={[styles.mdRecipeTime, { color: SUB, fontSize: 12, marginTop: 2 }]}>
              {i18n.t("dyn.minutes", { n: recipeHeaderMatch[3] })}
            </Text>
          )}
        </View>
      );
      continue;
    }

    // Section header with emoji:  食材：, 🍳 步驟：
    const sectionMatch = trimmed.match(/^([🛒🍳🥘🍽️👨‍🍳]+)\s*(.+?)[：:]$/);
    if (sectionMatch) {
      elements.push(
        <Text selectable key={key++} style={[styles.mdSectionHeader, { fontWeight: "700", fontSize: 14, marginTop: 10, marginBottom: 4, color: TEXT }]}>
          {sectionMatch[1]} {sectionMatch[2]}
        </Text>
      );
      continue;
    }

    // Bullet list item: - item or • item
    const bulletMatch = trimmed.match(/^[-–—*•·]\s*(.+)$/);
    if (bulletMatch) {
      elements.push(
        <View key={key++} style={{ flexDirection: "row", marginBottom: 4, paddingLeft: 8 }}>
          <Text style={{ color: BRAND, fontSize: 14, marginRight: 6 }}>•</Text>
          <Text selectable style={[styles.mdBullet, { fontSize: 14, color: TEXT, flex: 1 }]}>{stripListLabel(bulletMatch[1])}</Text>
        </View>
      );
      continue;
    }

    // Numbered list item: 1. item or 1、item
    const numberedMatch = trimmed.match(/^([0-9]+)[、.．)\s]\s*(.+)$/);
    if (numberedMatch) {
      elements.push(
        <View key={key++} style={{ flexDirection: "row", marginBottom: 6, paddingLeft: 8 }}>
          <Text style={[styles.mdStepNumber, { color: BRAND, fontWeight: "700", fontSize: 14, marginRight: 8, minWidth: 20 }]}>
            {numberedMatch[1]}.
          </Text>
          <Text selectable style={[styles.mdStepText, { fontSize: 14, color: TEXT, flex: 1 }]}>{stripListLabel(numberedMatch[2])}</Text>
        </View>
      );
      continue;
    }

    // Regular text paragraph
    elements.push(
      <Text selectable key={key++} style={[styles.mdParagraph, { fontSize: 14, color: TEXT, lineHeight: 20, marginBottom: 4 }]}>
        {stripInlineMarkdown(trimmed)}
      </Text>
    );
  }

  return elements;
}

// ─── Pressable with press-scale + haptics micro-interaction ───
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PressScale({ children, onPress, disabled, testID, style }: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function AIChefScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeFamily } = useAuth();
  const activeFamilyId = activeFamily?.id;
  const userName = user?.name ?? "";
  const { data: familySettings, isLoading: familySettingsLoading } = trpc.family.settings.useQuery(undefined, {
    enabled: !!activeFamilyId,
    staleTime: 60_000,
  });
  const mealDefaults = useMemo(
    () => normalizeMealPreferences((familySettings as any)?.mealPreferences),
    [familySettings],
  );


  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [cardsReadyChatId, setCardsReadyChatId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  // Cross-device sync: backend is the source of truth for chat history so the
  // same conversations appear on App + Web. Local AsyncStorage stays as cache.
  const {
    cloudSessions,
    syncSession: syncSessionToCloud,
    removeSession: removeSessionFromCloud,
    clearAllSessions: clearAllSessionsFromCloud,
    migrateLocalIfNeeded,
  } = useAiChatCloudSync(user?.id);
  const displaySessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    const filtered = q
      ? sessions.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some(m => contentToText(m.content).toLowerCase().includes(q))
        )
      : sessions;
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, sessionSearch]);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get("window").width * 0.82)).current;

  // Animate sidebar in/out
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showSessions ? 0 : -Dimensions.get("window").width * 0.82,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showSessions, slideAnim]);

  const activeSession = sessions.find(s => s.id === activeChatId);
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession?.messages]);
  const greetingReply = t("aiChef.greeting");
  const isGreetingText = (text: string) => /^(hi|hello|hey|yo|你好|您好|早安|午安|晚安|多謝|謝謝|唔該|thanks|thank you|thx)$/i.test(text.trim());

  // ─── Session-scoped message updates ────────────────────
  // 請求途中切換對話時，AI 回覆要寫返「發送時」嗰個 session，唔可以跟當前 activeChatId
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  const chatSessionIdRef = useRef<string>("");
  const chatGenerationRef = useRef(0);
  const chatRequestMetaRef = useRef(new Map<string, { sessionId: string; generation: number; historyMax?: number }>());
  const visionContextRef = useRef<(VisionAnalysis & { imageKey?: string }) | null>(null);
  const updateMessagesFor = useCallback((sessionId: string, fn: (prev: Message[]) => Message[]) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === sessionId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], messages: fn(prev[idx].messages) };
      const next = [...prev]; next[idx] = updated;
      return next;
    });
  }, []);

  const [input, setInput] = useState("");
  const [recommendedRecipes, setRecommendedRecipes] = useState<AIRecipe[]>([]);
  const lastChefRequestIdRef = useRef<string | null>(null);
  const trackCardAction = useCallback((action: string, recipe: AIRecipe, cardIndex?: number) => {
    const recipeId = recipe._libraryRecipeId
      || recipe.id
      || (recipe._savedId ? `user_${recipe._savedId}` : undefined);
    track(Events.AiCardAction, {
      action,
      requestId: lastChefRequestIdRef.current ?? undefined,
      cardIndex,
      cardId: recipe.cardId,
      recipeId,
    });
  }, []);
  // 是否已出過卡／開始對話（控制輸入框顯示：初始隱藏，出卡後先顯示）
  const [chatStarted, setChatStarted] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const uploadingRef = useRef(false);
  const [photoFlowStatus, setPhotoFlowStatus] = useState<PhotoFlowStatus>(null);
  const photoRunRef = useRef(0);
  const photoAiBusyRef = useRef(false);
  const lastPhotoAssetRef = useRef<{ uri: string; mimeType?: string } | null>(null);
  const photoSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    photoRunRef.current += 1;
    if (photoSlowTimerRef.current) clearTimeout(photoSlowTimerRef.current);
    if (photoTimeoutTimerRef.current) clearTimeout(photoTimeoutTimerRef.current);
  }, []);
  // Hot key / library-first search loading state（顯示「正在搵食譜庫...」）
  const [, setLibraryLoading] = useState(false);
  // 卡片「睇食材」展開（記錄展開邊張卡）
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  // 出咗新一批卡 → 收起之前展開嘅食材（index-based，唔 reset 會自動展開錯卡）
  useEffect(() => { setExpandedCard(null); }, [recommendedRecipes]);

  // ─── Daily 3-dish-1-soup flow ──────────────────────────
  const [mealStep, setMealStep] = useState<MealPlanStep>("idle");
  const [mealPrefs, setMealPrefs] = useState<MealPlanPreferences>(EMPTY_PREFS);
  const [mealResult, setMealResult] = useState<AIRecipe[] | null>(null);
  const [isPreparingMeal, setIsPreparingMeal] = useState(false);
  const [selectedCardIndexes, setSelectedCardIndexes] = useState<Set<number>>(new Set());
  const preserveSelectionOnNextMealResultRef = useRef(false);
  const quickMealModeRef = useRef(false);
  // When a new session skips the people question, wait until activeChatId has
  // flushed before generating, otherwise messages land in the previous chat.
  const pendingAutoStartRef = useRef<{ sessionId: string } | null>(null);
  // 同步 ref，等共用 onSuccess 讀到最新值（React Query closure 可能捕捉舊 state）
  const mealResultRef = useRef<AIRecipe[] | null>(null);
  useEffect(() => { mealResultRef.current = mealResult; }, [mealResult]);
  useEffect(() => {
    if (mealStep === "result" || mealStep === "idle") setIsPreparingMeal(false);
  }, [mealStep]);
  useEffect(() => {
    if (!mealResult) {
      setSelectedCardIndexes(new Set());
      preserveSelectionOnNextMealResultRef.current = false;
      return;
    }
    if (preserveSelectionOnNextMealResultRef.current) {
      preserveSelectionOnNextMealResultRef.current = false;
      return;
    }
    setSelectedCardIndexes(new Set(mealResult.map((_, i) => i)));
  }, [mealResult]);

  const selectedMealRecipes = useMemo(
    () => (mealResult ?? []).filter((_, index) => selectedCardIndexes.has(index)),
    [mealResult, selectedCardIndexes],
  );
  const allMealSelected = !!mealResult && mealResult.length > 0 && selectedMealRecipes.length === mealResult.length;

  const toggleMealCard = (index: number) => {
    setSelectedCardIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllMealCards = () => {
    if (!mealResult) return;
    setSelectedCardIndexes(allMealSelected ? new Set() : new Set(mealResult.map((_, i) => i)));
  };

  // ─── AI proactive next steps ───────────────────────────
  const [aiNextSteps, setAiNextSteps] = useState<string[]>([]);
  const [contractQuickReplies, setContractQuickReplies] = useState<{ actionId: string; labelKey: string }[]>([]);
  const [contractAiBlocked, setContractAiBlocked] = useState(false);
  const [libraryAlternatives, setLibraryAlternatives] = useState<AIRecipe[]>([]);
  const [libraryMissScenario, setLibraryMissScenario] = useState<string | null>(null);

  // AI Chef incomplete contract（flag AI_CHEF_INCOMPLETE_CONTRACT）：保留 partial 卡＋retryToken
  type IncompleteContract = { got: number; requiredCards: number; retryToken: string; payload: any };
  const [incompleteContract, setIncompleteContract] = useState<IncompleteContract | null>(null);
  const recordIncompleteContract = (data: any, variables: any, got: number): boolean => {
    if (data?.status !== "incomplete") {
      setIncompleteContract(null);
      return false;
    }
    setIncompleteContract({
      got,
      requiredCards: Number(data?.requiredCards) || got,
      retryToken: typeof data?.retryToken === "string" ? data.retryToken : "",
      payload: variables,
    });
    return true;
  };

  // ─── Toast notification ────────────────────────────────
  const [toast, setToast] = useState<{ text: string; visible: boolean; action?: { label: string; onPress: () => void }; tone?: "success" | "info" | "error" }>({ text: "", visible: false });
  const [nextDayPrompt, setNextDayPrompt] = useState<NextDayPromptData | null>(null);
  const [pendingShoppingNav, setPendingShoppingNav] = useState(false);
  const [restoringCards, setRestoringCards] = useState(false);
  type CardHistoryEntry = { id: string; key: string; names: string[]; at: number; cards?: AIRecipe[]; version?: number };
  const [cardHistory, setCardHistory] = useState<CardHistoryEntry[]>([]);
  const [showCardHistory, setShowCardHistory] = useState(false);
  const CARD_HISTORY_KEY = (uid: string | number) => `@kindcipe:ai-card-history:${uid}`;
  const cardHistoryRef = useRef<CardHistoryEntry[]>([]);
  const historyReadyRef = useRef(false);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
    // Never carry one account's card history into another account.
    cardHistoryRef.current = [];
    setCardHistory([]);
    setShowCardHistory(false);
    historyReadyRef.current = false;
  }, [user?.id]);

  const persistCardHistory = (next: CardHistoryEntry[]) => {
    cardHistoryRef.current = next;
    setCardHistory(next);
    const uid = userIdRef.current;
    if (uid) AsyncStorage.setItem(CARD_HISTORY_KEY(uid), JSON.stringify(next)).catch(() => {});
  };

  // Explicit single-writer: callers decide which operations are a new "group".
  // swap / delete update the existing group that matches the pre-change key;
  // hydrate / restore / clear only change UI, never this history.
  const commitCardHistory = (cards: AIRecipe[], opts?: { operation?: "append"; max?: number }) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const prev = cardHistoryRef.current;
    // `max` is the card cap that matches the rendered UI (e.g. meal flow slices
    // to 4); history itself always keeps at most MAX_CARD_HISTORY groups.
    const visibleCards = opts?.max != null ? cards.slice(0, opts.max) : cards;
    const next = pushCardHistory(prev, visibleCards, {
      isValid: isValidRecipe,
      max: MAX_CARD_HISTORY,
      operation: opts?.operation,
      idFactory: generateId,
    });
    if (next === prev) return;
    cardHistoryRef.current = next;
    setCardHistory(next);
    if (userIdRef.current !== uid) return;
    // Before the stored history has loaded, keep the next value in memory only;
    // the load effect will merge it with the stored list instead of losing it.
    if (!historyReadyRef.current) return;
    AsyncStorage.setItem(CARD_HISTORY_KEY(uid), JSON.stringify(next)).catch(() => {});
  };

  const syncCardHistoryEntry = (preKey: string, cards: AIRecipe[]) => {
    const prev = cardHistoryRef.current;
    const next = updateHistoryEntryCards(prev, preKey, cards, { isValid: isValidRecipe });
    if (next === prev) return;
    cardHistoryRef.current = next;
    setCardHistory(next);
    if (!historyReadyRef.current) return;
    const uid = userIdRef.current;
    if (!uid) return;
    AsyncStorage.setItem(CARD_HISTORY_KEY(uid), JSON.stringify(next)).catch(() => {});
  };

  const pendingPostShoppingDateRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string, action?: { label: string; onPress: () => void }, duration = 2000, tone: "success" | "info" | "error" = "success") => {
    setToast({ text, visible: true, action, tone });
    // 清上一個 timer，否則快速連續兩個 toast 會被舊 timer 提早收埋
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Typed backend errors: a real paywall beats a generic “failed” alert.
  const showLimitError = (e: unknown): boolean => {
    const parsed = parsePlanError(e);
    if (parsed.kind === "limit_reached") {
      const usage = formatLimitUsage(parsed);
      Alert.alert(
        t("limitErrors.limitReachedTitle" as any),
        usage
          ? t("limitErrors.monthlyLimit" as any, { used: parsed.used ?? 0, limit: parsed.limit ?? 0 })
          : t("error.quota" as any),
        [
          { text: t("取消" as any), style: "cancel" },
          {
            text: t("limitErrors.upgrade" as any),
            onPress: () => {
              setPaywallFeature(limitPaywallFeature(parsed));
              setShowPaywall(true);
            },
          },
        ],
      );
      return true;
    }
    if (parsed.kind === "pro_required") {
      setPaywallFeature("kol_plan");
      setShowPaywall(true);
      return true;
    }
    return false;
  };

  // ─── Shopping lists after AI plan ─────────────────────
  const [shopPlannedDate, setShopPlannedDate] = useState<string>(todayISO());
  // 收藏中狀態（顯示嗰張卡個 spinner）
  const [favoritingName, setFavoritingName] = useState<string>("");
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  // 同步鎖：state 未 flush 前，double tap 都唔會再入 swap。
  const swapInFlightRef = useRef(false);
  const swapWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSwapWatchdog = useCallback(() => {
    if (swapWatchdogRef.current) {
      clearTimeout(swapWatchdogRef.current);
      swapWatchdogRef.current = null;
    }
  }, []);
  const clearSwapLock = useCallback(() => {
    clearSwapWatchdog();
    swapInFlightRef.current = false;
    setSwappingIndex(null);
  }, [clearSwapWatchdog]);
  // watchdog 一到就強制解鎖，避免 stalled request 令換卡永久鎖死。
  const armSwapWatchdog = useCallback((ms: number) => {
    clearSwapWatchdog();
    swapWatchdogRef.current = setTimeout(() => {
      swapWatchdogRef.current = null;
      swapInFlightRef.current = false;
      setSwappingIndex(null);
    }, ms);
  }, [clearSwapWatchdog]);
  useEffect(() => () => clearSwapWatchdog(), [clearSwapWatchdog]);
  // 新一批卡安裝 → 清走上一批嘅換卡鎖／watchdog。
  useEffect(() => { clearSwapLock(); }, [recommendedRecipes, clearSwapLock]);
  // 換卡時食譜庫（放寬後）仍然 0 張 → 喺張卡位置長期顯示兩個選擇，唔再用 8 秒 toast。
  const [swapNoCards, setSwapNoCards] = useState<{ index: number; recipeName: string; cardId?: string } | null>(null);
  // 記錄已換過嘅食譜名稱，避免重複
  const [swappedRecipeNames, setSwappedRecipeNames] = useState<Set<string>>(new Set());
  // 記錄本次 chat 已見過嘅食譜名稱，避免同一個 session 反覆輪迴
  const [sessionSeenRecipeNames, setSessionSeenRecipeNames] = useState<string[]>([]);
  // ── Pantry / Ingredient asking flow ───────────────────
  const { data: pantryData } = trpc.pantry.list.useQuery(undefined, { enabled: !!user });
  // 用戶食譜庫（cache 供 收藏/排餐 去重用，避免每次 ensureSaved 都重新 fetch 200 條）
  const { data: userRecipes = [] } = trpc.recipes.listUser.useQuery(
    { limit: 200, offset: 0 },
    { enabled: !!user, staleTime: 60_000 },
  );

  // ── Meal Plan History (for duplicate detection) ───────
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  }, []);
  const { data: mealPlanHistory = [] } = trpc.mealPlan.listByDateRange.useQuery(
    { startDate: thirtyDaysAgo, endDate: todayISO() },
    { enabled: !!user, staleTime: 30_000 }
  );

  // Build set of recipe names used in last 30 days + 食譜庫已有菜式 + AI 助手過往生成紀錄
  // （A: 已排餐/mealPlanHistory + userRecipes；B: 所有 AI session 歷史）
  // 唔再將 userRecipes（用戶自己嘅庫）加入 exclude —— 否則 3餸1湯/食譜庫 永遠抽唔到用戶自己嘅自訂/匯入食譜。
  // 只保留「已排餐 + 過往 AI 提議」做去重，用戶自己嘅庫係候選（會出返）。
  const usedRecipeNames = useMemo(() => {
    const names = new Set<string>();
    (mealPlanHistory || []).forEach((mp: any) => {
      if (mp.recipeName) names.add(String(mp.recipeName).trim());
    });
    extractAiHistoryRecipeNames(sessions).forEach((n) => names.add(n));
    return [...names];
  }, [mealPlanHistory, sessions]);

  const [askingIngredients, setAskingIngredients] = useState(false);

  const resolveRecipeRef = (r: AIRecipe): { recipeId: string; isLibraryRef: boolean } => {
    if (r.id && (r.id.startsWith("official_") || r.id.startsWith("user_"))) {
      return { recipeId: r.id, isLibraryRef: true };
    }
    const libraryId = normalizeLibraryRecipeId(r._libraryRecipeId)
      || (r.source === "library" ? normalizeLibraryRecipeId(r.id) : "");
    if (libraryId) return { recipeId: libraryId, isLibraryRef: true };
    if (r._savedId) return { recipeId: `user_${r._savedId}`, isLibraryRef: true };
    if (r.source === "official" && r.officialId) return { recipeId: `official_${r.officialId}`, isLibraryRef: true };
    if (r.source === "custom" && r.customId) return { recipeId: `user_${r.customId}`, isLibraryRef: true };
    return { recipeId: "", isLibraryRef: false };
  };

  const COMMON_INGREDIENT_CHIPS = [
    { value: "雞蛋", k: "egg" }, { value: "豆腐", k: "tofu" }, { value: "番茄", k: "tomato" },
    { value: "洋蔥", k: "onion" }, { value: "青菜", k: "veg" }, { value: "豬肉", k: "pork" },
    { value: "雞肉", k: "chicken" }, { value: "魚", k: "fish" }, { value: "米", k: "rice" }, { value: "麵", k: "noodle" },
  ];

  const buildRecipeTags = (
    name: string,
    recipeCategory: string,
    difficulty: string,
    cookTime: number,
    description: string,
    ingredientCount: number,
  ): string[] => {
    const tags: string[] = [];
    const add = (tag?: string) => {
      const value = (tag || "").trim();
      if (value && !tags.includes(value)) tags.push(value);
    };
    const text = `${name} ${description}`;
    add(recipeCategory !== "其他" ? recipeCategory : "家常");
    add(difficulty);
    add(cookTime <= 15 ? "15分鐘內" : cookTime <= 30 ? "30分鐘內" : cookTime <= 45 ? "45分鐘內" : "慢煮");
    add(text.includes("湯") ? "湯水" : text.includes("蒸") ? "清蒸" : text.includes("炒") ? "快炒" : text.includes("焗") || text.includes("烤") ? "焗烤" : "家常菜");
    add(ingredientCount <= 6 ? "少食材" : "豐富食材");
    return tags;
  };

  const tryParseRecipes = (text: string): AIRecipe[] => {
    const recipes: AIRecipe[] = [];

    const recipeHeaderPattern = /^(?:食譜[一二三四五六七八九十\d]+[：:]\s*|[\d]+[.、．]\s*)?(?:中菜|西餐|日式|韓式|東南亞|甜品|飲品|其他|中式|西式|韓式|東南亞式|家常|菜|川菜|湘菜|素菜|湯水|小炒|主食|麵食|飯類)[^\n]*[——\-—|｜][^\n]*（?約?\d+分鐘）?/m;

    // Find all recipe header positions
    const headerPositions: number[] = [];
    let match;
    const headerRegex = new RegExp(recipeHeaderPattern.source, 'gm');
    while ((match = headerRegex.exec(text)) !== null) {
      headerPositions.push(match.index);
    }

    if (headerPositions.length > 0) {
      // Extract sections between headers
      for (let i = 0; i < headerPositions.length; i++) {
        const start = headerPositions[i];
        const end = i < headerPositions.length - 1 ? headerPositions[i + 1] : text.length;
        const section = text.slice(start, end).trim();
        const parsed = parseSingleRecipe(section);
        if (parsed && isValidRecipe(parsed)) recipes.push(parsed);
      }
    } else {
      // Fallback: try old format (bold headers, ### headers, 第X道)
      const lines = text.split("\n");
      let buf: string[] = [];
      const recipeHeaderRe = /^(?:[*#]*\s*(?:第[一二三四五六七八九十]+道|[0-9]+[、.．]\s*)|Recipe\s*\d+\s*[:.\-])/i;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { buf.push(line); continue; }
        if ((trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) ||
            (trimmed.startsWith("**") && /\*\*\s*[-–—]/.test(trimmed)) ||
            recipeHeaderRe.test(trimmed) ||
            (/^###\s/.test(trimmed) && trimmed.length > 4)) {
          if (buf.length > 0) {
            const parsed = parseSingleRecipe(buf.join("\n"));
            if (parsed && isValidRecipe(parsed)) recipes.push(parsed);
          }
          buf = [line];
        } else {
          buf.push(line);
        }
      }
      if (buf.length > 0) {
        const parsed = parseSingleRecipe(buf.join("\n"));
        if (parsed && isValidRecipe(parsed)) recipes.push(parsed);
      }
    }

    return recipes;
  };

  const parseSingleRecipe = (text: string): AIRecipe | null => {
    const newFormatMatch = text.match(/^(?:食譜[一二三四五六七八九十\d]+[：:]\s*|[\d]+[.、．]\s*)?(.+?)[——\-—|｜]\s*(.+?)(?:（約?(\d+)分鐘）)?(?:\n|$)/);
    const englishStyle = /(^|\n)\s*(?:\*\*)?(?:Recipe\s*\d+|Ingredients|Steps)/i.test(text);
    const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
    const englishHeadLine = englishStyle
      ? firstLine
          .replace(/^#{1,3}\s*/, "")
          .replace(/\*\*/g, "")
          .replace(/^Recipe\s*\d+\s*[:.\-]\s*/i, "")
          .trim()
      : "";
    const englishHeadParts = englishHeadLine.split(/\s+[-–—]\s+/);

    let name = "";
    let recipeCategory = "其他";
    let cookTime = 30;
    let description = "";
    let englishParsed = false;

    if (englishHeadLine) {
      const rawName = (englishHeadParts[0] || "").replace(/^\*\*|\*\*$/g, "").trim();
      if (!/^(ingredients|steps|食材|步驟|材料|做法)$/i.test(rawName)) {
        name = rawName;
        description = englishHeadParts.slice(1).join(" - ").trim();
        const categoryMatch = text.match(/(?:Category|類別|分類)[：:]\s*([^\n]+)/i);
        recipeCategory = categoryMatch?.[1]?.trim() || "其他";
        const timeMatch = text.match(/(\d+)\s*(?:mins?|minutes?|分鐘)/i);
        cookTime = timeMatch ? parseInt(timeMatch[1], 10) : 30;
        englishParsed = true;
      }
    }

    if (!englishParsed && newFormatMatch) {
      const rawCategory = newFormatMatch[1]?.trim() || "";
      // Clean up category - remove leading/trailing dashes or spaces
      recipeCategory = rawCategory.replace(/^[—\-]+\s*/, "").trim() || "其他";
      name = newFormatMatch[2]?.trim() || "";
      // Clean up name - remove leading dashes
      name = name.replace(/^[—\-]+\s*/, "").trim();
      cookTime = newFormatMatch[3] ? parseInt(newFormatMatch[3], 10) : 30;
    } else if (!englishParsed) {
      // Fallback: old format **名稱** or ### 名稱
      const nameMatch = text.match(/\*{0,2}\s*(.+?)\s*\*{0,2}(?:\n|$)/);
      name = nameMatch?.[1]?.replace(/^(?:第[一二三四五六七八九十]+道|[0-9]+[、.．]\s*)/, "").trim() || "";
      if (!name || name.length > 30) return null;

      const categoryMatch = text.match(/(?:類別|分類|Category)[：:]\s*(中菜|西餐|日式|韓式|東南亞|甜品|飲品|其他)/);
      recipeCategory = categoryMatch?.[1] || "其他";

      const cookTimeMatch = text.match(/(?:煮食時間|烹調時間|Cooking Time)[：:]\s*(\d+)\s*分鐘?/i);
      cookTime = cookTimeMatch ? parseInt(cookTimeMatch[1], 10) : 30;
    }

    if (!name) return null;
    if (name.length < 2 || name.length > 50) return null;

    // Extract description (paragraph before 🛒 / 食材 / Ingredients)
    if (!description) {
      const descMatch = text.match(/(?:（約\d+分鐘）|^\s*$)\s*\n\s*(.+?)(?=\n\s*(?:🛒|食材|材料|原料|Ingredients))/s);
      description = descMatch?.[1]?.trim() || "";
    }
    // Clean up description - take first paragraph only
    description = description.split("\n\n")[0]?.trim() || "";

    const servingsMatch = text.match(/(?:份量|人份|Servings)[：:]\s*(\d+)\s*人?/i);
    const servings = servingsMatch ? parseInt(servingsMatch[1], 10) : 4;

    const diffMatch = text.match(/(?:難度|Difficulty)[：:]\s*(簡單|中等|困難|容易|難)/i);
    const rawDiff = diffMatch?.[1] || "中等";
    const difficulty = rawDiff === "容易" ? "簡單" : rawDiff === "難" ? "困難" : rawDiff;

    // Extract ingredients
      const ingredients: { name: string; quantity: string; unit: string }[] = [];
    const ingSection = text.match(/(?:\s*)?(?:食材|材料|原料|Ingredients)[：:]\s*([\s\S]*?)(?=\n\s*(?:🍳|步驟|做法|Steps?|烹飪方法|烹调方法)|$)/i);
    if (ingSection) {
      const ingLines = ingSection[1].split("\n");
      for (const ingLine of ingLines) {
        let il = ingLine.replace(/^[-–—*•·]\s*/, "").trim();
        if (!il) continue;
        // Handle format: "食材名：數量 單位" or "調味料：生抽 1湯匙、油 半湯匙"
        const colonMatch = il.match(/^(.+?)[：:]\s*(.+)$/);
        if (colonMatch) {
          const ingName = normalizeIngredientText(colonMatch[1]);
          const ingDetail = normalizeIngredientText(colonMatch[2]);
          if (!ingName || isQuantityOnlyIngredientLine(ingName) || isIngredientNoteFragment(ingName)) continue;
          // Check if it's a compound ingredient like "調味料：生抽 1湯匙、蠔油 半湯匙"
          if (ingDetail.includes("、") || ingDetail.includes(",")) {
            // Split compound ingredients
            const parts = ingDetail.split(/[、,]/);
            for (const part of parts) {
              const parsed = parseIngredientEntry(part, ingName);
              if (parsed) ingredients.push(parsed);
            }
          } else {
            const parsed = parseIngredientEntry(ingDetail, ingName);
            if (parsed) ingredients.push(parsed);
          }
        } else {
          // Old format: "食材名 數量 單位"
          const parsed = parseIngredientEntry(il);
          if (parsed) ingredients.push(parsed);
        }
      }
    }

    let filteredIngredients = ingredients.filter((ing) => !isPlaceholderIngredientName(ing.name));

    // Extract steps
    const steps: string[] = [];
    let stepSection = text.match(/(?:🍳\s*)?(?:步驟|做法|Steps?|烹方法|烹调方法)[：:]\s*([\s\S]*?)$/i);
    if (!stepSection) {
      // Fallback: look for numbered steps anywhere
      const numberedSteps = text.match(/(?:^|\n)\s*(?:[0-9]+[、.．)\s]|[一二三四五六七八九十]+[、．)\s])\s*(.+?)(?=\n|$)/g);
      if (numberedSteps) {
        steps.push(...numberedSteps.map(s => s.trim().replace(/^\s*(?:[0-9]+[、.．)\s]|[一二三四五六七八九十]+[、．)\s])\s*/, "")));
      }
    } else {
      const stepLines = stepSection[1].split("\n");
      for (const stepLine of stepLines) {
        let sl = stepLine.replace(/^[-–—*•·]\s*/, "").trim();
        if (!sl) continue;
        // Handle format: "1. 步驟標題（第 X-Y 分鐘）：詳細動作"
        const stepMatch = sl.match(/^([0-9]+)[、.．\s)]*\s*(.+?)(?:\n|$)/);
        if (stepMatch) {
          const stepContent = stepMatch[2].trim();
          if (stepContent) {
            // Preserve the full step with time range
            steps.push(stepContent);
          }
        }
      }
    }

    filteredIngredients = inferSoupWaterIngredient(recipeCategory, filteredIngredients, description, steps);
    const tags = buildRecipeTags(name, recipeCategory, difficulty, cookTime, description, filteredIngredients.length);

    return {
      name, description, cookTime, servings, difficulty, recipeCategory,
      ingredients: filteredIngredients, steps, tags,
    };
  };

  const recordSeenRecipes = (recipes: AIRecipe[]) => {
    if (!recipes || recipes.length === 0) return;
    setSessionSeenRecipeNames(prev => {
      const seen = new Set(prev);
      let changed = false;
      for (const r of recipes) {
        const n = (r.name || "").trim();
        if (n && !seen.has(n)) { seen.add(n); changed = true; }
      }
      return changed ? [...seen] : prev;
    });
  };

  // 將推薦嘅食譜名 list 出嚟（「記菜名」）：令用戶喺 chat 文字見到推薦咗咩，可以碌返/打名搵返食譜
  const recipeNameList = (recipes: AIRecipe[] | undefined | null): string => {
    if (!recipes || recipes.length === 0) return "";
    return "\n" + recipes.map((r, i) => `${i + 1}. ${getBilingualName(r.name, r.nameEn, r.nameFil, r.nameId).primary}`).join("\n");
  };

  const usageUtils = trpc.useUtils();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<
    "kol_plan" | "recipe_limit" | "import_limit" | "generic"
  >("generic");
  const { data: sub } = trpc.family.subscription.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const { data: usage } = trpc.family.usage.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60,
  });
  const { data: chefStatus } = (trpc.aiRecipe as any).status.useQuery(undefined, {
    staleTime: 15_000,
  }) as { data?: { canGenerate?: boolean; reason?: string; mode?: string; credits?: { used?: number; limit?: number; resetAt?: string } } };
  const statusCredits = chefStatus?.credits;
  const aiUsed = statusCredits?.used ?? usage?.aiChat?.used ?? 0;
  const aiLimit = statusCredits?.limit ?? usage?.aiChat?.limit ?? 0;
  const aiPercent = aiLimit > 0 ? aiUsed / aiLimit : 0;
  const creditsExhausted = aiLimit > 0 && aiUsed >= aiLimit;
  // 免費升級 modal（Life360 式）：額度剩 ≤20% 時彈一次，7 日內唔重複
  const [upsellVisible, setUpsellVisible] = useState(false);
  const [upsellPriceLabel, setUpsellPriceLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!upsellVisible) return;
    let alive = true;
    if (!canPurchaseHere) {
      setUpsellPriceLabel(undefined);
      return;
    }
    void getProducts()
      .then((products) => {
        if (!alive) return;
        setUpsellPriceLabel(
          products.find((product) => product.productId === PRODUCT_IDS.MONTHLY)?.price
        );
      })
      .catch(() => {
        if (alive) setUpsellPriceLabel(undefined);
      });
    return () => {
      alive = false;
    };
  }, [upsellVisible]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const paidNow = sub?.status === "active" || (sub as any)?.isPaid === true;
        if (!user || paidNow || showPaywall || (sub as any)?.coveredBy) return;
        if (aiLimit <= 0 || aiPercent < 0.8) return;
        const familyKey = String((user as any)?.familyId ?? "default");
        const key = `kindcipe_upsell_shown_${familyKey}`;
        const last = await AsyncStorage.getItem(key);
        if (last && Date.now() - Number(last) < 7 * 24 * 60 * 60 * 1000) return;
        await AsyncStorage.setItem(key, String(Date.now()));
        if (!cancelled) setUpsellVisible(true);
      } catch { /* 唔阻流程 */ }
    })();
    return () => { cancelled = true; };
  }, [user, sub, showPaywall, aiLimit, aiPercent]);
  const aiReplyBlocked = contractAiBlocked || creditsExhausted || chefStatus?.canGenerate === false;
  const capBlocked = chefStatus?.reason === "internal_cap" || chefStatus?.reason === "free_ai_off";
  const safeMode = chefStatus?.reason === "safe_mode" || chefStatus?.mode === "library_only" || chefStatus?.mode === "disabled";
  const aiCanGenerate = chefStatus?.canGenerate ?? (aiLimit > 0 && aiUsed < aiLimit);
  const resetLabel = statusCredits?.resetAt
    ? new Date(statusCredits.resetAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })
    : "";
  const aiNearLimit = aiLimit > 0 && aiUsed / aiLimit >= 0.8;
  const hideUpgradePromo = sub?.status === "active";
  const chatMutation = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data, variables: any) => {
      const requestMeta = variables?.clientMessageId
        ? chatRequestMetaRef.current.get(variables.clientMessageId)
        : undefined;
      const historyMax = requestMeta?.historyMax;
      if (variables?.clientMessageId) chatRequestMetaRef.current.delete(variables.clientMessageId);
      delete pendingChatRequestRef.current[chatRequestFingerprint(variables ?? {})];
      if (requestMeta && requestMeta.generation !== chatGenerationRef.current) return;
      const targetSessionId = requestMeta?.sessionId ?? chatSessionIdRef.current;
      if (failedChatRequestRef.current?.clientMessageId === variables?.clientMessageId) {
        failedChatRequestRef.current = null;
      }
      setContractAiBlocked(isQuotaBlocked((data as any)?.quota));
      void usageUtils.family.usage.invalidate();
      void (usageUtils.aiRecipe as any).status.invalidate();
      const requestId = typeof (data as any)?.requestId === "string" ? (data as any).requestId as string : undefined;
      lastChefRequestIdRef.current = requestId ?? null;
      if ((data.recipes?.length ?? 0) > 0) track(Events.AiRecipeGenerated, { count: data.recipes!.length, requestId });
      const served = data.served ?? data.recipes?.length ?? 0;
      const requested = data.requested?.total ?? 0;
      track(Events.AiChefResult, {
        requestId,
        kind: data.intent?.kind ?? "unknown",
        requested,
        served,
        missing: Array.isArray(data.missingRoles) ? data.missingRoles.length : 0,
        library: data.sources?.library ?? 0,
        ai: data.sources?.ai ?? 0,
        resolved: requested === 0 ? true : served >= requested,
      });
      const contractStatus = (data as any)?.status;
      const contractReplies = filterQuickReplies((data as any)?.quickReplies);
      setContractQuickReplies(contractReplies);

      if (contractStatus === "no_cards" || contractStatus === "clarify") {
        setIncompleteContract(null);
        const templateText = typeof (data as any)?.replyText === "string" && (data as any).replyText.trim()
          ? (data as any).replyText
          : t(contractStatus === "clarify" ? "aiChef.contractClarify" : "aiChef.contractNoCards");
        updateMessagesFor(targetSessionId, prev => [...prev, { role: "assistant", content: templateText }]);
        setAiNextSteps([]);
        const keepExistingCards = (data as any)?.operation === "append" && recommendedRecipes.length > 0;
        if (!keepExistingCards) {
          setRecommendedRecipes([]);
          setMealResult(null);
        }
        setChatStarted(true);
        // 0 卡時一定要有出路：用戶可能唔知可以叫 AI 生成（扣 1 credit）。
        // 後端未必送 quickReplies（flag OFF 時冇），所以 app 自己補。
        if (contractStatus === "no_cards") {
          const alternatives = Array.isArray((data as any)?.alternatives) ? (data as any).alternatives : [];
          setContractQuickReplies([
            { actionId: "ai_generate", labelKey: "aiChef.aiGenerate" },
            ...(alternatives.length > 0 ? [{ actionId: "closest_library", labelKey: "aiChef.closestLibrary" }] : []),
            { actionId: "import_recipe", labelKey: "aiChef.importRecipe" },
          ] as any);
        }
        scrollToLatestMessage();
        return;
      }

      const { mainText, nextSteps } = parseAssistantResponse(data.content ?? "");

      // Direct use of recipes from backend（卡片防線：normalize + isValidRecipe 過濾，保證卡一定撳得）
      let recipes = (data.recipes || []).map(normalizeRecipe).filter(isValidRecipe);
      const isAppend = (data as any)?.operation === "append";

      // 記低今次睇過嘅菜式名 → 之後排除重複
      recordSeenRecipes(recipes);

      // 文字/卡片一致：若後端文字講「N 道」但實際卡數唔符（filter 後變少），用實際卡數重寫 intro，
      // 避免「文字講 2 道、卡片得 1 張」誤導用戶。
      const finalMainText = (() => {
        let t = mainText;
        const m = t.match(/([一二兩三四五六七八九十\d]+)\s*道(?:菜|餸)/);
        if (m && recipes.length > 0) {
          const stated = m[1];
          const actual = String(recipes.length);
          const cn: Record<string, string> = { 一: "1", 兩: "2", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10" };
          const statedNum = /^\d+$/.test(stated) ? stated : (cn[stated] ?? stated);
          if (statedNum !== actual) {
            t = t.replace(/([一二兩三四五六七八九十\d]+)\s*道(?:菜|餸)/, `${actual}道菜`);
          }
        }
        return t;
      })();

      // 「記菜名」：將推薦咗嘅菜名一齊寫入 assistant message，令用戶碌返見到 / 打名搵返
      const assistantText = `${finalMainText}${recipeNameList(recipes)}`.trim();
      if (assistantText) {
        updateMessagesFor(targetSessionId, prev => [...prev, { role: "assistant", content: assistantText }]);
      }
      setAiNextSteps(nextSteps);

      const mergedRecipes = isAppend
        ? mergeAppendedCards(recommendedRecipes, recipes)
        : recipes;
      setSwapNoCards(null);
      setRecommendedRecipes(mergedRecipes);
      commitCardHistory(mergedRecipes, {
        operation: isAppend ? "append" : undefined,
        max: historyMax,
      });

      // 0 卡時一定要有出路（實測「有冇蔥油餅食譜」後端 status=text, alternatives=3,
      // quickReplies 係空，用戶見到一段文字但冇掣）。
      if (mergedRecipes.length === 0 && !isAppend) {
        const alts = Array.isArray((data as any)?.alternatives) ? (data as any).alternatives : [];
        setContractQuickReplies([
          { actionId: "ai_generate", labelKey: "aiChef.aiGenerate" },
          ...(alts.length > 0 ? [{ actionId: "closest_library", labelKey: "aiChef.closestLibrary" }] : []),
          { actionId: "import_recipe", labelKey: "aiChef.importRecipe" },
        ] as any);
        if (alts.length > 0) setLibraryAlternatives(alts);
      }

      // 0 卡唔算 crash，但對用戶嚟講就係失敗 —— 要留低可以追嘅證據。
      if (mergedRecipes.length === 0 && !isAppend) {
        reportAiChefFailure("zero_cards", {
          requestId,
          mode: (variables as any)?.mode ?? "chat",
          clarifyReason: (data as any)?.clarifyReason ?? null,
          served,
          requested,
          library: (data as any)?.sources?.library ?? 0,
          ai: (data as any)?.sources?.ai ?? 0,
          lang: i18n.language,
        });
      }
      // 多過一張卡（3餸1湯 / 2送一湯 / 打字要求出多卡）都 set mealResult，
      // 令「全部加入排餐」button 顯示（唔再淨係靠 3餸1湯問卷流程嘅 isSoupModeRef）
      setMealResult(mergedRecipes.length >= 2 ? mergedRecipes : null);
      recordIncompleteContract(data, variables, mergedRecipes.length);
      setChatStarted(true);
      scrollToLatestMessage();
    },
    onError: (err: any, variables: any) => {
      const requestMeta = variables?.clientMessageId
        ? chatRequestMetaRef.current.get(variables.clientMessageId)
        : undefined;
      if (variables?.clientMessageId) chatRequestMetaRef.current.delete(variables.clientMessageId);
      if (requestMeta && requestMeta.generation !== chatGenerationRef.current) return;
      const targetSessionId = requestMeta?.sessionId ?? chatSessionIdRef.current;
      delete pendingChatRequestRef.current[chatRequestFingerprint(variables ?? {})];
      const failedClientMessageId = typeof variables?.clientMessageId === "string" ? variables.clientMessageId : "";
      if (failedClientMessageId) {
        failedChatRequestRef.current = {
          fingerprint: chatRequestFingerprint(variables),
          clientMessageId: failedClientMessageId,
        };
      }
      // 達到配額 → 彈 paywall。優先靠 error code（穩定），message regex 只作後備。
      const code = err?.data?.code ?? err?.shape?.data?.code;
      if (
        code === "FORBIDDEN" ||
        /用量上限|匯入上限|額度|quota|達到本月/i.test(String(err?.message ?? ""))
      ) {
        setShowPaywall(true);
      }
      const rawMsg = friendlyError(err) || err?.data?.message || "";
      const isTransient = /abort|timeout|cancel|JSON Parse error|Unexpected character|Parse error|非 JSON|LLM 回覆格式異常/i.test(rawMsg);
      const errorRequestId = typeof (err as any)?.data?.requestId === "string" ? (err as any).data.requestId as string : undefined;
      track(Events.AiChefError, {
        code: String(code ?? "unknown"),
        transient: isTransient,
        requestId: errorRequestId,
        clientMessageId: (variables as any)?.clientMessageId,
      });
      reportAiChefFailure("error", {
        requestId: errorRequestId,
        code: String(code ?? "unknown"),
        transient: isTransient,
        mode: (variables as any)?.mode ?? "chat",
        message: String(rawMsg).slice(0, 120),
      });
      const msg = isTransient
        ? t("AI 暫時未有回應，請再試一次。" as any)
        : (rawMsg || "AI 暫時未能回應，請再試。");
      updateMessagesFor(targetSessionId, prev => [...prev, { role: "assistant", content: t("dyn.sorry", { msg }) }]);
      setAiNextSteps([t("aiChef.contactSupport" as any)]);
      setContractQuickReplies([]);
      setIncompleteContract(null);
      setRecommendedRecipes([]);
      setMealResult(null);
      setChatStarted(true);
      scrollToLatestMessage();
    },
  });

  // 所有 chatMutation 經呢度出，記低「發送時」嘅 session，令共用 onSuccess/onError 寫返正確 session
  const mutateChat = (payload: any, options?: any, retryToken?: string, historyMax?: number) => {
    chatSessionIdRef.current = activeChatIdRef.current;
    setIncompleteContract(null);
    const requestBody = {
      avoidIngredients: mealDefaults.allergens,
      ...payload,
      ...(retryToken ? { retryToken } : {}),
    };
    const { fingerprint, clientMessageId, isRetry } = resolveClientMessageId(
      requestBody,
      failedChatRequestRef.current,
      pendingChatRequestRef.current,
    );
    chatRequestMetaRef.current.set(clientMessageId, {
      sessionId: chatSessionIdRef.current,
      generation: chatGenerationRef.current,
      ...(historyMax != null ? { historyMax } : {}),
    });
    pendingChatRequestRef.current[fingerprint] = clientMessageId;
    const pendingKeys = Object.keys(pendingChatRequestRef.current);
    if (pendingKeys.length > 20) {
      for (const key of pendingKeys.slice(0, pendingKeys.length - 20)) {
        delete pendingChatRequestRef.current[key];
      }
    }
    if (isRetry) failedChatRequestRef.current = null;
    setContractQuickReplies([]);
    chatMutation.mutate({ ...requestBody, clientMessageId }, options);
  };

  // 「再試一次」：用同一個 retryToken 重發同一 payload
  const retryIncomplete = () => {
    if (!incompleteContract || chatMutation.isPending) return;
    const { payload, retryToken } = incompleteContract;
    mutateChat(payload, undefined, retryToken);
    scrollToLatestMessage();
  };

  // Loading step animation
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLoadingSeconds] = useState(0);
  useEffect(() => {
    if (chatMutation.isPending) {
      setLoadingStep(0);
      setLoadingSeconds(0);
      loadingTimer.current = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
        setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2000);
    } else {
      if (loadingTimer.current) { clearInterval(loadingTimer.current); loadingTimer.current = null; }
      setLoadingSeconds(0);
    }
    return () => { if (loadingTimer.current) clearInterval(loadingTimer.current); };
  }, [chatMutation.isPending]);

  // ─── Load / Save sessions ──────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSIONS_KEY(user.id));
        let all: ChatSession[] = raw ? JSON.parse(raw) : [];

        all = all.map(session => ({
          ...session,
          messages: session.messages.map(msg => {
            if (typeof msg.content !== "string") return msg;
            const legacyText = msg.content;
            if (legacyText.includes("Kindcipe AI") || legacyText.includes("私人廚師") || legacyText.includes("香港家庭")) {
              return { ...msg, content: greetingReply };
            }
            return compactLegacyMealPrompt(msg);
          }),
        }));

        // Migrate old single-chat data to new multi-session format
        if (all.length === 0) {
          const oldChat = await AsyncStorage.getItem(OLD_CHAT_KEY(user.id));
          if (oldChat) {
            try {
              const oldMessages: Message[] = JSON.parse(oldChat);
              if (oldMessages.length > 0) {
                const migratedId = generateId();
                const title = makeSessionTitle(oldMessages);
                all = [{ id: migratedId, title, createdAt: Date.now(), messages: oldMessages }];
                await AsyncStorage.removeItem(OLD_CHAT_KEY(user.id));
              }
            } catch { /* ignore */ }
          }
        }

        // Cross-device: if the backend has cloud sessions, they win (they may
        // have been created/updated from the web app). Otherwise keep local and
        // upload local-only sessions once.
        await migrateLocalIfNeeded(all);

        // Load card history together with sessions so legacy (names-only) entries
        // can be upgraded from local session cards before any commit overwrites it.
        try {
          const rawHistory = await AsyncStorage.getItem(CARD_HISTORY_KEY(user.id));
          const stored = sanitizeCardHistory<AIRecipe>(rawHistory ? JSON.parse(rawHistory) : []);
          if (userIdRef.current !== user.id) {
            // Account changed while this read was in flight; don't leak history.
            historyReadyRef.current = true;
          } else {
            const upgraded = stored.map((entry) => {
              if (entry.cards && entry.cards.length > 0) return entry;
              const matched = matchCardsFromSessions(entry.names, all, isValidRecipe, entry.at);
              if (!matched) return entry;
              return { ...entry, cards: matched, version: 2, key: cardSetKey(matched) };
            });
            const pending = cardHistoryRef.current;
            const mergedByKey = new Map<string, CardHistoryEntry>();
            for (const entry of [...upgraded, ...pending].sort((a, b) => a.at - b.at)) {
              mergedByKey.set(entry.key, entry);
            }
            const merged = [...mergedByKey.values()]
              .sort((a, b) => b.at - a.at)
              .slice(0, MAX_CARD_HISTORY);
            historyReadyRef.current = true;
            persistCardHistory(merged);
          }
        } catch {
          historyReadyRef.current = true;
        }

        const activeId = await AsyncStorage.getItem(ACTIVE_KEY(user.id));
        setSessions(all);
        // 用 functional update：若 Hero 已搶先開咗新 session（prev 已有值），唔好被還原覆蓋。
        setActiveChatId(prev => prev || (activeId && all.find(s => s.id === activeId) ? activeId : (all[0]?.id ?? "")));
      } catch { /* ignore */ }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // If the cloud query was still loading during the local load above, retry the
  // one-shot migration once it resolves. The hook's migrateLocalIfNeeded is
  // idempotent, so a cached cloud response + this effect can't double-import.
  const migrationUserRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!loaded || !user?.id || cloudSessions === undefined) return;
    if (migrationUserRef.current === user.id) return;
    migrationUserRef.current = user.id;
    void migrateLocalIfNeeded(sessions);
  }, [loaded, user?.id, cloudSessions, sessions, migrateLocalIfNeeded]);

  // 持久化 session：現在 images 用 storage URL（僅 ~200 字元），因此保留 url 即可。
  // 僅為防舊資料或極端大 URL，超過 5000 字元時才清空。
  const MAX_PERSISTED_URL_LEN = 5000;
  const persistSessions = useCallback((next: ChatSession[], nextActive: string) => {
    if (!user?.id) return;
    const compact = next.map(s => ({
      ...s,
      messages: s.messages.map(m => {
        if (typeof m.content === "string") return { role: m.role, content: m.content };
        const compactContent = m.content.map(block => {
          if (block.type === "image_url") {
            const blockUrl = block.image_url?.url;
            const safeUrl = blockUrl && blockUrl.length <= MAX_PERSISTED_URL_LEN ? blockUrl : "";
            return { type: "image_url" as const, image_url: { url: safeUrl } };
          }
          return block;
        });
        return { role: m.role, content: compactContent };
      }),
    }));
    AsyncStorage.setItem(SESSIONS_KEY(user.id), JSON.stringify(compact)).catch(() => {});
    AsyncStorage.setItem(ACTIVE_KEY(user.id), nextActive).catch(() => {});
  }, [user?.id]);

  // ─── Update a session's messages ───────────────────────

  const updateMessages = useCallback((fn: (prev: Message[]) => Message[]) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === activeChatId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], messages: fn(prev[idx].messages) };
      const next = [...prev]; next[idx] = updated;
      return next;
    });
  }, [activeChatId]);

  // Persist when sessions change (after loaded)
  useEffect(() => {
    if (!loaded || !user?.id || !activeChatId) return;
    persistSessions(sessions, activeChatId);
  }, [sessions, loaded, user?.id, activeChatId, persistSessions]);

  // Hydrate cards when the active chat changes, local cache finishes loading, or a
  // session arrives late. The early return on cardsReadyChatId is essential: the
  // persist-card effect writes cards back into `sessions`; hydrating on every sessions
  // change caused a hydrate ↔ persist feedback loop (A→B→A…).
  useEffect(() => {
    if (!loaded || !activeChatId) return;
    if (cardsReadyChatId === activeChatId) return;
    const session = sessions.find(s => s.id === activeChatId);
    if (!session) return;
    const cards = session.cards ?? EMPTY_RECIPE_LIST;
    const storedMeal = session.mealResult;
    setRecommendedRecipes(cards);
    setMealResult(
      Array.isArray(storedMeal) && storedMeal.length >= 2 && storedMeal.length === cards.length
        ? storedMeal
        : null,
    );
    // Mark cards ready only after hydration is scheduled. The persist effect below
    // skips the same commit, so it can't write the previous chat's cards into this one.
    setCardsReadyChatId(activeChatId);
  }, [activeChatId, loaded, cardsReadyChatId, sessions]);

  // Persist the active session's cards locally (cloud still syncs messages only).
  useEffect(() => {
    if (!loaded || !activeChatId) return;
    if (cardsReadyChatId !== activeChatId) return;
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === activeChatId);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (current.cards === recommendedRecipes && current.mealResult === mealResult) return prev;
      const next = [...prev];
      next[idx] = { ...current, cards: recommendedRecipes, mealResult };
      return next;
    });
  }, [recommendedRecipes, mealResult, activeChatId, loaded, cardsReadyChatId]);

  // ─── Cross-device hydration ─────────────────────────────
  // When cloud sessions arrive (or after a refetch triggered by App↔Web switch),
  // merge them in. Cloud is authoritative for sessions it knows about; local-only
  // sessions are preserved (and uploaded by migrateLocalIfNeeded).
  const cloudHydratedRef = useRef(false);
  // State twin of the ref: the debounced sync effect must run again when the
  // cloud load RESOLVES (even to []), otherwise a fresh account never uploads
  // its first locally-written message.
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const cloudSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCloudSyncRef = useRef<{
    id: string;
    title: string;
    createdAt: number;
    messages: Message[];
  } | null>(null);
  useEffect(() => {
    cloudHydratedRef.current = false;
    setCloudSyncReady(false);
    // Never carry one account's unsent session into another account.
    if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
    cloudSyncTimer.current = null;
    pendingCloudSyncRef.current = null;
  }, [user?.id]);
  useEffect(() => {
    if (!loaded || !user?.id || cloudSessions === undefined) return;
    if (cloudSessions.length === 0) {
      cloudHydratedRef.current = true;
      setCloudSyncReady(true);
      return;
    }
    // Skip the very first hydration if local already had sessions with content,
    // to avoid clobbering active in-flight edits. Afterwards always refresh.
    setSessions(prev => {
      const byId = new Map(prev.map(s => [s.id, s]));
      for (const cloud of cloudSessions) {
        const local = byId.get(cloud.id);
        // Prefer whichever has more messages (handles a message sent offline).
        if (!local || cloud.messages.length >= local.messages.length) {
          byId.set(cloud.id, {
            id: cloud.id,
            title: cloud.title,
            createdAt: cloud.createdAt,
            messages: cloud.messages.map(compactLegacyMealPrompt),
            cards: local?.cards,
            mealResult: local?.mealResult,
          });
        }
      }
      const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
      return merged;
    });
    cloudHydratedRef.current = true;
    setCloudSyncReady(true);
  }, [cloudSessions, loaded, user?.id]);

  // Push a session to the cloud whenever its messages change (debounced).
  const flushPendingCloudSync = useCallback(() => {
    if (cloudSyncTimer.current) {
      clearTimeout(cloudSyncTimer.current);
      cloudSyncTimer.current = null;
    }
    const pending = pendingCloudSyncRef.current;
    pendingCloudSyncRef.current = null;
    if (pending) syncSessionToCloud(pending);
  }, [syncSessionToCloud]);

  // Keep the latest flusher without re-running the unmount cleanup when the
  // mutation object identity changes.
  const flushCloudSyncRef = useRef(flushPendingCloudSync);
  useEffect(() => {
    flushCloudSyncRef.current = flushPendingCloudSync;
  }, [flushPendingCloudSync]);
  useEffect(() => () => { flushCloudSyncRef.current(); }, []);

  useEffect(() => {
    if (!loaded || !user?.id || !cloudHydratedRef.current || !cloudSyncReady) return;
    const session = sessions.find(s => s.id === activeChatId);
    const pending = pendingCloudSyncRef.current;

    // Switching conversation before the 800ms debounce must not drop the last
    // message: flush the previous session immediately.
    if (pending && pending.id !== session?.id) flushPendingCloudSync();

    // Only sync sessions that actually have content.
    if (!session || session.messages.length === 0) {
      if (cloudSyncTimer.current) {
        clearTimeout(cloudSyncTimer.current);
        cloudSyncTimer.current = null;
      }
      if (pendingCloudSyncRef.current?.id === session?.id) pendingCloudSyncRef.current = null;
      return;
    }

    // Loop guard: every upsert invalidates the cloud list, which replaces
    // `sessions`/`cloudSessions` with new identities. If the cloud already has
    // exactly this content there is nothing to push, otherwise we'd sync forever.
    const cloud = (cloudSessions ?? []).find(c => c.id === session.id);
    // Compare against exactly what hydration would write locally (legacy prompts
    // are compacted), otherwise an old session would look different forever.
    const cloudSignature = cloud
      ? chatSessionSignature({ ...cloud, messages: cloud.messages.map(compactLegacyMealPrompt) })
      : null;
    if (cloud && cloudSignature === chatSessionSignature(session)) {
      if (pendingCloudSyncRef.current?.id === session.id) {
        if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
        cloudSyncTimer.current = null;
        pendingCloudSyncRef.current = null;
      }
      return;
    }

    if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
    const payload = {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      messages: session.messages,
    };
    pendingCloudSyncRef.current = payload;
    cloudSyncTimer.current = setTimeout(() => {
      cloudSyncTimer.current = null;
      pendingCloudSyncRef.current = null;
      syncSessionToCloud(payload);
    }, 800);
  }, [sessions, activeChatId, cloudSessions, loaded, user?.id, syncSessionToCloud, cloudSyncReady, flushPendingCloudSync]);

  // Auto-title: when first user message is sent, update the title
  useEffect(() => {
    if (!activeSession || !loaded) return;
    if (activeSession.title !== t("新對話" as any)) return;
    const firstUser = activeSession.messages.find(m => m.role === "user");
    if (!firstUser) return;
    const title = makeSessionTitle(activeSession.messages);
    if (title === t("新對話" as any)) return;
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === activeChatId);
      if (idx === -1) return prev;
      const next = [...prev]; next[idx] = { ...next[idx], title };
      return next;
    });
  }, [activeSession, activeChatId, loaded, t]);

  // ─── Chat actions ──────────────────────────────────────

  const handleNewChat = () => {
    chatGenerationRef.current += 1;
    visionContextRef.current = null;
    pendingAutoStartRef.current = null;
    setIsPreparingMeal(false);
    setRecommendedRecipes([]);
    setNextDayPrompt(null);
    setChatStarted(false);
    setSessionSeenRecipeNames([]);
    setSwappedRecipeNames(new Set());
    setSwapNoCards(null);
    clearSwapLock();
    isSoupModeRef.current = false;
    setMealResult(null);
    setMealStep("idle");
    setMealPrefs(EMPTY_PREFS);
    setAiNextSteps([]);
    setContractQuickReplies([]);
    setAskingIngredients(false);
    setShowSessions(false);

    const newId = generateId();
    const newSession: ChatSession = { id: newId, title: t("新對話" as any), createdAt: Date.now(), messages: [] };
    activeChatIdRef.current = newId;
    setSessions(prev => [newSession, ...prev]);
    setActiveChatId(newId);
    scrollToLatestMessage();
    return newId;
  };

  const handleSwitchChat = (id: string) => {
    if (id === activeChatId) { setShowSessions(false); return; }
    chatGenerationRef.current += 1;
    pendingAutoStartRef.current = null;
    setIsPreparingMeal(false);
    setRecommendedRecipes([]);
    setChatStarted(false);
    setSessionSeenRecipeNames([]);
    setSwappedRecipeNames(new Set());
    setSwapNoCards(null);
    clearSwapLock();
    isSoupModeRef.current = false;
    setMealResult(null);
    setMealStep("idle");
    setMealPrefs(EMPTY_PREFS);
    setAiNextSteps([]);
    setContractQuickReplies([]);
    setAskingIngredients(false);
    setShowSessions(false);
    setActiveChatId(id);
    scrollToLatestMessage();
  };

  const handleDeleteChat = (id: string) => {
    Alert.alert(t("刪除對話" as any), t("確定要刪除這個對話嗎？" as any), [
      { text: t("取消" as any), style: "cancel" },
      {
        text: t("刪除" as any), style: "destructive",
        onPress: async () => {
          // Delete in the cloud first: if it fails, keep the row (no optimistic delete).
          try {
            await removeSessionFromCloud(id);
          } catch {
            showToast(t("error.generic" as any), undefined, 3000, "error");
            return;
          }
          // Drop any pending debounced upsert for the now-deleted session.
          if (pendingCloudSyncRef.current?.id === id) {
            if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
            cloudSyncTimer.current = null;
            pendingCloudSyncRef.current = null;
          }
          const deletingActive = id === activeChatId;
          setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (next.length === 0) {
              const newId = generateId();
              const fallback: ChatSession = { id: newId, title: t("新對話" as any), createdAt: Date.now(), messages: [] };
              setActiveChatId(newId);
              return [fallback];
            }
            if (id === activeChatId) setActiveChatId(next[0].id);
            return next;
          });
          // 刪嘅係當前對話 → 清走所有依附舊對話嘅 UI 狀態，避免殘留卡／狀態
          if (deletingActive) {
            setRecommendedRecipes([]);
            setChatStarted(false);
            setSessionSeenRecipeNames([]);
            setSwappedRecipeNames(new Set());
            setSwapNoCards(null);
            setMealResult(null);
            setMealStep("idle");
            setMealPrefs(EMPTY_PREFS);
            setAiNextSteps([]);
            setAskingIngredients(false);
            setExpandedCard(null);
            isSoupModeRef.current = false;
          }
        },
      },
    ]);
  };

  const handleClearAllChats = () => {
    Alert.alert(
      t("aiChef.clearAllChatsTitle" as any),
      t("aiChef.clearAllChatsBody" as any),
      [
        { text: t("取消" as any), style: "cancel" },
        {
          text: t("清除" as any),
          style: "destructive",
          onPress: async () => {
            // 雲端同本機一齊清；伺服器只會刪 caller 自己嘅 rows。
            // 清雲端失敗 → 保留本機紀錄並提示，唔好扮成功。
            try {
              await clearAllSessionsFromCloud();
            } catch {
              showToast(t("error.generic" as any), undefined, 3000, "error");
              return;
            }
            if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
            cloudSyncTimer.current = null;
            pendingCloudSyncRef.current = null;
            // Invalidate any in-flight chat response so it cannot restore cards/history.
            chatGenerationRef.current += 1;
            const uid = user?.id;
            if (uid) {
              await AsyncStorage.removeItem(CARD_HISTORY_KEY(uid));
              await AsyncStorage.removeItem(OLD_CHAT_KEY(uid));
              await AsyncStorage.removeItem(SESSIONS_KEY(uid));
              await AsyncStorage.removeItem(ACTIVE_KEY(uid));
            }
            const newId = generateId();
            const fresh: ChatSession = { id: newId, title: t("新對話" as any), createdAt: Date.now(), messages: [] };
            cardHistoryRef.current = [];
            historyReadyRef.current = true;
            setCardHistory([]);
            setShowCardHistory(false);
            setRestoringCards(false);
            setSessions([fresh]);
            setActiveChatId(newId);
            activeChatIdRef.current = newId;
            setCardsReadyChatId(null);
            setSessionSearch("");
            setRecommendedRecipes([]);
            setChatStarted(false);
            setSessionSeenRecipeNames([]);
            setSwappedRecipeNames(new Set());
            setSwapNoCards(null);
            setMealResult(null);
            setMealStep("idle");
            setMealPrefs(EMPTY_PREFS);
            setAiNextSteps([]);
            setAskingIngredients(false);
            setExpandedCard(null);
            setContractQuickReplies([]);
            isSoupModeRef.current = false;
          },
        },
      ],
    );
  };

  // 記住當前是否處於 3 餸 1 湯模式
  const isSoupModeRef = useRef(false);
  // 記住最近撳嘅 hotkey（快手/清淡/電飯煲/小朋友/宴客）—— source 掣跟返場景；打字或撳其他掣就清空
  const activeHotKeyRef = useRef<string | null>(null);
  const aiGeneratePendingRef = useRef(false);

  // ─── Keyboard ──────────────────────────────────────────

  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ─── Plan modal ────────────────────────────────────────

  const [showPlan, setShowPlan] = useState(false);
  // 排餐後確認購物清單（原設計）：單張同批量都直接開 IngredientPickerModal，
  // 由用戶揀材料／買餸日，或者跳過。買餸日可以同排餐日唔同日。
  const [shopConfirm, setShopConfirm] = useState<{
    recipes: any[];
    planIds?: (number | undefined)[];
    planDate: string;
    shopDate: string;
  } | null>(null);
  const shopConfirmHandoff = useModalHandoff<{
    recipes: any[];
    planIds?: (number | undefined)[];
    planDate: string;
    shopDate: string;
  }>(600);
  // 原設計：確認食材後問「去購物清單？」（加完先顯示，唔會靜靜跳走）
  const [shoppingConfirmCount, setShoppingConfirmCount] = useState<number | null>(null);
  const [mealConflict, setMealConflict] = useState<{ date: string; names: string[]; hint?: string } | null>(null);
  const [mealLimit, setMealLimit] = useState<{ date: string; existingCount: number; newCount: number; canReplace: boolean } | null>(null);
  const conflictProceedRef = useRef<((mode: "replace" | "add") => void) | null>(null);
  const [planRecipe, setPlanRecipe] = useState<AIRecipe | null>(null);
  const preferredPlanDateRef = useRef<string | null>(null);
  const lastPlannedDateRef = useRef<string | null>(null);
  // 同步 planRecipe，避免 onSuccess 閉包讀到舊值（尤其係 ensureSaved 後帶住 user_<id> 去購物清單）
  const planRecipeRef = useRef<AIRecipe | null>(null);
  // Confirm 時鎖定真正提交嘅食譜；避免 onSuccess 時 planRecipeRef 已被另一張卡覆蓋。
  const pendingSinglePlanRecipeRef = useRef<AIRecipe | null>(null);
  const singleAddBusyRef = useRef(false);
  useEffect(() => {
    planRecipeRef.current = planRecipe;
  }, [planRecipe]);
  // 防 onConfirm 喺 resolveShoppingRef await 期間重複提交
  const shopConfirmLockRef = useRef(false);
  const [batchPlanBusy, setBatchPlanBusy] = useState(false);
  const [batchRecipes, setBatchRecipes] = useState<AIRecipe[] | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(todayISO());
  // 上次排餐日期（用戶排「聽日」之後再排，唔應該又跳返今日）
  useEffect(() => {
    let alive = true;
    void (async () => {
      const last = await getLastPlanDate();
      if (!alive || !last) return;
      setPlanDate((cur) => (cur === todayISO() ? last : cur));
    })();
    return () => { alive = false; };
  }, []);
  const [planMeal, setPlanMeal] = useState("dinner");
  const lastChatModeRef = useRef<"library" | "ai" | "chat" | "question" | "">("");
  const noveltyRetryRef = useRef(false);
  const failedChatRequestRef = useRef<{ fingerprint: string; clientMessageId: string } | null>(null);
  // fingerprint → 進行中 request 嘅 clientMessageId（double-tap 重用同一個 id，讓 backend dedupe）
  const pendingChatRequestRef = useRef<Record<string, string>>({});

  const utils = trpc.useUtils();
  const invalidateMealPlanAndCart = useInvalidateMealPlanAndCart();
  const invalidateRecipesAndWeekly = useInvalidateRecipesAndWeekly();
  const saveRecipeM = trpc.recipes.importUser.useMutation({
    onSuccess: async () => {
      await Promise.all([
        invalidateRecipesAndWeekly(),
        invalidateMealPlanAndCart(),
        utils.family.usage.invalidate(),
      ]);
    },
  });
  // A3: 去重 —— 同 session 記住已 save 過嘅 id；跨 session 要同名 + 同食材簽名先歸一
  const savedRecipeIdsRef = useRef<Map<string, number>>(new Map());
  const ensureSaved = async (
    recipe: AIRecipe,
    overrideServings?: number | null,
    scaledIngredients?: AIRecipe["ingredients"]
  ): Promise<number> => {
    const key = (recipe.name || "").trim();
    if (key) {
      const cached = savedRecipeIdsRef.current.get(key);
      if (cached) return cached;
      try {
        // 用已 cache 嘅食譜庫資料去重，唔使每次重新 fetch（快好多）
        // 同名但食材唔同 = 另一道菜，唔可以重用舊 id
        const signature = ingredientsSignature(
          (scaledIngredients ?? recipe.ingredients ?? []).map((ing) => String(ing?.name ?? ""))
        );
        const hit = (userRecipes ?? []).find((c: any) => {
          if (!c.name || c.name.trim() !== key) return false;
          const hitSignature = ingredientsSignature(
            (Array.isArray(c.ingredients) ? c.ingredients : []).map((ing: any) => String(ing?.name ?? ""))
          );
          return hitSignature === signature;
        });
        if (hit && hit.id) {
          savedRecipeIdsRef.current.set(key, hit.id);
          return hit.id;
        }
      } catch { /* 庫查詢失敗就照儲 */ }
    }
    const saved = await saveRecipeM.mutateAsync({
      name: recipe.name, description: recipe.description,
      cookTime: recipe.cookTime, servings: overrideServings ?? recipe.servings,
      difficulty: recipe.difficulty || "中等",
      image: "", thumbnailUrl: "",
      recipeCategory: recipe.recipeCategory || "其他",
      dishType: getDishType(recipe),
      // AI 生成嘅食譜已帶翻譯，傳埋去後端 skip LLM translate（快好多）
      nameEn: recipe.nameEn, nameFil: recipe.nameFil, nameId: recipe.nameId,
      stepsEn: recipe.stepsEn, stepsFil: recipe.stepsFil, stepsId: recipe.stepsId,
      // 後端 library 卡嘅 source 係 "library"（唔係 official/custom），
      // 所以之前連食譜庫卡都會被加上「AI 生成」標籤，同上面「食譜庫 1 · AI 0」矛盾。
      tags: recipe.source === "official" || recipe.source === "custom" || recipe.source === "library"
        ? (recipe.tags ?? [])
        : [...(recipe.tags ?? []), "AI 生成"],
      isAiGenerated: recipe.source === "ai" || !recipe.source,
      ingredients: (scaledIngredients ?? recipe.ingredients)
        .map(ing => normalizeIngredient(ing))
        .filter((ing): ing is { name: string; quantity: string; unit: string } => !!ing)
        .map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name) })),
      steps: (recipe.steps ?? []).map(s => ({ instruction: normalizeStep(s), duration: parseStepDuration(s) })),
    });
    if (key) savedRecipeIdsRef.current.set(key, saved.id);
    return saved.id;
  };
  const addPlanM = trpc.mealPlan.add.useMutation({
    onSuccess: async (result, variables) => {
      lastPlannedDateRef.current = variables.date;
      void rememberPlanDate(variables.date);
      const mealTypeLabel = enumT.meal(variables.mealType === "breakfast" ? "早餐" : variables.mealType === "lunch" ? "午餐" : variables.mealType === "dinner" ? "晚餐" : "小食");
      const hasConflict = !!(result.warning && result.hasConflict);
      const plannedRecipe = pendingSinglePlanRecipeRef.current ?? planRecipeRef.current ?? planRecipe;
      pendingSinglePlanRecipeRef.current = null;
      singleAddBusyRef.current = false;
      if (plannedRecipe) {
        // 原設計：排餐成功後直接開食材選擇 modal（即使冇食材都俾用戶揀跳過），
        // 唔再經 Alert，亦唔會靜靜自動加購物清單。
        shopConfirmHandoff.queue({
          recipes: [plannedRecipe],
          planIds: [result.newPlanId],
          planDate: variables.date,
          shopDate: getDayBefore(variables.date),
        }, setShopConfirm);
      } else {
        showToast(t("✅ 已加入排餐（{{date}} {{label}}）" as any, { date: formatDateLabel(variables.date), label: mealTypeLabel }));
      }
      setShowPlan(false);
      track(Events.AiPlanAdded, {
        requestId: lastChefRequestIdRef.current ?? undefined,
        recipeId: variables.recipeId,
        count: 1,
        conflict: hasConflict,
      });
      void invalidateMealPlanAndCart();
    },
    onError: (e) => {
      pendingSinglePlanRecipeRef.current = null;
      singleAddBusyRef.current = false;
      if (showLimitError(e)) return;
      Alert.alert(t("加入排餐失敗" as any), friendlyError(e));
    },
  });
  const getRecipeImage = (recipe: AIRecipe | { image?: string; thumbnailUrl?: string }) => recipe.thumbnailUrl || recipe.image || undefined;
  const addPlanBatchM = trpc.mealPlan.addBatch.useMutation({
    onSuccess: async () => {
      try {
        await invalidateMealPlanAndCart();
      } catch (e) {
        console.error("[AI 助手] Batch meal plan invalidate failed:", e);
        showToast("⚠️ 已批量加入排餐，但列表可能需要手動刷新");
      }
    },
    onError: (e) => Alert.alert(t("批量加入排餐失敗" as any), friendlyError(e)),
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: async (_result: any, variables: any) => {
      setShowPlan(false);
      const plannedDate = typeof variables?.plannedDate === "string" ? variables.plannedDate : undefined;
      if (plannedDate) {
        utils.shopping.list.setData(undefined, (old: any[]) =>
          applyPlannedDateToCachedItems(old, (variables.items ?? []).map((i: any) => i.name), plannedDate)
        );
      }
      void invalidateMealPlanAndCart();
    },
  });

  const scrollToEnd = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const scrollToLatestMessage = () => {
    setTimeout(() => {
      if (flatListRef.current) flatListRef.current.scrollToEnd({ animated: true });
    }, 100);
    setTimeout(() => {
      if (flatListRef.current) flatListRef.current.scrollToEnd({ animated: false });
    }, 350);
  };

  // ─── Camera / Gallery ──────────────────────────────────

  const clearPhotoTimers = () => {
    if (photoSlowTimerRef.current) { clearTimeout(photoSlowTimerRef.current); photoSlowTimerRef.current = null; }
    if (photoTimeoutTimerRef.current) { clearTimeout(photoTimeoutTimerRef.current); photoTimeoutTimerRef.current = null; }
  };

  const cancelPhotoFlow = () => {
    photoRunRef.current += 1;
    clearPhotoTimers();
    uploadingRef.current = false;
    setLibraryLoading(false);
    setPhotoFlowStatus(null);
  };

  const runPhotoFlow = async (asset: { uri: string; mimeType?: string }) => {
    lastPhotoAssetRef.current = { uri: asset.uri, mimeType: asset.mimeType };
    const imageCount = messages.filter(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "image_url")
    ).length;
    if (imageCount >= MAX_IMAGES_PER_SESSION) {
      showToast(t("本次對話已達 {{n}} 張圖上限，請開始新對話" as any, { n: MAX_IMAGES_PER_SESSION }));
      return;
    }
    if (uploadingRef.current) {
      showToast(t("圖片處理中，請稍等" as any));
      return;
    }
    const runId = ++photoRunRef.current;
    clearPhotoTimers();
    uploadingRef.current = true;
    setLibraryLoading(true);
    setRecommendedRecipes([]);
    setMealResult(null);
    setContractQuickReplies([]);
    setPhotoFlowStatus({ stage: "uploading", slow: false, retryUri: asset.uri, retryMimeType: asset.mimeType });
    photoSlowTimerRef.current = setTimeout(() => {
      if (runId !== photoRunRef.current) return;
      setPhotoFlowStatus((prev) => prev && prev.stage !== "error" ? { ...prev, slow: true } : prev);
    }, 8000);
    const timeoutPromise = new Promise<never>((_, reject) => {
      photoTimeoutTimerRef.current = setTimeout(() => reject(new Error("photo_timeout")), 30_000);
    });

    try {
      const photo = await Promise.race([
        processPhoto(apiClient, {
          uri: asset.uri,
          mimeType: asset.mimeType,
          lang: i18n.language,
          compress: Platform.OS === "web" ? compressImageForWeb : compressImage,
          normalizeCards: (cards) => cards.map(normalizeRecipe).filter(isValidRecipe),
          onProgress: (phase) => {
            if (runId !== photoRunRef.current) return;
            setPhotoFlowStatus((prev) => prev && prev.stage !== "error" ? { ...prev, stage: phase } : prev);
          },
        }),
        timeoutPromise,
      ]);
      if (runId !== photoRunRef.current) return;
      clearPhotoTimers();
      uploadingRef.current = false;
      setLibraryLoading(false);
      setPhotoFlowStatus(null);
      const imageSessionId = handleNewChat();
      setChatStarted(true);
      const imageMsg: Message = {
        role: "user",
        content: [
          { type: "text", text: t("呢張相入面有咩食材？" as any) },
          { type: "image_url", image_url: { url: photo.imageUrl } },
        ],
      };

      const outcome = photo.outcome;
      if (outcome.kind === "failed") {
        updateMessagesFor(imageSessionId, prev => [...prev, imageMsg, {
          role: "assistant",
          content: t(outcome.messageKey as any),
        }]);
        setLibraryLoading(false);
        scrollToEnd();
        return;
      }
      visionContextRef.current = outcome.kind === "ai"
        ? { ...outcome.analysis, imageKey: outcome.imageKey }
        : null;
      updateMessagesFor(imageSessionId, prev => [...prev, imageMsg, {
        role: "assistant",
        content: t(outcome.messageKey as any, outcome.vars as any),
      }]);
      if (outcome.kind === "cards") {
        setSwapNoCards(null);
        setRecommendedRecipes(outcome.cards);
        commitCardHistory(outcome.cards);
        setMealResult(null);
        setChatStarted(true);
        recordSeenRecipes(outcome.cards);
        setContractQuickReplies([]);
      } else if (outcome.kind === "ai") {
        setContractQuickReplies(outcome.quickReplies as any);
      }
      scrollToEnd();
    } catch (e: any) {
      if (runId !== photoRunRef.current) return;
      photoRunRef.current += 1;
      clearPhotoTimers();
      uploadingRef.current = false;
      setLibraryLoading(false);
      if (isPhotoLimitError(e)) {
        setPhotoFlowStatus(null);
        const imageSessionId = handleNewChat();
        setChatStarted(true);
        updateMessagesFor(imageSessionId, () => [{
          role: "assistant",
          content: t("aiChef.photoAnalyzeLimit" as any),
        }]);
        setContractQuickReplies([{ actionId: "text_ingredients", labelKey: "aiChef.useTextIngredients" }]);
        scrollToEnd();
        return;
      }
      const message = String(e?.message ?? "") === "photo_timeout"
        ? t("aiChef.photoTimeout" as any)
        : (friendlyError(e) || t("請再試一次" as any));
      setPhotoFlowStatus({ stage: "error", message, retryUri: asset.uri, retryMimeType: asset.mimeType });
    }
  };

  const handleCamera = () => {
    const options = Platform.OS === "ios"
      ? ["拍照", "從相簿選擇", "取消"]
      : ["拍照", "從相簿選擇"];

    const onSelect = async (idx: number) => {
      if (idx === 2 || (Platform.OS === "android" && idx >= 2)) return;
      await onSelectImage(idx);
    };

    const onSelectImage = async (idx: number) => {
      let result: ImagePicker.ImagePickerResult;
      if (Platform.OS === "web") {
        const picked = await pickWebImageFile();
        if (!picked) {
          showToast(t("未選擇圖片" as any));
          return;
        }
        result = { canceled: false, assets: [picked] } as any;
      } else if (idx === 0) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("需要相機權限" as any));
          return;
        }
        try {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"], quality: 0.8, base64: false,
          });
        } catch (e: any) {
          console.error("[AI 助手] Camera launch failed:", e);
          Alert.alert(
            t("相機無法使用" as any),
            t("此裝置（例如 iOS 模擬器）冇可用相機。\n\n請用真機測試，或改用「從相簿選擇」。" as any)
          );
          return;
        }
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"], quality: 0.8, base64: false,
        });
      }

      if (result.canceled || !result.assets?.[0]) {
        showToast(t("未選擇圖片" as any));
        return;
      }
      await runPhotoFlow({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
    };

    if (Platform.OS === "web") {
      void onSelectImage(1);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, onSelect);
    } else {
      Alert.alert(t("上傳雪櫃圖片" as any), t("選擇來源" as any), [
        { text: t("拍照" as any), onPress: () => onSelect(0) },
        { text: t("從相簿選擇" as any), onPress: () => onSelect(1) },
        { text: t("取消" as any), style: "cancel" },
      ]);
    }
  };

  // ─── Chat send helper ───────────────────────────────────

  type AiEntry = "ai_tab" | "quick_reply" | "toast_fallback" | "ai_fallback" | "swap_ai" | "meal_ai" | `tab_${"quick" | "healthy" | "ricecooker" | "kids" | "guest"}`;

  const sendChat = (msgs: BackendMessage[], sourceMode?: "library" | "ai" | "chat" | "question", operation?: "append") => {
    // 用戶撳過「AI 助手設計食譜」→ 下一句一定行 LLM 生成，唔好行食譜庫。
    const forcedAi = sourceMode === undefined && aiGeneratePendingRef.current;
    if (forcedAi) aiGeneratePendingRef.current = false;
    const effectiveMode = sourceMode ?? (forcedAi ? "ai" : "chat");
    lastChatModeRef.current = effectiveMode;
    noveltyRetryRef.current = false;
    mutateChat({
      messages: msgs,
      mode: effectiveMode,
      ...(effectiveMode === "ai" ? { aiEntry: "ai_tab" as AiEntry } : {}),
      excludeNames: sessionSeenRecipeNames,
      lang: i18n.language,
      ...(operation ? { operation } : {}),
    });
  };

  const resolveShoppingRef = async (r: AIRecipe): Promise<string | null> => {
    // 已經揹住真 ref（official_<id> / user_<id>）→ 直接用
    const ref = resolveRecipeRef(r);
    if (ref.isLibraryRef && ref.recipeId) return ref.recipeId;
    // 否則 ensureSaved：佢本身會按名查庫重用，搵唔到先建立 —— 保證一定有 user_<id> 撳得開
    try {
      const id = await ensureSaved(r);
      const numeric = Number(id);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        track(Events.AiShoppingRefMissing, { recipeName: r.name, reason: "invalid_saved_id" });
        return null;
      }
      return `user_${numeric}`;
    } catch (e) {
      showLimitError(e);
      track(Events.AiShoppingRefMissing, { recipeName: r.name, reason: "ensure_saved_failed" });
      return null;
    }
  };

  const requestInstantRecipes = (source: "library" | "ai", aiEntry?: AiEntry) => {
    if (chatMutation.isPending) return;
    if (source === "ai" && !aiCanGenerate) {
      setShowPaywall(true);
      return;
    }
    // 判斷是否 3餸1湯場景（問卷進行中 或 已出過 4 卡）—— 係就出 4 個，唔係就一般 1 個
    // 只有 3餸1湯（daily）先有問卷；其他 hotkey 已經直接生成（唔經問卷）
    const inMealContext = isSoupModeRef.current || isMealAnswering || (mealResult && mealResult.length > 0) || mealStep === "result";
    if (!inMealContext) {
      isSoupModeRef.current = false;
      setMealStep("idle");
      setMealResult(null);
    } else {
      // 3餸1湯場景：確保 soup mode 保留，跳過問卷直接生成
      isSoupModeRef.current = true;
      setMealStep("result");
    }
    resetAiNextSteps();
    setSwappedRecipeNames(new Set());
    setSwapNoCards(null);
    setRecommendedRecipes([]);
    const activeConfig = activeHotKeyRef.current ? HOT_KEY_CONFIG[activeHotKeyRef.current] : null;
    // 自由對答：用「用戶最後一句」做 prompt，等後端按最新要求決定出幾多張（唔再硬code 4 卡）。
    // 例如用戶打完「只要兩個餸」再撳「食譜庫/AI生成」→ 出 2 卡。
    const lastUserText = [...messages].reverse().find(m => m.role === "user");
    const lastUserContent = lastUserText && typeof lastUserText.content === "string" ? lastUserText.content.trim() : "";
    // 判斷一餐結構（X餸Y湯/多卡）＋ 口味 constraint；兩者都要保留，唔好被蓋過
    const mealIntent = detectMealIntent(lastUserContent);
    const flavor = detectFlavorConstraint(lastUserContent);
    const isStructuredMealPrompt = !!mealIntent || /3\s*餸\s*1\s*湯|提供 4 個唔同嘅食譜/.test(lastUserContent);
    const promptPrefs = mealStep === "idle" ? buildMealPrefs() : mealPrefs;
    // 有結構化一餐意圖 → 直接用結構化 prompt（帶 count + 口味），確保出夠卡數同尊重 constraint
    // 3 餸 1 湯（或用戶指定嘅 X 餸 Y 湯）一定出齊 N 張：
    // 送「短意圖」而唔係長模板 —— 長模板會被後端當成指定菜單，只回 1 張。
    const mealCounts = mealIntent ?? { dishes: 3, soups: 1 };
    const userPrompt = isStructuredMealPrompt
      ? [
          promptPrefs.people ? `${promptPrefs.people} 人食。` : "",
          `${mealCounts.dishes} 餸 ${mealCounts.soups} 湯`,
          promptPrefs.allergens?.trim() ? `；避免：${promptPrefs.allergens}` : "",
          promptPrefs.dislikes?.trim() ? `；唔要：${promptPrefs.dislikes.trim()}` : "",
          promptPrefs.hasKids ? "；有小朋友" : "",
          promptPrefs.hasElderly ? "；有長者" : "",
          promptPrefs.time ? `；${promptPrefs.time}` : "",
          flavor?.spicy ? "；要辣" : "",
          flavor?.light ? "；要清淡" : "",
        ].join("")
      : lastUserContent.length >= 2
        ? lastUserContent
        : activeConfig
          // 熱鍵送短句（例：素食／高蛋白）俾後端，唔好送長 prompt：
          // 長句會被當成「指定菜式」而導致 library_miss（素食熱鍵 0 卡）。
          ? (QUICK_ACTIONS.find((a) => a.id === activeHotKeyRef.current)?.label ?? `${t(activeConfig.aiPrompt as any)}。`)
          : source === "ai"
            ? `提供 1 個唔同嘅家常菜食譜。`
            : `家常菜。提供 1 個唔同嘅食譜。`;
    // 可見 messages 只用用戶友善文字；完整 prompt 只送 backend
    const displayPrompt = lastUserContent.length >= 2
      ? lastUserContent
      : activeConfig
        ? t(activeConfig.aiPrompt as any)
        : source === "ai"
          ? t("aiChef.qa_aiLabel" as any)
          : t("aiChef.qa_randomLabel" as any);

    const newMsg: Message = { role: "user", content: userPrompt };
    const visibleMsg: Message = { role: "user", content: displayPrompt };
    const msgs: Message[] = [...messages, visibleMsg];
    updateMessages(() => msgs);
    // 記低今次 mode，令「換」button 之後識用 AI 生成替代
    lastChatModeRef.current = source === "ai" ? "ai" : "library";
    // AI mode：淨係傳新 prompt 俾後端（唔帶成個 history，避免 LLM 抄返之前建議過嘅菜式導致重複）
    // library mode：後端唔理 messages 內容，傳咩都得
    const backendMsgs: Message[] = source === "ai" ? [newMsg] : [...messages, newMsg];
    // 熱鍵場景：source 掣「食譜庫」都傳 search（排除甜品/湯水 + 7日去重）
    const searchParam = source === "library" && activeConfig?.search
      ? {
          ...activeConfig.search,
          count: inMealContext ? (mealIntent ? mealIntent.dishes + mealIntent.soups : 4) : 1,
          rank: activeConfig.rank,
          excludeCategories: ["甜品", "湯水"],
        }
      : undefined;
    // 場景熱鍵（素食／高蛋白／快手…）行 chat 路徑：library 快路徑會因為
    // 「指定菜式」＋7 日去重而回 0 卡（素食熱鍵實測 0 張）。
    const hotkeyUsesChat = Boolean(activeConfig && source === "library");
    // 重複撳同一個熱鍵要出唔同卡：排除目前畫面顯示緊嘅卡名，否則後端每次都揀返同一張。
    // 3餸1湯 path（inMealContext）保持原狀，唔加呢批名。
    const visibleCardNames = inMealContext
      ? []
      : [...(recommendedRecipes ?? []), ...(mealResult ?? [])]
          .map((r) => String(r?.name ?? "").trim())
          .filter(Boolean);
    mutateChat({
      messages: buildBackendMessages(backendMsgs),
      mode: source === "ai" ? "ai" : hotkeyUsesChat ? "chat" : "library",
      ...(source === "ai" && aiEntry ? { aiEntry } : {}),
      excludeNames: [...new Set([...usedRecipeNames, ...sessionSeenRecipeNames, ...visibleCardNames])],
      lang: i18n.language,
      search: searchParam,
    });
    scrollToEnd();
  };

  const handleInstantRecipeAction = (mode: "library" | "ai", aiEntry?: AiEntry) => {
    // source 掣（食譜庫／AI）= 新搜尋，唔再跟舊 hotkey
    activeHotKeyRef.current = null;
    requestInstantRecipes(mode, aiEntry);
  };

  // ─── Daily 3-dish-1-soup flow helpers ──────────────────

  const addBotMessage = (text: string) => {
    updateMessages(prev => {
      // 同一句回答唔可以連續出兩次（實測「炒雞？」連出 3 條一樣訊息）。
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && String(last.content ?? "").trim() === text.trim()) return prev;
      return [...prev, { role: "assistant", content: text }];
    });
    scrollToLatestMessage();
  };

  const addUserMessage = (text: string) => {
    // Functional append: some callers run after an await; never overwrite newer messages.
    updateMessages(prev => [...prev, { role: "user", content: text }]);
    scrollToEnd();
    return [...messages, { role: "user", content: text }] as Message[];
  };

  const buildMealPrefs = useCallback((): MealPlanPreferences => ({
    people: mealDefaults.servings,
    hasKids: mealDefaults.hasKids,
    hasElderly: mealDefaults.hasElderly,
    time: mealDefaults.time,
    timeModes: mealDefaults.timeModes,
    dislikes: mealDefaults.dislikes.join("、"),
    allergens: mealDefaults.allergens.join("、"),
  }), [mealDefaults]);

  const startMealFlow = () => {
    preferredPlanDateRef.current = null;
    pendingAutoStartRef.current = null;
    setNextDayPrompt(null);
    quickMealModeRef.current = aiChefQuickPlanEnabled;
    const prefs = buildMealPrefs();
    setMealPrefs(prefs);
    setMealResult(null);
    setRecommendedRecipes([]);
    setSwappedRecipeNames(new Set());
    setSessionSeenRecipeNames([]);
    if (aiChefQuickPlanEnabled) {
      setIsPreparingMeal(true);
      setMealStep("generating");
      if (familySettingsLoading) {
        pendingAutoStartRef.current = { sessionId: activeChatIdRef.current };
      } else {
        void generateMealPlan(buildMealPrefs(), []);
      }
    } else {
      setMealStep("people");
      addBotMessage(t(quickMealModeRef.current ? "aiChef.q_people_quick" : "aiChef.q_people", { n: 1 }));
    }
  };

  // 由 Hero（homepage / ai-chef hero card）觸發：新開一個獨立 session 嚟做 3餸1湯，
  // 唔會同現有對話撈埋（每次撳 = 乾淨、獨立嘅 3餸1湯）。
  const startMealFlowInNewSession = () => {
    preferredPlanDateRef.current = null;
    setNextDayPrompt(null);
    const newId = generateId();
    const newSession: ChatSession = { id: newId, title: t("新對話" as any), createdAt: Date.now(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveChatId(newId);
    quickMealModeRef.current = aiChefQuickPlanEnabled;
    const prefs = buildMealPrefs();
    setMealPrefs(prefs);
    setMealResult(null);
    setRecommendedRecipes([]);
    setSwappedRecipeNames(new Set());
    setSessionSeenRecipeNames([]);
    const skipPeople = aiChefQuickPlanEnabled;
    if (skipPeople) {
      // Generation must wait for activeChatId to flush so messages target the new session.
      // Do not capture prefs here: family settings may still be loading.
      setIsPreparingMeal(true);
      setChatStarted(true);
      setMealStep("generating");
      pendingAutoStartRef.current = { sessionId: newId };
    } else {
      setMealStep("people");
      // 直接 append 落新 session（避免 activeChatId 未 flush 而寫錯 session）
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === newId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], messages: [...prev[idx].messages, { role: "assistant" as const, content: t(quickMealModeRef.current ? "aiChef.q_people_quick" : "aiChef.q_people", { n: 1 }) }] };
        const next = [...prev]; next[idx] = updated; return next;
      });
    }
    scrollToLatestMessage();
  };

  // 由 Frontpage Hero 帶 `?action=daily` 跳入 → 自動開始 3 餸 1 湯問卷（每次撳 = 新獨立 session）。
  // 消費後即刻用 setParams 清走 action，避免 param persist 令「之後所有 entry 都當 daily」。
  // 1) 等 `loaded` 先開新 session，避免同 session-load effect 競賽而覆蓋新 session；
  // 2) 追蹤「上次已處理嘅 action」，當 heroAction 變返唔係 daily 就 reset → 下次 daily 再觸發。
  const heroParams = useLocalSearchParams<{ action?: string; entry?: string; t?: string; fresh?: string }>();
  const heroAction = Array.isArray(heroParams.action) ? heroParams.action[0] : heroParams.action;
  const heroEntry = Array.isArray(heroParams.entry) ? heroParams.entry[0] : heroParams.entry;
  const heroToken = Array.isArray(heroParams.t) ? heroParams.t[0] : heroParams.t;
  const homeMealEntry = heroAction === "daily" || heroEntry === "meal";
  const lastHandledTokenRef = useRef<string | undefined>(undefined);
  // 右上角 AI 掣 = 去 AI 助手首頁（唔好接住上次對話）
  const freshParam = Array.isArray(heroParams.fresh) ? heroParams.fresh[0] : heroParams.fresh;
  useEffect(() => {
    if (!loaded) return;
    if (freshParam === "1") {
      setChatStarted(false);
      updateMessages(() => []);
      setRecommendedRecipes([]);
      setMealResult(null);
      setMealStep("idle");
      lastChatModeRef.current = "";
      router.setParams({ fresh: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, freshParam]);

  useEffect(() => {
    if (!loaded || familySettingsLoading) return;
    if (heroAction === "daily" || heroEntry === "meal") {
      // 用每次撳嘅唯一 token（e.g. timestamp）做 key：確保「每次撳 hero = 開新對話」
      const token = heroToken || "daily";
      if (lastHandledTokenRef.current === token) return;
      lastHandledTokenRef.current = token;
      isSoupModeRef.current = true;
      startMealFlowInNewSession();
      router.setParams({ action: undefined, entry: undefined, t: undefined }); // 消費後清走
    } else {
      lastHandledTokenRef.current = undefined; // reset：下次新 daily 再觸發
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, heroAction, heroEntry, heroToken, familySettingsLoading]);

  const askMealQuestion = (step: MealPlanStep) => {
    const stepMap: Record<MealPlanStep, number> = { idle: 0, people: 1, audience: 2, time: 3, dislike: 4, generating: 0, result: 0 };
    const stepNum = stepMap[step];
    switch (step) {
      case "people":
        addBotMessage(t(quickMealModeRef.current ? "aiChef.q_people_quick" : "aiChef.q_people", { n: stepNum }));
        break;
      case "audience":
        addBotMessage(t("aiChef.q_kids", { n: stepNum }));
        break;
      case "time":
        addBotMessage(t("aiChef.q_time", { n: stepNum }));
        break;
      case "dislike":
        addBotMessage(t("aiChef.q_dislike", { n: stepNum }));
        break;
    }
  };

  const advanceMealStep = () => {
    const nextStep: Record<MealPlanStep, MealPlanStep> = {
      idle: "people", people: "audience", audience: "time",
      time: "dislike", dislike: "generating", generating: "result", result: "idle",
    };
    const next = nextStep[mealStep];
    setMealStep(next);
    if (next !== "generating" && next !== "result" && next !== "idle") {
      askMealQuestion(next);
    }
  };

  const parseMealAnswer = (text: string) => {
    const t = text.trim();
    const lower = t.toLowerCase();
    switch (mealStep) {
      case "people": {
        // 支援中文數字：兩人、四位、三個、十一人 等 (繁體/簡體)
        const chineseNums: Record<string, number> = {
          零: 0, 一: 1, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5,
          六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
          壹: 1, 貳: 2, 參: 3, 肆: 4, 伍: 5, 陸: 6, 柒: 7, 捌: 8, 玖: 9, 拾: 10,
          // 簡體
          两: 2, 么: 1, 个: 1
        };
        
        // 嘗試抽取「X 人/位/個」格式 (支援繁體/簡體)
        const cnMatch = t.match(/([零一两二三四五六七八九十壹贰叁肆伍陆柒捌玖拾两]+)\s*[人人位個个]/);
        if (cnMatch) {
          const cnStr = cnMatch[1];
          // 處理複合數字如「十一」= 10+1
          if (cnStr.includes('十')) {
            const parts = cnStr.split('十');
            let result = 0;
            if (parts[0] && chineseNums[parts[0]] !== undefined) {
              result += chineseNums[parts[0]] * 10;
            } else if (parts[0] === '') {
              result = 10; // 「十」= 10
            }
            if (parts[1] && chineseNums[parts[1]] !== undefined) {
              result += chineseNums[parts[1]];
            }
            return { people: result > 0 ? result : 4 };
          }
          // 單一中文數字
          if (chineseNums[cnStr] !== undefined) {
            return { people: chineseNums[cnStr] };
          }
        }
        
        // 嘗試抽取阿拉伯數字
        const numMatch = t.match(/(\d+)/);
        if (numMatch) {
          const n = parseInt(numMatch[1], 10);
          return { people: n < 1 ? 4 : n };
        }
        
        // 如果都無，就試下從中文數字單字抽取
        for (const [cn, val] of Object.entries(chineseNums)) {
          if (t.includes(cn) && val > 0) {
            return { people: val };
          }
        }
        
        return { people: -1 }; // 抽唔到人數 → 重新問（-1 表示無效）
      }
      case "audience": {
        const hasKids = /仔|女|小朋友|細路|童|孩子|kids|child|children|有小孩|小孩/.test(lower);
        const hasElderly = /老人家|長者|老人|爸|媽|爺|嫲|公公|婆婆|父母|elderly|old|parent|有老人/.test(lower);
        return { hasKids, hasElderly };
      }
      case "time": {
        if (/快|30|半|急|quick|速|簡單|易|快手|趕/.test(lower)) return { time: "quick" as const };
        if (/慢|煲|燉|leisure|slow|慢慢|燜|煮耐/.test(lower)) return { time: "leisure" as const };
        return { time: "normal" as const };
      }
      case "dislike": {
        // 「冇/無/無忌口」= 冇忌口 → 空字串；「唔食辣/唔食豬肉」= 有忌口 → 保留原文
        const noDislike = /^(冇|無|無忌口|沒有|冇忌口|none|唔使|不用|冇特別|無特別)$/.test(t.trim())
          || /(冇忌口|無忌口|沒有特別|唔使忌口|冇咩唔食|無咩唔食|什麼都食|咩都食)/.test(t);
        return { dislikes: noDislike ? "" : t };
      }
    }
    return {};
  };

  const handleMealAnswer = (text: string, displayLabel?: string) => {
    resetAiNextSteps();
    const display = displayLabel ?? text;
    const update = parseMealAnswer(text);
    // 人數答非數字 → 重新問，唔好靜靜 default 4
    if (mealStep === "people" && update.people === -1) {
      addUserMessage(display);
      addBotMessage(t("aiChef.q_people_invalid" as any));
      return;
    }
    const nextPrefs = { ...mealPrefs, ...update };
    setMealPrefs(nextPrefs);
    const msgs = addUserMessage(display);
    if (mealStep === "people" && quickMealModeRef.current) {
      const quickPrefs: MealPlanPreferences = {
        ...nextPrefs,
      };
      setMealPrefs(quickPrefs);
      setMealStep("generating");
      generateMealPlan(quickPrefs, msgs);
    } else if (mealStep === "dislike") {
      setMealStep("generating");
      generateMealPlan(nextPrefs, msgs);
    } else {
      advanceMealStep();
    }
  };

  // 跳過所有問題，直接 AI 生成
  const handleSkipMealQuestions = () => {
    if (chatMutation.isPending) return;
    setMealStep("generating");
    // 設置 3 餸 1 湯模式
    isSoupModeRef.current = true;
    // 用預設偏好（4 人，普通，冇忌口）直接生成
    const defaultPrefs: MealPlanPreferences = {
      people: mealDefaults.servings,
      hasKids: mealDefaults.hasKids,
      hasElderly: mealDefaults.hasElderly,
      time: mealDefaults.time,
      timeModes: mealDefaults.timeModes,
      dislikes: mealDefaults.dislikes.join("、"),
      allergens: mealDefaults.allergens.join("、"),
    };
    // 完整 prompt 只送去 backend；UI 只顯示短句
    const prompt = buildMealPrompt(defaultPrefs);
    const display = t("aiChef.userMsg3", { n: defaultPrefs.people });
    updateMessages(prev => [...prev, { role: "user", content: display }]);
    lastChatModeRef.current = "ai";
    noveltyRetryRef.current = false;
    mutateChat({ messages: [{ role: "user", content: prompt }], mode: "ai", aiEntry: "ai_tab" as AiEntry, excludeNames: [...new Set([...usedRecipeNames, ...sessionSeenRecipeNames])], lang: i18n.language }, {
      onSuccess: (data, variables) => {
        setMealStep("result");
        setAiNextSteps([]);
        setChatStarted(true);
        if (data.recipes?.length > 0) {
          // 唔再用重複湊 4（避免「（variation）」假卡）；後端已保證結構化 4 卡，AI fallback 就顯示實際有嘅
          const safeRecipes = data.recipes.map(normalizeRecipe);
          recordIncompleteContract(data, variables, safeRecipes.length);
          // 車主規則：3 餸 1 湯一定 4 張（或用戶指定嘅 X 餸 Y 湯）。
          // 之前用 >= 2 收貨，會靜靜交 2–3 張，違反保證。
          // 呢條 function 只服務 3 餸 1 湯 流程；用戶自訂 X 餸 Y 湯 走 requestInstantRecipes。
          const requiredCards = 4;
          setMealResult(safeRecipes.length >= requiredCards ? safeRecipes.slice(0, requiredCards) : null);
          setRecommendedRecipes(safeRecipes.slice(0, 4));
        } else {
          recordIncompleteContract(data, variables, 0);
          addBotMessage(t("AI 暫時未能提供食譜，請再試一次。" as any));
        }
      },
      onError: () => setMealStep("idle"),
    }, undefined, 4);
    scrollToEnd();
  };

  // 熱鍵：場景化搜尋（結構化參數）+ AI fallback（附帶已記住嘅偏好）
  const runHotKeyGeneration = async (
    id: string,
    prefs: MealPlanPreferences,
    config: { search?: { query?: string; tags?: string[]; cookTimeMax?: number; category?: string; scenario?: string }; rank?: "shortestTime" | "default"; aiPrompt: string },
  ) => {
    setLibraryLoading(true);
    resetAiNextSteps();
    setContractAiBlocked(false);
    setLibraryAlternatives([]);
    setLibraryMissScenario(null);
    setRecommendedRecipes([]);
    setMealResult(null);
    if (config.search) {
      try {
        const res = await apiClient.aiRecipe.chat.mutate({
          messages: [{ role: "user", content: t(config.aiPrompt as any) }],
          mode: "library",
          avoidIngredients: mealDefaults.allergens,
          lang: i18n.language,
          search: {
            query: config.search.query,
            tags: config.search.tags,
            cookTimeMax: config.search.cookTimeMax,
            category: config.search.category,
            scenario: config.search.scenario,
            count: 1,
            rank: config.rank,
            excludeCategories: ["甜品", "湯水"],
          },
          excludeNames: sessionSeenRecipeNames,
        });
        const rawRecipes = Array.isArray(res?.recipes) ? res.recipes : [];
        const libraryRecipes = rawRecipes
          .map(normalizeRecipe)
          .filter(isValidRecipe);
        if (libraryRecipes.length > 0) {
          // 後端已做 7 日去重 + fresh 優先（+ rank：快手揀最短時間）
          const picked = libraryRecipes.slice(0, 1);
          addUserMessage(t(config.aiPrompt as any));
          setSwapNoCards(null);
          setRecommendedRecipes(picked);
          commitCardHistory(picked);
          setChatStarted(true);
          recordSeenRecipes(picked);
          addBotMessage(t("aiChef.libMatched") + recipeNameList(picked));
          setLibraryLoading(false);
          return;
        }
        const clarifyReason = String((res as any)?.clarifyReason ?? "");
        const served = Number((res as any)?.served ?? rawRecipes.length);
        const isLibraryMiss = (clarifyReason === "library_miss" || clarifyReason === "lib_search_fail") && served === 0;
        if (isLibraryMiss) {
          const rawAlternatives = Array.isArray((res as any)?.alternatives) ? (res as any).alternatives : [];
          const alternatives = rawAlternatives.map(normalizeRecipe).filter(isValidRecipe);
          const rawReplies = Array.isArray((res as any)?.quickReplies) ? (res as any).quickReplies : [];
          const knownReplies = rawReplies.filter((q: any) =>
            q && ["ai_generate", "closest_library", "import_recipe"].includes(q.actionId) && typeof q.labelKey === "string"
          );
          const usableReplies = knownReplies.filter((q: any) => q.actionId !== "closest_library" || alternatives.length > 0);
          const replies = usableReplies.length > 0
            ? usableReplies
            : [
                { actionId: "ai_generate", labelKey: "aiChef.aiGenerate" },
                ...(alternatives.length > 0 ? [{ actionId: "closest_library", labelKey: "aiChef.closestLibrary" }] : []),
              ];
          setLibraryAlternatives(alternatives);
          setLibraryMissScenario(id);
          setContractAiBlocked(isQuotaBlocked((res as any)?.quota));
          setContractQuickReplies(replies);
          addBotMessage(t("aiChef.libraryMissCta"));
          setLibraryLoading(false);
          return;
        }
      } catch (e) {
        console.error(`[AI 助手] Hot key library search failed:`, e);
      }
    }
    setLibraryLoading(false);
    addBotMessage(t("aiChef.libNoMatch"));
    // 唔自動叫 AI：由用戶主動撳先至用 AI（只用「AI 生成」掣）
    showToast(t("aiChef.aiFallbackPrompt" as any), {
      label: t("aiChef.aiGenerate" as any),
      onPress: () => requestInstantRecipes("ai", "toast_fallback"),
    }, 8000);
  };

  const buildMealPrompt = (
    prefs: MealPlanPreferences,
    counts: { dishes: number; soups: number; carb?: boolean } = { dishes: 3, soups: 1 },
    flavor?: { spicy: boolean; light: boolean; exclusions: string[] },
  ) => {
    const { dishes, soups, carb = false } = counts;
    const total = Math.max(1, dishes + soups + (carb ? 1 : 0));
    const modes = prefs.timeModes.length > 0 ? prefs.timeModes : (prefs.time ? [prefs.time] : ["normal" as MealPreferenceTime]);
    const timeLabel = modes.includes("quick") && modes.includes("normal")
      ? t("優先 30 分鐘內；可接受普通約 45–60 分鐘（不要慢煮）" as any)
      : modes.includes("quick")
        ? t("30 分鐘內快手菜" as any)
        : modes.includes("leisure")
          ? t("可慢慢煮/煲燉" as any)
          : t("普通約 1 小時" as any);
    const titleParts = [`${dishes} 餸`];
    if (soups > 0) titleParts.push(`${soups} 湯`);
    if (carb) titleParts.push("主食");
    const catPool = [
      "肉類主菜（如豬/牛/雞）",
      "海鮮/其他蛋白主菜（如魚/蝦/豆腐蛋）",
      "蔬菜/小炒",
      "其他家常菜（如蛋/豆製品/麵飯）",
    ];
    const cats: string[] = [];
    for (let i = 0; i < dishes; i++) cats.push(catPool[i % catPool.length]);
    if (carb) cats.push("主食（飯/麵/粉/粥）");
    if (soups > 0) cats.push(`湯水（${soupStyleLabelFromModes(modes, prefs.time)}）`);
    const catLines = cats.map((c, i) => `${i + 1}. ${c}\n`).join("");
    const flavorLine =
      (flavor?.spicy && !flavor?.light ? `口味要求：辛辣、夠味（每道菜都要有辣度，例如辣椒/花椒/麻辣）。` : "") +
      (flavor?.light ? `口味要求：清淡、少油少鹽、唔辣。` : "") +
      (flavor?.exclusions?.length ? `避免食材：${flavor.exclusions.join("、")}（完全唔可以用）。` : "");
    return `請為我設計今晚「${titleParts.join(" ")}」晚餐，總共 ${total} 道菜，適合${prefs.people}人食用。` +
      (prefs.hasKids ? "有小朋友，口味要溫和、少辣、容易入口。" : "") +
      (prefs.hasElderly ? "有老人家，食材要易咀嚼、清淡少油鹽。" : "") +
      flavorLine +
      `煮食時間要求：${timeLabel}。` +
      (prefs.allergens ? `必須完全避免以下敏感食材（唔可以出現、亦唔可以作替代）：${prefs.allergens}。` : "") +
      (prefs.dislikes ? `避免食材/口味：${prefs.dislikes}。` : "") +
      "食材欄每行只寫一種食材，唔好加入功效、備註、口味描述。" +
      `請提供完整 ${total} 個食譜，分類如下：\n` +
      catLines +
      "每個食譜請包含：名稱、簡短描述、煮食時間（分鐘）、難度、份量、食材清單（名稱、數量、單位）、步驟。語言：繁體中文。";
  };

  const generateMealPlan = async (prefs: MealPlanPreferences, msgs: Message[]) => {
    // 設置 3 餸 1 湯模式
    isSoupModeRef.current = true;
    // ── Library-first：行結構化 meal path（pickSoupMeal，同食譜庫 button 一致，唔再隨機抽）──
    setLibraryLoading(true);
    setRecommendedRecipes([]);
    try {
      // 食譜庫路徑要送「短意圖」（3 餸 1 湯＋人數＋限制）。送長模板 prompt
      // （含「分類如下：1. 肉類主菜…」）會令後端只回 1 張卡。
      // 但安全資訊（敏感／唔食）一定要保留 —— 唔可以為咗短而漏過敏原。
      const libraryPrompt = [
        prefs.people ? `${prefs.people} 人食。` : "",
        "3 餸 1 湯",
        prefs.allergens?.trim() ? `；避免：${prefs.allergens}` : "",
        prefs.dislikes?.trim() ? `；唔要：${prefs.dislikes.trim()}` : "",
      ].join("");
      const res = await apiClient.aiRecipe.chat.mutate({
        messages: [{ role: "user", content: libraryPrompt }],
        mode: "library",
        lang: i18n.language,
        excludeNames: [...new Set([...usedRecipeNames, ...sessionSeenRecipeNames])],
        avoidIngredients: splitAvoidList(prefs.allergens),
      });
      const rawRecipes = Array.isArray(res?.recipes) ? res.recipes : [];
      const libraryRecipes = rawRecipes
        .map(normalizeRecipe)
        .filter(isValidRecipe);
      if (libraryRecipes.length >= 4) {
        setMealStep("result");
        const recipesToShow = libraryRecipes.slice(0, 4);
        setMealResult(recipesToShow);
        setRecommendedRecipes(recipesToShow);
        commitCardHistory(recipesToShow);
        recordSeenRecipes(recipesToShow);
        addUserMessage(`${t("aiChef.userMsg3", { n: prefs.people })}`);
        addBotMessage((res?.content || t("aiChef.foundMealDishesSoup", { dishes: 3, soups: 1 })) + recipeNameList(recipesToShow));
        setLibraryLoading(false);
        return;
      }
    } catch (e) {
      console.error("[AI 助手] Meal flow structured failed:", e);
    }
    setLibraryLoading(false);
    // Fallback：AI 3 餸 1 湯
    const prompt = buildMealPrompt(prefs);
    // 只發送當前 prompt，唔帶歷史。若 caller 已經有 user message（例如問卷答案），
    // 唔好再將長 prompt 顯示喺 chat；只喺真正空白新 session 才顯示。
    const fullMsgs: Message[] = [{ role: "user", content: prompt }];
    if (msgs.length === 0) {
      updateMessages(prev => [...prev, { role: "user", content: t("aiChef.userMsg3", { n: prefs.people }) }]);
    }
    resetAiNextSteps();
    lastChatModeRef.current = "ai";
    noveltyRetryRef.current = false;
    mutateChat({ messages: buildBackendMessages(fullMsgs), mode: "ai", aiEntry: "ai_fallback" as AiEntry, excludeNames: [...new Set([...usedRecipeNames, ...sessionSeenRecipeNames])], avoidIngredients: splitAvoidList(prefs.allergens), lang: i18n.language }, {
      onSuccess: (data, variables) => {
        setMealStep("result");
        setAiNextSteps([]);
        setChatStarted(true);
        if (data.recipes?.length > 0) {
          // 唔再用重複湊 4（避免「（variation）」假卡）
          const safeRecipes = data.recipes.map(normalizeRecipe);
          recordIncompleteContract(data, variables, safeRecipes.length);
          // 3 餸 1 湯 一定 4 張；少過 4 張就當 incomplete，唔可以靜靜交 2–3 張，
          // 亦唔可以留白：要明確講清楚，並保留已出嘅卡俾用戶揀。
          if (safeRecipes.length >= 4) {
            setMealResult(safeRecipes.slice(0, 4));
            setRecommendedRecipes(safeRecipes.slice(0, 4));
          } else {
            setMealResult(null);
            setRecommendedRecipes(safeRecipes);
            setMealStep("idle");
            if ((data as any)?.status !== "incomplete") {
              addBotMessage(
                t("aiChef.mealIncomplete", {
                  got: safeRecipes.length,
                  want: 4,
                  defaultValue: `今次只搵到 ${safeRecipes.length} 道菜（要 4 道）。可以再試一次，或者用「AI 生成食譜」補齊。`,
                } as any),
              );
            }
          }
        } else {
          recordIncompleteContract(data, variables, 0);
          addBotMessage(t("AI 暫時未能提供食譜，請再試一次。" as any));
        }
      },
      onError: () => setMealStep("idle"),
    }, undefined, 4);
    scrollToLatestMessage();
  };

  // ─── X 餸 Y 湯意圖：先交後端 role assembler（library-first，唔夠才 AI）───
  const generateMealFromIntent = async (
    intent: { dishes: number; soups: number; carb?: boolean },
    flavor?: { spicy: boolean; light: boolean; exclusions: string[] },
  ) => {
    const defaultPrefs = buildMealPrefs();
    isSoupModeRef.current = true;
    setMealPrefs(defaultPrefs);
    setMealStep("generating");
    setLibraryLoading(true);
    setRecommendedRecipes([]);
    setMealResult(null);
    const prompt = buildMealPrompt(defaultPrefs, intent, flavor);
    const msgs: Message[] = [{ role: "user", content: prompt }];
    resetAiNextSteps();
    lastChatModeRef.current = "chat";
    noveltyRetryRef.current = false;
    // Server role assembler owns library-first + AI-fill. Do not duplicate the
    // old client-side compose/AI fallback here.
    mutateChat({
      messages: buildBackendMessages(msgs),
      mode: "chat",
      excludeNames: [...new Set([...usedRecipeNames, ...sessionSeenRecipeNames])],
      avoidIngredients: splitAvoidList(defaultPrefs.allergens),
      lang: i18n.language,
    }, {
      onSuccess: (data, variables) => {
        setLibraryLoading(false);
        setMealStep("result");
        setAiNextSteps([]);
        setChatStarted(true);
        const safe = (data.recipes ?? []).map(normalizeRecipe).filter(isValidRecipe);
        recordIncompleteContract(data, variables, safe.length);
        if (safe.length > 0) {
          setMealResult(safe.length >= 2 ? safe : null);
          setRecommendedRecipes(safe);
          recordSeenRecipes(safe);
        } else {
          addBotMessage(t("AI 暫時未能提供食譜，請再試一次。" as any));
        }
      },
      onError: () => {
        setLibraryLoading(false);
        setMealStep("idle");
      },
    });
    scrollToLatestMessage();
  };

  const handlePantryAction = async () => {
    if (chatMutation.isPending) {
      showToast(t("AI 回覆中，請稍等" as any));
      return;
    }
    if (mealStep !== "idle") {
      setMealStep("idle");
      setMealPrefs(EMPTY_PREFS);
      setMealResult(null);
    }
    resetAiNextSteps();
    setRecommendedRecipes([]);
    setMealResult(null);

    const inStockItems = (pantryData || []).filter((item: any) => item.inStock);
    if (inStockItems.length > 0) {
      const ingredientList = inStockItems.map((item: any) => `${item.name}${item.quantity ? ` ${item.quantity}${item.unit || ""}` : ""}`).join("、");
      const ingredientNames = inStockItems.map((item: any) => item.name).join(" ");
      const searchPrompt = `用 ${ingredientNames} 煮嘅菜`;

      // Library-first：先搵食譜庫（經 aiRecipe.chat library mode → 行 7 日去重）
      setLibraryLoading(true);
      setRecommendedRecipes([]);
      try {
        const res = await apiClient.aiRecipe.chat.mutate({
          messages: [{ role: "user", content: searchPrompt }],
          mode: "library",
          avoidIngredients: mealDefaults.allergens,
          lang: i18n.language,
          search: { query: ingredientNames, count: 6 },
          excludeNames: sessionSeenRecipeNames,
        });
        const rawRecipes = Array.isArray(res?.recipes) ? res.recipes : [];
        const libraryRecipes = rawRecipes
          .map(normalizeRecipe)
          .filter(isValidRecipe);
        if (libraryRecipes.length > 0) {
          addUserMessage(searchPrompt);
          setRecommendedRecipes(libraryRecipes);
          commitCardHistory(libraryRecipes);
          recordSeenRecipes(libraryRecipes);
          addBotMessage(t("aiChef.pantryMatchN", { n: libraryRecipes.length }));
          setLibraryLoading(false);
          return;
        }
      } catch (e) {
        console.error("[AI 助手] Pantry library search failed:", e);
      }
      setLibraryLoading(false);
      addBotMessage(t("aiChef.pantryNoMatch"));
      const prompt = `我雪櫃有：${ingredientList}，可以煮咩？`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(prev => [...prev, { role: "user", content: prompt }]);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else {
      setAskingIngredients(true);
      addBotMessage(t("aiChef.askFridgeIngredients"));
    }
  };

  const handleQuickAction = async (id: string) => {
    if (chatMutation.isPending && id !== "fridge") {
      showToast(t("AI 回覆中，請稍等" as any));
      return;
    }
    if (mealStep !== "idle") {
      setMealStep("idle");
      setMealPrefs(EMPTY_PREFS);
      setMealResult(null);
    }
    // 如果唔係 daily hotkey，重置 3 餸 1 湯模式
    if (id !== "daily") {
      isSoupModeRef.current = false;
    }

    // 「AI 生成食譜」唔應該一撳就出食譜：先打招呼，等用戶講想食咩。
    if (id === "ai") {
      activeHotKeyRef.current = null;
      aiGeneratePendingRef.current = true;   // 下一句 → 直接 LLM 生成
      setChatStarted(true);
      addBotMessage(t("aiChef.aiAsk" as any));
      return;
    }

    const config = HOT_KEY_CONFIG[id];
    // 記錄當前場景：hotkey → 跟住；其他掣 → 清空（source 掣只跟 hotkey）
    activeHotKeyRef.current = config ? id : null;

    // 熱鍵（quick/healthy/ricecooker/kids/guest）：直接用預設偏好生成（唔出問卷，同 3餸1湯 skip 一致）
    if (config && config.single) {
      // 單卡 hotkey：直接由食譜庫出 1 張（唔行角色組合）
      requestInstantRecipes("library");
      return;
    }

    if (config) {
      const defaultPrefs: MealPlanPreferences = {
        people: 4,
        hasKids: false,
        hasElderly: false,
        time: "normal",
        timeModes: ["quick", "normal"],
        dislikes: "",
        allergens: mealDefaults.allergens.join("、"),
      };
      await runHotKeyGeneration(id, defaultPrefs, config);
      return;
    }

    // 其他快捷動作
    switch (id) {
      case "random":
        requestInstantRecipes("library");
        break;
      case "ai":
        requestInstantRecipes("ai", "ai_tab");
        break;
      case "daily":
        // 3餸1湯流程：一開始就標記為 soup mode，令「直接 AI 生成/食譜庫」都出 4 張卡
        isSoupModeRef.current = true;
        startMealFlowInNewSession();
        break;
      case "fridge":
        handleCamera();
        break;
      case "pantry":
        handlePantryAction();
        break;
      default:
        break;
    }
  };

  // ─── Batch meal plan + shopping helpers ────────────────

  const addMealPlanBatch = async (recipes: AIRecipe[], date?: string) => {
    if (batchPlanBusy) return;
    const targetDate = date ?? preferredPlanDateRef.current ?? todayISO();
    preferredPlanDateRef.current = null;
    lastPlannedDateRef.current = targetDate;
    const validRecipes = recipes.filter(isValidRecipe);
    if (validRecipes.length === 0) {
      Alert.alert(t("無法加入排餐" as any), t("未找到有效食譜，請確認食譜包含食材同步驟。" as any));
      return;
    }
    if (validRecipes.length === 1) {
      setPlanRecipe(validRecipes[0]);
      setBatchRecipes(null);
      setPlanDate(targetDate);
      setShowPlan(true);
      return;
    }
    setBatchPlanBusy(true);
    const overrideServings = mealPrefs.people > 0 && (isSoupModeRef.current || mealStep === "result" || (mealResult?.length ?? 0) > 0)
      ? mealPrefs.people
      : null;
    try {
      const items: { date: string; mealType: string; recipeId: string; recipeName: string; recipeImage?: string; recipe?: AIRecipe }[] = [];
      // 目標份量縮放：先將每張卡嘅食材按 overrideServings 縮放，之後 save / 購物都用縮放後數量
      const scaledRecipes = validRecipes.map((r) => ({ ...r, ingredients: scaleIngredients(r, overrideServings) }));
      // 並行處理每個食譜（library ref 直接取；否則 save）—— 一次過落 4 個 network call，唔再逐個 await 排隊（舊版 ~1min）
      const resolvedItems = await Promise.all(
        scaledRecipes.map(async (r) => {
          const ref = resolveRecipeRef(r);
          if (ref.isLibraryRef) {
            return {
              date: targetDate,
              mealType: "dinner",
              recipeId: ref.recipeId,
              recipeName: r.name,
              recipeImage: getRecipeImage(r),
              recipe: r,
            };
          }
          const savedId = await ensureSaved(r, overrideServings, r.ingredients);
          return {
            date: targetDate,
            mealType: "dinner",
            recipeId: `user_${savedId}`,
            recipeName: r.name,
            recipeImage: getRecipeImage(r),
            recipe: r,
          };
        })
      );
      items.push(...resolvedItems);
      const recipesWithIds = scaledRecipes.map((r, idx) => {
        const found = items[idx];
        if (!found) return { ...r };
        return found.recipeId.startsWith("user_")
          ? { ...r, _savedId: Number(found.recipeId.replace("user_", "")), _libraryRecipeId: found.recipeId }
          : { ...r, _libraryRecipeId: found.recipeId };
      });
      setBatchRecipes(recipesWithIds);
      setPlanDate(targetDate);
      setShowPlan(true);
    } catch (e: any) {
      if (showLimitError(e)) return;
      Alert.alert(t("儲存食譜失敗" as any), friendlyError(e) || t("請稍後再試" as any));
    } finally {
      setBatchPlanBusy(false);
    }
  };

  const planNames = (plans: any[]) =>
    plans
      .map((meal) => getBilingualName(meal.recipeName, meal.recipeNameEn, meal.recipeNameFil, meal.recipeNameId).primary)
      .filter(Boolean)
      .join("、");

  const getNextDayInfo = async (date: string, mealType: string = "dinner"): Promise<NextDayPromptData | null> => {
    if (!aiChefQuickPlanEnabled) return null;
    // The next-day prompt launches the 3-dish dinner generator, so only offer it for dinner.
    if (mealType !== "dinner") return null;
    const nextDate = getDayAfter(date);
    const dayAfterDate = getDayAfter(nextDate);
    let nextPlans: any[] = [];
    let dayAfterPlans: any[] = [];
    try {
      const plans = await utils.mealPlan.listByDateRange.fetch({ startDate: nextDate, endDate: dayAfterDate });
      const meals = (plans as any[]).filter((meal) => meal.mealType === mealType && meal.status !== "rejected");
      nextPlans = meals.filter((meal) => meal.date === nextDate);
      dayAfterPlans = meals.filter((meal) => meal.date === dayAfterDate);
    } catch {
      // If the check fails, still let the user choose; add flow has its own conflict guard.
    }

    if (nextPlans.length > 0 && dayAfterPlans.length > 0) {
      return {
        targetDate: dayAfterDate,
        title: t("聽日/後日已有排餐" as any),
        body: t("聽日已排：{{next}}；後日已排：{{dayAfter}}" as any, {
          next: planNames(nextPlans),
          dayAfter: planNames(dayAfterPlans),
        }),
      };
    }
    if (nextPlans.length > 0) {
      return {
        targetDate: dayAfterDate,
        title: t("聽日已排：{{names}}" as any, { names: planNames(nextPlans) }),
        body: t("要唔要排後日？" as any),
        acceptLabel: t("排後日" as any),
      };
    }
    return {
      targetDate: nextDate,
      title: t("要唔要再排多一日？" as any),
      body: t("排埋下一日，之後再買餸就一次過搞掂。" as any),
      acceptLabel: t("排埋下一日" as any),
    };
  };

  const showNextDayPrompt = async (date: string, mealType: string = "dinner") => {
    const prompt = await getNextDayInfo(date, mealType);
    if (prompt) setNextDayPrompt(prompt);
  };

  const finishShoppingConfirm = async (goShopping: boolean, focusDate = shopPlannedDate, mealType: string = "dinner") => {
    const date = pendingPostShoppingDateRef.current ?? lastPlannedDateRef.current;
    pendingPostShoppingDateRef.current = null;
    if (!date) {
      if (goShopping) router.push({ pathname: "/(tabs)/shopping", params: { focusDate } } as any);
      return;
    }
    const prompt = await getNextDayInfo(date, mealType);
    if (!prompt) {
      if (goShopping) router.push({ pathname: "/(tabs)/shopping", params: { focusDate } } as any);
      return;
    }
    setPendingShoppingNav(goShopping);
    setNextDayPrompt(prompt);
  };

  const acceptNextDay = () => {
    const targetDate = nextDayPrompt?.targetDate;
    setNextDayPrompt(null);
    setPendingShoppingNav(false);
    if (!targetDate) return;
    startMealFlowInNewSession();
    preferredPlanDateRef.current = targetDate;
  };

  const declineNextDay = () => {
    setNextDayPrompt(null);
    if (pendingShoppingNav) {
      setPendingShoppingNav(false);
      router.push({ pathname: "/(tabs)/shopping", params: { focusDate: shopPlannedDate } } as any);
    }
  };

  const handleFavoriteRecipe = async (recipe: AIRecipe, cardIndex?: number) => {
    if (!isValidRecipe(recipe)) {
      Alert.alert(t("無法收藏" as any), t("此食譜資料不完整，無法收藏。" as any));
      return;
    }
    const key = (recipe.name || "").trim();
    if (favoritingName === key) return;
    try {
      setFavoritingName(key);
      await ensureSaved(recipe);
      trackCardAction("save", recipe, cardIndex);
      showToast("✅ 已收藏（食譜庫）");
    } catch (e: any) {
      if (showLimitError(e)) return;
      Alert.alert(t("收藏失敗" as any), friendlyError(e) || t("請稍後再試" as any));
    } finally {
      setFavoritingName("");
    }
  };

  const replaceRecipeAtIndex = (index: number, newRecipe: AIRecipe) => {
    setSwapNoCards(null);
    preserveSelectionOnNextMealResultRef.current = true;
    const preSwapCards = recommendedRecipes;
    const preSwapKey = cardSetKey(preSwapCards.filter(isValidRecipe));
    const nextCards = preSwapCards.map((r, i) => i === index ? newRecipe : r);
    setRecommendedRecipes(nextCards);
    setMealResult(prev => {
      if (!prev) return prev;
      const next = prev.map((r, i) => i === index ? newRecipe : r);
      return next.length >= 2 ? next : null;
    });
    syncCardHistoryEntry(preSwapKey, nextCards);
  };

  // 「換」掣：只替換單張卡。AI mode 就直接出 1 個替代食譜；library mode 先搵庫內替代
  const handleSwapRecipe = async (
    recipe: AIRecipe,
    index: number,
    opts?: { aiFallback?: boolean; relaxRole?: boolean },
  ) => {
    // 全域鎖：任何一張換卡進行中，唔准再撳其他卡（避免並發交錯覆寫）
    if (swappingIndex !== null || swapInFlightRef.current) return;
    swapInFlightRef.current = true;
    setSwapNoCards(null);
    armSwapWatchdog(recipe.source === "ai" || opts?.aiFallback ? AI_SWAP_TIMEOUT_MS : LIBRARY_SWAP_TIMEOUT_MS);
    trackCardAction("swap", recipe, index);
    const category = recipe.recipeCategory || "其他";
    const otherNames = recommendedRecipes
      .filter((_, i) => i !== index)
      .map(r => (r.name || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    const sessionAvoidNames = [...usedRecipeNames, ...sessionSeenRecipeNames];

    // 換卡唯一守門：新卡名唔可以撞其他卡／session 已見／本輪已換過。
    const passesSwapGuard = (r: AIRecipe | null | undefined) =>
      !!r &&
      !isDuplicateRecipeName(r.name, otherNames) &&
      !isDuplicateRecipeName(r.name, sessionAvoidNames) &&
      !swappedRecipeNames.has(r.name);

    const pickLibraryFallback = () => {
      const cardDishType = getDishType(recipe);
      const alternatives = [...(userRecipes ?? [])]
        .filter((r: any) => {
          const dt = getDishType(r);
          return dt === cardDishType && r.name !== recipe.name;
        })
        .map(normalizeRecipe)
        .filter((r): r is AIRecipe => !!r && isValidRecipe(r));
      return alternatives.find(passesSwapGuard) ?? null;
    };

    const collectCandidates = (res: any) => {
      const structured = Array.isArray(res?.recipes) ? res.recipes : [];
      const fallbackText = typeof res?.content === "string" ? tryParseRecipes(res.content) : [];
      return [...structured, ...fallbackText]
        .map(normalizeRecipe)
        .filter((r): r is AIRecipe => !!r && isValidRecipe(r));
    };

    // 換嘅結果跟「張卡本身嘅來源」：AI 卡 → AI 換；食譜庫卡 → 食譜庫換（來源一致）
    const useAi = recipe.source === "ai";
    const recipeDishType = getDishType(recipe);
    const swapFromLibrary = async (
      kwOverride?: string,
      relaxRole = false,
    ): Promise<{ picked: AIRecipe | null; response: any }> => {
      // 換要換返「相關」：張卡嘅 dishType（湯→湯、肉→肉…）＋ 原請求 context（hotkey query / 用戶 keyword）
      const cardDishType = getDishType(recipe);
      const hotkeyCtx = activeHotKeyRef.current ? HOT_KEY_CONFIG[activeHotKeyRef.current]?.search : null;
      // 唔好用英文 dishType 做 search keyword（後端食譜庫係中文，搜唔到嘢）——
      // 優先「類別詞」（蔬菜/肉/海鮮/湯水）搜晒成個類別 pool，其次先原卡名（太精準搜唔到其他）。
      // 唔好俾 ctxQuery（用戶對話/問卷答案）污染 keyword —— 嗰啲唔係菜名/類別詞，搜唔到會 fallback AI。
      const cardNameKw = (recipe.name || "").replace(/[（(].*?[)）]/g, "").trim().slice(0, 12);
      const catKw = dishTypeKeyword(cardDishType);
      const kw = kwOverride || (relaxRole ? "家常" : catKw) || cardNameKw || "家常菜";
      // relax_role：放寬到其他類別 → 唔好再送「同類別：xxx」marker，等後端唔再按原 role 篩。
      const message = relaxRole
        ? `請從食譜庫提供 1 個替換「${recipe.name}」嘅食譜。庫內搜尋：${kw}。`
        : `請從食譜庫提供 1 個替換「${recipe.name}」嘅食譜。庫內搜尋：${kw}；同類別：${cardDishType || ""}`;
      try {
        const res = await apiClient.aiRecipe.chat.mutate({
          messages: [{ role: "user", content: message }],
          mode: "library",
          // 換卡要保留 hotkey 嘅搜尋條件（例如 scenario: highProtein），
          // 否則只靠 keyword + dishType，換兩次之後候選變 0 → 誤彈「AI 建議」。
          // relax_role 要跨類別，唔可以再帶原 role 嘅 scenario 約束。
          search: !relaxRole && hotkeyCtx ? { ...hotkeyCtx, count: 1 } : undefined,
          avoidIngredients: mealDefaults.allergens,
          lang: i18n.language,
          // 瘦身：7 日去重由後端 cache 負責；前端只排除「其他卡 + 現卡 + 已換過」（sessionAvoidNames 太肥會爆池錯誤 fallback AI）
          excludeNames: [...new Set([...otherNames, recipe.name || "", ...swappedRecipeNames])],
        });
        const candidates = collectCandidates(res);
        // 來源一致優先：搵「同類別 + 唔撞其他卡／現卡／已換過」；冇就接受同類別；跨類唔收。
        // 注意：唔好用 sessionAvoidNames（30 日 + 全部對話歷史）→ 池被過度收窄 → 誤 fallback AI。
        const picked = relaxRole
          ? candidates.find((cand) =>
              !isDuplicateRecipeName(cand.name, [...otherNames, recipe.name || ""]) &&
              !swappedRecipeNames.has(cand.name)
            ) ?? null
          : candidates.find((cand) =>
              getDishType(cand) === cardDishType &&
              !isDuplicateRecipeName(cand.name, [...otherNames, recipe.name || ""]) &&
              !swappedRecipeNames.has(cand.name)
            ) ?? null;
        return { picked, response: res };
      } catch (err: any) {
        console.error("[handleSwapRecipe] library swap failed:", friendlyError(err) || err);
        return { picked: null, response: null };
      }
    };
    const recordSwappedName = (name: string) => {
      setSwappedRecipeNames(prev => {
        const newSet = new Set(prev);
        newSet.add(name);
        return newSet;
      });
    };
    const replaceFromAi = async () => {
      setSwappingIndex(index);
      try {
        const cardDishType = getDishType(recipe);
        const prompt = [
          `請只生成 1 個可直接煮嘅食譜，作為「${recipe.name}」嘅替代。`,
          `分類要同原本相近：${category}。`,
          `呢道一定要係「${cardDishType}」類別（soup=湯、meat=肉、seafood=海鮮、vegetable=菜、other=主食），唔可以變成其他類別。`,
          `食譜名稱唔可以同以下已顯示食譜重複：${otherNames.length > 0 ? otherNames.join("、") : "無"}。`,
          `食材欄每行只寫一種食材，唔好加入功效、備註、口味描述；每個食材都一定要有名字。`,
          `保持家庭日常可煮、步驟完整、繁體中文。`,
        ].join("\n");

        // 只收「同類別」嘅候選；避開已顯示 + 已換過
        const pickSameCategory = (candidates: AIRecipe[]): AIRecipe | null =>
          candidates.find((cand) =>
            getDishType(cand) === cardDishType &&
            !isDuplicateRecipeName(cand.name, [...otherNames, ...sessionAvoidNames]) &&
            !swappedRecipeNames.has(cand.name)
          ) ?? null;

        const tryGenerate = async (extra: string): Promise<AIRecipe | null> => {
          if (!aiCanGenerate) {
            setShowPaywall(true);
            return null;
          }
          try {
            const res = await apiClient.aiRecipe.chat.mutate({
              messages: [{ role: "user", content: `${prompt}${extra}` }],
              mode: "ai",
              aiEntry: "swap_ai" as AiEntry,
              avoidIngredients: mealDefaults.allergens,
              lang: i18n.language,
              excludeNames: [...sessionAvoidNames, ...swappedRecipeNames],
            });

            const candidates = collectCandidates(res);
            if (candidates.length === 0) {
              console.warn("[handleSwapRecipe] API returned no usable candidates:", res);
              return null;
            }

            // 優先同類別；AI 全出錯類就當冇（交由 repeat / 兜底）
            const picked = pickSameCategory(candidates);
            if (picked) return picked;

            console.warn("[handleSwapRecipe] AI candidates wrong category:", candidates.map(c => `${c.name}(${getDishType(c)})`));
            return null;
          } catch (err: any) {
            console.error("[handleSwapRecipe] API call failed:", friendlyError(err) || err);
            throw err;
          }
        };

        // 次序：library 同類 → repeat 1-2 次（再生成）→ AI 換 prompt → 提示
        let candidate: AIRecipe | null = pickLibraryFallback();
        if (!passesSwapGuard(candidate)) {
          for (let attempt = 0; attempt < 2; attempt++) {
            candidate = await tryGenerate(attempt === 1 ? `\n請再生成一個全新、唔重複、可直接煮嘅「${cardDishType}」食譜，唔好重複上次。類別一定要一致。` : "");
            if (candidate) break;
          }
        }
        if (!candidate) {
          candidate = await tryGenerate("\n請直接生成一個全新、唔重複、可直接煮嘅食譜。唔需要參考舊食譜。");
        }

        if (candidate && isValidRecipe(candidate) && getDishType(candidate) === cardDishType && passesSwapGuard(candidate)) {
          replaceRecipeAtIndex(index, candidate);
          setSwapNoCards(null);
          showToast(t("✅ 已換成「{{name}}」" as any, { name: getDisplayName(candidate.name, candidate.nameEn, candidate.nameFil, candidate.nameId).primary || "…" }));
          recordSeenRecipes([candidate]); // 納入「睇過」去重 —— AI 換嘅都要記住，避免之後重複
          setSwappedRecipeNames(prev => {
            const newSet = new Set(prev);
            newSet.add(candidate.name);
            return newSet;
          });
        } else {
          const fallback = pickLibraryFallback();
          if (fallback && getDishType(fallback) === cardDishType && passesSwapGuard(fallback)) {
            showToast(t("📚 食譜庫搵到相近替代：{{name}}" as any, { name: getDisplayName(fallback.name, fallback.nameEn, fallback.nameFil, fallback.nameId).primary || "…" }));
            replaceRecipeAtIndex(index, fallback);
            setSwapNoCards(null);
            showToast(t("✅ 已換成「{{name}}」" as any, { name: getDisplayName(fallback.name, fallback.nameEn, fallback.nameFil, fallback.nameId).primary || "…" }));
            recordSeenRecipes([fallback]);
            setSwappedRecipeNames(prev => {
              const newSet = new Set(prev);
              newSet.add(fallback.name);
              return newSet;
            });
            return;
          }
          showToast("⚠️ 暫時搵唔到同類食譜，已試過 AI 生成，請再按一次");
        }
      } catch (e: any) {
        console.error("[handleSwapRecipe] Error:", e);
        const errorMsg = friendlyError(e) || t("未知錯誤" as any);
        Alert.alert(
          t("換食譜失敗" as any),
          t("錯誤：{{msg}}\n\n請檢查網絡連接，或嘗試再次點擊。" as any, { msg: errorMsg }),
          [{ text: t("確定" as any) }]
        );
      } finally {
        clearSwapWatchdog();
        swapInFlightRef.current = false;
        setSwappingIndex(null);
      }
    };

    if (useAi) {
      await replaceFromAi();
      return;
    }

    // 用戶喺 no_cards 面板揀「用 AI 生成」→ 直接幫呢張卡換（唔重開一個新搜尋）。
    if (opts?.aiFallback) {
      await replaceFromAi();
      return;
    }

    // 食譜庫卡：先喺後端食譜庫換（指定類別 + 7 日去重）—— 純食譜庫，唔 AI。
    // 次序：① 後端（卡名）→ ② 後端（類別詞）→ ③ local 庫（唔理 7 日 seen）。
    // 後端回 status=no_cards（已放寬過一次）→ 喺卡位置長期顯示兩個出路，唔再靠 8 秒 toast。
    setSwappingIndex(index);
    let libraryPicked: AIRecipe | null = null;
    let lastResponse: any = null;
    try {
      const first = await swapFromLibrary(opts?.relaxRole ? "家常" : undefined, !!opts?.relaxRole);
      libraryPicked = first.picked;
      lastResponse = first.response;
      if (!libraryPicked && !opts?.relaxRole && lastResponse?.status !== "no_cards") {
        const second = await swapFromLibrary(dishTypeKeyword(recipeDishType) || "家常");
        libraryPicked = second.picked;
        lastResponse = second.response ?? lastResponse;
      }
      if (!libraryPicked) libraryPicked = pickLibraryFallback();
    } finally {
      clearSwapWatchdog();
      swapInFlightRef.current = false;
      setSwappingIndex(null);
    }
    if (libraryPicked && passesSwapGuard(libraryPicked)) {
      replaceRecipeAtIndex(index, libraryPicked);
      setSwapNoCards(null);
      recordSeenRecipes([libraryPicked]);
      recordSwappedName(libraryPicked.name);
      showToast(t("📚 已用食譜庫換成「{{name}}」" as any, { name: getDisplayName(libraryPicked.name, libraryPicked.nameEn, libraryPicked.nameFil, libraryPicked.nameId).primary || "…" }));
      return;
    }

    if (lastResponse?.status === "no_cards" || opts?.relaxRole) {
      setContractAiBlocked(isQuotaBlocked(lastResponse?.quota));
      setSwapNoCards({ index, recipeName: recipe.name, cardId: recipe.cardId });
      if (opts?.relaxRole) addBotMessage(t("aiChef.swapNoLibrary" as any));
      return;
    }

    // 舊後端（冇 status）先用返 toast；新後端唔會行到呢度。
    showToast(t("aiChef.swapNoLibrary" as any), {
      label: t("aiChef.aiGenerate" as any),
      onPress: () => { void replaceFromAi(); },
    }, 8000, "info");
  };

  // no_cards 面板嘅兩個出路：AI 生成（1 credit）／放寬到其他類別。
  const handleSwapNoCardsAction = (actionId: "ai_generate" | "relax_role") => {
    const ctx = swapNoCards;
    if (!ctx) return;
    const recipe = recommendedRecipes[ctx.index];
    if (!recipe) { setSwapNoCards(null); return; }
    if (actionId === "ai_generate") {
      // 額度用完：只顯示 quota 訊息，唔彈 paywall（避免用戶以為一定要付款）。
      if (!aiCanGenerate || aiReplyBlocked) {
        showToast(t("aiChef.quotaExhausted" as any));
        return;
      }
      void handleSwapRecipe(recipe, ctx.index, { aiFallback: true });
      return;
    }
    void handleSwapRecipe(recipe, ctx.index, { relaxRole: true });
  };

  // Phase 1: AI 排餐後自動加入「主要食材」（跳過調味料/水），再帶用戶去購物清單。
  // 唔再彈 IngredientPickerModal，減少「確認完又唔知去咗邊」嘅斷點。
  const autoAddShoppingForPlan = async (
    recipes: AIRecipe[],
    plannedDate?: string,
    maxDate?: string,
    fromMealPlanIds?: (number | undefined)[],
    promptNextDay = true,
  ) => {
    if (shopConfirmLockRef.current) return;
    shopConfirmLockRef.current = true;
    const resolvedBuyDate = buyDateForMeal(plannedDate ?? null, todayISO());
    if (!resolvedBuyDate.ok) {
      shopConfirmLockRef.current = false;
      setShowPlan(false);
      setBatchRecipes(null);
      showToast(t("planner.mealPastNoCart" as any));
      return;
    }
    const purchaseDate = resolvedBuyDate.date;
    setShopPlannedDate(purchaseDate);
    setShowPlan(false);
    setBatchRecipes(null);
    try {
      const items: {
        name: string;
        nameEn?: string;
        nameFil?: string;
        nameId?: string;
        quantity?: string | null;
        unit?: string;
        category?: string;
        fromRecipeId?: string;
        fromRecipeName?: string;
        fromMealPlanId?: number;
      }[] = [];
      for (let ri = 0; ri < recipes.length; ri++) {
        const recipe = recipes[ri];
        const fromRecipeId = (await resolveShoppingRef(recipe)) ?? undefined;
        const fromMealPlanId = fromRecipeId ? fromMealPlanIds?.[ri] : undefined;
        const seen = new Set<string>();
        for (const rawIng of recipe.ingredients ?? []) {
          const ing = normalizeIngredient(rawIng);
          if (!ing) continue;
          for (const part of splitMultiIngredient(ing)) {
            const name = String(part.name ?? "").trim();
            const category = categorizeIngredient(name);
            // 只剔真正調味料；避免「油麥菜」因含「油」被誤剔。
            if (!name || (category === "調味料" && isSeasoning(name)) || isWaterIngredient(name)) continue;
            const key = `${name}::${String(part.unit ?? "").trim()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({
              name,
              nameEn: ing.nameEn,
              nameFil: ing.nameFil,
              nameId: ing.nameId,
              quantity: part.quantity,
              unit: part.unit,
              category,
              fromRecipeId,
              fromRecipeName: recipe.name,
              fromMealPlanId,
            });
          }
        }
      }

      if (items.length === 0) {
        showToast(t("已加入排餐，但冇需要購買嘅主要食材" as any));
        if (promptNextDay) {
          pendingPostShoppingDateRef.current = maxDate || purchaseDate;
          await finishShoppingConfirm(true, purchaseDate, planMeal);
        } else {
          router.push({ pathname: "/(tabs)/shopping", params: { focusDate: purchaseDate } } as any);
        }
        return;
      }

      const plannedShoppingDate = resolveShoppingPlannedDate(purchaseDate, plannedDate, todayISO());
      const result: any = await addShoppingM.mutateAsync({
        items: withItemPlannedDate(items, plannedShoppingDate),
        plannedDate: plannedShoppingDate,
      });
      const summary = summarizeShoppingBatch(result, items.length);
      track(Events.AiShoppingAutoAdded, { count: summary.added, recipeCount: recipes.length });
      if (summary.allSkipped) {
        showToast(
          t("已加入 {{added}} 項，另有 {{skipped}} 項未能加入（食材來源無效）" as any, { added: summary.added, skipped: summary.skipped }),
          undefined,
          2600,
          "error"
        );
      } else if (summary.skipped > 0) {
        showToast(
          t("已加入 {{added}} 項，另有 {{skipped}} 項未能加入（食材來源無效）" as any, { added: summary.added, skipped: summary.skipped }),
          undefined,
          2600,
          "info"
        );
      } else {
        showToast(t("已加入 {{n}} 樣主要食材" as any, { n: summary.added }), undefined, 2400);
      }
      if (promptNextDay) {
        pendingPostShoppingDateRef.current = maxDate || purchaseDate;
        await finishShoppingConfirm(true, purchaseDate, planMeal);
      } else {
        router.push({ pathname: "/(tabs)/shopping", params: { focusDate: purchaseDate } } as any);
      }
    } catch (e: any) {
      showToast(t("加入食材失敗：{{msg}}" as any, { msg: friendlyError(e) }));
    } finally {
      shopConfirmLockRef.current = false;
    }
  };

  // ─── Backend message builder ───────────────────────────

  // Start generation only after the new session is active. This prevents the
  // first message from being written into the previous conversation.
  useEffect(() => {
    if (!loaded || familySettingsLoading) return;
    const pending = pendingAutoStartRef.current;
    if (!pending || pending.sessionId !== activeChatId) return;
    pendingAutoStartRef.current = null;
    const prefs = buildMealPrefs();
    setMealPrefs(prefs);
    void generateMealPlan(prefs, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, loaded, familySettingsLoading]);

  const buildBackendMessages = (msgs: Message[]): BackendMessage[] => {
    return msgs.map(m => ({ role: m.role, content: m.content }) as BackendMessage);
  };

  const resetAiNextSteps = () => { setAiNextSteps([]); setContractQuickReplies([]); };

  // ─── Chat Handlers ─────────────────────────────────────

  const isMealAnswering = mealStep === "people" || mealStep === "audience" || mealStep === "time" || mealStep === "dislike";

  // #10: 攔截「加入排餐／購物清單／收藏」意圖，唔好畀 AI 呃話「已加入」
  const addDaysISO = (base: string, n: number): string => {
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };

  const handleActionIntent = (text: string): boolean => {
    const validRecipes = recommendedRecipes.filter(isValidRecipe);
    const genericAdd = /^(幫我|請|唔該)?\s*(加入|加埋|加落|加)\s*(佢|呢|全部|埋|啦|呀|啦)?[。！!]?$/.test(text.trim());
    const planRe = genericAdd || /(加入|加埋|加落|排入|入|全部加|加)(.{0,8})(排餐|餐牌|下餐|菜單|三餐)|(加一)(排餐)/.test(text);
    const favRe = /(收藏|收埋|存入食譜庫|加入食譜庫|儲存食譜)/.test(text);
    const shopRe = /(加入|加埋|加落|入)(.{0,6})(購物清單|購物車|購買|買嘢清單)|shopping ?list/i.test(text);

    if (planRe && validRecipes.length > 0) {
      let date = planDate ?? todayISO();
      if (/大後日/.test(text)) date = addDaysISO(todayISO(), 3);
      else if (/後日/.test(text)) date = addDaysISO(todayISO(), 2);
      else if (/聽日|明天|明日/.test(text)) date = addDaysISO(todayISO(), 1);
      else {
        const wdMatch = text.match(/(?:禮拜|星期)(日|天|一|二|三|四|五|六)/);
        if (wdMatch) {
          const wdMap: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
          let diff = (wdMap[wdMatch[1]] - new Date().getDay() + 7) % 7;
          if (diff === 0) diff = 7;
          date = addDaysISO(todayISO(), diff);
        }
      }
      track(Events.AiIntentHandled, { action: "plan", count: validRecipes.length });
      if (validRecipes.length === 1) {
        // Single card follows the single-add conflict preflight, not the batch path.
        setPlanRecipe(validRecipes[0]);
        setBatchRecipes(null);
        setPlanDate(date);
        setShowPlan(true);
      } else {
        addMealPlanBatch(validRecipes, date);
      }
      return true;
    }
    if (shopRe && validRecipes.length > 0) {
      track(Events.AiIntentHandled, { action: "shopping", count: validRecipes.length });
      void autoAddShoppingForPlan(validRecipes, undefined, undefined, undefined, false);
      return true;
    }
    if (favRe) {
      track(Events.AiIntentHandled, { action: "favorite", count: validRecipes.length });
      if (validRecipes.length === 1) {
        handleFavoriteRecipe(validRecipes[0]);
      } else if (validRecipes.length > 1) {
        Alert.alert(t("選擇食譜" as any), t("你想收藏邊個食譜？請㩒卡片上嘅「收藏」掣。" as any));
      }
      return true;
    }
    return false;
  };

  const isActionText = (text: string) =>
    /^(幫我|請|唔該)?\s*(加入|加埋|加落|加)\s*(佢|呢|全部|埋|啦|呀|啦)?[。！!]?$/.test(text.trim()) ||
    /(加入|加埋|加落|排入|全部加|加一)(.{0,8})(排餐|餐牌|下餐|菜單|三餐)/.test(text) ||
    /(加入|加埋|加落|入)(.{0,6})(購物清單|購物車|購買|買嘢清單)|shopping ?list/i.test(text) ||
    /(收藏|收埋|存入食譜庫|加入食譜庫|儲存食譜)/.test(text);

  const isModifyText = (text: string) =>
    /(少辣|小辣|微辣|清淡|少油|少鹽|唔要|不要|走|刪|換|加多|加一道|改.*人|改.*時間|轉做|轉成)/.test(text);

  const isHowToQuestion = (text: string) => {
    const value = text.trim();
    return /^(唔該|請問|我想問|想問|想知)?\s*(點樣|點解|如何|點做|教我|怎樣|點先|點至|可以點)/.test(value) ||
      /^(我想問|想問|請問|想知|唔該想問)/.test(value) ||
      /(點樣|點解|如何|點做)/.test(value) && /[?？]\s*$/.test(value);
  };
  const isActionQuestion = (text: string) => {
    const value = text.trim();
    const action = "(加入|加埋|加落|排餐|購物|收藏)";
    const ask = "(可唔可以|能唔能夠|好唔好|得唔得|應唔應該|係咪|可以嗎|嗎)";
    return new RegExp(`(?:${ask})[^。！!？?]{0,16}${action}`).test(value) ||
      new RegExp(`${action}[^。！!？?]{0,16}(?:${ask})`).test(value);
  };
  const isQuestionText = (text: string) =>
    isHowToQuestion(text) || /[?？]|^(好唔好|得唔得|係咪|可以嗎|咩|什麼|為什麼|why|how|what|你覺得|可唔可以)/i.test(text.trim());

  const extractRecipeNamesFromText = (text: string): string[] => {
    const names: string[] = [];
    for (const line of text.split("\n")) {
      const listMatch = line.match(/^\s*(?:\d+[.、)]|[-•])\s*(.+?)\s*$/);
      const boldMatch = line.match(/^\s*(?:#{1,3}\s*)?\*\*(.+?)\*\*/);
      const matchText = listMatch?.[1] ?? boldMatch?.[1];
      if (!matchText) continue;
      const cleaned = matchText
        .replace(/^\*\*[^*]+\*\*\s*[:：]\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/^(?:Recipe\s*\d+\s*[:.\-]\s*)/i, "")
        .replace(/\s*[（(].*?[）)]\s*$/g, "")
        .replace(/\s+[-–—]\s+.*$/, "")
        .trim();
      if (cleaned.length >= 2 && cleaned.length <= 60 && !/^(食材|步驟|做法|材料|Ingredients|Steps)$/i.test(cleaned)) {
        if (!names.includes(cleaned)) names.push(cleaned);
      }
    }
    return names;
  };

  const parsePlanDateFromText = (text: string): string => {
    if (/大後日/.test(text)) return addDaysISO(todayISO(), 3);
    if (/後日/.test(text)) return addDaysISO(todayISO(), 2);
    if (/聽日|明天|明日/.test(text)) return addDaysISO(todayISO(), 1);
    const wdMatch = text.match(/(?:禮拜|星期)(日|天|一|二|三|四|五|六)/);
    if (wdMatch) {
      const wdMap: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
      let diff = (wdMap[wdMatch[1]] - new Date().getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return addDaysISO(todayISO(), diff);
    }
    return planDate ?? todayISO();
  };

  const resolveRecipesByNames = async (names: string[]): Promise<AIRecipe[]> => {
    const searchCandidates = (name: string): string[] => {
      const cleaned = name
        .replace(/^\s*\*\*|\*\*\s*$/g, "")
        .replace(/^\s*#{1,3}\s*/, "")
        .replace(/^(?:Recipe\s*\d+\s*[:.\-]\s*)/i, "")
        .replace(/\s+[-–—]\s+.*$/, "")
        .trim();
      const inside = [...cleaned.matchAll(/[（(]([^）)]+)[）)]/g)].map((m) => m[1].trim());
      const withoutParen = cleaned.replace(/\s*[（(][^）)]*[）)]\s*/g, " ").trim();
      return Array.from(new Set([cleaned, withoutParen, ...inside].filter((x) => x.length >= 2)));
    };

    const results = await Promise.all(
      names.map(async (name) => {
        try {
          const byId = new Map<string, AIRecipe>();
          for (const candidate of searchCandidates(name)) {
            const res: any = await apiClient.recipes.search.query({ query: candidate, limit: 8 });
            const list = Array.isArray(res) ? res : (res?.recipes ?? []);
            for (const recipe of list.map(normalizeRecipe).filter(isValidRecipe)) {
              const key = String(recipe.id ?? recipe.name ?? "");
              if (key) byId.set(key, recipe);
            }
          }
          const target = name;
          const ranked = [...byId.values()]
            .map((recipe) => ({
              recipe,
              score: Math.max(
                recipeNameSimilarity(recipe.name || "", target),
                recipeNameSimilarity(recipe.nameEn || "", target),
                recipeNameSimilarity(recipe.nameFil || "", target),
                recipeNameSimilarity(recipe.nameId || "", target),
              ),
            }))
            .sort((a, b) => b.score - a.score);
          return ranked[0] && ranked[0].score >= 0.72 ? ranked[0].recipe : null;
        } catch {
          return null;
        }
      }),
    );
    const seen = new Set<string>();
    return results.filter((r): r is AIRecipe => {
      if (!r) return false;
      const key = normalizeRecipeName(r.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleTextActionFallback = async (text: string): Promise<boolean> => {
    if (!isActionText(text)) return false;
    const names = [...messages]
      .reverse()
      .filter((m) => m.role === "assistant")
      .map((m) => extractRecipeNamesFromText(contentToText(m.content)))
      .find((list) => list.length > 0) ?? [];
    if (names.length === 0) {
      addBotMessage(t("我見唔到上一則回覆有食譜清單。請重新生成食譜卡，或者直接講菜名。" as any));
      return true;
    }
    const resolved = await resolveRecipesByNames(names);
    if (resolved.length === 0) {
      addBotMessage(t("我未能由文字清單還原食譜。請重新生成食譜卡。" as any));
      return true;
    }
    // Append functionally: resolution is async, and an awaited addUserMessage()
    // would overwrite any newer message sent while we were searching.
    updateMessages(prev => [...prev, { role: "user", content: text }]);
    scrollToEnd();
    track(Events.AiActionFallback, { count: resolved.length });
    if (/(購物清單|購物車|購買|買嘢清單)|shopping ?list/i.test(text)) {
      void autoAddShoppingForPlan(resolved, undefined, undefined, undefined, false);
    } else if (/(收藏|收埋|存入食譜庫|加入食譜庫|儲存食譜)/.test(text)) {
      if (resolved.length === 1) void handleFavoriteRecipe(resolved[0]);
      else Alert.alert(t("選擇食譜" as any), t("請先選擇一張食譜卡。" as any));
    } else if (resolved.length === 1) {
      setPlanRecipe(resolved[0]);
      setBatchRecipes(null);
      setPlanDate(parsePlanDateFromText(text));
      setShowPlan(true);
    } else {
      void addMealPlanBatch(resolved, parsePlanDateFromText(text));
    }
    return true;
  };

  // A history entry is restorable only when it has a real card snapshot or the
  // session store can resolve exactly one unambiguous card set for its names.
  const restorableHistory = useMemo(() => {
    return cardHistory.filter((entry) => {
      const snapshot = Array.isArray(entry.cards) ? entry.cards.filter(isValidRecipe) : [];
      if (snapshot.length > 0) return true;
      return matchCardsFromSessions(entry.names, sessions, isValidRecipe, entry.at) !== null;
    });
  }, [cardHistory, sessions]);

  const hasRestorable = restorableHistory.length > 0;
  const restoreBarNames = restorableHistory[0]?.names ?? [];

  const applyRestoredCards = (resolved: AIRecipe[]) => {
    lastChefRequestIdRef.current = null;
    setRecommendedRecipes(resolved);
    setMealResult(resolved.length >= 2 ? resolved : null);
    setChatStarted(true);
    recordSeenRecipes(resolved);
    track(Events.AiCardsRestored, { count: resolved.length });
    showToast(t("已還原 {{n}} 張食譜卡" as any, { n: resolved.length }));
    scrollToLatestMessage();
  };

  const resolveLegacyHistory = async (entry: { names: string[] }): Promise<AIRecipe[]> => {
    const resolved = await resolveRecipesByNames(entry.names);
    return resolved.length === entry.names.length ? resolved : [];
  };

  // Upgrade a names-only entry in place: same id/at/position, no new history entry.
  const upgradeHistoryEntry = (entry: CardHistoryEntry, cards: AIRecipe[]) => {
    const next = cardHistoryRef.current.map((item) =>
      item.id === entry.id
        ? { ...item, cards, version: 2, key: cardSetKey(cards) }
        : item,
    );
    persistCardHistory(next);
  };

  const restoreCardHistory = async (entry: CardHistoryEntry) => {
    if (restoringCards) return;
    setRestoringCards(true);
    try {
      const snapshot = Array.isArray(entry.cards) ? entry.cards.filter(isValidRecipe) : [];
      let resolved = snapshot;
      if (resolved.length === 0) {
        const matched = matchCardsFromSessions(entry.names, sessions, isValidRecipe, entry.at);
        if (matched && matched.length > 0) {
          resolved = matched.filter(isValidRecipe);
          if (resolved.length > 0) upgradeHistoryEntry(entry, resolved);
        }
      }
      if (resolved.length === 0) {
        const legacy = await resolveLegacyHistory(entry);
        if (legacy.length > 0) {
          resolved = legacy;
          upgradeHistoryEntry(entry, legacy);
        }
      }
      if (resolved.length === 0) {
        Alert.alert(t("未能還原食譜卡" as any), t("此舊記錄未能還原，請重新生成食譜。" as any));
        return;
      }
      setShowCardHistory(false);
      applyRestoredCards(resolved);
    } finally {
      setRestoringCards(false);
    }
  };

  const handleModifyIntent = (text: string): boolean => {
    if (!isModifyText(text)) return false;
    const validCards = recommendedRecipes.filter(isValidRecipe);
    if (validCards.length === 0) return false;
    addUserMessage(text);
    const removeMatch = text.match(/(?:唔要|不要|走|刪走|唔食)\s*([^\s，,。！!？?]+)/);
    if (removeMatch) {
      const term = removeMatch[1].trim();
      const preDeleteKey = cardSetKey(validCards);
      const kept = validCards.filter((r) => {
        const hay = `${r.name} ${r.description ?? ""} ${(r.ingredients ?? []).map((i) => i.name).join(" ")}`;
        return !hay.includes(term);
      });
      if (kept.length !== validCards.length) {
        setRecommendedRecipes(kept);
        setMealResult(kept.length >= 2 ? kept : null);
        syncCardHistoryEntry(preDeleteKey, kept);
        addBotMessage(t("已移除含有「{{name}}」嘅菜式。" as any, { name: term }));
        return true;
      }
    }
    if (/換/.test(text)) {
      const soupIndex = validCards.findIndex((r) => getDishType(r) === "soup");
      if (/湯/.test(text) && soupIndex >= 0) {
        void handleSwapRecipe(validCards[soupIndex], soupIndex);
        return true;
      }
      addBotMessage(t("你想換邊一張？可以用卡片上嘅「換」掣，或者講「換走個湯」。" as any));
      return true;
    }
    addBotMessage(t("呢個修改可以用卡片上嘅「換」或「刪」掣，或者講清楚要改邊張、改成點。" as any));
    return true;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setInput("");
    resetAiNextSteps();
    // ─── Layer 0: Greeting (already exists) ──────────────────
    if (isGreetingText(trimmed)) {
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }, { role: "assistant", content: greetingReply }];
      updateMessages(() => msgs);
      setRecommendedRecipes([]);
      setMealResult(null);
      setMealStep("idle");
      scrollToEnd();
      return;
    }

    // ─── Simple acknowledgement: don't spend an AI call on "ok" ─────────
    if (/^(ok|okay|ok!|好|好的|得|收到|thanks|thank you|thx)[.!。！？]*$/i.test(trimmed)) {
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }, { role: "assistant", content: t("aiChef.ack" as any) }];
      updateMessages(() => msgs);
      setAiNextSteps([]);
      scrollToEnd();
      return;
    }

    // ─── Send to backend - all input goes to LLM (except greetings) ─────────
    if (isMealAnswering) {
      handleMealAnswer(trimmed);
    } else if (isHowToQuestion(trimmed) || isActionQuestion(trimmed)) {
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }];
      updateMessages(() => msgs);
      track(Events.AiFreeTextSent, { hasQuestion: true, hasCards: recommendedRecipes.length > 0, mealStep: mealStep !== "idle" });
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else if (handleActionIntent(trimmed)) {
      // handled client-side; do not send to AI
    } else if (isActionText(trimmed)) {
      void handleTextActionFallback(trimmed);
    } else if (askingIngredients) {
      setAskingIngredients(false);
      const prompt = t("aiChef.pantryPrompt", { items: trimmed });
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else if (handleModifyIntent(trimmed)) {
      // handled client-side; do not send to AI
    } else if (detectMealIntent(trimmed)) {
      // 高信心「X 餸 Y 湯」意圖：直接出返正確數量（唔好當自由對話亂抽 keyword）
      const intent = detectMealIntent(trimmed)!;
      const flavor = detectFlavorConstraint(trimmed);
      activeHotKeyRef.current = null;
      if (mealStep !== "idle") { setMealStep("idle"); setMealResult(null); }
      updateMessages(prev => [...prev, { role: "user", content: trimmed }]);
      scrollToEnd();
      void generateMealFromIntent(intent, flavor);
    } else {
      // Analytics: a free-text follow-up while recipes already exist is treated
      // as an "edit/refine" of the previous suggestion.
      if (
        recommendedRecipes.filter(isValidRecipe).length > 0 &&
        /(改|換|轉|調整|少|多|走|加減|唔要|不要|少辣|少甜|素食|拌|炒|蒸|焗|煎|炸|燉)/.test(trimmed)
      ) {
        track(Events.AiEditUsed);
      }
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }];
      updateMessages(() => msgs);
      track(Events.AiFreeTextSent, {
        hasQuestion: isQuestionText(trimmed),
        hasCards: recommendedRecipes.length > 0,
        mealStep: mealStep !== "idle",
      });
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    }
  };

  const handlePrompt = (p: string) => {
    if (chatMutation.isPending) return;
    activeHotKeyRef.current = null; // 打字 = 新意圖，唔再跟舊 hotkey
    resetAiNextSteps();
    if (isGreetingText(p)) {
      const msgs: Message[] = [...messages, { role: "user", content: p }, { role: "assistant", content: greetingReply }];
      updateMessages(() => msgs);
      setRecommendedRecipes([]);
      setMealResult(null);
      setMealStep("idle");
      scrollToEnd();
      return;
    }
    if (isMealAnswering) {
      handleMealAnswer(p);
    } else if (isHowToQuestion(p) || isActionQuestion(p)) {
      const msgs: Message[] = [...messages, { role: "user", content: p }];
      updateMessages(() => msgs);
      track(Events.AiFreeTextSent, { hasQuestion: true, hasCards: recommendedRecipes.length > 0, mealStep: mealStep !== "idle" });
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else if (handleActionIntent(p)) {
      // handled client-side
    } else if (isActionText(p)) {
      void handleTextActionFallback(p);
    } else if (askingIngredients) {
      setAskingIngredients(false);
      const prompt = t("aiChef.pantryPrompt", { items: p });
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else if (handleModifyIntent(p)) {
      // handled client-side
    } else {
      const msgs: Message[] = [...messages, { role: "user", content: p }];
      updateMessages(() => msgs);
      const appendCards = recommendedRecipes.length > 0
        && /(加|再|仲有|有冇|有沒有|another|more|add|多一)/i.test(p)
        && !/(換|唔要|不要|remove|replace|改)/i.test(p);
      sendChat(buildBackendMessages(msgs), undefined, appendCards ? "append" : undefined);
      scrollToEnd();
    }
  };

  const handleNextStep = (text: string) => {
    if (chatMutation.isPending) return;
    if (/遇到問題|同我講/.test(text)) {
      openSupport("ai_chef_error");
      return;
    }
    if (/3餸1湯|今晚食咩|設計晚餐|設計今晚/.test(text)) {
      resetAiNextSteps();
      startMealFlow();
      return;
    }
    handlePrompt(text);
  };

  const showPhotoAiFailure = (
    reason: "quality_rejected" | "malformed_recipe" | "legacy_rejected" | "network",
    steps = 0,
    minSteps = 0,
  ) => {
    const message = reason === "quality_rejected"
      ? t("aiChef.photoAiQualityFailed" as any, { steps, minSteps })
      : reason === "network"
        ? t("aiChef.photoAiNetworkFailed" as any)
        : t("aiChef.photoAiMalformed" as any);
    addBotMessage(message);
    const replies: { actionId: string; labelKey: string }[] = [];
    if (lastPhotoAssetRef.current) replies.push({ actionId: "photo_retry", labelKey: "aiChef.photoAiRetry" });
    if (aiCanGenerate && !aiReplyBlocked) replies.push({ actionId: "photo_regenerate", labelKey: "aiChef.photoAiRegenerate" });
    setContractQuickReplies(replies);
    track(Events.AiChefFailure, {
      kind: reason === "quality_rejected" ? "photo_ai_quality" : reason === "network" ? "photo_ai_network" : "photo_ai_malformed",
      reason,
      steps,
      minSteps,
      lang: i18n.language,
    });
  };

  // One photo -> one generateFromImage request. The ref guard covers both the
  // dish ai_generate path and the legacy similar_ai path, including fast double taps.
  const generatePhotoRecipe = async (sourceAction: "similar_ai" | "ai_generate" | "photo_regenerate") => {
    const ctx = visionContextRef.current;
    if (!ctx?.imageKey) {
      showToast(t("搵唔到相片資料，請再影一次" as any));
      return;
    }
    if (photoAiBusyRef.current) return;
    photoAiBusyRef.current = true;
    try {
      const res = await apiClient.aiRecipe.generateFromImage.mutate({ storageKeys: [ctx.imageKey] });
      const rawRecipe = res?.recipe;
      if (!rawRecipe) {
        showPhotoAiFailure("malformed_recipe");
        return;
      }
      const recipe = normalizeRecipe(rawRecipe);
      const decision = decidePhotoRecipe(recipe, res?.quality);
      if (!decision.accepted) {
        showPhotoAiFailure(decision.reason, decision.steps, decision.minSteps);
        return;
      }
      const accepted = decision.recipe as AIRecipe;
      setRecommendedRecipes([accepted]);
      commitCardHistory([accepted]);
      setMealResult(null);
      setChatStarted(true);
      recordSeenRecipes([accepted]);
      addBotMessage(t("aiChef.similarAiDone" as any));
      setContractQuickReplies([]);
      visionContextRef.current = null;
      track(Events.AiRecipeGenerated, { count: 1, source: "photo", action: sourceAction });
    } catch (e) {
      console.error("[photoFlow] generateFromImage failed:", friendlyError(e) || e);
      showPhotoAiFailure("network");
    } finally {
      photoAiBusyRef.current = false;
      void usageUtils.family.usage.invalidate();
      void (usageUtils.aiRecipe as any).status.invalidate();
    }
  };

  const handleContractQuickReply = (actionId: string) => {
    if (chatMutation.isPending) {
      showToast(t("AI 回覆中，請稍等" as any));
      return;
    }
    if ((actionId === "ai_generate" || actionId === "similar_ai" || actionId === "photo_regenerate") && aiReplyBlocked) return;
    if (photoAiBusyRef.current && (actionId === "ai_generate" || actionId === "similar_ai" || actionId === "photo_regenerate")) return;
    setContractQuickReplies([]);
    if (actionId === "photo_retry") {
      const asset = lastPhotoAssetRef.current;
      if (!asset) {
        showToast(t("搵唔到相片資料，請再影一次" as any));
        return;
      }
      void runPhotoFlow(asset);
      return;
    }
    if (actionId === "photo_regenerate") {
      void generatePhotoRecipe("photo_regenerate");
      return;
    }
    if (actionId === "similar_library") {
      track(Events.AiActionFallback, { actionId, source: "quick_reply" });
      const ctx = visionContextRef.current;
      if (!ctx) return;
      const query = (ctx.dishName || ctx.ingredients.join(" ")).trim();
      if (!query) return;
      void (async () => {
        try {
          const res = await apiClient.recipes.search.query({ query, limit: 6 });
          const recipes = (Array.isArray(res?.recipes) ? res.recipes : []).map(normalizeRecipe).filter(isValidRecipe);
          if (recipes.length > 0) {
            setSwapNoCards(null);
            setRecommendedRecipes(recipes);
            commitCardHistory(recipes);
            setMealResult(null);
            setChatStarted(true);
            recordSeenRecipes(recipes);
            addBotMessage(t("aiChef.pantryMatchN", { n: recipes.length }));
          } else {
            addBotMessage(t("aiChef.similarNoMatch" as any));
          }
        } catch (e) {
          Alert.alert(t("搵食譜失敗" as any), friendlyError(e));
        }
      })();
      return;
    }
    if (actionId === "similar_ai") {
      // UI is hidden by the quick-reply whitelist; keep the handler for one release
      // so stale backend replies fail gracefully and stay observable.
      track(Events.AiActionFallback, { actionId, source: "quick_reply" });
      void generatePhotoRecipe("similar_ai");
      return;
    }
    if (actionId === "text_ingredients") {
      setAskingIngredients(true);
      setChatStarted(true);
      setContractQuickReplies([]);
      addBotMessage(t("aiChef.askFridgeIngredients" as any));
      return;
    }
    if (actionId === "restart") {
      handleNewChat();
      return;
    }
    if (actionId === "ai_generate" && visionContextRef.current?.scene === "fridge") {
      const items = visionContextRef.current.ingredients;
      const prompt = t("aiChef.pantryPrompt", { items: items.join("、") });
      const msgs: Message[] = [{ role: "user", content: prompt }];
      updateMessages(prev => [...prev, ...msgs]);
      sendChat(buildBackendMessages(msgs), "ai");
      visionContextRef.current = null;
      scrollToEnd();
      return;
    }
    if (actionId === "ai_generate" && visionContextRef.current?.scene === "dish") {
      // A dish photo must generate from the photo content, not the generic prompt.
      void generatePhotoRecipe("ai_generate");
      return;
    }
    if (actionId === "ai_generate") {
      const aiEntry = (libraryMissScenario ? `tab_${libraryMissScenario}` : "quick_reply") as AiEntry;
      setLibraryMissScenario(null);
      requestInstantRecipes("ai", aiEntry);
      return;
    }
    if (actionId === "closest_library") {
      if (libraryAlternatives.length === 0) return;
      const picked = libraryAlternatives;
      setSwapNoCards(null);
      setRecommendedRecipes(picked);
      commitCardHistory(picked);
      setMealResult(picked.length >= 2 ? picked : null);
      setChatStarted(true);
      recordSeenRecipes(picked);
      addBotMessage(t("aiChef.closestLibraryResult"));
      return;
    }
    if (actionId === "import_recipe") {
      router.push("/import");
      return;
    }
  };

  const handleConvertToRecipeCard = () => {
    const lastBot = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastBot) return;
    // 純前端抽卡：由最近一條 assistant 訊息抽食譜卡（唔再 call LLM，避免將 JSON 指令顯示俾用戶）
    const text = contentToText(lastBot.content);
    const parsed = tryParseRecipes(text).map(normalizeRecipe).filter(isValidRecipe);
    if (parsed.length > 0) {
      setRecommendedRecipes(parsed);
      commitCardHistory(parsed);
      setMealResult(parsed.length >= 2 ? parsed : null);
      setChatStarted(true);
      recordSeenRecipes(parsed);
      scrollToLatestMessage();
      return;
    }
    // 抽唔到 → 用唔顯示嘅指令 call LLM（唔加落 user message，用戶唔會見到）
    const convertPrompt = "請將你剛才嘅建議，用 JSON 格式整理：{\"replyText\":\"...\",\"recipes\":[...]}";
    resetAiNextSteps();
    mutateChat({ messages: buildBackendMessages([...messages, { role: "user", content: convertPrompt }]), lang: i18n.language });
    scrollToLatestMessage();
  };

  // ─── Plan modal confirm ────────────────────────────────

  const getMealConflict = async (date: string): Promise<{ plans: any[]; isEatOut: boolean }> => {
    let plans: any[] = [];
    let eatOutDates: any[] = [];
    try {
      plans = await utils.mealPlan.listByDateRange.fetch({ startDate: date, endDate: date }) as any[];
    } catch { /* keep empty */ }
    try {
      eatOutDates = await (utils as any).eatOut.listByDateRange.fetch({ startDate: date, endDate: date }) as any[];
    } catch { /* keep empty */ }
    return {
      plans: (plans as any[]).filter((meal) => meal.status !== "rejected"),
      isEatOut: Array.isArray(eatOutDates) && eatOutDates.includes(date),
    };
  };

  const askDeleteRelatedShopping = (execute: (replace: boolean, deleteShopping: boolean) => void) => {
    Alert.alert(
      t("要唔要同時刪除相關購物清單？" as any),
      t("只會刪除未購買、由呢個排餐加入嘅食材。" as any),
      [
        { text: t("保留購物清單" as any), style: "cancel", onPress: () => execute(true, false) },
        { text: t("刪除相關購物清單" as any), style: "destructive", onPress: () => execute(true, true) },
      ],
    );
  };

  const executeSingleAdd = async (recipe: AIRecipe, date: string, mealType: string) => {
    if (singleAddBusyRef.current) return;
    if (!isValidRecipe(recipe)) {
      Alert.alert(t("無法加入" as any), t("此食譜資料不完整（缺少食材或步驟），無法加入排餐。" as any));
      return;
    }
    // Override servings with user's preference if from meal plan flow
    const overrideServings = mealPrefs.people > 0 && (isSoupModeRef.current || mealStep === "result" || (mealResult?.length ?? 0) > 0)
      ? mealPrefs.people
      : null;
    // 如果人數有變，按比例縮放食材份量（調味料唔縮）
    const servingRatio = overrideServings && recipe.servings > 0
      ? overrideServings / recipe.servings
      : 1;
    const scaledIngredients = servingRatio === 1
      ? recipe.ingredients
      : recipe.ingredients.map((ing) => ({
          ...ing,
          quantity: calcAdjustedQty(String(ing.quantity ?? ""), ing.unit ?? "", categorizeIngredient(ing.name), servingRatio),
        }));
    singleAddBusyRef.current = true;
    const scaledRecipe: AIRecipe = { ...recipe, ingredients: scaledIngredients };
    planRecipeRef.current = scaledRecipe;
    const ref = resolveRecipeRef(recipe);
    if (ref.isLibraryRef) {
      // Capture the exact recipe now. A later card tap must not change what we add to shopping.
      pendingSinglePlanRecipeRef.current = scaledRecipe;
      addPlanM.mutate({
        date, mealType: mealType as any,
        recipeId: ref.recipeId, recipeName: recipe.name,
        recipeNameEn: recipe.nameEn, recipeNameFil: recipe.nameFil, recipeNameId: recipe.nameId,
        recipeImage: getRecipeImage(recipe),
        autoAddIngredients: false,
      });
    } else {
      (async () => {
        try {
          const savedId = await ensureSaved(recipe, overrideServings, scaledIngredients);
          const withRef: AIRecipe = { ...scaledRecipe, _savedId: savedId, _libraryRecipeId: `user_${savedId}` };
          planRecipeRef.current = withRef;
          pendingSinglePlanRecipeRef.current = withRef;
          addPlanM.mutate({
            date, mealType: mealType as any,
            recipeId: `user_${savedId}`, recipeName: recipe.name,
            recipeNameEn: recipe.nameEn, recipeNameFil: recipe.nameFil, recipeNameId: recipe.nameId,
            recipeImage: getRecipeImage(recipe),
            autoAddIngredients: false,
          });
        } catch (e: any) {
          pendingSinglePlanRecipeRef.current = null;
          singleAddBusyRef.current = false;
          if (showLimitError(e)) return;
          Alert.alert(t("加入排餐失敗" as any), friendlyError(e) || t("請稍後再試" as any));
        }
      })();
    }
  };

  const confirmAction = async () => {
    // Guard: ensure modal was shown
    if (!showPlan) {
      console.error("[AI Chef] confirmAction called without modal being shown!");
      return;
    }
    // Guard: ensure date is selected
    if (!planDate) {
      Alert.alert(t("請選擇日期" as any));
      return;
    }
    // Batch mode: add all recipes to meal plan with selected date/mealType
    if (batchRecipes && batchRecipes.length > 0) {
      const recipesForShopping = batchRecipes;
      const buildItems = (force: boolean) => batchRecipes.map((r: any) => {
        const libId = r._libraryRecipeId;
        return {
          date: planDate,
          mealType: planMeal as any,
          recipeId: libId || `user_${r._savedId}`,
          recipeName: r.name,
          recipeNameEn: r.nameEn,
          recipeNameFil: r.nameFil,
          recipeNameId: r.nameId,
          recipeImage: getRecipeImage(r),
          ingredients: (r.ingredients ?? []).map((ing: any) => ({
            name: ing.name,
            nameEn: ing.nameEn,
            nameFil: ing.nameFil,
            nameId: ing.nameId,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        };
      });
      const afterAdded = (results: any[]) => {
        // 合併多個 result（第一次成功 + force 補加）嘅成功項，確保所有成功加入嘅食譜都開到購物車
        const mergedItems: any[] = [];
        const seenPlan = new Set<number>();
        for (const res of results) {
          for (const it of (res?.items ?? [])) {
            if (it?.newPlanId != null && seenPlan.has(it.newPlanId)) continue;
            if (it?.newPlanId != null) seenPlan.add(it.newPlanId);
            mergedItems.push(it);
          }
        }
        track(Events.AiPlanAdded, {
          requestId: lastChefRequestIdRef.current ?? undefined,
          count: mergedItems.length,
          batch: true,
        });
        const addedIds = new Set(mergedItems.map((it: any) => String(it.recipeId)));
        const planIdByRecipeId = new Map<string, number>();
        mergedItems.forEach((it: any) => planIdByRecipeId.set(String(it.recipeId), it.newPlanId));
        // 只對「成功加入排餐」嘅食譜開購物車；被外出/重複跳過嘅唔入購物車（唔再 fallback 去 recipesForShopping）
        const shoppingRecipes = recipesForShopping.filter((r: any) => {
          const libId = r._libraryRecipeId ? String(r._libraryRecipeId) : "";
          const savedId = r._savedId ? `user_${r._savedId}` : "";
          return addedIds.has(libId) || addedIds.has(savedId);
        });
        if (shoppingRecipes.length === 0) {
          // 全部被跳過（例如全部設定咗外出）—— 唔跳去購物車
          setShowPlan(false);
          setBatchRecipes(null);
          void showNextDayPrompt(lastPlannedDateRef.current ?? planDate ?? todayISO(), planMeal);
          return;
        }
        // 對位：每個 shopping 食譜搵返佢自己嘅 newPlanId（唔可以直接用 result.items 次序，因 shoppingRecipes 可能係過濾子集）
        const planIds = shoppingRecipes.map((r: any) => {
          const libId = r._libraryRecipeId ? String(r._libraryRecipeId) : "";
          const savedId = r._savedId ? `user_${r._savedId}` : "";
          return planIdByRecipeId.get(libId) ?? planIdByRecipeId.get(savedId);
        });

        // 原設計：批量排餐成功後同樣直接開食材選擇 modal，唔自動加購物清單。
        const batchPlanDate = planDate ?? todayISO();
        shopConfirmHandoff.queue({
          recipes: shoppingRecipes,
          planIds,
          planDate: batchPlanDate,
          shopDate: getDayBefore(batchPlanDate),
        }, setShopConfirm);
        setShowPlan(false);
        setBatchRecipes(null);
      };
      const executeBatch = async (replaceExistingDinner: boolean, deleteRelatedShopping: boolean) => {
      try {
        const result = await addPlanBatchM.mutateAsync({
          items: buildItems(false),
          replaceExistingDinner,
          deleteRelatedShopping,
        });
        const pro = summarizeMealPlanBatch(result, buildItems(false).length);
        if (pro.proRequired > 0) {
          setPaywallFeature("kol_plan");
          setShowPaywall(true);
          showToast(
            t("limitErrors.batchAddedNeedPro" as any, {
              added: pro.added,
              needPro: pro.proRequired,
            }),
            undefined,
            4000,
            "error",
          );
          return;
        }
        const skipped = result?.skippedCount ?? (result?.skippedDays?.length ?? 0);
        if (skipped > 0) {
          const days = result?.skippedDays?.length ? result.skippedDays.join("、") : "";
          const hasDup = !!result?.skippedDueToDuplicate;
          const hasEatOut = !!result?.skippedDueToEatOut;
          if (hasEatOut) {
            // 外出要問；重複唔會因為 force 而加入，會繼續 skip。
            Alert.alert(
              t("衝突提示" as any),
              hasDup
                ? t("有 {{n}} 道食譜被跳過（{{days}}）：部分重複、部分當日外出。確定要加入外出部分嗎？重複食譜仍會跳過。" as any, { n: skipped, days })
                : t("當日已設定外出（{{days}}），確定要排餐嗎？" as any, { days }),
              [
                { text: t("取消" as any), style: "cancel", onPress: () => {} },
                { text: t("確定" as any), onPress: async () => {
                  try {
                    const forced = await addPlanBatchM.mutateAsync({ items: buildItems(true), force: true, replaceExistingDinner, deleteRelatedShopping });
                    afterAdded([result, forced]);
                  } catch (e: any) {
                    Alert.alert(t("加入排餐失敗" as any), friendlyError(e) || t("請稍後再試" as any));
                  }
                } },
              ],
              { cancelable: false },
            );
          } else if (hasDup) {
            Alert.alert(
              t("重複食譜提示" as any),
              t("有 {{n}} 道食譜同日已排過（{{days}}），已跳過重複項目。" as any, { n: skipped, days }),
              [{ text: t("確定" as any), onPress: () => afterAdded([result]) }],
              { cancelable: false },
            );
          } else {
            Alert.alert(
              t("部分食譜未加入" as any),
              t("有 {{n}} 道食譜未加入（{{days}}）。" as any, { n: skipped, days }),
              [{ text: t("確定" as any), onPress: () => afterAdded([result]) }],
              { cancelable: false },
            );
          }
          return;
        }
        afterAdded([result]);
      } catch (e: any) {
        if (showLimitError(e)) return;
        Alert.alert(t("加入排餐失敗" as any), friendlyError(e) || t("請稍後再試" as any));
      }
      };

      const { plans: conflictPlans } = planDate ? await getMealConflict(planDate) : { plans: [] };
      const existingForMeal = conflictPlans.filter((meal) => meal.mealType === planMeal);
      const addTotal = existingForMeal.length + batchRecipes.length;
      if (planDate && addTotal > 16) {
        setShowPlan(false);
        track(Events.AiIntentHandled, { action: "meal_limit", count: batchRecipes.length, mealType: planMeal, total: addTotal });
        conflictProceedRef.current = (mode) => {
          if (mode === "replace") askDeleteRelatedShopping((replace, deleteShopping) => { void executeBatch(replace, deleteShopping); });
          else void executeBatch(false, false);
        };
        const limit = {
          date: planDate,
          existingCount: existingForMeal.length,
          newCount: batchRecipes.length,
          canReplace: batchRecipes.length <= 16,
        };
        setTimeout(() => setMealLimit(limit), 260);
        return;
      }
      if (existingForMeal.length > 0 && planDate && batchRecipes.length > 1) {
        setShowPlan(false);
        track(Events.AiIntentHandled, { action: "batch_conflict", count: batchRecipes.length, mealType: planMeal });
        conflictProceedRef.current = (mode) => {
          if (mode === "replace") askDeleteRelatedShopping((replace, deleteShopping) => { void executeBatch(replace, deleteShopping); });
          else void executeBatch(false, false);
        };
        const fallbackMeal = enumT.meal(planMeal);
        const conflict = {
          date: planDate,
          names: existingForMeal.map((meal) => getBilingualName(meal.recipeName, meal.recipeNameEn, meal.recipeNameFil, meal.recipeNameId).primary || fallbackMeal),
          hint: existingForMeal.length >= 4 ? t("當日已經好豐富，仍要加入？" as any) : undefined,
        };
        // 等 plan modal 完全 dismiss 先開 conflict modal；否則 iOS 會出現兩個 Modal 疊住／第二個唔顯示。
        setTimeout(() => setMealConflict(conflict), 260);
        return;
      }
      await executeBatch(false, false);
      return;
    }

    // Single recipe mode
    if (!planRecipe) return;
    const sourceRecipe = planRecipe;
    if (!isValidRecipe(sourceRecipe)) {
      Alert.alert(t("無法加入" as any), t("此食譜資料不完整（缺少食材或步驟），無法加入排餐。" as any));
      return;
    }
    const { plans: conflictPlans, isEatOut } = await getMealConflict(planDate);
    const existingForMeal = conflictPlans.filter((meal) => meal.mealType === planMeal);
    if (existingForMeal.length + 1 > 16) {
      setShowPlan(false);
      track(Events.AiIntentHandled, { action: "meal_limit", count: 1, mealType: planMeal, total: existingForMeal.length + 1 });
      const limit = {
        date: planDate,
        existingCount: existingForMeal.length,
        newCount: 1,
        canReplace: false,
      };
      setTimeout(() => setMealLimit(limit), 260);
      return;
    }
    const duplicate = conflictPlans.some(
      (meal) => (meal.recipeName || "").trim() === (sourceRecipe.name || "").trim(),
    );
    const eatOutConflict = planMeal === "dinner" && isEatOut;
    if (duplicate || eatOutConflict) {
      const body = duplicate && eatOutConflict
        ? t("呢個食譜今日已排過，當日亦設定外出。仍要加入嗎？" as any)
        : duplicate
          ? t("呢個食譜今日已經排過，仍要加入嗎？" as any)
          : t("當日已設定外出，仍要排晚餐嗎？" as any);
      Alert.alert(t("衝突提示" as any), body, [
        { text: t("取消" as any), style: "cancel" },
        { text: t("仍要加入" as any), onPress: () => { void executeSingleAdd(sourceRecipe, planDate, planMeal); } },
      ], { cancelable: false });
      return;
    }
    await executeSingleAdd(sourceRecipe, planDate, planMeal);
  };

  // ─── Render: Message bubble ────────────────────────────

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const hasImage = typeof item.content !== "string" && Array.isArray(item.content) &&
      item.content.some(b => b.type === "image_url");

    return (
      <View style={[s.msgRow, isUser && { justifyContent: "flex-end" }]}>
        {!isUser && <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot, hasImage && { backgroundColor: "#E8F0F4" }]}>
          {hasImage ? (
            <>
              {typeof item.content !== "string" && item.content.map((block, idx) =>
                block.type === "image_url" ? (
                  <Image key={idx} source={{ uri: block.image_url.url }} style={s.msgImage} resizeMode="cover" onError={() => {}} />
                ) : (
                  <Text key={idx} style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{t(block.text as any)}</Text>
                )
              )}
            </>
          ) : isUser ? (
            <Text style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{contentToText(item.content)}</Text>
          ) : (
            (() => {
              const full = contentToText(item.content);
              const blocks = splitRecipeBlocks(full);
              if (blocks.length > 0) {
                return (
                  <View style={{ minWidth: 200 }}>
                    {blocks.map((block, bi) => (
                      <View key={bi} style={{ marginBottom: 6 }}>
                        {renderMarkdown(block, s)}
                        <TouchableOpacity
                          style={s.copyBtn}
                          onPress={async () => {
                            await Clipboard.setStringAsync(block);
                            showToast("已複製食譜");
                          }}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <Ionicons name="copy-outline" size={12} color="#5F6F80" />
                          <Text style={s.copyBtnTxt}>{t("aiChef.copyRecipe")}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              }
              return (
                <View style={{ minWidth: 200 }}>
                  {renderMarkdown(full, s)}
                  <TouchableOpacity
                    style={s.copyBtn}
                    onPress={async () => {
                      await Clipboard.setStringAsync(full);
                      showToast("已複製");
                    }}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="copy-outline" size={12} color="#5F6F80" />
                    <Text style={s.copyBtnTxt}>{t("aiChef.copy")}</Text>
                  </TouchableOpacity>
                </View>
              );
            })()
          )}
        </View>
      </View>
    );
  };

  // ─── Render: Empty state ───────────────────────────────

  const renderEmpty = () => {
    if (photoFlowStatus) return <View style={{ height: 12 }} />;
    if (isPreparingMeal || homeMealEntry) {
      return (
        <View style={s.preparing}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={s.preparingTxt}>{t("正在用你嘅排餐偏好準備 3 餸 1 湯…" as any)}</Text>
        </View>
      );
    }
    const hero = QUICK_ACTIONS.find((a) => a.group === "hero");
    const tools = QUICK_ACTIONS.filter((a) => a.group === "tools");
    const scenarios = QUICK_ACTIONS.filter((a) => a.group === "scenario");
    return (
      <View style={s.empty}>
        <View style={s.emptyContent}>
        {/* Greeting */}
        <View style={s.greetingRow}>
          <Text style={s.greetingEmoji}>🍳</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingName}>{userName ? t("aiChef.helloName", { name: userName }) : t("aiChef.hello")}</Text>
          </View>
        </View>

        {/* Hero card */}
        {hero && (
          <PressScale
            testID={`ai-chef-quick-${hero.id}`}
            onPress={() => handleQuickAction(hero.id)}
            disabled={chatMutation.isPending}
            style={s.heroCard}
          >
            <ExpoImage
              source={require("../assets/herocard-v4.jpeg")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="right center"
              cachePolicy="memory-disk"
              transition={0}
            />
            <View style={s.heroCardScrim} pointerEvents="none">
              <View style={[s.heroCardScrimLayer, { width: "100%", opacity: 0.25 }]} />
              <View style={[s.heroCardScrimLayer, { width: "66%", opacity: 0.52 }]} />
              <View style={[s.heroCardScrimLayer, { width: "40%", opacity: 0.55 }]} />
            </View>
            <View style={s.heroCardContent}>
              <Text style={s.heroCardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t(`aiChef.qa_${hero.id}Label` as any)}</Text>
              <View style={s.heroCardCta}>
                <Text style={s.heroCardCtaTxt}>{t("aiChef.heroCta")}</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </View>
            </View>
          </PressScale>
        )}

        {/* Tools 2x2 */}
        <View style={s.toolGrid}>
          {tools.map((a) => (
            <PressScale
              key={a.id}
              testID={`ai-chef-quick-${a.id}`}
              onPress={() => handleQuickAction(a.id)}
              disabled={chatMutation.isPending}
              style={s.toolBtn}
            >
              <View style={[s.toolIcon, { backgroundColor: a.tint }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={s.toolBtnTxt}>{t(`aiChef.qa_${a.id}Label` as any)}</Text>
            </PressScale>
          ))}
        </View>

        {/* Scenario cards — horizontal scroll */}
        <Text style={s.scenarioLabel}>{t("aiChef.scenarioLabel")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scenarioRow}>
          {scenarios.map((a) => (
              <PressScale
                key={a.id}
                testID={`ai-chef-quick-${a.id}`}
                onPress={() => handleQuickAction(a.id)}
                disabled={chatMutation.isPending}
                style={s.scenarioCard}
              >
                {a.image ? (
                  <ExpoImage
                    source={a.image}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: (a as any).tint ?? "#FFFFFF" }]} />
                )}
                <View style={s.scenarioCardScrim} />
                <View style={s.scenarioCardContent}>
                  <Text style={s.scenarioCardEmoji}>{a.emoji}</Text>
                  <Text style={s.scenarioCardTitle} numberOfLines={1}>{t(`aiChef.qa_${a.id}Label` as any)}</Text>
                  <Text style={s.scenarioCardSub} numberOfLines={1}>{t(a.subtitle as any)}</Text>
                </View>
              </PressScale>
          ))}
        </ScrollView>
        </View>

      </View>
    );
  };

  // ─── Render: Meal flow hot keys ────────────────────────

  const renderMealHotKeys = () => {
    if (!isMealAnswering) return null;
    let options: { label: string; value: string }[] = [];
    if (mealStep === "people") options = PEOPLE_OPTIONS.map(n => ({ label: t("aiChef.peopleN", { n }), value: n }));
    else if (mealStep === "audience") options = AUDIENCE_OPTIONS.map(o => ({ label: t(o.label as any), value: o.label }));
    else if (mealStep === "time") options = TIME_OPTIONS.map(o => ({ label: t(o.label as any), value: o.label }));
    else if (mealStep === "dislike") options = [
      { label: t("aiChef.dislikeNone"), value: "冇" },
      { label: t("aiChef.dislikeSpicy"), value: "唔食辣" },
      { label: t("aiChef.dislikePork"), value: "唔食豬肉" },
      { label: t("aiChef.dislikeFish"), value: "唔食魚" },
      { label: t("aiChef.dislikeLight"), value: "清淡為主" },
    ];
    return (
      <View style={s.hotKeyBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hotKeyScroll}>
          {options.map((o, i) => (
            <TouchableOpacity key={i} style={s.hotKeyChip} onPress={() => handleMealAnswer(o.value, o.label)} disabled={chatMutation.isPending}>
              <Text style={s.hotKeyChipTxt}>{o.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.hotKeyChip, { backgroundColor: "#183B56" }]} onPress={() => handleSkipMealQuestions()} disabled={chatMutation.isPending}>
            <Text style={[s.hotKeyChipTxt, { color: "#fff" }]}>{t("aiChef.directAi")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // ─── Render: Sessions sidebar (left drawer) ────────────

  const SIDEBAR_W = Dimensions.get("window").width * 0.82;
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [-SIDEBAR_W, 0],
    outputRange: [0, 0.5],
    extrapolate: "clamp",
        });

  const renderSessionsSidebar = () => (
    <Modal visible={showSessions} transparent animationType="none" onRequestClose={() => setShowSessions(false)}>
      <View style={d.outer}>
        <TouchableWithoutFeedback onPress={() => setShowSessions(false)}>
          <Animated.View style={[d.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[d.drawer, { width: SIDEBAR_W, transform: [{ translateX: slideAnim }] }]}>
          <SafeAreaView style={d.drawerInner} edges={["top", "bottom"]}>
            <View style={[d.drawerHead, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
              <TouchableOpacity onPress={handleNewChat} style={d.drawerNewBtn}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={d.drawerNewTxt}>{t("aiChef.newChat")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSessions(false)} style={s.headerBtn}>
                <Ionicons name="close" size={20} color={BRAND} />
              </TouchableOpacity>
            </View>

            <View style={d.searchBox}>
              <Ionicons name="search-outline" size={18} color={SUB} />
              <TextInput
                style={d.searchInput}
                value={sessionSearch}
                onChangeText={setSessionSearch}
                placeholder={t("aiChef.searchChat")}
                placeholderTextColor={HINT}
              />
              {sessionSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSessionSearch("")}>
                  <Ionicons name="close-circle" size={18} color={HINT} />
                </TouchableOpacity>
              )}
            </View>

            <View style={d.sectionHeadRow}>
              <Text style={[d.sectionTitle, { marginBottom: 0 }]}>{t("aiChef.chatHistory")}</Text>
              {sessions.some(s => s.messages.length > 0) && (
                <TouchableOpacity
                  testID="ai-chef-clear-all-chats"
                  onPress={handleClearAllChats}
                  style={d.clearAllBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={13} color="#DC2626" />
                  <Text style={d.clearAllTxt}>{t("aiChef.clearAllChats" as any)}</Text>
                </TouchableOpacity>
              )}
            </View>

            {sessions.length === 0 ? (
              <View style={d.emptyRow}><Text style={d.emptyTxt}>{t("aiChef.noChats")}</Text></View>
            ) : displaySessions.length === 0 ? (
              <View style={d.emptyRow}><Text style={d.emptyTxt}>{t("aiChef.noMatchingChats")}</Text></View>
            ) : (
              <FlatList
                data={displaySessions}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const isActive = item.id === activeChatId;
                  const preview = item.messages.length > 0
                    ? contentToText(item.messages[item.messages.length - 1].content).slice(0, 40)
                    : "";
                  return (
                  <View style={[d.sessionRow, isActive && d.sessionRowActive]}>
                    <TouchableOpacity
                      style={d.sessionContent}
                      onPress={() => handleSwitchChat(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[d.sessionTitle, isActive && d.sessionTitleActive]} numberOfLines={1}>
                        {t(item.title as any)}
                      </Text>
                      {preview ? <Text style={d.sessionPreview} numberOfLines={1}>{preview}</Text> : null}
                      <Text style={d.sessionDate}>
                        {new Date(item.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                        {item.messages.length > 0 ? ` · ${item.messages.length} ${t("條" as any)}` : ""}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={d.sessionDelete} onPress={() => handleDeleteChat(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={SUB} />
                    </TouchableOpacity>
                  </View>
                  );
                }}
              />
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );

  // ─── Main Return ───────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{
        title: t("aiChef.title"),
        headerShown: true,
        headerBackTitle: '',
        headerStyle: { backgroundColor: BG }, headerTintColor: BRAND,
        headerTitleStyle: { fontWeight: "800" },
        headerLeft: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              testID="ai-chef-back"
              onPress={() => {
                if (messages.length > 0) {
                  // 喺對話入面 → 返去 AI 助手主頁（空 session）
                  const empty = sessions.find(s => s.messages.length === 0);
                  if (empty) {
                    setRecommendedRecipes([]);
                    setMealResult(null);
                    setMealStep("idle");
                    setMealPrefs(EMPTY_PREFS);
                    setAiNextSteps([]);
                    setAskingIngredients(false);
                    setShowSessions(false);
                    setActiveChatId(empty.id);
                  } else {
                    handleNewChat();
                  }
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)/planner");
                }
              }}
              style={s.headerBtn}
            >
              <Ionicons name="arrow-back" size={20} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity testID="ai-chef-sessions" onPress={() => setShowSessions(true)} style={s.headerBtn}>
              <Ionicons name="chatbubbles-outline" size={20} color={BRAND} />
            </TouchableOpacity>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {hasRestorable && (
              <TouchableOpacity
                onPress={() => setShowCardHistory(true)}
                style={s.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={t("最近食譜卡" as any)}
              >
                <Ionicons name="time-outline" size={19} color={BRAND} />
              </TouchableOpacity>
            )}
            {aiLimit > 0 && (
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  borderRadius: 10,
                  backgroundColor: aiNearLimit ? "#FEF2F2" : "#E8F0F4",
                  borderWidth: 1,
                  borderColor: aiNearLimit ? "#FECACA" : "#D6E2EA",
                }}
                accessibilityRole="button"
                accessibilityLabel={`AI ${aiUsed}/${aiLimit}`}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: aiNearLimit ? "#DC2626" : BRAND }}>
                  AI {aiUsed}/{aiLimit}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="ai-chef-new-chat"
              onPress={handleNewChat}
              style={s.headerBtn}
              accessibilityRole="button"
              accessibilityLabel={t("aiChef.newChat" as any)}
            >
              <Ionicons name="add" size={24} color={BRAND} />
            </TouchableOpacity>
          </View>
        ),
      }} />

      {renderSessionsSidebar()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <View style={s.root}> 
        {(safeMode || capBlocked || creditsExhausted || (aiPercent >= 0.8 && !creditsExhausted)) && aiLimit > 0 && (
          <View style={[s.usageBanner, (creditsExhausted || capBlocked || safeMode) && s.usageBannerWarn]} testID="ai-chef-usage-banner">
            <View style={{ flex: 1 }}>
              <Text style={s.usageBannerTitle}>
                {safeMode
                  ? t("aiChef.safeMode" as any)
                  : capBlocked
                    ? t("aiChef.cap100" as any)
                    : creditsExhausted
                      ? t("aiChef.usage100" as any, { date: resetLabel })
                      : t("aiChef.usage80" as any, { used: aiUsed, limit: aiLimit })}
              </Text>
            </View>
            {(creditsExhausted || capBlocked) && (
              <TouchableOpacity onPress={() => setShowPaywall(true)} style={s.usageUpgradeBtn}>
                <Text style={s.usageUpgradeTxt}>{t("aiChef.upgradeCta" as any)}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => String(i)}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={messages.length === 0 ? s.emptyList : s.list}
          onContentSizeChange={() => messages.length > 0 && scrollToLatestMessage()}
          onScrollToIndexFailed={(info) =>
            setTimeout(() =>
              flatListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              }), 50)
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <>
              {photoFlowStatus && (
                <View style={s.msgRow}>
                  <View style={s.avatar}>
                    <Ionicons
                      name={photoFlowStatus.stage === "error" ? "alert-circle" : "camera"}
                      size={16}
                      color={photoFlowStatus.stage === "error" ? "#C0392B" : BRAND}
                    />
                  </View>
                  <View style={[s.bubbleBot, s.typing]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {photoFlowStatus.stage === "error" ? null : <ActivityIndicator size="small" color={BRAND} />}
                      <Text style={[s.bubbleTxt, { color: photoFlowStatus.stage === "error" ? "#C0392B" : BRAND, fontWeight: "600" }]}>
                        {photoFlowStatus.stage === "error"
                          ? photoFlowStatus.message
                          : photoFlowStatus.stage === "analyzing"
                            ? t("aiChef.photoAnalyzing" as any)
                            : t("aiChef.photoUploading" as any)}
                      </Text>
                    </View>
                    {photoFlowStatus.stage !== "error" && photoFlowStatus.slow && (
                      <Text style={[s.bubbleTxt, { fontSize: 12, color: SUB, marginTop: 6 }]}>
                        {t("aiChef.photoStillAnalyzing" as any)}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
                      {photoFlowStatus.stage === "error" && (
                        <TouchableOpacity
                          onPress={() => void runPhotoFlow({ uri: photoFlowStatus.retryUri, mimeType: photoFlowStatus.retryMimeType })}
                        >
                          <Text style={{ color: BRAND, fontSize: 13, fontWeight: "700" }}>{t("重試" as any)}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={cancelPhotoFlow}>
                        <Text style={{ color: SUB, fontSize: 13, fontWeight: "600" }}>{t("取消" as any)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              {chatMutation.isPending && ((chatMutation as any).variables?.mode === "library") ? (
                <View style={s.msgRow}>
                  <View style={s.avatar}><Ionicons name="search" size={16} color={BRAND} /></View>
                  <View style={[s.bubbleBot, s.typing]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color={BRAND} />
                      <Text style={[s.bubbleTxt, { color: BRAND, fontWeight: "600" }]}>{t("aiChef.searchingLibrary")}</Text>
                    </View>
                  </View>
                </View>
              ) : chatMutation.isPending ? (
                <View style={s.msgRow}>
                   <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>
                   <View style={[s.bubbleBot, s.typing]}>
                     <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <ActivityIndicator size="small" color={BRAND} />
                        <Text style={[s.bubbleTxt, { color: BRAND, fontWeight: "600" }]}>
                          {((chatMutation as any).variables?.mode === "ai") ? t("aiChef.generating") : t("aiChef.thinking" as any)}
                        </Text>
                     </View>
                     <Text style={[s.bubbleTxt, { fontSize: 12, color: SUB }]}>
                       {mealStep === "generating"
                          ? t("aiChef.generating3")
                         : t(LOADING_STEPS[loadingStep] as any)}
                     </Text>
                   </View>
                 </View>
              ) : null}
              {!chatMutation.isPending && messages.length > 0 && recommendedRecipes.length === 0 && hasRestorable && (
                <View style={s.restoreBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.restoreTitle}>
                      {t("最近 {{n}} 組食譜卡" as any, { n: restorableHistory.length })}
                    </Text>
                    <Text style={s.restoreSub} numberOfLines={2}>{restoreBarNames.join("、")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.restoreBtn, { backgroundColor: "#183B56" }]}
                    onPress={() => setShowCardHistory(true)}
                    disabled={restoringCards}
                    accessibilityRole="button"
                  >
                    <Text style={[s.restoreBtnTxt, { color: "#fff" }]}>{t("歷史" as any)}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {incompleteContract && !chatMutation.isPending && (
                <View style={s.incompleteBar}>
                  <Text style={s.incompleteTxt}>
                    {t("aiChef.incompleteBar", {
                      got: incompleteContract.got,
                      want: incompleteContract.requiredCards,
                    })}
                  </Text>
                  <TouchableOpacity
                    style={s.incompleteBtn}
                    onPress={retryIncomplete}
                    disabled={chatMutation.isPending}
                    accessibilityRole="button"
                  >
                    <Text style={s.incompleteBtnTxt}>{t("再試一次" as any)}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {recommendedRecipes.length > 0 && !chatMutation.isPending && (
                <View style={s.recBar}>
                  <View style={s.recHead}>
                    <Text style={s.recTitle}><Ionicons name="restaurant-outline" size={13} /> {mealResult
                      ? (lastChatModeRef.current === "ai"
                          // 用戶撳「AI 助手設計食譜」→ 唔好當成今晚 3 餸 1 湯
                          ? `AI 助手設計（${recommendedRecipes.length} 道）`
                          : recommendedRecipes.some((r) => /湯|羹/.test(String(r.name ?? "")))
                            ? t("aiChef.sectionTonight")
                            : `今晚 ${recommendedRecipes.length} 道菜`)
                      : t("aiChef.swapOther")}</Text>
                    {mealResult && aiChefQuickPlanEnabled && (
                      <TouchableOpacity
                        style={s.selectAllBtn}
                        onPress={toggleAllMealCards}
                        disabled={chatMutation.isPending || batchPlanBusy}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: allMealSelected }}
                      >
                        <Ionicons name={allMealSelected ? "checkbox" : "square-outline"} size={16} color={BRAND} />
                        <Text style={s.selectAllTxt}>{t("全選" as any)}</Text>
                      </TouchableOpacity>
                    )}
                    {mealResult && !aiChefQuickPlanEnabled && (
                      <TouchableOpacity
                        style={[s.batchPlanBtn, batchPlanBusy && { opacity: 0.7 }]}
                        onPress={() => addMealPlanBatch(mealResult)}
                        disabled={chatMutation.isPending || batchPlanBusy}
                      >
                        {batchPlanBusy ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <ActivityIndicator size="small" color={canva.textOnAccent} />
                            <Text style={s.batchShopTxt}>{t("aiChef.adding")}</Text>
                          </View>
                        ) : (
                          <Text style={s.batchShopTxt}>{t("aiChef.addAllToPlan")}</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {mealResult && aiChefQuickPlanEnabled && (
                    <View style={s.batchActionRow}>
                      <View style={s.batchMeta}>
                        <Text style={s.selectedCount}>
                          {t("已選 {{n}}/{{total}} 道" as any, { n: selectedMealRecipes.length, total: mealResult.length })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        testID="ai-chef-batch-add"
                        style={[s.batchPlanBtnWide, (batchPlanBusy || selectedMealRecipes.length === 0) && { opacity: 0.5 }]}
                        onPress={() => addMealPlanBatch(selectedMealRecipes)}
                        disabled={chatMutation.isPending || batchPlanBusy || selectedMealRecipes.length === 0}
                        accessibilityRole="button"
                      >
                        {batchPlanBusy ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <ActivityIndicator size="small" color={canva.textOnAccent} />
                            <Text style={s.batchPlanTxtWide}>{t("aiChef.adding")}</Text>
                          </View>
                        ) : (
                          <Text style={s.batchPlanTxtWide}>
                            {selectedMealRecipes.length === 0
                              ? t("請選擇菜式" as any)
                              : t("加入排餐（{{n}} 道）" as any, { n: selectedMealRecipes.length })}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  {aiChefSourceLabelsEnabled && recommendedRecipes.length > 0 && (
                    <View style={s.sourceSummaryRow} testID="ai-chef-source-summary">
                      <Text style={s.sourceSummaryTxt}>
                        {t("aiChef.sourceSummary" as any, {
                          library: recommendedRecipes.filter((r) => r.source !== "ai").length,
                          ai: recommendedRecipes.filter((r) => r.source === "ai").length,
                        })}
                      </Text>
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
                    {recommendedRecipes.map((r, i) => (
                      <View key={`${r.id ?? r.name ?? "recipe"}-${i}`} style={s.recCard} testID={`recipe-card-${i}`}>
                        {mealResult && aiChefQuickPlanEnabled && (
                          <TouchableOpacity
                            onPress={() => toggleMealCard(i)}
                            style={s.recCardCheck}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selectedCardIndexes.has(i) }}
                          >
                            <Ionicons
                              name={selectedCardIndexes.has(i) ? "checkmark-circle" : "ellipse-outline"}
                              size={21}
                              color={selectedCardIndexes.has(i) ? "#F37021" : "#5F6F80"}
                            />
                          </TouchableOpacity>
                        )}
                        <View style={s.recCardHeader}>
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                            <Ionicons name="restaurant-outline" size={14} color={BRAND} />
                            <Text style={s.recCardDiff}>
                              {(() => {
                                const dishKey = normalizeDishType(r.dishType || inferDishTypeKeyFromName(String(r.name ?? "")));
                                if (
                                  aiChefNoodleRoleEnabled &&
                                  !r.dishType &&
                                  /麵|面|拉麵|拉面|烏冬|乌冬|米線|米线|意粉|noodle|ramen|udon|soba|pasta/i.test(`${r.name ?? ""} ${(r.tags ?? []).join(" ")}`)
                                ) {
                                  return t("aiChef.noodleCategory" as any);
                                }
                                return dishTypeLabel(dishKey, (key) => t(key as any));
                              })()}
                            </Text>
                            <Text style={[s.recCardDiff, { color: SUB }]}>·</Text>
                            <Text style={s.recCardDiff}>{enumT.difficulty(r.difficulty)}</Text>
                            {typeof r.cookTime === "number" && r.cookTime > 0 ? (
                              <>
                                <Text style={[s.recCardDiff, { color: SUB }]}>·</Text>
                                <Text style={s.recCardDiff}>{r.cookTime} 分鐘</Text>
                              </>
                            ) : null}
                          </View>
                          <View
                            testID={`recipe-card-source-${i}`}
                            style={[
                              s.recCardSourceBadge,
                              aiChefSourceLabelsEnabled
                                ? r.source === "ai" ? s.recCardSourceAI : s.recCardSourceLibrary
                                : r.source === "ai" ? s.recCardSourceAI : r.source === "custom" ? s.recCardSourceMine : s.recCardSourceLibrary,
                            ]}
                          >
                            <Text testID={`recipe-card-source-label-${i}`} style={[s.recCardSourceTxt, aiChefSourceLabelsEnabled && r.source === "ai" && { color: "#B45309" }]}>
                              {aiChefSourceLabelsEnabled
                                ? r.source === "ai" ? "AI" : t("aiChef.sourceLibrary" as any)
                                : r.source === "ai" ? "AI" : r.source === "custom" ? t("我的食譜" as any) : t("官方食譜" as any)}
                            </Text>
                          </View>
                        </View>
                        {(() => {
                          const imgUrl = resolveImageUrl(getRecipeImage(r));
                          const localImg = getRecipeLocalImage(r.name);
                          if (imgUrl) return <Image source={{ uri: imgUrl }} style={s.recCardImg} resizeMode="cover" />;
                          if (localImg) return <Image source={localImg} style={s.recCardImg} resizeMode="cover" />;
                          // Keep the same image height even without a photo, otherwise
                          // the card body jumps up and cards in the same row misalign.
                          return (
                            <View style={[s.recCardImg, s.recCardImgPH]}>
                              <Ionicons name="restaurant-outline" size={24} color="#8A99A8" />
                            </View>
                          );
                        })()}
                        <View style={s.recCardBody} testID={`recipe-card-content-${i}`}>
                          <Text style={s.recCardName} numberOfLines={2} testID={`recipe-card-name-${i}`}>
                            {(() => { const bn = getBilingualName(r.name, r.nameEn, r.nameFil, r.nameId); return bn.primary; })()}
                          </Text>
                          {(() => { if (i18n.language === "zh") return null; const bn = getBilingualName(r.name, r.nameEn, r.nameFil, r.nameId); return bn.secondary ? (
                            <Text style={s.recCardNameEn} numberOfLines={1}>{bn.secondary}</Text>
                          ) : null; })()}
                          <View style={s.recCardMeta}>
                            <Text style={s.recCardMetaTxt}>{r.cookTime}{t("aiChef.unitMin")}</Text>
                            <Text style={s.recCardMetaTxt}>{r.servings}{t("aiChef.unitServing")}</Text>
                            <Text style={s.recCardMetaTxt}>{getValidIngredients(r.ingredients).length}{t("aiChef.unitIngredients")}</Text>
                            <Text style={[s.recCardMetaTxt, { color: (r.steps || []).length > 0 ? GREEN : SUB }]} testID={`recipe-card-steps-count-${i}`}>{(r.steps || []).length}{t("aiChef.unitSteps")}</Text>
                          </View>
                          <View style={s.recCardTags} testID={`recipe-card-tags-${i}`}>
                            {(r.tags || []).map((tag) => enumT.tag(tag)).filter((tag) => Boolean(tag && String(tag).trim())).slice(0, 4).map((tag, tagIdx) => (
                              <View key={tagIdx} style={s.recTagPill}>
                                <Text style={s.recTagTxt} numberOfLines={1}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                          {/* 睇食材（撳開先見） */}
                          <TouchableOpacity
                            style={s.recCardIngredientsToggle}
                            onPress={() => setExpandedCard(expandedCard === i ? null : i)}
                            testID={`recipe-card-ingredients-toggle-${i}`}
                          >
                            <Ionicons name={expandedCard === i ? "chevron-up" : "chevron-down"} size={13} color={BRAND} />
                            <Text style={s.recCardIngredientsToggleTxt}>
                              {expandedCard === i ? t("aiChef.collapseIngredients") : t("aiChef.viewIngredients", { n: getValidIngredients(r.ingredients).length })}
                            </Text>
                          </TouchableOpacity>
                          {expandedCard === i && (
                            <View style={s.recCardIngList} testID={`recipe-card-ingredients-${i}`}>
                              {getValidIngredients(r.ingredients).slice(0, 5).map((ing, ingIdx) => (
                                  <View key={ingIdx} style={s.recCardIngRow}>
                                    <View style={s.recCardIngDot} />
                                    <Text style={s.recCardIngTxt}>
                                      {(() => { const bn = getBilingualName(ing.name, ing.nameEn, ing.nameFil, ing.nameId); return (bn.secondary && i18n.language !== "zh") ? `${bn.primary} (${bn.secondary})` : bn.primary; })()}
                                      {formatIngredientDisplay(ing.quantity, ing.unit) ? ` ${formatIngredientDisplay(ing.quantity, ing.unit)}` : ""}
                                    </Text>
                                  </View>
                              ))}
                              {getValidIngredients(r.ingredients).length > 5 && (
                                <Text style={s.recCardIngMore}>{t("aiChef.moreItems", { n: getValidIngredients(r.ingredients).length - 5 })}</Text>
                              )}
                            </View>
                          )}
                          {/* 步驟內容驗證 */}
                          {r.steps && r.steps.length > 0 && (
                            <View style={{ paddingVertical: 8 }} testID={`recipe-card-steps-content-${i}`}>
                              <Text style={{ fontSize: 12, color: SUB }}>{r.steps.length} {t("aiChef.unitSteps")}</Text>
                              <Text style={{ fontSize: 11, color: TEXT }} numberOfLines={2} testID={`recipe-card-first-step-${i}`}>
                                {getLocalizedSteps(r.steps, r.stepsEn, r.stepsFil, r.stepsId)[0]}
                              </Text>
                            </View>
                          )}
                          <View style={s.recCardBtns} testID={`recipe-card-btns-${i}`}>
                            {(!mealResult || !aiChefQuickPlanEnabled) && (
                              <TouchableOpacity
                                testID={`ai-chef-recipe-${i}-meal`}
                                style={[s.btnMeal, !isValidRecipe(r) && { opacity: 0.4 }]}
                                onPress={() => {
                                  if (isValidRecipe(r)) {
                                    trackCardAction("plan_open", r, i);
                                    setPlanRecipe(r);
                                    setPlanDate(todayISO());
                                    setShowPlan(true);
                                  } else {
                                    Alert.alert(t("無法加入" as any), t("此食譜資料不完整。" as any));
                                  }
                                }}
                                disabled={!isValidRecipe(r)}
                              >
                                <Text style={s.btnMealTxt}>{t("aiChef.addToPlan")}</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              testID={`ai-chef-recipe-${i}-favorite`}
                              style={[s.btnFavorite, (!isValidRecipe(r) || r.source === "official" || r.source === "custom") && { opacity: 0.4 }]}
                              onPress={() => handleFavoriteRecipe(r, i)}
                              disabled={!isValidRecipe(r) || r.source === "official" || r.source === "custom" || favoritingName === (r.name || "").trim()}
                            >
                              {favoritingName === (r.name || "").trim() ? (
                                <ActivityIndicator size="small" color={BRAND} />
                              ) : (
                                <Ionicons name="heart-outline" size={18} color={BRAND} />
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              testID={`ai-chef-recipe-${i}-swap`}
                              style={[s.btnSwap, { opacity: chatMutation.isPending ? 0.5 : 1 }]}
                              onPress={() => handleSwapRecipe(r, i)}
                              disabled={chatMutation.isPending || swappingIndex !== null}
                            >
                              {swappingIndex === i ? (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <ActivityIndicator size="small" color={BRAND} />
                                  <Text style={s.btnSwapTxt}>{t("aiChef.swapping")}</Text>
                                </View>
                              ) : (
                                <>
                                  <Ionicons name="refresh-outline" size={14} color={BRAND} />
                                  <Text style={s.btnSwapTxt}>{t("aiChef.swap")}</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                          {swapNoCards?.index === i &&
                            recommendedRecipes[i]?.name === swapNoCards.recipeName &&
                            (!swapNoCards.cardId || recommendedRecipes[i]?.cardId === swapNoCards.cardId) &&
                            recommendedRecipes[i]?.source !== "ai" && (
                            <View style={s.swapNoCardsBox} testID={`ai-chef-recipe-${i}-swap-no-cards`}>
                              <Text style={s.swapNoCardsTxt}>{t("aiChef.swapNoLibrary" as any)}</Text>
                              <TouchableOpacity
                                testID={`ai-chef-recipe-${i}-swap-ai`}
                                style={[s.swapNoCardsPrimary, (!aiCanGenerate || aiReplyBlocked) && { opacity: 0.5 }]}
                                onPress={() => handleSwapNoCardsAction("ai_generate")}
                                disabled={chatMutation.isPending || swappingIndex !== null || !aiCanGenerate || aiReplyBlocked}
                              >
                                <Text style={s.swapNoCardsPrimaryTxt}>
                                  {(!aiCanGenerate || aiReplyBlocked) ? t("aiChef.quotaExhausted" as any) : t("aiChef.aiGenerateCredit" as any)}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                testID={`ai-chef-recipe-${i}-swap-relax`}
                                style={s.swapNoCardsSecondary}
                                onPress={() => handleSwapNoCardsAction("relax_role")}
                                disabled={chatMutation.isPending || swappingIndex !== null}
                              >
                                <Text style={s.swapNoCardsSecondaryTxt}>{t("aiChef.relaxRole" as any)}</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <Text style={s.foodSafetyDisclaimer}>{t("legal.foodSafety" as any)}</Text>

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: SUB }}>{t("aiChef.swapOther")}</Text>
                    <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
                      <TouchableOpacity style={[s.sourceBtnLib, { flex: 1 }]} onPress={() => handleInstantRecipeAction("library")} disabled={chatMutation.isPending}>
                        <Text style={s.sourceBtnTxt}>{t("aiChef.library")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.sourceBtnAI, { flex: 1 }, !aiCanGenerate && { opacity: 0.45 }]} onPress={() => handleInstantRecipeAction("ai", "ai_tab")} disabled={chatMutation.isPending || !aiCanGenerate}>
                        <Text style={s.sourceBtnTxt}>{t("aiChef.aiGenerate")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </>
        }
        />

        {!chatMutation.isPending && mealStep === "idle" && messages.length > 0 && messages[messages.length - 1].role === "assistant" && recommendedRecipes.length === 0 && (() => {
          const lastBot = messages[messages.length - 1];
          const lastText = lastBot ? contentToText(lastBot.content) : "";
          const hasRecipe = hasRecipeContent(lastText);
          const chips = aiNextSteps.filter(c => c.trim() !== "加入排餐");
          // 冇 chip 就唔好淨係出「下一步 ➔」— 用戶睇落會覺得多餘
          if (chips.length === 0) return null;
          return (
            <View style={s.followUpBar}>
              <Text style={s.followUpLabel}>{t("aiChef.nextStep")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.followUpScroll}>
                {chips.map((chip, i) => (
                  <TouchableOpacity key={i} style={s.followUpChip} onPress={() => handleNextStep(chip)} disabled={chatMutation.isPending}>
                    <Text style={s.followUpTxt}>{chip}</Text>
                  </TouchableOpacity>
                ))}
                {hasRecipe && (
                  <TouchableOpacity
                    style={[s.followUpChip, s.followUpChipAction]}
                    onPress={handleConvertToRecipeCard}
                    disabled={chatMutation.isPending}
                  >
                    <Text style={[s.followUpTxt, { color: "#fff" }]}>{t("aiChef.next")}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          );
        })()}

        {!chatMutation.isPending && contractQuickReplies.length > 0 && (
          <View style={s.followUpBar}>
            <Text style={s.followUpLabel}>{t("aiChef.nextStep")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.followUpScroll}>
              {contractQuickReplies.map((q, i) => {
                const blocked = (q.actionId === "ai_generate" || q.actionId === "photo_regenerate") && aiReplyBlocked;
                return (
                  <TouchableOpacity
                    key={`${q.actionId}-${i}`}
                    style={[s.followUpChip, blocked && { opacity: 0.45 }]}
                    onPress={() => handleContractQuickReply(q.actionId)}
                    disabled={chatMutation.isPending || blocked}
                  >
                    <Text style={s.followUpTxt}>{blocked ? t("aiChef.quotaExhausted") : t(q.labelKey as any)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {askingIngredients && (
          <View style={s.hotKeyBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hotKeyScroll}>
              {COMMON_INGREDIENT_CHIPS.map((c, i) => (
                <TouchableOpacity key={i} style={s.hotKeyChip} onPress={() => {
                  setInput(prev => prev ? `${prev}、${c.value}` : c.value);
                }} disabled={chatMutation.isPending}>
                  <Text style={s.hotKeyChipTxt}>{t(`ingredients.${c.k}` as any)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!chatMutation.isPending && recommendedRecipes.length === 0 && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#183B56", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, alignItems: "center" }} onPress={() => handleInstantRecipeAction("library")} disabled={chatMutation.isPending}>
                <Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>{t("aiChef.library")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#F59E0B", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, alignItems: "center", opacity: aiCanGenerate ? 1 : 0.45 }} onPress={() => handleInstantRecipeAction("ai", "ai_tab")} disabled={chatMutation.isPending || !aiCanGenerate}>
                <Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>{t("aiChef.aiGenerate")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {renderMealHotKeys()}

      </View>

      {chatStarted || messages.length > 0 || isMealAnswering || askingIngredients ? (
        <View style={[s.bottomDock, { paddingBottom: keyboardH > 0 ? 8 : Math.max(insets.bottom, 8) }]}>
        {!hideUpgradePromo && <AdSlot onPressUpgrade={() => setShowPaywall(true)} />}
          <View style={s.inputBar}>
            <TouchableOpacity style={s.camBtn} onPress={handleCamera}>
              <Ionicons name="camera-outline" size={22} color={BRAND} />
            </TouchableOpacity>
            <TextInput
              testID="ai-chef-input"
              style={s.input} value={input} onChangeText={setInput}
              placeholder={t("aiChef.inputPlaceholder")} placeholderTextColor={HINT}
              multiline maxLength={500} returnKeyType="send" onSubmitEditing={handleSend} blurOnSubmit
            />
            <TouchableOpacity testID="ai-chef-send" style={[s.sendBtn, (!input.trim() || chatMutation.isPending) && s.sendOff]} onPress={handleSend} disabled={!input.trim() || chatMutation.isPending}>
              {chatMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          {keyboardH === 0 && (
            <Text style={s.disclaimer}>{t("aiChef.disclaimer")}</Text>
          )}
        </View>
      ) : null}
      </KeyboardAvoidingView>

      <View style={s.toastOverlay} pointerEvents="box-none">
        {toast.visible && (
          <View style={s.toastContainer}>
            <View style={s.toast}>
              <View style={s.toastRow}>
                <Ionicons
                  name={toast.tone === "error" ? "alert-circle" : toast.tone === "info" ? "sparkles" : "checkmark-circle"}
                  size={18}
                  color={toast.tone === "error" ? canva.danger : toast.tone === "info" ? canva.accent : GREEN}
                />
                <Text style={s.toastTxt}>{t(toast.text as any)}</Text>
              </View>
              {toast.action ? (
                <TouchableOpacity
                  onPress={() => { toast.action?.onPress(); setToast(prev => ({ ...prev, visible: false })); }}
                  style={s.toastAction}
                  hitSlop={8}
                >
                  <Text style={s.toastActionTxt}>{t(toast.action.label as any)}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </View>

      <MealConflictPrompt
        visible={!!mealConflict}
        dateLabel={mealConflict ? formatDateLabel(mealConflict.date) : ""}
        mealLabel={enumT.meal(planMeal === "breakfast" ? "早餐" : planMeal === "lunch" ? "午餐" : planMeal === "dinner" ? "晚餐" : "小食")}
        mealNames={mealConflict?.names ?? []}
        hint={mealConflict?.hint}
        onCancel={() => { setMealConflict(null); conflictProceedRef.current = null; setTimeout(() => setShowPlan(true), 260); }}
        onAdd={() => { setMealConflict(null); conflictProceedRef.current?.("add"); conflictProceedRef.current = null; }}
        onReplace={() => { setMealConflict(null); conflictProceedRef.current?.("replace"); conflictProceedRef.current = null; }}
      />

      <MealLimitPrompt
        visible={!!mealLimit}
        dateLabel={mealLimit ? formatDateLabel(mealLimit.date) : ""}
        mealLabel={enumT.meal(planMeal === "breakfast" ? "早餐" : planMeal === "lunch" ? "午餐" : planMeal === "dinner" ? "晚餐" : "小食")}
        existingCount={mealLimit?.existingCount ?? 0}
        newCount={mealLimit?.newCount ?? 0}
        canReplace={!!mealLimit?.canReplace}
        onReplace={mealLimit?.canReplace ? () => { setMealLimit(null); conflictProceedRef.current?.("replace"); conflictProceedRef.current = null; } : undefined}
        onViewPlan={() => { setMealLimit(null); conflictProceedRef.current = null; router.push({ pathname: "/(tabs)/planner" } as any); }}
        onCancel={() => { setMealLimit(null); conflictProceedRef.current = null; setTimeout(() => setShowPlan(true), 260); }}
      />

      <NextDayPrompt
        visible={!!nextDayPrompt}
        title={nextDayPrompt?.title ?? ""}
        body={nextDayPrompt?.body ?? ""}
        acceptLabel={nextDayPrompt?.acceptLabel}
        onAccept={nextDayPrompt?.acceptLabel ? acceptNextDay : undefined}
        onDecline={declineNextDay}
      />

      <IngredientPickerModal
        visible={!!shopConfirm}
        recipes={(shopConfirm?.recipes ?? []).flatMap((recipe: any, index: number) => {
          const ref = resolveRecipeRef(recipe);
          if (!ref.isLibraryRef || !ref.recipeId) {
            track(Events.AiShoppingRefMissing, { recipeName: recipe?.name, reason: "picker_missing_ref" });
            return [];
          }
          return [{
            id: ref.recipeId,
            name: recipe?.name ?? "",
            nameEn: recipe?.nameEn,
            nameFil: recipe?.nameFil,
            nameId: recipe?.nameId,
            date: shopConfirm?.planDate,
            mealType: planMeal ?? undefined,
            fromMealPlanId: shopConfirm?.planIds?.[index],
            ingredients: (recipe?.ingredients ?? []).map((ing: any) => {
              const n = normalizeIngredient(ing);
              return n ? { name: n.name, nameEn: n.nameEn, nameFil: n.nameFil, nameId: n.nameId, quantity: n.quantity, unit: n.unit, category: categorizeIngredient(n.name) } : null;
            }).filter(Boolean) as any,
          }];
        })}
        loading={addShoppingM.isPending}
        mealDate={shopConfirm?.planDate}
        defaultBuyDate={shopConfirm?.shopDate}
        showDateSelector={true}
        maxDate={shopConfirm?.planDate}
        onDateChange={(d: string) => setShopConfirm((cur) => (cur ? { ...cur, shopDate: d } : cur))}
        onConfirm={(items) => {
          const cur = shopConfirm;
          setShopConfirm(null);
          if (!cur || items.length === 0) return;
          addShoppingM.mutate(
            buildShoppingBatchPayload({
              items,
              pickedDate: cur.shopDate,
              mealDate: cur.planDate,
              today: todayISO(),
              fromRecipeId: items[0]?.recipeId,
              fromRecipeName: cur.recipes.map((r: any) => r.name).join(", "),
              fromMealPlanId: items[0]?.fromMealPlanId,
            }),
            {
            onSuccess: (result: any) => {
              const summary = summarizeShoppingBatch(result, items.length);
              if (summary.allSkipped) {
                setShoppingConfirmCount(null);
                showToast(
                  t("已加入 {{added}} 項，另有 {{skipped}} 項未能加入（食材來源無效）" as any, { added: summary.added, skipped: summary.skipped }),
                  undefined,
                  2600,
                  "error"
                );
                return;
              }
              if (summary.skipped > 0) {
                showToast(
                  t("已加入 {{added}} 項，另有 {{skipped}} 項未能加入（食材來源無效）" as any, { added: summary.added, skipped: summary.skipped }),
                  undefined,
                  2600,
                  "info"
                );
              }
              setShoppingConfirmCount(summary.added);
            },
          });
        }}
        onSkip={() => setShopConfirm(null)}
      />
      <ShoppingAddConfirm
        visible={shoppingConfirmCount !== null}
        count={shoppingConfirmCount ?? 0}
        onGoShopping={() => { setShoppingConfirmCount(null); router.push("/(tabs)/shopping" as any); }}
        onClose={() => setShoppingConfirmCount(null)}
      />
      <Modal visible={showPlan} transparent animationType="slide" onDismiss={() => { shopConfirmHandoff.onDismiss(); setBatchRecipes(null); }}>
        <View style={m.overlay}><View style={[m.sheet, { paddingTop: Math.max(insets.top, 8) + 16 }]}>
          <View style={m.handle} />
          <View style={m.head}>
            <Text style={m.title}>{t("aiChef.addToPlan")}</Text>
            <TouchableOpacity onPress={() => { setShowPlan(false); setBatchRecipes(null); }}><Ionicons name="close" size={22} color={TEXT} /></TouchableOpacity>
          </View>
          {batchRecipes ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={[m.rname, { marginBottom: 4 }]}>{t("aiChef.recipesCount", { n: batchRecipes.length })}</Text>
              {batchRecipes.map((r: any, i: number) => (
                <Text key={i} style={[m.previewItem, { color: TEXT }]} numberOfLines={1}>· {getBilingualName(r.name, r.nameEn, r.nameFil, r.nameId).primary}</Text>
              ))}
            </View>
          ) : planRecipe ? (
            <Text style={m.rname} numberOfLines={1}>{getBilingualName(planRecipe.name, planRecipe.nameEn, planRecipe.nameFil, planRecipe.nameId).primary}</Text>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Dimensions.get("window").height * 0.55 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={m.label}>{t("aiChef.mealTime")}</Text>
            <View style={m.mealRow}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt.id} style={[m.mealChip, planMeal === mt.id && m.mealChipOn]} onPress={() => setPlanMeal(mt.id)}>
                  <Text style={[m.mealChipTxt, planMeal === mt.id && { color: "#fff" }]}>{enumT.meal(mt.label)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={m.label}>{t("aiChef.date")}</Text>
            <View style={{ width: Dimensions.get("window").width - 32 }}>
              <PlanDatePicker value={planDate} onChange={setPlanDate} showShortcuts={true} minDate={todayISO()} />
              {planDate && (
                <TouchableOpacity 
                  onPress={() => setPlanDate(null)} 
                  style={{ alignSelf: "flex-end", marginTop: -8 }}
                >
                  <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>{t("aiChef.clearDate")}</Text>
                </TouchableOpacity>
              )}
            </View>
            {planRecipe && !batchRecipes && (
              <View style={m.preview}>
                <Text style={m.label}>{t("aiChef.ingredients")}</Text>
                {(planRecipe.ingredients || []).slice(0, 5).map((ing, i) => {
                  const n = normalizeIngredient(ing);
                  if (!n) return null;
                  return <Text key={i} style={m.previewItem}>· {getBilingualName(n.name, n.nameEn, n.nameFil, n.nameId).primary} {formatIngredientDisplay(n.quantity, n.unit)}</Text>;
                })}
                {(planRecipe.ingredients || []).length > 5 && <Text style={m.previewMore}>{t("aiChef.morePreview", { n: (planRecipe.ingredients || []).length - 5 })}</Text>}
              </View>
            )}
            {planRecipe && !batchRecipes && (getLocalizedSteps(planRecipe.steps, planRecipe.stepsEn, planRecipe.stepsFil, planRecipe.stepsId) || []).length > 0 && (
              <View style={[m.preview, { marginTop: -8 }]}>
                <Text style={m.label}>{t("aiChef.steps")}</Text>
                {getLocalizedSteps(planRecipe.steps, planRecipe.stepsEn, planRecipe.stepsFil, planRecipe.stepsId).slice(0, 4).map((step, i) => (
                  <Text key={i} style={m.previewItem}>{i + 1}. {normalizeStep(step)}</Text>
                ))}
                {getLocalizedSteps(planRecipe.steps, planRecipe.stepsEn, planRecipe.stepsFil, planRecipe.stepsId).length > 4 && <Text style={m.previewMore}>{t("aiChef.moreSteps", { n: getLocalizedSteps(planRecipe.steps, planRecipe.stepsEn, planRecipe.stepsFil, planRecipe.stepsId).length - 4 })}</Text>}
              </View>
            )}
            {planRecipe && !batchRecipes && (getLocalizedSteps(planRecipe.steps, planRecipe.stepsEn, planRecipe.stepsFil, planRecipe.stepsId) || []).length === 0 && (
              <View style={[m.preview, { marginTop: -8 }]}>
                <Text style={[m.previewItem, { color: SUB }]}>{t("aiChef.noSteps")}</Text>
              </View>
            )}
            {planRecipe && !batchRecipes && !isValidRecipe(planRecipe) && (
              <View style={[m.preview, { marginTop: 8, backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Text style={[m.previewItem, { color: "#DC2626", fontWeight: "600" }]}>{t("aiChef.incomplete")}</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[m.btn, (saveRecipeM.isPending || addPlanM.isPending || addPlanBatchM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))) && { opacity: 0.6 }]}
            onPress={confirmAction}
            disabled={saveRecipeM.isPending || addPlanM.isPending || addPlanBatchM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))}
          >
            {(addPlanM.isPending || addPlanBatchM.isPending) ? (
              <Text style={m.btnTxt}>{t("aiChef.addingToPlan")}</Text>
            ) : (saveRecipeM.isPending || addShoppingM.isPending) ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={m.btnTxt}>{t("aiChef.confirm")}</Text>
            )}
          </TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showCardHistory} transparent animationType="slide" onRequestClose={() => setShowCardHistory(false)}>
        <View style={m.overlay}>
          <View style={[m.sheet, { paddingTop: Math.max(insets.top, 8) + 16 }]}>
            <View style={m.handle} />
            <View style={m.head}>
              <Text style={m.title}>{t("最近食譜卡" as any)}</Text>
              <TouchableOpacity onPress={() => setShowCardHistory(false)}>
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
              {restorableHistory.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 12, backgroundColor: "#fff" }}
                  onPress={() => { void restoreCardHistory(entry); }}
                  disabled={restoringCards}
                >
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }} numberOfLines={2}>
                    {entry.names.join("、")}
                  </Text>
                  <Text style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                    {new Date(entry.at).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FreeUpsellModal
        visible={upsellVisible}
        remaining={Math.max(0, aiLimit - aiUsed)}
        priceLabel={upsellPriceLabel}
        canPurchaseHere={canPurchaseHere}
        onClose={() => setUpsellVisible(false)}
        onUpgrade={() => { setUpsellVisible(false); setShowPaywall(true); }}
        onHaveCode={() => { setUpsellVisible(false); setShowPaywall(true); }}
      />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={paywallFeature}
      />
    </>
  );
      }

// ─── Styles ───────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  preparing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  preparingTxt: { fontSize: 14, fontWeight: "700", color: SUB, textAlign: "center" },
  emptyList: { flexGrow: 1, padding: 20, paddingTop: 12 },
  list: { padding: 14 },
  msgRow: { flexDirection: "row", marginBottom: 12, gap: 8, alignItems: "flex-end" },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#E8F0F4", alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BRAND, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: CARD, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER },
  copyBtn: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8 },
  copyBtnTxt: { fontSize: 11, fontWeight: "700", color: "#5F6F80" },
  bubbleTxt: { fontSize: 14, color: TEXT, lineHeight: 21 },
  typing: { paddingHorizontal: 18, paddingVertical: 14 },
  msgImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
  empty: { flex: 1, paddingHorizontal: 16, justifyContent: "space-between" },
  emptyContent: { alignSelf: "stretch" },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch", marginBottom: 16 },
  greetingEmoji: { fontSize: 32 },
  greetingName: { fontSize: 18, fontWeight: "900", color: TEXT },
  heroCard: { alignSelf: "stretch", height: 135, borderRadius: 22, overflow: "hidden", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16, shadowColor: "#8A4B2A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6 },
  heroCardScrim: { position: "absolute", top: 0, left: 0, bottom: 0 },
  heroCardScrimLayer: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "#FFF8EF" },
  heroCardContent: { zIndex: 2, gap: 2, maxWidth: "58%" },
  heroCardTitle: { fontSize: 22, fontWeight: "900", color: "#183B56", textShadowColor: "rgba(90,60,20,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  heroCardSubtitle: { fontSize: 13, color: "#183B56", marginTop: 2, fontWeight: "700", textShadowColor: "rgba(90,60,20,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroCardCta: { zIndex: 2, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: canva.action, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 10 },
  heroCardCtaTxt: { fontSize: 14, fontWeight: "800", color: canva.textOnAccent },
  toolGrid: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  toolBtn: { width: "48%", flexGrow: 1, backgroundColor: CARD, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: BORDER, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  toolIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  toolBtnTxt: { fontSize: 14, fontWeight: "800", color: TEXT, flex: 1 },
  scenarioLabel: { fontSize: 12, color: SUB, fontWeight: "700", alignSelf: "flex-start", marginTop: 26, marginBottom: 10 },
  scenarioRow: { alignSelf: "stretch", flexDirection: "row", gap: 12, paddingRight: 4 },
  scenarioCard: { width: 176, height: 128, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end", borderWidth: 1, borderColor: "#E6DED4", backgroundColor: "#FFF8EF" },
  scenarioCardScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.30)" },
  scenarioCardContent: { paddingHorizontal: 12, paddingBottom: 12, zIndex: 2 },
  scenarioCardEmoji: { fontSize: 20, marginBottom: 4 },
  scenarioCardTitle: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  scenarioCardSub: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  hotKeyBar: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 10 },
  hotKeyScroll: { paddingHorizontal: 12, gap: 8 },
  hotKeyChip: { backgroundColor: "#E8F0F4", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  hotKeyChipTxt: { fontSize: 13, color: BRAND, fontWeight: "700" },
  followUpBar: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 10 },
  followUpLabel: { fontSize: 12, fontWeight: "700", color: SUB, marginBottom: 8, paddingHorizontal: 12 },
  followUpScroll: { paddingHorizontal: 12, gap: 8 },
  followUpChip: { backgroundColor: "#E8F0F4", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  followUpChipAction: { backgroundColor: BRAND, borderColor: BRAND },
  followUpTxt: { fontSize: 13, color: BRAND, fontWeight: "700" },
  sourceBtnRow: { flexDirection: "row", gap: 10, paddingHorizontal: 12, marginBottom: 8 },
  sourceBtnLib: { backgroundColor: "#183B56", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, flex: 1, alignItems: "center" },
  sourceBtnAI: { backgroundColor: "#183B56", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, flex: 1, alignItems: "center" },
  sourceBtnTxt: { fontSize: 14, color: "#fff", fontWeight: "800" },
  restoreBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginTop: 4, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: "#FFF8EF", borderWidth: 1, borderColor: "#F3DFC7" },
  restoreTitle: { fontSize: 13, fontWeight: "800", color: "#183B56" },
  restoreSub: { fontSize: 11, color: SUB, marginTop: 2, lineHeight: 15 },
  restoreBtn: { backgroundColor: canva.action, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  restoreBtnTxt: { fontSize: 12, fontWeight: "900", color: canva.textOnAccent },
  incompleteBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginTop: 4, marginBottom: 8, padding: 12, borderRadius: 14, backgroundColor: "#FFF4E5", borderWidth: 1, borderColor: "#F5C18F" },
  incompleteTxt: { flex: 1, fontSize: 12, fontWeight: "700", color: "#8A4B08", lineHeight: 17 },
  incompleteBtn: { backgroundColor: "#183B56", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  incompleteBtnTxt: { fontSize: 12, fontWeight: "900", color: "#fff" },
  recBar: { borderTopWidth: 1, borderTopColor: BORDER, padding: 12 },
  foodSafetyDisclaimer: { fontSize: 11, color: HINT, lineHeight: 16, marginTop: 8 },
  recHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  recTitle: { fontSize: 12, fontWeight: "700", color: BRAND },
  recBatch: { flexDirection: "row", gap: 6, alignItems: "center" },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4, paddingVertical: 6 },
  selectAllTxt: { fontSize: 12, fontWeight: "700", color: BRAND },
  batchActionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  batchMeta: { flex: 1, minWidth: 0, gap: 3 },
  selectedCount: { fontSize: 11, fontWeight: "700", color: SUB },
  batchPlanBtnWide: { flex: 1, backgroundColor: canva.action, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  batchPlanTxtWide: { fontSize: 13, fontWeight: "900", color: canva.textOnAccent },
  recCardCheck: { position: "absolute", top: 34, left: 7, zIndex: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: "rgba(255,248,239,0.92)", alignItems: "center", justifyContent: "center" },
  batchMealBtn: { backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  batchMealTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  batchPlanBtn: { backgroundColor: canva.action, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  batchShopBtn: { backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  batchShopTxt: { fontSize: 11, fontWeight: "800", color: "#183B56" },
  recScroll: { gap: 10 },
  recCard: { width: 170, minHeight: 160, backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, overflow: "hidden", position: "relative" },
  recCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  recCardImg: { width: "100%", height: 96, backgroundColor: BORDER },
  recCardImgPH: { alignItems: "center", justifyContent: "center", backgroundColor: "#EEF4FB" },
  recCardDiff: { fontSize: 10, fontWeight: "700", color: BRAND },
  usageBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "#FFF8E8", borderWidth: 1, borderColor: "#F5D9A8" },
  usageBannerWarn: { backgroundColor: "#FFF1E6", borderColor: "#F5C18F" },
  usageBannerTitle: { fontSize: 12, color: TEXT, fontWeight: "700", lineHeight: 17 },
  usageUpgradeBtn: { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  usageUpgradeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  sourceSummaryRow: { paddingHorizontal: 12, paddingBottom: 6 },
  sourceSummaryTxt: { fontSize: 11, fontWeight: "700", color: SUB },
  recCardSourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recCardSourceLibrary: { backgroundColor: "#E8F0F4" },
  recCardSourceMine: { backgroundColor: "#E8F0E4" },
  recCardSourceAI: { backgroundColor: "#FFF1E6" },
  recCardSourceTxt: { fontSize: 9, fontWeight: "800", color: "#5F6F80" },
  recCardBody: { padding: 10, paddingTop: 4, justifyContent: "space-between" },
  recCardName: { fontSize: 13, fontWeight: "800", color: TEXT, lineHeight: 18, minHeight: 36, marginBottom: 6 },
  recCardNameEn: { fontSize: 11, color: SUB, lineHeight: 14, marginBottom: 4 },
  recCardMeta: { flexDirection: "row", gap: 8, marginBottom: 8 },
  recCardMetaTxt: { fontSize: 10, color: SUB },
  recCardTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  recTagPill: { backgroundColor: "#E8F0F4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  recTagTxt: { fontSize: 10, fontWeight: "700", color: BRAND, maxWidth: 88 },
  recCardBtns: { flexDirection: "row", gap: 6 },
  recCardIngredientsToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8, paddingVertical: 2 },
  recCardIngredientsToggleTxt: { fontSize: 11, fontWeight: "700", color: BRAND },
  recCardIngList: { marginBottom: 10, paddingTop: 2 },
  recCardIngRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  recCardIngDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: SUB, marginTop: 6 },
  recCardIngTxt: { flex: 1, fontSize: 11, color: TEXT, flexShrink: 1 },
  recCardIngMore: { fontSize: 10, color: SUB, marginTop: 2, fontWeight: "600" },
  btnMeal: { flex: 1, backgroundColor: BRAND, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  btnMealTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnFavorite: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BRAND, paddingVertical: 6, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnSwap: { flex: 1, backgroundColor: "#E8F0F4", paddingVertical: 7, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  btnSwapTxt: { fontSize: 11, fontWeight: "700", color: BRAND },
  swapNoCardsBox: { marginTop: 8, padding: 8, borderRadius: 10, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA", gap: 6 },
  swapNoCardsTxt: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  swapNoCardsPrimary: { backgroundColor: "#F59E0B", paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  swapNoCardsPrimaryTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  swapNoCardsSecondary: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: BRAND, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  swapNoCardsSecondaryTxt: { fontSize: 11, fontWeight: "800", color: BRAND },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bottomDock: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: CARD },
  disclaimer: { fontSize: 11, color: HINT, textAlign: "center", paddingHorizontal: 16, paddingVertical: 6, backgroundColor: CARD },
  input: { flex: 1, backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT, maxHeight: 100, minHeight: 40, borderWidth: 1, borderColor: BORDER },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  camBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F0F4", alignItems: "center", justifyContent: "center" },
  toastOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  toastContainer: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center", zIndex: 100 },
  toast: { backgroundColor: BG, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: BORDER, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  toastRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch" },
  toastTxt: { fontSize: 14, fontWeight: "700", color: TEXT, flex: 1 },
  toastAction: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: canva.accent, minWidth: 96, alignItems: "center" },
  toastActionTxt: { fontSize: 14, fontWeight: "800", color: canva.textOnAccent },

  // Markdown renderer styles
  mdRecipeTitle: { fontSize: 16, fontWeight: "700", color: BRAND, marginTop: 12, marginBottom: 4 },
  mdRecipeTime: { fontSize: 12, color: SUB, marginTop: 2 },
  mdSectionHeader: { fontSize: 14, fontWeight: "700", color: TEXT, marginTop: 10, marginBottom: 4 },
  mdBullet: { fontSize: 14, color: TEXT },
  mdStepNumber: { color: BRAND, fontWeight: "700", fontSize: 14, marginRight: 8, minWidth: 20 },
  mdStepText: { fontSize: 14, color: TEXT, flex: 1 },
  mdParagraph: { fontSize: 14, color: TEXT, lineHeight: 20, marginBottom: 4 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { width: '100%', backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingVertical: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24, height: Dimensions.get("window").height * 0.80 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E6DED4", alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: TEXT },
  rname: { fontSize: 14, color: SUB, fontWeight: "600", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  mealChip: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F8F1E7", alignItems: "center" },
  mealChipOn: { backgroundColor: BRAND },
  mealChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F8F1E7", marginRight: 8 },
  dateChipOn: { backgroundColor: BRAND },
  dateChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  preview: { backgroundColor: "#FFF8EF", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  previewItem: { fontSize: 13, color: TEXT, lineHeight: 22 },
  previewMore: { fontSize: 12, color: SUB, marginTop: 4 },
  btn: { backgroundColor: BRAND, paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  shopActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  shopActionChip: { flex: 1, backgroundColor: "#F8F1E7", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  shopActionTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  shopActionCancel: { backgroundColor: "#FEE2E2" },
  shopActionCancelTxt: { fontSize: 13, fontWeight: "700", color: RED },
  shopGroup: { marginBottom: 14 },
  shopGroupTitle: { fontSize: 13, fontWeight: "800", color: BRAND, marginBottom: 8 },
  shopItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  shopItemOn: { backgroundColor: "#E8F0F4" },
  shopItemTxt: { flex: 1, fontSize: 14, color: SUB },
});

const d = StyleSheet.create({
  outer: { flex: 1, flexDirection: "row" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  drawer: {
    height: "100%", backgroundColor: CARD,
    borderRightWidth: 1, borderRightColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  drawerInner: { flex: 1, paddingHorizontal: 16 },
  drawerHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 12,
  },
  drawerNewBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: BRAND, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  drawerNewTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BG, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: BORDER,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, paddingVertical: 0 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: SUB, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  clearAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#FEF2F2" },
  clearAllTxt: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  emptyRow: { alignItems: "center", paddingVertical: 40 },
  emptyTxt: { fontSize: 15, color: SUB },
  sessionRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 4,
    backgroundColor: "#FFF8EF",
  },
  sessionRowActive: { backgroundColor: "#E8F0F4", borderWidth: 1, borderColor: BRAND },
  sessionContent: { flex: 1, marginRight: 8 },
  sessionTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 2 },
  sessionTitleActive: { color: BRAND },
  sessionPreview: { fontSize: 12, color: SUB, marginBottom: 2 },
  sessionDate: { fontSize: 11, color: HINT },
  sessionDelete: { padding: 6 },
});
