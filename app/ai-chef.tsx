import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Platform, Modal, ScrollView, Alert, Keyboard, Image, ActionSheetIOS,
  ActivityIndicator, Animated, Dimensions, TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { trpc, apiClient, API_BASE_URL } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateMealPlanAndCart } from "@/hooks/useInvalidateMealPlanAndCart";
import { useInvalidateRecipesAndWeekly } from "@/hooks/useInvalidateRecipesAndWeekly";
import { compressImage } from "@/lib/image-utils";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";
import { categorizeIngredient, calcAdjustedQty } from "@/constants/ingredients";
import { todayISO, toISODate, formatDateLabel, getDayBefore } from "@/src/lib/date";

type MsgContent = string | Array<
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
>;
type Message = { role: "user" | "assistant"; content: MsgContent };
type BackendMessage = { role: "user" | "assistant"; content: MsgContent };
type AIRecipe = {
  id?: string;
  name: string; description: string;
  cookTime: number; servings: number;
  difficulty: string; recipeCategory?: string;
  ingredients: { name: string; quantity: string; unit: string; category?: string }[];
  steps: string[]; tags: string[];
  image?: string; thumbnailUrl?: string;
  source?: "official" | "custom" | "ai";
  officialId?: number;
  customId?: number;
  _savedId?: number;
  _libraryRecipeId?: string;
};

type MealPlanStep = "idle" | "people" | "audience" | "time" | "dislike" | "generating" | "result";
type MealPlanPreferences = {
  people: number;
  hasKids: boolean;
  hasElderly: boolean;
  time: "quick" | "normal" | "leisure" | null;
  dislikes: string;
};

const EMPTY_PREFS: MealPlanPreferences = { people: 0, hasKids: false, hasElderly: false, time: null, dislikes: "" };

// ─── Recipe Validation ───────────────────────────────────
// A valid recipe MUST have: name (2-50 chars), ≥1 ingredient, ≥1 step
// Relaxed validation to accept backend-validated recipes
const isValidRecipe = (r: AIRecipe): boolean => {
  if (!r.name || r.name.length < 2 || r.name.length > 50) return false;
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) return false;
  if (!Array.isArray(r.steps) || r.steps.length === 0) return false;
  return true;
};

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
    return name.length > 1 && !PLACEHOLDER_INGREDIENT_NAMES.has(name);
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

const normalizeIngredient = (ing: any): { name: string; quantity: string; unit: string } | null => {
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
      quantity: nameQtyMatch[2] || rawQuantity,
      unit: nameQtyMatch[3] || rawUnit,
    };
  }

  if (!rawQuantity && !rawUnit && /^(?:約|大約|大概|近約|左右)?\s*[\d.]+(?:[\d.-]*[\d.]+)?\s*(?:克|毫升|公升|升|ml|l|L|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb|角|副)\s*$/i.test(rawName)) {
    return null;
  }

  return {
    name: rawName,
    quantity: rawQuantity,
    unit: rawUnit,
  };
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

// 將任何來源嘅食譜 steps/ingredients 統一 normalize 成 string[] / 標準 ingredient[]
// 防呆：如果 AI 返回空嘅 ingredients/steps，嘗試修復
const normalizeRecipe = (r: any): AIRecipe => {
  const normalized = {
    ...r,
    steps: Array.isArray(r?.steps) ? r.steps.map(normalizeStep).filter(Boolean) : [],
    ingredients: Array.isArray(r?.ingredients)
      ? r.ingredients.map(normalizeIngredient).filter((v: { name: string; quantity: string; unit: string } | null): v is { name: string; quantity: string; unit: string } => !!v)
      : [],
    tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t ?? "").trim()).filter(Boolean) : [],
    source: (r?.source ?? "ai") as AIRecipe["source"],
  };
  
  // Fallback: if ingredients/steps are empty but we have description, try to extract
  if (normalized.ingredients.length === 0 && r.description) {
    // Try to extract ingredients from description (simple fallback)
    console.log(`[normalizeRecipe] No ingredients found, description: ${r.description?.slice(0, 100)}`);
  }
  if (normalized.steps.length === 0 && r.description) {
    // Use description as a single step (better than nothing)
    normalized.steps = [r.description];
    console.log(`[normalizeRecipe] Using description as step`);
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

// 由 AI Chef 所有過往 session 嘅 assistant 訊息抽「食譜名稱」（來源 B：歷史生成紀錄）
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

const QUICK_ACTIONS = [
  { id: "fridge", icon: "camera-outline", label: "拍雪櫃幫我諗" },
  { id: "daily", icon: "restaurant-outline", label: "幫我諗3餸1湯" },
  { id: "quick", icon: "time-outline", label: "30分鐘快手" },
  { id: "healthy", icon: "heart-outline", label: "清淡健康" },
  { id: "ricecooker", icon: "hardware-chip-outline", label: "電飯煲懶人" },
  { id: "kids", icon: "happy-outline", label: "小朋友啱食" },
  { id: "guest", icon: "wine-outline", label: "宴客/有朋友" },
  { id: "pantry", icon: "basket-outline", label: "用雪櫃食材" },
];

const HOT_KEY_CONFIG: Record<string, { searchQuery?: string; aiPrompt: string }> = {
  quick: { searchQuery: "快手", aiPrompt: "30 分鐘內可以做好的家常菜" },
  healthy: { searchQuery: "清淡", aiPrompt: "今晚想吃清淡一點，少油少鹽" },
  ricecooker: { searchQuery: "電飯煲", aiPrompt: "用電飯煲一鍋煮的懶人食譜" },
  kids: { searchQuery: "小朋友", aiPrompt: "小朋友喜歡吃的菜式" },
  guest: { searchQuery: "宴客", aiPrompt: "宴客/有朋友來，想煮得體面啲" },
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

// ─── Helpers ──────────────────────────────────────────────

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const SESSIONS_KEY = (uid: string | number) => `kindcipe_ai_sessions_${uid}`;
const ACTIVE_KEY = (uid: string | number) => `kindcipe_ai_active_${uid}`;
const OLD_CHAT_KEY = (uid: string | number) => `kindcipe_ai_chat_${uid}`;

const MAX_IMAGES_PER_SESSION = 3;

const LOADING_STEPS = [
  "AI 正在分析你的需求...",
  "生成食譜中...",
  "為你整理個人化結果...",
  "計算食材份量同配搭...",
  "準備食譜步驟同貼士...",
  "快完成，最後整合中...",
];

const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#8A94A6";
const HINT = "#B0BAC9";
const BORDER = "#E0EAF4";
const GREEN = "#16A34A";
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
  const text = content.replace(/^\s+|\s+$/g, "");
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
  if (!firstUser) return "新對話";
  const t = contentToText(firstUser.content).trim();
  return t.length > 30 ? t.slice(0, 30) + "..." : t;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
// Renders the specific format used by AI Chef:
// - Recipe headers: 食譜一：類別 —— 名稱（約XX分鐘）
// - Section headers: 🛒 食材：, 🍳 步驟：
// - Bullet lists: - item
// - Numbered lists: 1. item
// - Bold: **text**
// - Horizontal rules: ---

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
    const recipeHeaderMatch = trimmed.match(/^(?:食譜[一二三四五六七八九十\d]+[：:]\s*)?(.+?)[——\-]\s*(.+?)(?:（約?(\d+)分鐘）)?$/);
    if (recipeHeaderMatch) {
      elements.push(
        <View key={key++} style={{ marginTop: 12, marginBottom: 4 }}>
          <Text selectable style={[styles.mdRecipeTitle, { color: BRAND, fontWeight: "700", fontSize: 16 }]}>
            {recipeHeaderMatch[2]?.trim() || trimmed}
          </Text>
          {recipeHeaderMatch[3] && (
            <Text selectable style={[styles.mdRecipeTime, { color: SUB, fontSize: 12, marginTop: 2 }]}>
              約 {recipeHeaderMatch[3]} 分鐘
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
          <Text selectable style={[styles.mdBullet, { fontSize: 14, color: TEXT, flex: 1 }]}>{bulletMatch[1]}</Text>
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
          <Text selectable style={[styles.mdStepText, { fontSize: 14, color: TEXT, flex: 1 }]}>{numberedMatch[2]}</Text>
        </View>
      );
      continue;
    }

    // Regular text paragraph
    elements.push(
      <Text selectable key={key++} style={[styles.mdParagraph, { fontSize: 14, color: TEXT, lineHeight: 20, marginBottom: 4 }]}>
        {trimmed}
      </Text>
    );
  }

  return elements;
}

// ─── Main Component ──────────────────────────────────────

export default function AIChefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeFamily } = useAuth();
  const activeFamilyId = activeFamily?.id;
  const kitchenName = activeFamily?.name ?? "Kindcipe";
  const userName = user?.name ?? "";

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
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
  }, [showSessions]);

  const activeSession = sessions.find(s => s.id === activeChatId);
  const messages = activeSession?.messages ?? [];

  const [input, setInput] = useState("");
  const [recommendedRecipes, setRecommendedRecipes] = useState<AIRecipe[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const uploadingRef = useRef(false);
  // Hot key / library-first search loading state（顯示「正在搵食譜庫...」）
  const [libraryLoading, setLibraryLoading] = useState(false);
  // 卡片「睇食材」展開（記錄展開邊張卡）
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // ─── Daily 3-dish-1-soup flow ──────────────────────────
  const [mealStep, setMealStep] = useState<MealPlanStep>("idle");
  const [mealPrefs, setMealPrefs] = useState<MealPlanPreferences>(EMPTY_PREFS);
  const [mealResult, setMealResult] = useState<AIRecipe[] | null>(null);

  // ─── AI proactive next steps ───────────────────────────
  const [aiNextSteps, setAiNextSteps] = useState<string[]>([]);

  // ─── Toast notification ────────────────────────────────
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });
  const showToast = (text: string) => {
    setToast({ text, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  };

  // ─── Shopping lists after AI plan ─────────────────────
  const [shopRecipes, setShopRecipes] = useState<AIRecipe[]>([]); // 保留食譜名稱供 fromRecipeName
  const [shopPlannedDate, setShopPlannedDate] = useState<string>(todayISO());
  const [shopMaxDate, setShopMaxDate] = useState<string>(todayISO());
  // 收藏中狀態（顯示嗰張卡個 spinner）
  const [favoritingName, setFavoritingName] = useState<string>("");
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  // 記錄已換過嘅食譜名稱，避免重複
  const [swappedRecipeNames, setSwappedRecipeNames] = useState<Set<string>>(new Set());
  // 記錄本次 chat 已見過嘅食譜名稱，避免同一個 session 反覆輪迴
  const [sessionSeenRecipeNames, setSessionSeenRecipeNames] = useState<string[]>([]);
  // 批量排餐完成後用嚟開啟 IngredientPickerModal（多個食譜）
  const [batchPickerRecipes, setBatchPickerRecipesState] = useState<PickerRecipe[] | null>(null);
  const setBatchPickerRecipes = (recipes: PickerRecipe[] | null) => {
    setBatchPickerRecipesState(recipes);
  };

  // ── Pantry / Ingredient asking flow ───────────────────
  const { data: pantryData } = trpc.pantry.list.useQuery(undefined, { enabled: !!user });
  const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, { enabled: !!user, staleTime: 30_000 });
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

  // Build set of recipe names used in last 30 days + 食譜庫已有菜式 + AI Chef 過往生成紀錄
  // （A: 已排餐/mealPlanHistory + userRecipes；B: 所有 AI session 歷史）
  const usedRecipeNames = useMemo(() => {
    const names = new Set<string>();
    (mealPlanHistory || []).forEach((mp: any) => {
      if (mp.recipeName) names.add(String(mp.recipeName).trim());
    });
    (userRecipes || []).forEach((r: any) => {
      if (r?.name) names.add(String(r.name).trim());
    });
    extractAiHistoryRecipeNames(sessions).forEach((n) => names.add(n));
    return [...names];
  }, [mealPlanHistory, userRecipes, sessions]);

  const [askingIngredients, setAskingIngredients] = useState(false);

  const resolveRecipeRef = (r: AIRecipe): { recipeId: string; isLibraryRef: boolean } => {
    if (r.id && (r.id.startsWith("official_") || r.id.startsWith("user_"))) {
      return { recipeId: r.id, isLibraryRef: true };
    }
    if (r._libraryRecipeId) return { recipeId: r._libraryRecipeId, isLibraryRef: true };
    if (r._savedId) return { recipeId: `user_${r._savedId}`, isLibraryRef: true };
    if (r.source === "official" && r.officialId) return { recipeId: `official_${r.officialId}`, isLibraryRef: true };
    if (r.source === "custom" && r.customId) return { recipeId: `user_${r.customId}`, isLibraryRef: true };
    return { recipeId: "", isLibraryRef: false };
  };

  const batchAlreadyAddedKeys = useMemo(() => {
    const added = new Set<string>();
    if (!batchPickerRecipes?.length || !shoppingItems.length) return added;
    const activeItems = (shoppingItems as any[]).filter((item: any) => item.status !== "bought");
    // 每張 card 對應嘅真實 recipe id（ai_<i> → official_X/user_X），用嚟對返購物清單項目
    const realIds = shopRecipes.map((r) => {
      const ref = resolveRecipeRef(r);
      return ref.isLibraryRef ? ref.recipeId : "";
    });
    batchPickerRecipes.forEach((recipe, ri) => {
      const realId = realIds[ri] || "";
      const targetMealPlanId = recipe.fromMealPlanId ? Number(recipe.fromMealPlanId) : null;
      const targetShoppingDate = recipe.date || todayISO();
      recipe.ingredients.forEach((ing, idx) => {
        const key = `${recipe.id}::${idx}`;
        const ingName = (ing.name || "").trim();
        const ingUnit = (ing.unit || "").trim();
        if (!ingName || !realId) return;
        const matched = activeItems.some((item: any) => {
          const itemName = (item.name || "").trim();
          const itemUnit = (item.unit || "").trim();
          const itemRecipeId = (item.fromRecipeId || "").trim();
          const itemMealPlanId = item.fromMealPlanId ? Number(item.fromMealPlanId) : null;
          const itemDate = String(item.plannedDate ?? "").trim();
          const sameMealPlan = targetMealPlanId != null && itemMealPlanId === targetMealPlanId;
          const sameRecipeAndDate = itemName === ingName && itemUnit === ingUnit && itemRecipeId === realId && itemDate === targetShoppingDate;
          return sameMealPlan || sameRecipeAndDate;
        });
        if (matched) added.add(key);
      });
    });
    return added;
  }, [batchPickerRecipes, shoppingItems, shopRecipes]);

  const COMMON_INGREDIENT_CHIPS = ["雞蛋", "豆腐", "番茄", "洋蔥", "青菜", "豬肉", "雞肉", "魚", "米", "麵"];

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
      const recipeHeaderRe = /^[*#]*\s*(?:第[一二三四五六七八九十]+道|[0-9]+[、.．]\s*)/;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { buf.push(line); continue; }
        if ((trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) ||
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

    let name = "";
    let recipeCategory = "其他";
    let cookTime = 30;

    if (newFormatMatch) {
      const rawCategory = newFormatMatch[1]?.trim() || "";
      // Clean up category - remove leading/trailing dashes or spaces
      recipeCategory = rawCategory.replace(/^[—\-]+\s*/, "").trim() || "其他";
      name = newFormatMatch[2]?.trim() || "";
      // Clean up name - remove leading dashes
      name = name.replace(/^[—\-]+\s*/, "").trim();
      cookTime = newFormatMatch[3] ? parseInt(newFormatMatch[3], 10) : 30;
    } else {
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

    // Extract description (paragraph before 🛒 or 食材)
    const descMatch = text.match(/(?:（約\d+分鐘）|^\s*$)\s*\n\s*(.+?)(?=\n\s*(?:🛒|食材|材料|原料|Ingredients))/s);
    let description = descMatch?.[1]?.trim() || "";
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

  const chatMutation = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => {
      const { mainText, nextSteps } = parseAssistantResponse(data.content);
      updateMessages(prev => [...prev, { role: "assistant", content: mainText }]);
      setAiNextSteps(nextSteps);

      // Backend now returns structured, validated recipes via extractRecipes
      const backendRecipes = Array.isArray(data.recipes) && data.recipes.length > 0
        ? data.recipes.map(normalizeRecipe)
        : [];

      // Use backend recipes if available, otherwise try frontend parsing
      let recipes = backendRecipes.length > 0 ? backendRecipes : tryParseRecipes(mainText);

      // Final validation: only show cards for truly valid recipes
      // 去重做硬擋：若全部撞歷史，先自動再試一次；仍然冇新卡先清空
      const seenRecipeKeys = new Set<string>();
      const dedupeRecipe = (r: AIRecipe): AIRecipe[] => {
        if (!isValidRecipe(r)) return [];
        const dupByHistory = isDuplicateRecipeName(r.name, usedRecipeNames);
        if (dupByHistory) {
          console.log(`[AI Chef] Filtering out duplicate recipe: ${r.name}`);
          return [];
        }
        const key = normalizeRecipeName(r.name);
        if (seenRecipeKeys.has(key)) return [];
        seenRecipeKeys.add(key);
        return [r];
      };

      const validRecipes = recipes.flatMap(dedupeRecipe);
      const fallbackRecipes = recipes.filter(isValidRecipe); // 唔理去重，至少有卡

      if (validRecipes.length > 0) {
        const normalizedValidRecipes = validRecipes.map(normalizeRecipe);
        setRecommendedRecipes(normalizedValidRecipes);
        setSessionSeenRecipeNames((prev) => {
          const next = [...prev];
          normalizedValidRecipes.forEach((r) => {
            const name = normalizeRecipeName(r.name || "");
            if (name && !next.includes(name)) next.push(name);
          });
          return next.slice(-15);
        });
      } else if (fallbackRecipes.length > 0 && !noveltyRetryRef.current) {
        // 全部撞歷史 → 自動再試一次，叫 AI 出更唔同嘅
        noveltyRetryRef.current = true;
        console.log(`[AI Chef] All recipes duplicated in history, retrying once with stricter novelty`);
        addBotMessage("🔄 今次同你之前見過嘅建議太接近，我再換一批全新食譜... ");
        regenerateWithMode((lastChatModeRef.current || "ai") as "library" | "ai", true, true);
        setRecommendedRecipes([]);
        return;
      } else if (fallbackRecipes.length > 0) {
        // retry 後仍然冇新卡，直接清空，避免重複卡再出現
        console.log(`[AI Chef] All recipes duplicated in history after retry, clearing recommendations`);
        setRecommendedRecipes([]);
      } else {
        // No valid recipes from backend — try aggressive frontend parse as fallback
        console.log("[AI Chef] No valid recipes from backend, trying aggressive parse...");
        const aggressiveParsed = tryParseRecipes(mainText);
        const validParsed = aggressiveParsed.filter(isValidRecipe);
        if (validParsed.length > 0) {
          console.log(`[AI Chef] Aggressive parse found ${validParsed.length} valid recipes`);
          const normalizedValidParsed = validParsed.map(normalizeRecipe);
          setRecommendedRecipes(normalizedValidParsed);
          setSessionSeenRecipeNames((prev) => {
            const next = [...prev];
            normalizedValidParsed.forEach((r) => {
              const name = normalizeRecipeName(r.name || "");
              if (name && !next.includes(name)) next.push(name);
            });
            return next.slice(-15);
          });
        } else {
          // Still nothing — clear stale recommendations
          console.log("[AI Chef] No valid recipes found after aggressive parse");
          setRecommendedRecipes([]);
        }
      }

      scrollToLatestMessage();
    },
    onError: (err: any) => {
      const rawMsg = err?.message || err?.data?.message || "";
      const lowerMsg = rawMsg.toLowerCase();
      let msg: string;
      if (lowerMsg.includes("abort") || lowerMsg.includes("timeout")) {
        msg = "AI 回應時間過長，請簡化問題或稍後再試。";
      } else if (rawMsg) {
        msg = rawMsg;
      } else {
        msg = "AI 助手暫時無法回應，請稍後再試。";
      }
      updateMessages(prev => [...prev, { role: "assistant", content: `抱歉，${msg}` }]);
      // Clear all stale AI state on error
      setAiNextSteps([]);
      setRecommendedRecipes([]);
      setMealResult(null);
      scrollToLatestMessage();
    },
  });

  // Loading step animation
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
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

        if (all.length === 0) {
          const newId = generateId();
          all = [{ id: newId, title: "新對話", createdAt: Date.now(), messages: [] }];
        }
        const activeId = await AsyncStorage.getItem(ACTIVE_KEY(user.id));
        setSessions(all);
        setActiveChatId(activeId && all.find(s => s.id === activeId) ? activeId : all[0].id);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [user?.id]);

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

  // Auto-title: when first user message is sent, update the title
  useEffect(() => {
    if (!activeSession || !loaded) return;
    if (activeSession.title !== "新對話") return;
    const firstUser = activeSession.messages.find(m => m.role === "user");
    if (!firstUser) return;
    const title = makeSessionTitle(activeSession.messages);
    if (title === "新對話") return;
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === activeChatId);
      if (idx === -1) return prev;
      const next = [...prev]; next[idx] = { ...next[idx], title };
      return next;
    });
  }, [activeSession?.messages.length]);

  // ─── Chat actions ──────────────────────────────────────

  const handleNewChat = () => {
    setRecommendedRecipes([]);
    setMealResult(null);
    setMealStep("idle");
    setMealPrefs(EMPTY_PREFS);
    setAiNextSteps([]);
    setAskingIngredients(false);
    setShowSessions(false);

    const newId = generateId();
    const newSession: ChatSession = { id: newId, title: "新對話", createdAt: Date.now(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveChatId(newId);
    scrollToLatestMessage();
  };

  const handleSwitchChat = (id: string) => {
    if (id === activeChatId) { setShowSessions(false); return; }
    setRecommendedRecipes([]);
    setMealResult(null);
    setMealStep("idle");
    setMealPrefs(EMPTY_PREFS);
    setAiNextSteps([]);
    setAskingIngredients(false);
    setShowSessions(false);
    setActiveChatId(id);
    scrollToLatestMessage();
  };

  const handleDeleteChat = (id: string) => {
    Alert.alert("刪除對話", "確定要刪除這個對話嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除", style: "destructive",
        onPress: () => {
          setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (next.length === 0) {
              const newId = generateId();
              const fallback: ChatSession = { id: newId, title: "新對話", createdAt: Date.now(), messages: [] };
              setActiveChatId(newId);
              return [fallback];
            }
            if (id === activeChatId) setActiveChatId(next[0].id);
            return next;
          });
        },
      },
    ]);
  };

  // ─── Hot key preference（第一次主動問，之後記住唔再問）──────
  const hotKeyPrefsRef = useRef<MealPlanPreferences | null>(null);
  const pendingHotKeyRef = useRef<string>("");

  // ─── Keyboard ──────────────────────────────────────────

  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ─── Plan modal ────────────────────────────────────────

  const [showPlan, setShowPlan] = useState(false);
  const [planRecipe, setPlanRecipe] = useState<AIRecipe | null>(null);
  // 同步 planRecipe，避免 onSuccess 閉包讀到舊值（尤其係 ensureSaved 後帶住 user_<id> 去購物清單）
  const planRecipeRef = useRef<AIRecipe | null>(null);
  useEffect(() => {
    planRecipeRef.current = planRecipe;
  }, [planRecipe]);
  // 防 onConfirm 喺 resolveShoppingRef await 期間重複提交
  const shopConfirmLockRef = useRef(false);
  const [batchRecipes, setBatchRecipes] = useState<AIRecipe[] | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(todayISO());
  const [planMeal, setPlanMeal] = useState("dinner");
  const lastChatModeRef = useRef<"library" | "ai" | "">("");
  const noveltyRetryRef = useRef(false);

  const utils = trpc.useUtils();
  const invalidateMealPlanAndCart = useInvalidateMealPlanAndCart();
  const invalidateRecipesAndWeekly = useInvalidateRecipesAndWeekly();
  const saveRecipeM = trpc.recipes.importUser.useMutation({
    onSuccess: async () => {
      await Promise.all([
        invalidateRecipesAndWeekly(),
        invalidateMealPlanAndCart(),
      ]);
    },
  });
  // A3: 去重 —— 同 session 記住已 save 過嘅 id；跨 session 靠「同名 custom」歸一
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
        const hit = (userRecipes ?? []).find((c: any) => c.name && c.name.trim() === key);
        if (hit && hit.id) {
          savedRecipeIdsRef.current.set(key, hit.id);
          return hit.id;
        }
      } catch { /* 庫查詢失敗就照儲 */ }
    }
    const saved = await saveRecipeM.mutateAsync({
      name: recipe.name, description: recipe.description,
      cookTime: recipe.cookTime, servings: overrideServings ?? recipe.servings,
      difficulty: recipe.difficulty,
      image: "", thumbnailUrl: "",
      recipeCategory: recipe.recipeCategory || "其他",
      tags: recipe.source === "official" || recipe.source === "custom" ? (recipe.tags ?? []) : [...(recipe.tags ?? []), "AI 生成"],
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
      const mealTypeLabel = variables.mealType === "breakfast" ? "早餐" : variables.mealType === "lunch" ? "午餐" : variables.mealType === "dinner" ? "晚餐" : "小食";
      const hasConflict = !!(result.warning && result.hasConflict);
      const continueAfterMealPlan = () => {
        const currentRecipe = planRecipeRef.current ?? planRecipe;
        setShowPlan(false);
        // 永遠彈出食材選擇 modal（即使冇食材都让用户揀跳過）
        if (currentRecipe) {
          const ingredients = Array.isArray(currentRecipe.ingredients) && currentRecipe.ingredients.length > 0
            ? currentRecipe.ingredients
            : [];
          openShoppingSelection([currentRecipe], getDayBefore(variables.date), variables.date, [result.newPlanId]);
        } else {
          showToast(`✅ 已加入排餐 (${formatDateLabel(variables.date)} ${mealTypeLabel})`);
        }

        void invalidateMealPlanAndCart();
      };
      if (hasConflict) {
        const warningText = result.warning ?? "";
        const isEatOutConflict = warningText.includes("外出");
        Alert.alert(
          isEatOutConflict ? "衝突提示" : "重複食譜提示",
          warningText,
          [
            { text: "取消", style: "cancel", onPress: () => {
              if (result.newPlanId) deleteMealM.mutate({ id: result.newPlanId, keepRelatedItems: false });
              showToast("已取消衝突排餐");
            }},
            { text: "確定", onPress: () => {
              continueAfterMealPlan();
            }},
          ]
        );
      }
      if (!hasConflict) {
        continueAfterMealPlan();
      }
    },
    onError: (e) => Alert.alert("加入排餐失敗", e.message),
  });
  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: async () => { await invalidateMealPlanAndCart(); },
  });
  const addPlanBatchM = trpc.mealPlan.addBatch.useMutation({
    onSuccess: async () => {
      try {
        await invalidateMealPlanAndCart();
        console.log("[AI Chef] Batch meal plan invalidate successful");
        showToast("✅ 已批量加入排餐");
      } catch (e) {
        console.error("[AI Chef] Batch meal plan invalidate failed:", e);
        showToast("⚠️ 已批量加入排餐，但列表可能需要手動刷新");
      }
    },
    onError: (e) => Alert.alert("批量加入排餐失敗", e.message),
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: async (data, variables) => {
      setShowPlan(false);
      setShopRecipes([]);
      setBatchPickerRecipes(null);
      const count = variables.items.length;
      showToast(`✅ ${count} 件食材已加入購物清單`);
      void invalidateMealPlanAndCart();
    },
    onError: (e) => {
      showToast(`加入食材失敗：${e.message}`);
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

  const handleCamera = () => {
    const options = Platform.OS === "ios"
      ? ["拍照", "從相簿選擇", "取消"]
      : ["拍照", "從相簿選擇"];

    const onSelect = async (idx: number) => {
      if (idx === 2 || (Platform.OS === "android" && idx >= 2)) return;
      if (chatMutation.isPending) return;

      let result: ImagePicker.ImagePickerResult;
      if (idx === 0) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("需要相機權限"); return; }
        try {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"], quality: 0.8, base64: false,
          });
        } catch (e: any) {
          console.error("[AI Chef] Camera launch failed:", e);
          Alert.alert(
            "相機無法使用",
            "此裝置（例如 iOS 模擬器）冇可用相機。\n\n請用真機測試，或改用「從相簿選擇」。"
          );
          return;
        }
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"], quality: 0.8, base64: false,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      try {
        const imageCount = messages.filter(
          (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "image_url")
        ).length;
        if (imageCount >= MAX_IMAGES_PER_SESSION) {
          showToast(`本次對話已達 ${MAX_IMAGES_PER_SESSION} 張圖上限，請開始新對話`);
          return;
        }

        const compressed = await compressImage(result.assets[0].uri);

        if (uploadingRef.current) return;
        uploadingRef.current = true;
        let imageUrl: string;
        try {
          showToast("正在上傳圖片...");
          const up = await apiClient.recipes.uploadRecipeImage.mutate({
            base64: compressed.base64,
            mimeType: compressed.mimeType,
          });
          imageUrl = up?.url ?? "";
          if (!imageUrl) throw new Error("upload returned no url");
          // 相對路徑（/r2-storage/…）要補返後端 base，否則手機 Image 拎唔到
          if (imageUrl.startsWith("/")) imageUrl = `${API_BASE_URL}${imageUrl}`;
        } catch (e: any) {
          Alert.alert("上傳失敗", e?.message ?? "請重試");
          uploadingRef.current = false;
          return;
        } finally {
          uploadingRef.current = false;
        }

        const imageMsg: Message = {
          role: "user",
          content: [
            { type: "text", text: "我雪櫃有呢啲食材，可以煮咩？" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        };

        // ── Library-first：先叫 AI 認食材 → 再搜食譜庫 ──
        setLibraryLoading(true);
        setRecommendedRecipes([]);
        try {
          const recognizeMsg: Message[] = [
            {
              role: "user",
              content: [
                { type: "text", text: "請辨認圖片中嘅食材，逐個列出食材名稱，用頓號分隔，唔好比步驟或食譜。" },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ];
          const recognizeRes = await apiClient.aiRecipe.chat.mutate({
            messages: buildBackendMessages(recognizeMsg),
          });
          const recognizeText = typeof recognizeRes?.content === "string" ? recognizeRes.content : "";
          const ingredients = recognizeText
            .split(/[,、，\n]/)
            .map(s => s.replace(/^[\s\-•*]+|[\s\-•*]+$/g, "").trim())
            .filter(s => /[\u4e00-\u9fa5A-Za-z]/.test(s) && s.length <= 10);

          if (ingredients.length > 0) {
            const searchResult = await apiClient.recipes.search.query({
              query: ingredients.join(" "),
              limit: 6,
            });
            const rawRecipes = Array.isArray(searchResult?.recipes) ? searchResult.recipes : [];
            const libraryRecipes = rawRecipes
              .map(normalizeRecipe)
              .filter(isValidRecipe);
            if (libraryRecipes.length > 0) {
              console.log(`[AI Chef] Camera found ${libraryRecipes.length} library recipes, ingredients: ${ingredients.join("、")}`);
              updateMessages(prev => [...prev, imageMsg]);
              setRecommendedRecipes(libraryRecipes);
              addBotMessage(`我認到你雪櫃有：${ingredients.join("、")}。喺食譜庫搵到 ${libraryRecipes.length} 個配合嘅食譜：`);
              setLibraryLoading(false);
              scrollToEnd();
              return;
            }
          }
          console.log("[AI Chef] Camera library search found 0, falling back to AI");
        } catch (e) {
          console.error("[AI Chef] Camera recognize/search failed:", e);
        }
        setLibraryLoading(false);

        // Fallback：原有 AI flow（連相問可以煮咩）
        resetAiNextSteps();
        updateMessages((prev) => {
          const msgs: Message[] = [...prev, imageMsg];
          return msgs;
        });
        sendChat(buildBackendMessages([...messages, imageMsg]));
        scrollToEnd();
      } catch (e: any) {
        console.error("[AI Chef] image upload/send failed:", e);
        Alert.alert("上傳失敗", e?.message ?? "請重試");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, onSelect);
    } else {
      Alert.alert("上傳雪櫃圖片", "選擇來源", [
        { text: "拍照", onPress: () => onSelect(0) },
        { text: "從相簿選擇", onPress: () => onSelect(1) },
        { text: "取消", style: "cancel" },
      ]);
    }
  };

  // ─── Chat send helper ───────────────────────────────────

  const sendChat = (msgs: BackendMessage[], sourceMode?: "library" | "ai") => {
    lastChatModeRef.current = sourceMode ?? "";
    noveltyRetryRef.current = false;
    chatMutation.mutate({ messages: msgs, mode: sourceMode });
  };

  const resolveShoppingRef = async (r: AIRecipe): Promise<string> => {
    // 已經揹住真 ref（official_<id> / user_<id>）→ 直接用
    const ref = resolveRecipeRef(r);
    if (ref.isLibraryRef) return ref.recipeId;
    // 否則 ensureSaved：佢本身會按名查庫重用，搵唔到先建立 —— 保證一定有 user_<id> 撳得開
    const id = await ensureSaved(r);
    return `user_${id}`;
  };

  const regenerateWithMode = (mode: "library" | "ai", force = false, preserveRetryState = false) => {
    if (chatMutation.isPending && !force) return;
    if (!preserveRetryState) noveltyRetryRef.current = false;
    lastChatModeRef.current = mode;
    resetAiNextSteps();
    // 清空已換過嘅食譜記錄
    setSwappedRecipeNames(new Set());
    // 清空本次 chat 已見過嘅食譜記錄
    setSessionSeenRecipeNames([]);
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const regeneratePrompt = lastUser
      ? "請再提供一組新的建議。"
      : mode === "ai"
        ? "請隨機提供一組唔重複嘅食譜，避免同之前建議過嘅菜式重複。"
        : "請從食譜庫再提供一組唔同嘅建議，避免同之前建議過嘅菜式重複。";
    const newMsgs: Message[] = [...messages, { role: "user", content: regeneratePrompt }];
    updateMessages(() => newMsgs);
    chatMutation.mutate({ messages: buildBackendMessages(newMsgs), mode });
    scrollToEnd();
  };

  // ─── Daily 3-dish-1-soup flow helpers ──────────────────

  const addBotMessage = (text: string) => {
    updateMessages(prev => [...prev, { role: "assistant", content: text }]);
    scrollToLatestMessage();
  };

  const addUserMessage = (text: string) => {
    const msgs: Message[] = [...messages, { role: "user", content: text }];
    updateMessages(() => msgs);
    scrollToEnd();
    return msgs;
  };

  const startMealFlow = () => {
    setMealPrefs(EMPTY_PREFS);
    setMealResult(null);
    setRecommendedRecipes([]);
    setSwappedRecipeNames(new Set());
    setSessionSeenRecipeNames([]);
    setMealStep("people");
    addBotMessage("（步驟 1/4）今晚幾多人食？（可直接輸入數字，例如 4）");
  };

  const askMealQuestion = (step: MealPlanStep) => {
    const stepMap: Record<MealPlanStep, number> = { idle: 0, people: 1, audience: 2, time: 3, dislike: 4, generating: 0, result: 0 };
    const stepNum = stepMap[step];
    const label = stepNum ? `（步驟 ${stepNum}/4）` : "";
    switch (step) {
      case "people":
        addBotMessage(`${label}今晚幾多人食？（可直接輸入數字，例如 4）`);
        break;
      case "audience":
        addBotMessage(`${label}有冇小朋友或老人家？（可揀快速選項或自由輸入）`);
        break;
      case "time":
        addBotMessage(`${label}想幾耐煮好？（可揀快速選項或自由輸入）`);
        break;
      case "dislike":
        addBotMessage(`${label}有咩唔食？（可輸入食材或口味，冇就寫「冇」）`);
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
        
        return { people: 4 }; // 預設值
      }
      case "audience": {
        const hasKids = /仔 | 女|小朋友 | 細路 | 童|孩|孩 子|kids|child|children/.test(lower);
        const hasElderly = /老人家 | 長者 | 老人 | 爸|媽|爺|嫲|公公 | 婆婆|父母|elderly|old|parent/.test(lower);
        return { hasKids, hasElderly };
      }
      case "time": {
        if (/快 |30|半|急|quick| 速|簡單| 易/.test(lower)) return { time: "quick" as const };
        if (/慢 | 煲|燉|leisure|slow| 慢慢| 燜|煮 耐/.test(lower)) return { time: "leisure" as const };
        return { time: "normal" as const };
      }
      case "dislike":
        return { dislikes: /冇 | 没有|無|none| 沒有|唔食|不食| 過敏| 唔鍾意|不喜歡/.test(t) ? "" : t };
    }
    return {};
  };

  const handleMealAnswer = (text: string) => {
    resetAiNextSteps();
    const update = parseMealAnswer(text);
    const nextPrefs = { ...mealPrefs, ...update };
    setMealPrefs(nextPrefs);
    const msgs = addUserMessage(text);
    if (mealStep === "dislike") {
      setMealStep("generating");
      if (pendingHotKeyRef.current) {
        // 熱鍵問卷完成 → 記住偏好，再執行該熱鍵生成
        const hid = pendingHotKeyRef.current;
        const config = HOT_KEY_CONFIG[hid];
        hotKeyPrefsRef.current = nextPrefs;
        pendingHotKeyRef.current = "";
        if (config) {
          void runHotKeyGeneration(hid, nextPrefs, config);
          return;
        }
      }
      generateMealPlan(nextPrefs, msgs);
    } else {
      advanceMealStep();
    }
  };

  // 跳過所有問題，直接 AI 生成
  const handleSkipMealQuestions = () => {
    if (chatMutation.isPending) return;
    setMealStep("generating");
    // 用預設偏好（4 人，普通，冇忌口）直接生成
    const defaultPrefs: MealPlanPreferences = {
      people: 4,
      hasKids: false,
      hasElderly: false,
      time: "normal",
      dislikes: "",
    };
    const msgs: Message[] = [...messages, { role: "user", content: buildMealPrompt(defaultPrefs) }];
    updateMessages(() => msgs);
    lastChatModeRef.current = "ai";
    noveltyRetryRef.current = false;
    chatMutation.mutate({ messages: buildBackendMessages(msgs) }, {
      onSuccess: (data) => {
        setMealStep("result");
        setAiNextSteps([]);
        if (data.recipes?.length > 0) {
          const safeRecipes = data.recipes.map(normalizeRecipe);
          setMealResult(safeRecipes);
          setRecommendedRecipes(safeRecipes);
        }
      },
      onError: () => setMealStep("idle"),
    });
    scrollToEnd();
  };

  const buildPrefContext = (prefs: MealPlanPreferences) => {
    const parts: string[] = [];
    if (prefs.people > 0) parts.push(`適合 ${prefs.people} 人食`);
    if (prefs.hasKids) parts.push("有小朋友，口味要溫和、少辣、容易入口");
    if (prefs.hasElderly) parts.push("有老人家，清淡少油鹽、易咀嚼");
    if (prefs.time === "quick") parts.push("30 分鐘內快手菜");
    else if (prefs.time === "leisure") parts.push("可慢慢煮/煲燉");
    if (prefs.dislikes) parts.push(`避免食材/口味：${prefs.dislikes}`);
    return parts.join("，");
  };

  // 熱鍵：library-first 搜 + AI fallback（附帶已記住嘅偏好）
  const runHotKeyGeneration = async (
    id: string,
    prefs: MealPlanPreferences,
    config: { searchQuery?: string; aiPrompt: string },
  ) => {
    setLibraryLoading(true);
    setRecommendedRecipes([]);
    if (config.searchQuery) {
      try {
        const searchResult = await apiClient.recipes.search.query({
          query: config.searchQuery,
          limit: 6,
        });
        const rawRecipes = Array.isArray(searchResult?.recipes) ? searchResult.recipes : [];
        const libraryRecipes = rawRecipes
          .map(normalizeRecipe)
          .filter(isValidRecipe);
        if (libraryRecipes.length > 0) {
          console.log(`[AI Chef] Hot key "${id}" found ${libraryRecipes.length} library recipes`);
          addUserMessage(config.aiPrompt);
          setRecommendedRecipes(libraryRecipes);
          addBotMessage(`我喺食譜庫搵到 ${libraryRecipes.length} 個配合「${config.searchQuery}」嘅食譜：`);
          setLibraryLoading(false);
          return;
        }
        console.log(`[AI Chef] Hot key "${id}" found 0 library recipes, falling back to AI`);
      } catch (e) {
        console.error(`[AI Chef] Hot key library search failed:`, e);
      }
    }
    setLibraryLoading(false);
    addBotMessage(`食譜庫暫時冇配合「${config.searchQuery || config.aiPrompt}」嘅食譜，我用 AI 幫你諗幾個：`);
    const prefCtx = buildPrefContext(prefs);
    handlePrompt(prefCtx ? `${config.aiPrompt}。${prefCtx}` : config.aiPrompt);
  };

  // 第一次撳熱鍵：先問偏好（只問一次）
  const startHotKeyPrefFlow = (id: string) => {
    pendingHotKeyRef.current = id;
    setMealPrefs(EMPTY_PREFS);
    setMealResult(null);
    setRecommendedRecipes([]);
    setMealStep("people");
    addBotMessage("（步驟 1/4）幾多個人食？（可直接輸入數字，例如 4）");
  };

  const buildMealPrompt = (prefs: MealPlanPreferences) => {
    const timeLabel = prefs.time === "quick" ? "30 分鐘內快手菜" : prefs.time === "leisure" ? "可慢慢煮/煲燉" : "普通約 1 小時";
    return `請為我設計今晚「3 餸 1 湯」晚餐，總共 4 道菜，適合${prefs.people}人食用。` +
      (prefs.hasKids ? "有小朋友，口味要溫和、少辣、容易入口。" : "") +
      (prefs.hasElderly ? "有老人家，食材要易咀嚼、清淡少油鹽。" : "") +
      `煮食時間要求：${timeLabel}。` +
      (prefs.dislikes ? `避免食材/口味：${prefs.dislikes}。` : "") +
      "食材欄每行只寫一種食材，唔好加入功效、備註、口味描述。" +
      "請提供完整 4 個食譜，分類如下：\n" +
      "1. 肉類主菜（如豬/牛/雞）\n" +
      "2. 海鮮/其他蛋白主菜（如魚/蝦/豆腐蛋）\n" +
      "3. 蔬菜/小炒\n" +
      "4. 湯水\n" +
      "每個食譜請包含：名稱、簡短描述、煮食時間（分鐘）、難度、份量、食材清單（名稱、數量、單位）、步驟。語言：繁體中文。";
  };

  const generateMealPlan = async (prefs: MealPlanPreferences, msgs: Message[]) => {
    // ── Library-first：用問卷條件先搜食譜庫 ──
    setLibraryLoading(true);
    setRecommendedRecipes([]);
    try {
      const searchTerms: string[] = [];
      if (prefs.time === "quick") searchTerms.push("快手");
      else if (prefs.time === "leisure") searchTerms.push("慢煮");
      const audienceTag = prefs.hasKids ? "小朋友" : prefs.hasElderly ? "清淡" : "";
      if (audienceTag) searchTerms.push(audienceTag);
      if (!searchTerms.length) searchTerms.push("家常");
      const searchResult = await apiClient.recipes.search.query({
        query: searchTerms.join(" "),
        limit: 8,
      });
      const rawRecipes = Array.isArray(searchResult?.recipes) ? searchResult.recipes : [];
      const libraryRecipes = rawRecipes
        .map(normalizeRecipe)
        .filter(isValidRecipe);
      if (libraryRecipes.length > 0) {
        // 有庫存食譜 → 直接顯示（最多 4 道）
        console.log(`[AI Chef] Meal flow found ${libraryRecipes.length} library recipes`);
        setMealStep("result");
        setMealResult(libraryRecipes.slice(0, 4));
        setRecommendedRecipes(libraryRecipes.slice(0, 4));
        addUserMessage(`3餸1湯（${prefs.people}人，${searchTerms.join("/")}）`);
        addBotMessage(`我喺食譜庫搵到 ${Math.min(libraryRecipes.length, 4)} 個配合嘅食譜：`);
        setLibraryLoading(false);
        return;
      }
      console.log("[AI Chef] Meal flow library search found 0, falling back to AI");
    } catch (e) {
      console.error("[AI Chef] Meal flow library search failed:", e);
    }
    setLibraryLoading(false);
    // Fallback：AI 3餸1湯
    const prompt = buildMealPrompt(prefs);
    const fullMsgs: Message[] = [...msgs, { role: "user", content: prompt }];
    updateMessages(() => fullMsgs);
    resetAiNextSteps();
    lastChatModeRef.current = "ai";
    noveltyRetryRef.current = false;
    chatMutation.mutate({ messages: buildBackendMessages(fullMsgs) }, {
      onSuccess: (data) => {
        setMealStep("result");
        setAiNextSteps([]);
        if (data.recipes?.length > 0) {
          const safeRecipes = data.recipes.map(normalizeRecipe);
          setMealResult(safeRecipes);
          setRecommendedRecipes(safeRecipes);
        }
      },
      onError: () => setMealStep("idle"),
    });
    scrollToLatestMessage();
  };

  const handlePantryAction = async () => {
    if (chatMutation.isPending) return;
    if (mealStep !== "idle") {
      setMealStep("idle");
      setMealPrefs(EMPTY_PREFS);
      setMealResult(null);
    }
    resetAiNextSteps();
    setRecommendedRecipes([]);

    const inStockItems = (pantryData || []).filter((item: any) => item.inStock);
    if (inStockItems.length > 0) {
      const ingredientList = inStockItems.map((item: any) => `${item.name}${item.quantity ? ` ${item.quantity}${item.unit || ""}` : ""}`).join("、");
      const ingredientNames = inStockItems.map((item: any) => item.name).join(" ");
      const searchPrompt = `用 ${ingredientNames} 煮嘅菜`;

      // Library-first：先搵食譜庫
      setLibraryLoading(true);
      setRecommendedRecipes([]);
      try {
        const searchResult = await apiClient.recipes.search.query({
          query: ingredientNames,
          limit: 6,
        });
        const rawRecipes = Array.isArray(searchResult?.recipes) ? searchResult.recipes : [];
        const libraryRecipes = rawRecipes
          .map(normalizeRecipe)
          .filter(isValidRecipe);
        if (libraryRecipes.length > 0) {
          console.log(`[AI Chef] Pantry found ${libraryRecipes.length} library recipes`);
          addUserMessage(searchPrompt);
          setRecommendedRecipes(libraryRecipes);
          addBotMessage(`我喺食譜庫搵到 ${libraryRecipes.length} 個配合你雪櫃食材嘅食譜：`);
          setLibraryLoading(false);
          return;
        }
        console.log("[AI Chef] Pantry library search found 0, falling back to AI");
      } catch (e) {
        console.error("[AI Chef] Pantry library search failed:", e);
      }
      setLibraryLoading(false);
      addBotMessage(`食譜庫暫時冇配合你雪櫃食材嘅食譜，我用 AI 幫你諗：`);
      const prompt = `我雪櫃有：${ingredientList}，可以煮咩？`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else {
      setAskingIngredients(true);
      addBotMessage("我見你雪櫃暫時未有同步到食材。\n\n你而家有咩食材？可以告訴我，例如雞蛋、豆腐、番茄等，我幫你諗食譜。");
    }
  };

  const handleQuickAction = async (id: string) => {
    if (chatMutation.isPending) return;
    if (mealStep !== "idle") {
      setMealStep("idle");
      setMealPrefs(EMPTY_PREFS);
      setMealResult(null);
    }

    const config = HOT_KEY_CONFIG[id];

    // 熱鍵（quick/healthy/ricecooker/kids/guest）：第一次主動問偏好，之後記住唔再問
    if (config) {
      if (!hotKeyPrefsRef.current) {
        startHotKeyPrefFlow(id);
        return;
      }
      await runHotKeyGeneration(id, hotKeyPrefsRef.current, config);
      return;
    }

    // 其他快捷動作
    switch (id) {
      case "daily":
        startMealFlow();
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

  const addMealPlanBatch = async (recipes: AIRecipe[], date: string = todayISO()) => {
    const validRecipes = recipes.filter(isValidRecipe);
    if (validRecipes.length === 0) {
      Alert.alert("無法加入排餐", "未找到有效食譜，請確認食譜包含食材同步驟。");
      return;
    }
    const overrideServings = mealResult && mealResult.length > 0 && mealPrefs.people > 0
      ? mealPrefs.people
      : null;
    try {
      const items: Array<{ date: string; mealType: string; recipeId: string; recipeName: string; recipe?: AIRecipe }> = [];
      for (const r of validRecipes) {
        const ref = resolveRecipeRef(r);
        if (ref.isLibraryRef) {
          items.push({
            date,
            mealType: "dinner",
            recipeId: ref.recipeId,
            recipeName: r.name,
            recipe: r,
          });
        } else {
          const savedId = await ensureSaved(r, overrideServings);
          items.push({
            date,
            mealType: "dinner",
            recipeId: `user_${savedId}`,
            recipeName: r.name,
            recipe: r,
          });
        }
      }
      const recipesWithIds = validRecipes.map((r, idx) => {
        const found = items[idx];
        if (!found) return { ...r };
        return found.recipeId.startsWith("user_")
          ? { ...r, _savedId: Number(found.recipeId.replace("user_", "")), _libraryRecipeId: found.recipeId }
          : { ...r, _libraryRecipeId: found.recipeId };
      });
      setBatchRecipes(recipesWithIds);
      // 同步返落 mealResult，令「加入購買」嗰批食譜都帶住 user_<id> ref
      setMealResult(recipesWithIds);
      setPlanDate(date);
      setShowPlan(true);
    } catch (e: any) {
      Alert.alert("儲存食譜失敗", e?.message || "請稍後再試");
    }
  };

  const handleFavoriteRecipe = async (recipe: AIRecipe) => {
    if (!isValidRecipe(recipe)) {
      Alert.alert("無法收藏", "此食譜資料不完整，無法收藏。");
      return;
    }
    const key = (recipe.name || "").trim();
    if (favoritingName === key) return;
    try {
      setFavoritingName(key);
      await ensureSaved(recipe);
      showToast("✅ 已收藏（食譜庫）");
    } catch (e: any) {
      Alert.alert("收藏失敗", e?.message || "請稍後再試");
    } finally {
      setFavoritingName("");
    }
  };

  const replaceRecipeAtIndex = (index: number, newRecipe: AIRecipe) => {
    setRecommendedRecipes(prev => prev.map((r, i) => i === index ? newRecipe : r));
    setMealResult(prev => prev ? prev.map((r, i) => i === index ? newRecipe : r) : prev);
  };

  // 「換」掣：只替換單張卡。AI mode 就直接出 1 個替代食譜；library mode 先搵庫內替代
  const handleSwapRecipe = async (recipe: AIRecipe, index: number) => {
    const category = recipe.recipeCategory || "其他";
    const otherNames = recommendedRecipes
      .filter((_, i) => i !== index)
      .map(r => (r.name || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    const sessionAvoidNames = [...usedRecipeNames, ...sessionSeenRecipeNames];

    const pickLibraryFallback = () => {
      const alternatives = [...(userRecipes ?? [])]
        .filter((r: any) => r.recipeCategory === category && r.name !== recipe.name)
        .map(normalizeRecipe)
        .filter((r): r is AIRecipe => !!r && isValidRecipe(r));
      return alternatives.find((r) => !isDuplicateRecipeName(r.name, otherNames)) ?? alternatives[0] ?? null;
    };

    const collectCandidates = (res: any) => {
      const structured = Array.isArray(res?.recipes) ? res.recipes : [];
      const fallbackText = typeof res?.content === "string" ? tryParseRecipes(res.content) : [];
      return [...structured, ...fallbackText]
        .map(normalizeRecipe)
        .filter((r): r is AIRecipe => !!r && isValidRecipe(r));
    };

    const useAi = lastChatModeRef.current === "ai";
    const replaceFromAi = async () => {
      setSwappingIndex(index);
      try {
        const prompt = [
          `請只生成 1 個可直接煮嘅食譜，作為「${recipe.name}」嘅替代。`,
          `分類要同原本相近：${category}。`,
          `食譜名稱唔可以同以下已顯示食譜重複：${otherNames.length > 0 ? otherNames.join("、") : "無"}。`,
          `食材欄每行只寫一種食材，唔好加入功效、備註、口味描述；每個食材都一定要有名字。`,
          `保持香港家庭日常可煮、步驟完整、繁體中文。`,
        ].join("\n");

        const tryGenerate = async (extra: string) => {
          try {
            const res = await apiClient.aiRecipe.chat.mutate({
              messages: [{ role: "user", content: `${prompt}${extra}` }],
              mode: "ai",
            });

            const candidates = collectCandidates(res);
            if (candidates.length === 0) {
              console.warn("[handleSwapRecipe] API returned no usable candidates:", res);
              return null;
            }

            // 避開已顯示 + 已換過嘅食譜
            const picked = candidates.find((candidate) => 
              !isDuplicateRecipeName(candidate.name, [...otherNames, ...sessionAvoidNames]) && 
              !swappedRecipeNames.has(candidate.name)
            ) ?? candidates[0];
            if (picked) return picked;

            console.warn("[handleSwapRecipe] All candidates duplicated:", candidates.map(c => c.name));
            return null;
          } catch (err: any) {
            console.error("[handleSwapRecipe] API call failed:", err?.message || err);
            throw err;
          }
        };

        let candidate = await tryGenerate("");
        const duplicate = candidate ? isDuplicateRecipeName(candidate.name, [...otherNames, ...sessionAvoidNames]) : false;
        const alreadySwapped = candidate ? swappedRecipeNames.has(candidate.name) : false;
        if (!candidate || duplicate || alreadySwapped) {
          const libraryFallback = pickLibraryFallback();
          if (libraryFallback && !swappedRecipeNames.has(libraryFallback.name) && !isDuplicateRecipeName(libraryFallback.name, sessionAvoidNames)) {
            showToast(`📚 食譜庫搵到相近替代：${libraryFallback.name}`);
            candidate = libraryFallback;
          } else {
            showToast("📚 食譜庫冇相近替代，改用 AI 生成全新食譜");
            candidate = await tryGenerate("\n請直接生成一個全新、唔重複、可直接煮嘅食譜。唔需要參考舊食譜。");
          }
        }

        if (candidate && isValidRecipe(candidate) && !isDuplicateRecipeName(candidate.name, [...otherNames, ...sessionAvoidNames]) && !swappedRecipeNames.has(candidate.name)) {
          replaceRecipeAtIndex(index, candidate);
          showToast(`✅ 已換成「${candidate.name}」`);
          // 只保留最近 3 個換過嘅食譜
          setSwappedRecipeNames(prev => {
            const newSet = new Set(prev);
            newSet.add(candidate.name);
            if (newSet.size > 3) {
              const arr = Array.from(newSet);
              return new Set(arr.slice(arr.length - 3));
            }
            return newSet;
          });
        } else {
          const fallback = pickLibraryFallback();
          if (fallback && !swappedRecipeNames.has(fallback.name) && !isDuplicateRecipeName(fallback.name, sessionAvoidNames)) {
            showToast(`📚 食譜庫搵到相近替代：${fallback.name}`);
            replaceRecipeAtIndex(index, fallback);
            showToast(`✅ 已換成「${fallback.name}」`);
            setSwappedRecipeNames(prev => {
              const newSet = new Set(prev);
              newSet.add(fallback.name);
              if (newSet.size > 3) {
                const arr = Array.from(newSet);
                return new Set(arr.slice(arr.length - 3));
              }
              return newSet;
            });
            return;
          }
          showToast("⚠️ 暫時搵唔到可用替代，已試過 AI 生成，請再按一次");
        }
      } catch (e: any) {
        console.error("[handleSwapRecipe] Error:", e);
        const errorMsg = e?.message || "未知錯誤";
        Alert.alert(
          "換食譜失敗",
          `錯誤：${errorMsg}\n\n請檢查網絡連接，或嘗試再次點擊。`,
          [{ text: "確定" }]
        );
      } finally {
        setSwappingIndex(null);
      }
    };

    if (useAi) {
      await replaceFromAi();
      return;
    }

    const alternatives = [...(userRecipes ?? [])]
      .filter((r: any) => r.recipeCategory === category && r.name !== recipe.name)
      .map(normalizeRecipe)
      .filter((r): r is AIRecipe => !!r && isValidRecipe(r))
      .slice(0, 20);

    if (alternatives.length > 0) {
      const picked = alternatives.find((r) => !isDuplicateRecipeName(r.name, otherNames)) ?? alternatives[0];
      if (picked) {
        replaceRecipeAtIndex(index, picked);
        showToast(`✅ 已換成「${picked.name}」`);
        return;
      }
    }

    await replaceFromAi();
  };

  const openShoppingSelection = (recipes: AIRecipe[], plannedDate?: string, maxDate?: string, fromMealPlanIds?: Array<number | undefined>) => {
    // 改用 IngredientPickerModal：統一 UI、預設唔勾調味料、支援日期驗證
    const pickers: PickerRecipe[] = recipes.map((r, ri) => ({
      id: `ai_${ri}`,
      name: r.name,
      fromMealPlanId: fromMealPlanIds?.[ri],
      ingredients: r.ingredients
        .map((ing) => normalizeIngredient(ing))
        .filter((ing): ing is { name: string; quantity: string; unit: string } => !!ing)
        .map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: categorizeIngredient(ing.name),
        })),
      date: plannedDate || todayISO(),
    }));
    setShopPlannedDate(plannedDate || todayISO());
    // maxDate = 排餐嗰日（購買可早唔可遲）；冇傳就預設今日
    setShopMaxDate(maxDate || plannedDate || todayISO());
    setShopRecipes(recipes); // 保留 source 名稱等 onConfirm 用
    setBatchPickerRecipes(pickers);
  };

  // ─── Backend message builder ───────────────────────────

  const buildBackendMessages = (msgs: Message[]): BackendMessage[] => {
    return msgs.map(m => ({ role: m.role, content: m.content }) as BackendMessage);
  };

  const resetAiNextSteps = () => setAiNextSteps([]);

  // ─── Chat Handlers ─────────────────────────────────────

  const isMealAnswering = mealStep === "people" || mealStep === "audience" || mealStep === "time" || mealStep === "dislike";

  // #1: 第一輪（未有 AI 回覆、且未傳過相片）強制 from 食譜庫，之後先由用戶揀 食譜庫/AI
  const firstTurnLibraryMode = useMemo(() => {
    const hasAssistant = messages.some(m => m.role === "assistant");
    const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(b => b.type === "image_url"));
    return !hasAssistant && !hasImage ? ("library" as const) : undefined;
  }, [messages]);

  // #10: 攔截「加入排餐／購物清單／收藏」意圖，唔好畀 AI 呃話「已加入」
  const addDaysISO = (base: string, n: number): string => {
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };

  const handleActionIntent = (text: string): boolean => {
    const validRecipes = recommendedRecipes.filter(isValidRecipe);
    const planRe = /(加入|加埋|加落|排入|入|全部加|加)(.{0,8})(排餐|餐牌|下餐|菜單|三餐)|(加一)(排餐)/.test(text);
    const favRe = /(收藏|收埋|存入食譜庫|加入食譜庫|儲存食譜)/.test(text);
    const shopRe = /(加入|加埋|加落|入)(.{0,6})(購物清單|購物車|購買|買嘢清單)|shopping ?list/i.test(text);

    if (planRe && validRecipes.length > 0) {
      let date = planDate ?? todayISO();
      if (/後日/.test(text)) date = addDaysISO(todayISO(), 2);
      else if (/大後日/.test(text)) date = addDaysISO(todayISO(), 3);
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
      addMealPlanBatch(validRecipes, date);
      return true;
    }
    if (shopRe && validRecipes.length > 0) {
      openShoppingSelection(validRecipes);
      return true;
    }
    if (favRe) {
      if (validRecipes.length === 1) {
        handleFavoriteRecipe(validRecipes[0]);
      } else if (validRecipes.length > 1) {
        Alert.alert("選擇食譜", "你想收藏邊個食譜？請㩒卡片上嘅「收藏」掣。");
      }
      return true;
    }
    return false;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setInput("");
    resetAiNextSteps();
    if (isMealAnswering) {
      handleMealAnswer(trimmed);
    } else if (handleActionIntent(trimmed)) {
      // handled client-side; do not send to AI
    } else if (askingIngredients) {
      setAskingIngredients(false);
      const prompt = `我想用以下食材煮餸：${trimmed}。請推薦可以用到呢啲食材嘅食譜。`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else {
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs), firstTurnLibraryMode);
      scrollToEnd();
    }
  };

  const handlePrompt = (p: string) => {
    if (chatMutation.isPending) return;
    resetAiNextSteps();
    if (isMealAnswering) {
      handleMealAnswer(p);
    } else if (askingIngredients) {
      setAskingIngredients(false);
      const prompt = `我想用以下食材煮餸：${p}。請推薦可以用到呢啲食材嘅食譜。`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs));
      scrollToEnd();
    } else {
      const msgs: Message[] = [...messages, { role: "user", content: p }];
      updateMessages(() => msgs);
      sendChat(buildBackendMessages(msgs), firstTurnLibraryMode);
      scrollToEnd();
    }
  };

  const handleQuickPlanFromText = () => {
    const validRecipes = recommendedRecipes.filter(isValidRecipe);
    if (validRecipes.length > 0) {
      setMealResult(validRecipes);
      setRecommendedRecipes(validRecipes);
      setMealStep("result");
      scrollToLatestMessage();
      return;
    }
    const lastBot = [...messages].reverse().find(m => m.role === "assistant");
    const text = lastBot ? contentToText(lastBot.content) : "";
    const parsedRecipes = tryParseRecipes(text);
    const validParsedRecipes = parsedRecipes.filter(isValidRecipe);
    if (validParsedRecipes.length > 0) {
      setMealResult(validParsedRecipes);
      setRecommendedRecipes(validParsedRecipes);
      setMealStep("result");
      scrollToLatestMessage();
    } else {
      Alert.alert("未能識別食譜", "AI 回覆中未找到有效食譜，請直接點擊 AI 推薦食譜卡片上的「加排餐」。");
    }
  };

  const handleNextStep = (text: string) => {
    if (chatMutation.isPending) return;
    if (/3餸1湯|今晚食咩|設計晚餐|設計今晚/.test(text)) {
      resetAiNextSteps();
      startMealFlow();
      return;
    }
    handlePrompt(text);
  };

  // Convert plain-text AI response to structured recipe cards
  const handleConvertToRecipeCard = () => {
    const lastBot = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastBot) return;
    
    const fullText = contentToText(lastBot.content);
    const parsedRecipes = tryParseRecipes(fullText);
    const validParsedRecipes = parsedRecipes.filter(isValidRecipe);
    
    // If we can already parse recipes, use them directly
    if (validParsedRecipes.length > 0) {
      setMealResult(validParsedRecipes);
      setRecommendedRecipes(validParsedRecipes);
      setMealStep("result");
      scrollToLatestMessage();
      return;
    }
    
    // Otherwise, ask AI to restructure the content into recipe cards
    const convertPrompt = "請將你剛才嘅建議，用結構化食譜卡格式重新整理（每個食譜都要有：名稱、類別、煮食時間、食材清單、烹飪步驟）。按照以下格式：\n\n食譜一：類別 —— 名稱（約 XX 分鐘）\n\n🛒 食材：\n- 食材名：數量 單位\n\n🍳 步驟：\n1. 步驟（第 X-Y 分鐘）：詳細動作";
    
    const msgs: Message[] = [...messages, { role: "user", content: convertPrompt }];
    updateMessages(() => msgs);
    resetAiNextSteps();
    lastChatModeRef.current = "ai";
    noveltyRetryRef.current = false;
    chatMutation.mutate({ messages: buildBackendMessages(msgs) });
    scrollToLatestMessage();
  };

  // ─── Plan modal confirm ────────────────────────────────

  const confirmAction = () => {
    // Guard: ensure modal was shown
    if (!showPlan) {
      console.error("[AI Chef] confirmAction called without modal being shown!");
      return;
    }
    // Guard: ensure date is selected
    if (!planDate) {
      Alert.alert("請選擇日期");
      return;
    }
    // Batch mode: add all recipes to meal plan with selected date/mealType
    if (batchRecipes && batchRecipes.length > 0) {
      const items = batchRecipes.map((r: any) => {
        const libId = r._libraryRecipeId;
        return {
          date: planDate,
          mealType: planMeal as any,
          recipeId: libId || `user_${r._savedId}`,
          recipeName: r.name,
          ingredients: (r.ingredients ?? []).map((ing: any) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        };
      });
      addPlanBatchM.mutateAsync({ items }).then(() => {
        setShowPlan(false);
        setBatchRecipes(null);
      }).catch((e: any) => {
        Alert.alert("加入排餐失敗", e?.message || "請稍後再試");
      });
      return;
    }

    // Single recipe mode
    if (!planRecipe) return;
    if (!isValidRecipe(planRecipe)) {
      Alert.alert("無法加入", "此食譜資料不完整（缺少食材或步驟），無法加入排餐。");
      return;
    }
    // Override servings with user's preference if from meal plan flow
    const overrideServings = mealResult && mealResult.length > 0 && mealPrefs.people > 0
      ? mealPrefs.people
      : null;
    // 如果人數有變，按比例縮放食材份量（調味料唔縮）
    const servingRatio = overrideServings && planRecipe.servings > 0
      ? overrideServings / planRecipe.servings
      : 1;
    const scaledIngredients = servingRatio === 1
      ? planRecipe.ingredients
      : planRecipe.ingredients.map((ing) => ({
          ...ing,
          quantity: calcAdjustedQty(String(ing.quantity ?? ""), ing.unit ?? "", categorizeIngredient(ing.name), servingRatio),
        }));
    const ref = resolveRecipeRef(planRecipe);
    if (ref.isLibraryRef) {
      addPlanM.mutate({
        date: planDate, mealType: planMeal as any,
        recipeId: ref.recipeId, recipeName: planRecipe.name,
        autoAddIngredients: false,
      });
    } else {
      (async () => {
        try {
          const savedId = await ensureSaved(planRecipe, overrideServings, scaledIngredients);
          // 將 saved id 帶返落 planRecipeRef，令 continueAfterMealPlan→加入購物清單都用到 user_<id>
          const withRef: AIRecipe = planRecipe
            ? { ...planRecipe, _savedId: savedId, _libraryRecipeId: `user_${savedId}` }
            : planRecipe;
          planRecipeRef.current = withRef;
          addPlanM.mutate({
            date: planDate, mealType: planMeal as any,
            recipeId: `user_${savedId}`, recipeName: planRecipe.name,
            autoAddIngredients: false,
          });
        } catch (e: any) {
          Alert.alert("加入排餐失敗", e?.message || "請稍後再試");
        }
      })();
    }
  };

  // ─── Render: Message bubble ────────────────────────────

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const hasImage = typeof item.content !== "string" && Array.isArray(item.content) &&
      item.content.some(b => b.type === "image_url");

    return (
      <View style={[s.msgRow, isUser && { justifyContent: "flex-end" }]}>
        {!isUser && <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot, hasImage && { backgroundColor: "#EEF4FB" }]}>
          {hasImage ? (
            <>
              {typeof item.content !== "string" && item.content.map((block, idx) =>
                block.type === "image_url" ? (
                  <Image key={idx} source={{ uri: block.image_url.url }} style={s.msgImage} resizeMode="cover" onError={() => console.log('[AI Chef] Image load failed')} />
                ) : (
                  <Text key={idx} style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{block.text}</Text>
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
                          <Ionicons name="copy-outline" size={12} color="#6B7280" />
                          <Text style={s.copyBtnTxt}>複製食譜</Text>
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
                    <Ionicons name="copy-outline" size={12} color="#6B7280" />
                    <Text style={s.copyBtnTxt}>複製</Text>
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

  const renderEmpty = () => (
      <View style={s.empty}>
        <View style={s.emptyIcon}><Ionicons name="sparkles" size={48} color={BRAND} /></View>
        <Text style={s.emptyTitle}>{userName ? `${userName}，今晚食咩好？` : "今晚食咩好？"}</Text>
        <Text style={s.emptySub}>{userName ? `${kitchenName}的 AI 助手` : "AI 幫你決定今晚煮什麼"}</Text>
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity key={a.id} testID={`ai-chef-quick-${a.id}`} style={s.quickBtn} onPress={() => handleQuickAction(a.id)} disabled={chatMutation.isPending}>
            <Ionicons name={a.icon as any} size={20} color={BRAND} />
            <Text style={s.quickBtnTxt}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── Render: Meal flow hot keys ────────────────────────

  const renderMealHotKeys = () => {
    if (!isMealAnswering) return null;
    let options: { label: string; value: string }[] = [];
    if (mealStep === "people") options = PEOPLE_OPTIONS.map(n => ({ label: n + "人", value: n }));
    else if (mealStep === "audience") options = AUDIENCE_OPTIONS.map(o => ({ label: o.label, value: o.label }));
    else if (mealStep === "time") options = TIME_OPTIONS.map(o => ({ label: o.label, value: o.label }));
    else if (mealStep === "dislike") options = [
      { label: "冇", value: "冇" },
      { label: "唔食辣", value: "唔食辣" },
      { label: "唔食豬肉", value: "唔食豬肉" },
      { label: "唔食魚", value: "唔食魚" },
      { label: "清淡為主", value: "清淡為主" },
    ];
    return (
      <View style={s.hotKeyBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hotKeyScroll}>
          {options.map((o, i) => (
            <TouchableOpacity key={i} style={s.hotKeyChip} onPress={() => handleMealAnswer(o.value)} disabled={chatMutation.isPending}>
              <Text style={s.hotKeyChipTxt}>{o.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.hotKeyChip, { backgroundColor: "#7C3AED" }]} onPress={() => handleSkipMealQuestions()} disabled={chatMutation.isPending}>
            <Text style={[s.hotKeyChipTxt, { color: "#fff" }]}>✨ 直接 AI 生成</Text>
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
                <Text style={d.drawerNewTxt}>新對話</Text>
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
                placeholder="搜尋對話"
                placeholderTextColor={HINT}
              />
              {sessionSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSessionSearch("")}>
                  <Ionicons name="close-circle" size={18} color={HINT} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={d.sectionTitle}>對話記錄</Text>

            {sessions.length === 0 ? (
              <View style={d.emptyRow}><Text style={d.emptyTxt}>未有對話記錄</Text></View>
            ) : displaySessions.length === 0 ? (
              <View style={d.emptyRow}><Text style={d.emptyTxt}>沒有符合的對話</Text></View>
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
                        {item.title}
                      </Text>
                      {preview ? <Text style={d.sessionPreview} numberOfLines={1}>{preview}</Text> : null}
                      <Text style={d.sessionDate}>
                        {new Date(item.createdAt).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}
                        {item.messages.length > 0 ? ` · ${item.messages.length} 條` : ""}
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
        title: "AI 助手",
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
                  // 喺對話入面 → 返去 AI Chef 主頁（空 session）
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
          <TouchableOpacity testID="ai-chef-new-chat" onPress={handleNewChat} style={s.headerBtn}>
            <Ionicons name="create-outline" size={20} color={BRAND} />
          </TouchableOpacity>
        ),
      }} />

      {renderSessionsSidebar()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <View style={[s.root, { paddingTop: insets.top }]}> 
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
          ListFooterComponent={() => (
            <>
              {libraryLoading ? (
                <View style={s.msgRow}>
                  <View style={s.avatar}><Ionicons name="search" size={16} color={BRAND} /></View>
                  <View style={[s.bubbleBot, s.typing]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color={BRAND} />
                      <Text style={[s.bubbleTxt, { color: BRAND, fontWeight: "600" }]}>🔍 正在搵食譜庫...</Text>
                    </View>
                  </View>
                </View>
              ) : chatMutation.isPending ? (
                <View style={s.msgRow}>
                  <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>
                  <View style={[s.bubbleBot, s.typing]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <ActivityIndicator size="small" color={BRAND} />
                      <Text style={[s.bubbleTxt, { color: BRAND, fontWeight: "600" }]}>生成食譜中，請稍候...</Text>
                    </View>
                    <Text style={[s.bubbleTxt, { fontSize: 12, color: SUB }]}>{LOADING_STEPS[loadingStep]}</Text>
                  </View>
                </View>
              ) : null}
              {recommendedRecipes.length > 0 && !chatMutation.isPending && (
                <View style={s.recBar}>
                  <View style={s.recHead}>
                    <Text style={s.recTitle}><Ionicons name="restaurant-outline" size={13} /> {mealResult ? "今晚 3 餸 1 湯" : "轉換其他食譜："}</Text>
                    {mealResult && (
                      <View style={s.recBatch}>
                        <TouchableOpacity style={s.batchShopBtn} onPress={() => openShoppingSelection(mealResult)} disabled={addShoppingM.isPending}>
                          <Text style={s.batchShopTxt}>加入購買</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
                    {recommendedRecipes.map((r, i) => (
                      <View key={i} style={s.recCard} testID={`recipe-card-${i}`}>
                        <View style={s.recCardHeader}>
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                            <Ionicons name="restaurant-outline" size={14} color={BRAND} />
                            <Text style={s.recCardDiff}>{r.recipeCategory || "其他"}</Text>
                            <Text style={[s.recCardDiff, { color: SUB }]}>·</Text>
                            <Text style={s.recCardDiff}>{r.difficulty}</Text>
                          </View>
                          <View style={[s.recCardSourceBadge, r.source === "ai" ? s.recCardSourceAI : s.recCardSourceLibrary]}>
                            <Text style={s.recCardSourceTxt}>{r.source === "ai" ? "AI" : "食譜庫"}</Text>
                          </View>
                        </View>
                        <View style={s.recCardBody} testID={`recipe-card-content-${i}`}>
                          <Text style={s.recCardName} numberOfLines={2} testID={`recipe-card-name-${i}`}>{r.name}</Text>
                          <View style={s.recCardMeta}>
                            <Text style={s.recCardMetaTxt}>{r.cookTime}分</Text>
                            <Text style={s.recCardMetaTxt}>{r.servings}人</Text>
                            <Text style={s.recCardMetaTxt}>{getValidIngredients(r.ingredients).length}食材</Text>
                            <Text style={[s.recCardMetaTxt, { color: (r.steps || []).length > 0 ? GREEN : SUB }]} testID={`recipe-card-steps-count-${i}`}>{(r.steps || []).length}步驟</Text>
                          </View>
                          <View style={s.recCardTags} testID={`recipe-card-tags-${i}`}>
                            {(r.tags || []).slice(0, 4).map((tag, tagIdx) => (
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
                              {expandedCard === i ? "收起食材" : `睇食材 (${getValidIngredients(r.ingredients).length})`}
                            </Text>
                          </TouchableOpacity>
                          {expandedCard === i && (
                            <View style={s.recCardIngList} testID={`recipe-card-ingredients-${i}`}>
                              {getValidIngredients(r.ingredients).slice(0, 5).map((ing, ingIdx) => (
                                <View key={ingIdx} style={s.recCardIngRow}>
                                  <View style={s.recCardIngDot} />
                                  <Text style={s.recCardIngTxt}>
                                    {ing.name}
                                    {ing.quantity ? ` ${ing.quantity}` : ""}
                                    {ing.unit ? ` ${ing.unit}` : ""}
                                  </Text>
                                </View>
                              ))}
                              {getValidIngredients(r.ingredients).length > 5 && (
                                <Text style={s.recCardIngMore}>+{getValidIngredients(r.ingredients).length - 5} 項</Text>
                              )}
                            </View>
                          )}
                          {/* 步驟內容驗證 */}
                          {r.steps && r.steps.length > 0 && (
                            <View style={{ paddingVertical: 8 }} testID={`recipe-card-steps-content-${i}`}>
                              <Text style={{ fontSize: 12, color: SUB }}>{r.steps.length} 步驟</Text>
                              <Text style={{ fontSize: 11, color: TEXT }} numberOfLines={2} testID={`recipe-card-first-step-${i}`}>
                                {r.steps[0]}
                              </Text>
                            </View>
                          )}
                          <View style={s.recCardBtns} testID={`recipe-card-btns-${i}`}>
                            <TouchableOpacity
                              testID={`ai-chef-recipe-${i}-meal`}
                              style={[s.btnMeal, !isValidRecipe(r) && { opacity: 0.4 }]}
                              onPress={() => {
                                if (isValidRecipe(r)) {
                                  setPlanRecipe(r);
                                  setPlanDate(todayISO());
                                  setShowPlan(true);
                                } else {
                                  Alert.alert("無法加入", "此食譜資料不完整。");
                                }
                              }}
                              disabled={!isValidRecipe(r)}
                            >
                              <Text style={s.btnMealTxt}>加排餐</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              testID={`ai-chef-recipe-${i}-favorite`}
                              style={[s.btnFavorite, (!isValidRecipe(r) || r.source === "official" || r.source === "custom") && { opacity: 0.4 }]}
                              onPress={() => handleFavoriteRecipe(r)}
                              disabled={!isValidRecipe(r) || r.source === "official" || r.source === "custom" || favoritingName === (r.name || "").trim()}
                            >
                              {favoritingName === (r.name || "").trim() ? (
                                <ActivityIndicator size="small" color={BRAND} />
                              ) : (
                                <Ionicons name="bookmark-outline" size={14} color={BRAND} />
                              )}
                              <Text style={s.btnFavoriteTxt}>收藏</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              testID={`ai-chef-recipe-${i}-swap`}
                              style={[s.btnSwap, { opacity: chatMutation.isPending ? 0.5 : 1 }]}
                              onPress={() => handleSwapRecipe(r, i)}
                              disabled={chatMutation.isPending || swappingIndex === i}
                            >
                              {swappingIndex === i ? (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <ActivityIndicator size="small" color={BRAND} />
                                  <Text style={s.btnSwapTxt}>換中</Text>
                                </View>
                              ) : (
                                <>
                                  <Ionicons name="refresh-outline" size={14} color={BRAND} />
                                  <Text style={s.btnSwapTxt}>換</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: SUB }}>換成其他食譜：</Text>
                    <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
                      <TouchableOpacity style={[s.sourceBtnLib, { flex: 1 }]} onPress={() => regenerateWithMode("library")} disabled={chatMutation.isPending}>
                        <Text style={s.sourceBtnTxt}>📚 食譜庫</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.sourceBtnAI, { flex: 1 }]} onPress={() => regenerateWithMode("ai")} disabled={chatMutation.isPending}>
                        <Text style={s.sourceBtnTxt}>✨ AI 生成</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        />

        {!chatMutation.isPending && mealStep === "idle" && messages.length > 0 && messages[messages.length - 1].role === "assistant" && recommendedRecipes.length === 0 && (
          <View style={s.followUpBar}>
            <Text style={s.followUpLabel}>下一步：</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.followUpScroll}>
              {aiNextSteps.length > 0 ? (
                <>
                  {aiNextSteps.filter(c => c.trim() !== "加入排餐").map((chip, i) => (
                    <TouchableOpacity key={i} style={s.followUpChip} onPress={() => handleNextStep(chip)} disabled={chatMutation.isPending}>
                      <Text style={s.followUpTxt}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                  {(() => {
                    const lastBot = messages[messages.length - 1];
                    const lastText = lastBot ? contentToText(lastBot.content) : "";
                    const hasRecipe = hasRecipeContent(lastText);
                    return (
                      <TouchableOpacity
                        style={[s.followUpChip, s.followUpChipAction]}
                        onPress={hasRecipe ? handleQuickPlanFromText : handleConvertToRecipeCard}
                        disabled={chatMutation.isPending}
                      >
                        <Text style={[s.followUpTxt, { color: "#fff" }]}>
                          {hasRecipe ? "加入排餐" : "轉換為食譜卡"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </>
              ) : (
                <>
                  {[
                    { label: "再詳細啲", prompt: "可以再詳細啲嗎？" },
                    { label: "畀我完整食譜", prompt: "請提供完整食譜，包括食材清單同烹飪步驟" },
                    { label: "換一批建議", prompt: "可以換另一組建議嗎？" },
                  ].map((chip, i) => (
                    <TouchableOpacity key={i} style={s.followUpChip} onPress={() => handlePrompt(chip.prompt)} disabled={chatMutation.isPending}>
                      <Text style={s.followUpTxt}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                  {(() => {
                    const lastBot = messages[messages.length - 1];
                    const lastText = lastBot ? contentToText(lastBot.content) : "";
                    const hasRecipe = hasRecipeContent(lastText);
                    return (
                      <TouchableOpacity
                        style={[s.followUpChip, s.followUpChipAction]}
                        onPress={hasRecipe ? handleQuickPlanFromText : handleConvertToRecipeCard}
                        disabled={chatMutation.isPending}
                      >
                        <Text style={[s.followUpTxt, { color: "#fff" }]}>
                          {hasRecipe ? "加入排餐" : "轉換為食譜卡"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </>
              )}
            </ScrollView>
          </View>
        )}

        {!chatMutation.isPending && recommendedRecipes.length === 0 && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD }}>
            <TouchableOpacity style={{ backgroundColor: "#7C3AED", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, alignItems: "center" }} onPress={() => regenerateWithMode("ai")} disabled={chatMutation.isPending}>
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>✨ 試 AI 生成</Text>
            </TouchableOpacity>
          </View>
        )}

        {renderMealHotKeys()}

        {askingIngredients && (
          <View style={s.hotKeyBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hotKeyScroll}>
              {COMMON_INGREDIENT_CHIPS.map((ing, i) => (
                <TouchableOpacity key={i} style={s.hotKeyChip} onPress={() => {
                  setInput(prev => prev ? `${prev}、${ing}` : ing);
                }} disabled={chatMutation.isPending}>
                  <Text style={s.hotKeyChipTxt}>{ing}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

      </View>

      <View style={[s.bottomDock, { paddingBottom: keyboardH > 0 ? 8 : Math.max(insets.bottom, 8) }]}>
        <View style={s.inputBar}>
          <TouchableOpacity style={s.camBtn} onPress={handleCamera} disabled={chatMutation.isPending}>
            <Ionicons name="camera-outline" size={22} color={chatMutation.isPending ? HINT : BRAND} />
          </TouchableOpacity>
          <TextInput
            testID="ai-chef-input"
            style={s.input} value={input} onChangeText={setInput}
            placeholder="告訴我你想吃什麼..." placeholderTextColor={HINT}
            multiline maxLength={500} returnKeyType="send" onSubmitEditing={handleSend} blurOnSubmit
          />
          <TouchableOpacity testID="ai-chef-send" style={[s.sendBtn, (!input.trim() || chatMutation.isPending) && s.sendOff]} onPress={handleSend} disabled={!input.trim() || chatMutation.isPending}>
            {chatMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
        {keyboardH === 0 && (
          <Text style={s.disclaimer}>AI Chef 由 AI 生成內容，可能會出錯，請仔細檢查食材及步驟。</Text>
        )}
      </View>
      </KeyboardAvoidingView>

      {toast.visible && (
        <View style={s.toastContainer}>
          <View style={s.toast}>
            <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
            <Text style={s.toastTxt}>{toast.text}</Text>
          </View>
        </View>
      )}

      <Modal visible={showPlan} transparent animationType="slide">
        <View style={m.overlay}><View style={[m.sheet, { paddingTop: Math.max(insets.top, 8) + 16 }]}>
          <View style={m.handle} />
          <View style={m.head}>
            <Text style={m.title}>加入排餐</Text>
            <TouchableOpacity onPress={() => { setShowPlan(false); setBatchRecipes(null); }}><Ionicons name="close" size={22} color={TEXT} /></TouchableOpacity>
          </View>
          {batchRecipes ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={[m.rname, { marginBottom: 4 }]}>{batchRecipes.length} 個食譜</Text>
              {batchRecipes.map((r: any, i: number) => (
                <Text key={i} style={[m.previewItem, { color: TEXT }]} numberOfLines={1}>· {r.name}</Text>
              ))}
            </View>
          ) : planRecipe ? (
            <Text style={m.rname} numberOfLines={1}>{planRecipe.name}</Text>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Dimensions.get("window").height * 0.55 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={m.label}>餐次</Text>
            <View style={m.mealRow}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt.id} style={[m.mealChip, planMeal === mt.id && m.mealChipOn]} onPress={() => setPlanMeal(mt.id)}>
                  <Text style={[m.mealChipTxt, planMeal === mt.id && { color: "#fff" }]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={m.label}>日期</Text>
            <View style={{ width: Dimensions.get("window").width - 32 }}>
              <PlanDatePicker value={planDate} onChange={setPlanDate} showShortcuts={true} minDate={todayISO()} />
              {planDate && (
                <TouchableOpacity 
                  onPress={() => setPlanDate(null)} 
                  style={{ alignSelf: "flex-end", marginTop: -8 }}
                >
                  <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>清除日期</Text>
                </TouchableOpacity>
              )}
            </View>
            {planRecipe && !batchRecipes && (
              <View style={m.preview}>
                <Text style={m.label}>食材</Text>
                {(planRecipe.ingredients || []).slice(0, 5).map((ing, i) => {
                  const n = normalizeIngredient(ing);
                  if (!n) return null;
                  return <Text key={i} style={m.previewItem}>· {n.name} {n.quantity}{n.unit}</Text>;
                })}
                {(planRecipe.ingredients || []).length > 5 && <Text style={m.previewMore}>還有 {(planRecipe.ingredients || []).length - 5} 項...</Text>}
              </View>
            )}
            {planRecipe && !batchRecipes && (planRecipe.steps || []).length > 0 && (
              <View style={[m.preview, { marginTop: -8 }]}>
                <Text style={m.label}>烹飪步驟</Text>
                {(planRecipe.steps || []).slice(0, 4).map((step, i) => (
                  <Text key={i} style={m.previewItem}>{i + 1}. {normalizeStep(step)}</Text>
                ))}
                {(planRecipe.steps || []).length > 4 && <Text style={m.previewMore}>還有 {(planRecipe.steps || []).length - 4} 步...</Text>}
              </View>
            )}
            {planRecipe && !batchRecipes && (planRecipe.steps || []).length === 0 && (
              <View style={[m.preview, { marginTop: -8 }]}>
                <Text style={[m.previewItem, { color: SUB }]}>未有烹飪步驟</Text>
              </View>
            )}
            {planRecipe && !batchRecipes && !isValidRecipe(planRecipe) && (
              <View style={[m.preview, { marginTop: 8, backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Text style={[m.previewItem, { color: "#DC2626", fontWeight: "600" }]}>⚠️ 此食譜資料不完整，無法加入排餐</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[m.btn, (saveRecipeM.isPending || addPlanM.isPending || addPlanBatchM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))) && { opacity: 0.6 }]}
            onPress={confirmAction}
            disabled={saveRecipeM.isPending || addPlanM.isPending || addPlanBatchM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))}
          >
            {(addPlanM.isPending || addPlanBatchM.isPending) ? (
              <Text style={m.btnTxt}>加入排餐，請稍後...</Text>
            ) : (saveRecipeM.isPending || addShoppingM.isPending) ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={m.btnTxt}>確認</Text>
            )}
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* 排餐後 / 批量加入食材 */}
      <IngredientPickerModal
        visible={!!batchPickerRecipes}
        recipes={batchPickerRecipes ?? []}
        defaultDate={shopPlannedDate}
        onDateChange={setShopPlannedDate}
        maxDate={shopMaxDate}
        showDateSelector={true}
        loading={addShoppingM.isPending}
        alreadyAddedKeys={batchAlreadyAddedKeys}
        onConfirm={async (items) => {
          if (items.length === 0) {
            setBatchPickerRecipes(null);
            showToast("已跳過食材");
            return;
          }
          if (shopConfirmLockRef.current) return;
          shopConfirmLockRef.current = true;
          try {
            const byPickerId = new Map<string, AIRecipe>();
            shopRecipes.forEach((r, i) => byPickerId.set(`ai_${i}`, r));
            const resolved: Record<string, { fromRecipeId?: string; fromRecipeName?: string }> = {};
            const recipeIds = [...new Set(items.map(i => i.recipeId))];
            await Promise.all(recipeIds.map(async (pid) => {
              const recipe = byPickerId.get(pid);
              if (!recipe) { resolved[pid] = {}; return; }
              try {
                const ref = await resolveShoppingRef(recipe);
                resolved[pid] = { fromRecipeId: ref, fromRecipeName: recipe.name };
              } catch {
                resolved[pid] = {};
              }
            }));
            addShoppingM.mutate({
              items: items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                category: i.category,
                fromRecipeId: resolved[i.recipeId]?.fromRecipeId,
                fromRecipeName: resolved[i.recipeId]?.fromRecipeName,
              })),
              fromRecipeName: shopRecipes.map((r) => r.name).join(", "),
              fromRecipeId: undefined,
              fromMealPlanId: items[0].fromMealPlanId,
              plannedDate: items[0].plannedDate,
            });
          } finally {
            shopConfirmLockRef.current = false;
          }
        }}
        onSkip={() => {
          setBatchPickerRecipes(null);
          showToast("已跳過食材");
        }}
      />
    </>
  );
      }

// ─── Styles ───────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  emptyList: { flexGrow: 1, padding: 20, paddingTop: 24 },
  list: { padding: 14 },
  msgRow: { flexDirection: "row", marginBottom: 12, gap: 8, alignItems: "flex-end" },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BRAND, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: CARD, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER },
  copyBtn: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8 },
  copyBtnTxt: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  bubbleTxt: { fontSize: 14, color: TEXT, lineHeight: 21 },
  typing: { paddingHorizontal: 18, paddingVertical: 14 },
  msgImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
  empty: { alignItems: "center", paddingHorizontal: 16 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 14, color: SUB, marginBottom: 24 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  quickBtn: { width: "47%", backgroundColor: CARD, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, flexDirection: "row", alignItems: "center", gap: 8 },
  quickBtnTxt: { fontSize: 13, color: TEXT, fontWeight: "700" },
  hotKeyBar: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 10 },
  hotKeyScroll: { paddingHorizontal: 12, gap: 8 },
  hotKeyChip: { backgroundColor: "#EEF4FB", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  hotKeyChipTxt: { fontSize: 13, color: BRAND, fontWeight: "700" },
  followUpBar: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 10 },
  followUpLabel: { fontSize: 12, fontWeight: "700", color: SUB, marginBottom: 8, paddingHorizontal: 12 },
  followUpScroll: { paddingHorizontal: 12, gap: 8 },
  followUpChip: { backgroundColor: "#EEF4FB", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  followUpChipAction: { backgroundColor: BRAND, borderColor: BRAND },
  followUpTxt: { fontSize: 13, color: BRAND, fontWeight: "700" },
  sourceBtnRow: { flexDirection: "row", gap: 10, paddingHorizontal: 12, marginBottom: 8 },
  sourceBtnLib: { backgroundColor: "#3B82F6", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, flex: 1, alignItems: "center" },
  sourceBtnAI: { backgroundColor: "#7C3AED", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, flex: 1, alignItems: "center" },
  sourceBtnTxt: { fontSize: 14, color: "#fff", fontWeight: "800" },
  recBar: { borderTopWidth: 1, borderTopColor: BORDER, padding: 12 },
  recHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  recTitle: { fontSize: 12, fontWeight: "700", color: BRAND },
  recBatch: { flexDirection: "row", gap: 6 },
  batchMealBtn: { backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  batchMealTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  batchShopBtn: { backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  batchShopTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  recScroll: { gap: 10 },
  recCard: { width: 170, minHeight: 160, backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, overflow: "hidden" },
  recCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  recCardDiff: { fontSize: 10, fontWeight: "700", color: BRAND },
  recCardSourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recCardSourceLibrary: { backgroundColor: "#E0F2FE" },
  recCardSourceAI: { backgroundColor: "#F3E8FF" },
  recCardSourceTxt: { fontSize: 9, fontWeight: "800", color: "#475569" },
  recCardBody: { padding: 10, paddingTop: 4, justifyContent: "space-between" },
  recCardName: { fontSize: 13, fontWeight: "800", color: TEXT, lineHeight: 18, minHeight: 36, marginBottom: 6 },
  recCardMeta: { flexDirection: "row", gap: 8, marginBottom: 8 },
  recCardMetaTxt: { fontSize: 10, color: SUB },
  recCardTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  recTagPill: { backgroundColor: "#EEF4FB", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
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
  btnFavorite: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BRAND, paddingVertical: 6, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  btnFavoriteTxt: { fontSize: 11, fontWeight: "700", color: BRAND },
  btnSwap: { flex: 1, backgroundColor: "#EEF4FB", paddingVertical: 7, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  btnSwapTxt: { fontSize: 11, fontWeight: "700", color: BRAND },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bottomDock: { backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: CARD },
  disclaimer: { fontSize: 11, color: HINT, textAlign: "center", paddingHorizontal: 16, paddingVertical: 6, backgroundColor: CARD },
  input: { flex: 1, backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT, maxHeight: 100, minHeight: 40, borderWidth: 1, borderColor: BORDER },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  camBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" },
  toastContainer: { position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 100 },
  toast: { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  toastTxt: { fontSize: 14, fontWeight: "700", color: TEXT },

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
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: TEXT },
  rname: { fontSize: 14, color: SUB, fontWeight: "600", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  mealChip: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  mealChipOn: { backgroundColor: BRAND },
  mealChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", marginRight: 8 },
  dateChipOn: { backgroundColor: BRAND },
  dateChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  preview: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  previewItem: { fontSize: 13, color: TEXT, lineHeight: 22 },
  previewMore: { fontSize: 12, color: SUB, marginTop: 4 },
  btn: { backgroundColor: BRAND, paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  shopActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  shopActionChip: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  shopActionTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  shopActionCancel: { backgroundColor: "#FEE2E2" },
  shopActionCancelTxt: { fontSize: 13, fontWeight: "700", color: RED },
  shopGroup: { marginBottom: 14 },
  shopGroupTitle: { fontSize: 13, fontWeight: "800", color: BRAND, marginBottom: 8 },
  shopItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  shopItemOn: { backgroundColor: "#EEF4FB" },
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
  emptyRow: { alignItems: "center", paddingVertical: 40 },
  emptyTxt: { fontSize: 15, color: SUB },
  sessionRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 4,
    backgroundColor: "#F9FAFB",
  },
  sessionRowActive: { backgroundColor: "#EEF4FB", borderWidth: 1, borderColor: BRAND },
  sessionContent: { flex: 1, marginRight: 8 },
  sessionTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 2 },
  sessionTitleActive: { color: BRAND },
  sessionPreview: { fontSize: 12, color: SUB, marginBottom: 2 },
  sessionDate: { fontSize: 11, color: HINT },
  sessionDelete: { padding: 6 },
});
