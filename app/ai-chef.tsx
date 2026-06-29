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
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/image-utils";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";

type MsgContent = string | Array<
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
>;
type Message = { role: "user" | "assistant"; content: MsgContent };
type BackendMessage = { role: "user" | "assistant"; content: MsgContent };
type AIRecipe = {
  name: string; description: string;
  cookTime: number; servings: number;
  difficulty: string; recipeCategory?: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[]; tags: string[];
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

const LOADING_STEPS = [
  "AI 正在分析你的需求...",
  "正在搜尋合適食譜...",
  "為你生成個人化建議...",
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
          <Text style={[styles.mdRecipeTitle, { color: BRAND, fontWeight: "700", fontSize: 16 }]}>
            {recipeHeaderMatch[2]?.trim() || trimmed}
          </Text>
          {recipeHeaderMatch[3] && (
            <Text style={[styles.mdRecipeTime, { color: SUB, fontSize: 12, marginTop: 2 }]}>
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
        <Text key={key++} style={[styles.mdSectionHeader, { fontWeight: "700", fontSize: 14, marginTop: 10, marginBottom: 4, color: TEXT }]}>
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
          <Text style={[styles.mdBullet, { fontSize: 14, color: TEXT, flex: 1 }]}>{bulletMatch[1]}</Text>
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
          <Text style={[styles.mdStepText, { fontSize: 14, color: TEXT, flex: 1 }]}>{numberedMatch[2]}</Text>
        </View>
      );
      continue;
    }

    // Regular text paragraph
    elements.push(
      <Text key={key++} style={[styles.mdParagraph, { fontSize: 14, color: TEXT, lineHeight: 20, marginBottom: 4 }]}>
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

  // ─── Batch shopping selection popup ────────────────────
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopRecipes, setShopRecipes] = useState<AIRecipe[]>([]);
  const [shopSelected, setShopSelected] = useState<Set<string>>(new Set());
  const [shopPlannedDate, setShopPlannedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  // Ingredient picker after addPlanM success (single recipe)
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);

  // ── Pantry / Ingredient asking flow ───────────────────
  const { data: pantryData } = trpc.pantry.list.useQuery(undefined, { enabled: !!user });
  const [askingIngredients, setAskingIngredients] = useState(false);

  const COMMON_INGREDIENT_CHIPS = ["雞蛋", "豆腐", "番茄", "洋蔥", "青菜", "豬肉", "雞肉", "魚", "米", "麵"];

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

    const tags: string[] = recipeCategory !== "其他" ? [recipeCategory] : [];

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
          const ingName = colonMatch[1].trim();
          const ingDetail = colonMatch[2].trim();
          // Remove parenthetical notes like "（熟透的更好）"
          const cleanDetail = ingDetail.replace(/（[^）]*）/g, "").trim();
          // Check if it's a compound ingredient like "調味料：生抽 1湯匙、蠔油 半湯匙"
          if (cleanDetail.includes("、") || cleanDetail.includes(",")) {
            // Split compound ingredients
            const parts = cleanDetail.split(/[、,]/);
            for (const part of parts) {
              const p = part.trim();
              if (p) {
                // First try to match just quantity+unit (like "1湯匙" or "半湯匙")
                const qtyOnlyMatch = p.match(/^([\d.]+(?:[\d.-]*[\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)\s*(克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵||杯|碟|勺|份|根|塊|斤|磅|oz|lb)?\s*$/);
                if (qtyOnlyMatch) {
                  // This is just a quantity, use the parent ingredient name
                  ingredients.push({ name: ingName, quantity: qtyOnlyMatch[1] || "適量", unit: qtyOnlyMatch[2] || "" });
                } else {
                  // Try name + quantity + unit format (like "生抽 1湯匙")
                  const qMatch = p.match(/(.+?)\s+([\d.]+(?:[\d.-]*[\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)\s*(克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb)?\s*$/);
                  if (qMatch) {
                    ingredients.push({ name: qMatch[1].trim(), quantity: qMatch[2] || "適量", unit: qMatch[3] || "" });
                  } else {
                    ingredients.push({ name: p, quantity: "適量", unit: "" });
                  }
                }
              }
            }
          } else {
            // Handle ranges like "200-300克" and text after unit
            const qMatch = cleanDetail.match(/(.+?)\s+([\d.]+(?:[\d.-]*[\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)\s*(克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb)?\s*$/);
            if (qMatch) {
              ingredients.push({ name: ingName, quantity: qMatch[2] || "適量", unit: qMatch[3] || "" });
            } else {
              ingredients.push({ name: ingName, quantity: cleanDetail || "適量", unit: "" });
            }
          }
        } else {
          // Old format: "食材名 數量 單位"
          const cleanIl = il.replace(/（[^）]*）/g, "").trim();
          const qMatch = cleanIl.match(/(.+?)\s+([\d.]+(?:[\d.-]*[\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)\s*(克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb)?\s*$/);
          if (qMatch) {
            ingredients.push({ name: qMatch[1].trim(), quantity: qMatch[2] || "適量", unit: qMatch[3] || "" });
          } else {
            ingredients.push({ name: il, quantity: "適量", unit: "" });
          }
        }
      }
    }

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

    return {
      name, description, cookTime, servings, difficulty, recipeCategory,
      ingredients, steps, tags,
    };
  };

  const chatMutation = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => {
      const { mainText, nextSteps } = parseAssistantResponse(data.content);
      updateMessages(prev => [...prev, { role: "assistant", content: mainText }]);
      setAiNextSteps(nextSteps);

      // Backend now returns structured, validated recipes via extractRecipes
      const backendRecipes = Array.isArray(data.recipes) && data.recipes.length > 0
        ? data.recipes.map((r: any) => ({
            ...r,
            steps: Array.isArray(r.steps) ? r.steps : [],
            ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
            tags: Array.isArray(r.tags) ? r.tags : [],
          }))
        : [];

      // Use backend recipes if available, otherwise try frontend parsing
      let recipes = backendRecipes.length > 0 ? backendRecipes : tryParseRecipes(mainText);

      // Final validation: only show cards for truly valid recipes
      const validRecipes = recipes.filter(isValidRecipe);

      if (validRecipes.length > 0) {
        setRecommendedRecipes(validRecipes);
      } else {
        // No valid recipes — clear any stale recommendations
        setRecommendedRecipes([]);
      }

      scrollToLatestMessage();
    },
    onError: (err: any) => {
      const rawMsg = err?.message || err?.data?.message || "";
      let msg: string;
      if (rawMsg.includes("aborted") || rawMsg.includes("AbortError") || rawMsg.includes("timeout")) {
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
  useEffect(() => {
    if (chatMutation.isPending) {
      setLoadingStep(0);
      loadingTimer.current = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2000);
    } else {
      if (loadingTimer.current) { clearInterval(loadingTimer.current); loadingTimer.current = null; }
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

  const persistSessions = useCallback((next: ChatSession[], nextActive: string) => {
    if (!user?.id) return;
    const compact = next.map(s => ({
      ...s,
      messages: s.messages.map(m => {
        if (typeof m.content === "string") return { role: m.role, content: m.content };
        // Preserve content structure but strip large base64 image data
        const compactContent = m.content.map(block => {
          if (block.type === "image_url") {
            // Keep the block type but strip base64 to save AsyncStorage space
            return { type: "image_url" as const, image_url: { url: "" } };
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

  // ─── Keyboard ──────────────────────────────────────────

  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ─── Plan modal ────────────────────────────────────────

  const [showPlan, setShowPlan] = useState(false);
  const [planAction, setPlanAction] = useState<"meal" | "shopping">("meal");
  const [planRecipe, setPlanRecipe] = useState<AIRecipe | null>(null);
  const [batchRecipes, setBatchRecipes] = useState<AIRecipe[] | null>(null);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [planMeal, setPlanMeal] = useState("dinner");

  const utils = trpc.useUtils();
  const saveRecipeM = trpc.recipes.importUser.useMutation({
    onSuccess: () => utils.recipes.listUser.invalidate(),
  });
  const addPlanM = trpc.mealPlan.add.useMutation({
    onError: (e) => Alert.alert("加入排餐失敗", e.message),
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: (data, variables) => {
      utils.shopping.list.invalidate();
      utils.mealPlan.listByDateRange.invalidate();
      setShowPlan(false);
      setShowShopModal(false);
      setShopRecipes([]);
      setShopSelected(new Set());
      setPlanPickerRecipe(null);
      const count = variables.items.length;
      showToast(`✅ ${count} 件食材已加入購物清單`);
    },
    onError: (e) => {
      showToast(`加入食材失敗：${e.message}`);
    },
  });

  const scrollToEnd = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const scrollToLatestMessage = () => {
    setTimeout(() => {
      if (!flatListRef.current || messages.length === 0) return;
      const lastIndex = messages.length - 1;
      flatListRef.current.scrollToIndex({ index: Math.max(0, lastIndex - 1), animated: true, viewPosition: 0 });
    }, 150);
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
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"], quality: 0.8, base64: false,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"], quality: 0.8, base64: false,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      try {
        const compressed = await compressImage(result.assets[0].uri);
        const dataUri = `data:${compressed.mimeType};base64,${compressed.base64}`;
        const imageMsg: Message = { role: "user", content: [{ type: "text", text: "我雪櫃有呢啲食材，可以煮咩？" }, { type: "image_url", image_url: { url: dataUri } }] };

        resetAiNextSteps();
        updateMessages(prev => {
          const msgs: Message[] = [...prev, imageMsg];
          return msgs;
        });
        chatMutation.mutate({ messages: buildBackendMessages([...messages, imageMsg]) });
        scrollToEnd();
      } catch {
        Alert.alert("讀取圖片失敗");
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
    setMealStep("people");
    addBotMessage("今晚幾多人食？（可直接輸入數字，例如 4）");
  };

  const askMealQuestion = (step: MealPlanStep) => {
    switch (step) {
      case "people":
        addBotMessage("今晚幾多人食？（可直接輸入數字，例如 4）");
        break;
      case "audience":
        addBotMessage("有冇小朋友或老人家？（可揀快速選項或自由輸入）");
        break;
      case "time":
        addBotMessage("想幾耐煮好？（可揀快速選項或自由輸入）");
        break;
      case "dislike":
        addBotMessage("有咩唔食？（可輸入食材或口味，冇就寫「冇」）");
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
        const n = parseInt(t.replace(/\D/g, ""), 10);
        return { people: isNaN(n) || n < 1 ? 4 : n };
      }
      case "audience": {
        const hasKids = /仔|女|小朋友|細路|童|孩|kids|child/.test(lower);
        const hasElderly = /老人家|長者|老人|爸|媽|爺|嫲|公公|婆婆|elderly|old/.test(lower);
        return { hasKids, hasElderly };
      }
      case "time": {
        if (/快|30|半|急|quick/.test(lower)) return { time: "quick" as const };
        if (/慢|煲|燉|leisure|slow/.test(lower)) return { time: "leisure" as const };
        return { time: "normal" as const };
      }
      case "dislike":
        return { dislikes: /冇|没有|無|none|沒有/.test(t) ? "" : t };
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
      generateMealPlan(nextPrefs, msgs);
    } else {
      advanceMealStep();
    }
  };

  const buildMealPrompt = (prefs: MealPlanPreferences) => {
    const timeLabel = prefs.time === "quick" ? "30分鐘內快手菜" : prefs.time === "leisure" ? "可慢慢煮/煲燉" : "普通約1小時";
    return `請為我設計今晚「3餸1湯」晚餐，總共4道菜，適合${prefs.people}人食用。` +
      (prefs.hasKids ? "有小朋友，口味要溫和、少辣、容易入口。" : "") +
      (prefs.hasElderly ? "有老人家，食材要易咀嚼、清淡少油鹽。" : "") +
      `煮食時間要求：${timeLabel}。` +
      (prefs.dislikes ? `避免食材/口味：${prefs.dislikes}。` : "") +
      "請提供完整4個食譜，分類如下：\n" +
      "1. 肉類主菜（如豬/牛/雞）\n" +
      "2. 海鮮/其他蛋白主菜（如魚/蝦/豆腐蛋）\n" +
      "3. 蔬菜/小炒\n" +
      "4. 湯水\n" +
      "每個食譜請包含：名稱、簡短描述、煮食時間（分鐘）、難度、份量、食材清單（名稱、數量、單位）、步驟。語言：繁體中文。";
  };

  const generateMealPlan = (prefs: MealPlanPreferences, msgs: Message[]) => {
    const prompt = buildMealPrompt(prefs);
    const fullMsgs: Message[] = [...msgs, { role: "user", content: prompt }];
    updateMessages(() => fullMsgs);
    resetAiNextSteps();
    chatMutation.mutate({ messages: buildBackendMessages(fullMsgs) }, {
      onSuccess: (data) => {
        setMealStep("result");
        setAiNextSteps([]);
        console.log("[AI Chef] Meal plan response - recipes:", data.recipes?.length);
        data.recipes?.forEach((r: any, i: number) => {
          console.log(`[AI Chef] Recipe ${i + 1}: ${r.name}, ingredients: ${r.ingredients?.length}, steps: ${r.steps?.length}`);
        });
        if (data.recipes?.length > 0) {
          const safeRecipes = data.recipes.map((r: any) => ({ ...r, steps: r.steps ?? [], ingredients: r.ingredients ?? [] }));
          setMealResult(safeRecipes);
          setRecommendedRecipes(safeRecipes);
        }
      },
      onError: () => setMealStep("idle"),
    });
    scrollToLatestMessage();
  };

  const handlePantryAction = () => {
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
      const prompt = `我雪櫃有：${ingredientList}，可以煮咩？`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      chatMutation.mutate({ messages: buildBackendMessages(msgs) });
      scrollToEnd();
    } else {
      setAskingIngredients(true);
      addBotMessage("我見你雪櫃暫時未有同步到食材。\n\n你而家有咩食材？可以告訴我，例如雞蛋、豆腐、番茄等，我幫你諗食譜。");
    }
  };

  const handleQuickAction = (id: string) => {
    if (chatMutation.isPending) return;
    if (mealStep !== "idle") {
      setMealStep("idle");
      setMealPrefs(EMPTY_PREFS);
      setMealResult(null);
    }
    switch (id) {
      case "daily":
        startMealFlow();
        break;
      case "fridge":
        handleCamera();
        break;
      case "quick":
        handlePrompt("30分鐘內可以做好的家常菜");
        break;
      case "healthy":
        handlePrompt("今晚想吃清淡一點，少油少鹽");
        break;
      case "ricecooker":
        handlePrompt("用電飯煲一鍋煮的懶人食譜");
        break;
      case "kids":
        handlePrompt("小朋友喜歡吃的菜式");
        break;
      case "guest":
        handlePrompt("宴客/有朋友來，想煮得體面啲");
        break;
      case "pantry":
        handlePantryAction();
        break;
    }
  };

  // ─── Batch meal plan + shopping helpers ────────────────

  const addMealPlanBatch = async (recipes: AIRecipe[]) => {
    const validRecipes = recipes.filter(isValidRecipe);
    console.log("[AI Chef] Batch add meal plan - total recipes:", recipes.length, "valid:", validRecipes.length);
    recipes.forEach((r, i) => {
      console.log(`[AI Chef] Recipe ${i + 1}:`, r.name, "ingredients:", r.ingredients?.length, "steps:", r.steps?.length);
    });
    if (validRecipes.length === 0) {
      Alert.alert("無法加入排餐", "未找到有效食譜，請確認食譜包含食材同步驟。");
      return;
    }
    console.log("[AI Chef] Batch add meal plan clicked, recipes:", validRecipes.length);
    // Override servings with user's preference if from meal plan flow
    const overrideServings = mealResult && mealResult.length > 0 && mealPrefs.people > 0
      ? mealPrefs.people
      : null;
    // Save recipes to user library first, then open date picker modal
    try {
      const saved = await Promise.all(validRecipes.map(r => saveRecipeM.mutateAsync({
        name: r.name, description: r.description,
        cookTime: r.cookTime, servings: overrideServings ?? r.servings,
        difficulty: r.difficulty,
        image: "", thumbnailUrl: "",
        recipeCategory: r.recipeCategory || "其他",
        tags: [...(r.tags ?? []), "AI生成"],
        ingredients: r.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name) })),
        steps: (r.steps ?? []).map(s => ({ instruction: s, duration: 0 })),
      })));
      // Store saved recipe IDs with the valid recipes for later use
      const recipesWithIds = validRecipes.map((r, i) => ({
        ...r,
        _savedId: saved[i]?.id,
      }));
      setBatchRecipes(recipesWithIds);
      setPlanAction("meal");
      setPlanDate(new Date().toISOString().split("T")[0]); // Reset to today
      setShowPlan(true);
    } catch (e: any) {
      Alert.alert("儲存食譜失敗", e?.message || "請稍後再試");
    }
  };

  const handleFavoriteRecipe = (recipe: AIRecipe) => {
    if (!isValidRecipe(recipe)) {
      Alert.alert("無法收藏", "此食譜資料不完整，無法收藏。");
      return;
    }
    saveRecipeM.mutate({
      name: recipe.name, description: recipe.description,
      cookTime: recipe.cookTime, servings: recipe.servings,
      difficulty: recipe.difficulty,
      image: "", thumbnailUrl: "",
      recipeCategory: recipe.recipeCategory || "其他",
      tags: [...(recipe.tags ?? []), "AI生成"],
      ingredients: recipe.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name) })),
      steps: (recipe.steps ?? []).map(s => ({ instruction: s, duration: 0 })),
    }, {
      onSuccess: () => {
        Alert.alert("已收藏", "食譜已加入你的食譜庫");
      },
      onError: (e: any) => {
        Alert.alert("收藏失敗", e?.message || "請稍後再試");
      },
    });
  };

const COMMON_PANTRY = [
  "油", "鹽", "糖", "生抽", "老抽", "蠔油", "麻油",
  "胡椒粉", "黑椒粉", "醋", "料酒", "紹酒",
  "生粉", "粟粉", "太白粉",
  "薑", "薑絲", "薑片", "蒜", "蒜蓉", "蒜頭", "蔥", "蔥花",
  "清水", "水", "八角", "花椒", "五香粉", "雞粉", "味醂",
];

// Helper to categorize ingredients based on keywords
const categorizeIngredient = (name: string): string => {
  const n = name.toLowerCase();
  if (/蔬菜|菜|青菜|白菜|生菜|菠菜|芥蘭|菜心|西蘭花|椰菜|蘿蔔|薯仔|番茄|青瓜|茄子|南瓜|冬瓜|絲瓜|洋蔥|洋蔥/.test(n)) return "蔬菜";
  if (/肉|豬|牛|雞|羊|排骨|雞翼|雞腿|牛肉|豬肉|雞胸/.test(n)) return "肉類";
  if (/魚|蝦|蟹|貝|魷魚|章魚|蠔|蜆|蛤|鮑魚|海參/.test(n)) return "海鮮";
  if (/蛋|奶|芝士|牛奶|奶油|牛油/.test(n)) return "蛋奶";
  if (/米|飯|麵|粉|粉絲|烏冬|意粉|通粉|餃子|雲吞/.test(n)) return "主食";
  if (/醬|油|鹽|糖|醋|酒|味精|雞粉|胡椒粉|五香|八角|花椒|桂皮/.test(n)) return "調味料";
  if (/乾|冬菇|木耳|金針|蝦米|瑤柱|蓮子|百合|紅棗|枸杞/.test(n)) return "乾貨";
  if (/水|果汁|汽水|啤酒|紅酒|白酒|湯/.test(n)) return "飲品";
  return "其他";
};

const openShoppingSelection = (recipes: AIRecipe[], plannedDate?: string) => {
    console.log("[AI Chef] openShoppingSelection - recipes:", recipes.length, recipes.map(r => r.name));
    setShopRecipes(recipes);
    setShopPlannedDate(plannedDate || new Date().toISOString().split("T")[0]);
    const selected = new Set<string>();
    recipes.forEach(r => {
      console.log(`[AI Chef] Recipe "${r.name}" has ${r.ingredients.length} ingredients`);
      r.ingredients.forEach((ing, i) => {
        const isPantry = COMMON_PANTRY.some(p => ing.name.includes(p));
        if (!isPantry) selected.add(`${r.name}::${i}`);
        else console.log(`[AI Chef] Filtered pantry item: ${ing.name} from ${r.name}`);
      });
    });
    setShopSelected(selected);
    setShowShopModal(true);
  };

  const toggleShopIngredient = (key: string) => {
    setShopSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirmShopBatch = () => {
    const items: { name: string; quantity: string; unit: string; category: string }[] = [];
    shopRecipes.forEach(r => {
      r.ingredients.forEach((ing, i) => {
        if (shopSelected.has(`${r.name}::${i}`)) {
          items.push({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name) });
        }
      });
    });
    console.log("[AI Chef] confirmShopBatch - recipes:", shopRecipes.length, "items:", items.length);
    shopRecipes.forEach((r, i) => {
      console.log(`[AI Chef] Shopping recipe ${i + 1}:`, r.name, "ingredients:", r.ingredients?.length);
    });
    addShoppingM.mutate({
      items,
      fromRecipeName: shopRecipes.map(r => r.name).join(", "),
      plannedDate: shopPlannedDate,
    });
    setShopRecipes([]);
    setShopSelected(new Set());
  };

  // ─── Backend message builder ───────────────────────────

  const buildBackendMessages = (msgs: Message[]): BackendMessage[] => {
    return msgs.map(m => ({ role: m.role, content: m.content }) as BackendMessage);
  };

  const resetAiNextSteps = () => setAiNextSteps([]);

  // ─── Chat Handlers ─────────────────────────────────────

  const isMealAnswering = mealStep === "people" || mealStep === "audience" || mealStep === "time" || mealStep === "dislike";

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setInput("");
    resetAiNextSteps();
    if (isMealAnswering) {
      handleMealAnswer(trimmed);
    } else if (askingIngredients) {
      setAskingIngredients(false);
      const prompt = `我想用以下食材煮餸：${trimmed}。請推薦可以用到呢啲食材嘅食譜。`;
      const msgs: Message[] = [...messages, { role: "user", content: prompt }];
      updateMessages(() => msgs);
      chatMutation.mutate({ messages: buildBackendMessages(msgs) });
      scrollToEnd();
    } else {
      const msgs: Message[] = [...messages, { role: "user", content: trimmed }];
      updateMessages(() => msgs);
      chatMutation.mutate({ messages: buildBackendMessages(msgs) });
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
      chatMutation.mutate({ messages: buildBackendMessages(msgs) });
      scrollToEnd();
    } else {
      const msgs: Message[] = [...messages, { role: "user", content: p }];
      updateMessages(() => msgs);
      chatMutation.mutate({ messages: buildBackendMessages(msgs) });
      scrollToEnd();
    }
  };

  const handleQuickPlanFromText = () => {
    console.log("[AI Chef] Quick action '加入排餐' clicked");
    const lastBot = [...messages].reverse().find(m => m.role === "assistant");
    const text = lastBot ? contentToText(lastBot.content) : "";
    const parsedRecipes = tryParseRecipes(text);
    const validRecipe = parsedRecipes.find(isValidRecipe);
    if (validRecipe) {
      setPlanRecipe(validRecipe);
      setPlanAction("meal");
      setPlanDate(new Date().toISOString().split("T")[0]); // Reset to today
      setShowPlan(true);
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

  // ─── Plan modal confirm ────────────────────────────────

  const confirmAction = () => {
    console.log("[AI Chef] confirmAction called, planAction:", planAction, "planDate:", planDate, "planMeal:", planMeal);
    // Guard: ensure modal was shown
    if (!showPlan) {
      console.error("[AI Chef] confirmAction called without modal being shown!");
      return;
    }
    // Batch mode: add all recipes to meal plan with selected date/mealType
    if (batchRecipes && batchRecipes.length > 0) {
      if (planAction === "meal") {
        Promise.all(batchRecipes.map((r: any) => addPlanM.mutateAsync({
          date: planDate, mealType: planMeal as any,
          recipeId: `user_${r._savedId}`, recipeName: r.name,
          autoAddIngredients: false,
          ingredients: [],
        }))).then(() => {
          setShowPlan(false);
          setBatchRecipes(null);
          showToast(`✅ ${batchRecipes.length} 個排餐已加入`);
          utils.mealPlan.listByDateRange.invalidate();
          // Open shopping selection for all batch recipes
          const allIngredients = batchRecipes.flatMap((r: any) =>
            (r.ingredients || []).map((ing: any, idx: number) => ({
              ...ing,
              _recipeId: `user_${r._savedId}`,
              _recipeName: r.name,
              _idx: idx,
            }))
          );
          if (allIngredients.length > 0) {
            console.log("[AI Chef] Opening shopping for", batchRecipes.length, "recipes:", batchRecipes.map((r: any) => r.name));
            openShoppingSelection(batchRecipes, planDate);
          }
        }).catch((e: any) => {
          Alert.alert("加入排餐失敗", e?.message || "請稍後再試");
        });
      }
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
    if (planAction === "meal") {
      saveRecipeM.mutate({
        name: planRecipe.name, description: planRecipe.description,
        cookTime: planRecipe.cookTime, servings: overrideServings ?? planRecipe.servings,
        difficulty: planRecipe.difficulty,
        image: "", thumbnailUrl: "",
        recipeCategory: planRecipe.recipeCategory || "其他",
        tags: [...(planRecipe.tags ?? []), "AI生成"],
        ingredients: planRecipe.ingredients.map(ing => ({
          name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name),
        })),
        steps: (planRecipe.steps ?? []).map(s => ({ instruction: s, duration: 0 })),
      }, {
        onSuccess: (saved) => {
          addPlanM.mutate({
            date: planDate, mealType: planMeal as any,
            recipeId: `user_${saved.id}`, recipeName: planRecipe.name,
            autoAddIngredients: false,
            ingredients: planRecipe.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit })),
          }, {
            onSuccess: () => {
              setShowPlan(false);
              showToast("已加入排餐");
              utils.mealPlan.listByDateRange.invalidate();
              if (planRecipe!.ingredients.length > 0) {
                const COMMON_PANTRY_SET = new Set(COMMON_PANTRY);
                const initialSel = new Set<string>();
                planRecipe!.ingredients.forEach((ing, idx) => {
                  if (!COMMON_PANTRY_SET.has(ing.name)) {
                    initialSel.add(`user_${saved.id}::${idx}`);
                  }
                });
                setPlanPickerRecipe({
                  id: `user_${saved.id}`,
                  name: planRecipe!.name,
                  ingredients: planRecipe!.ingredients.map(ing => ({
                    name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name),
                  })),
                  date: planDate,
                });
              } else {
                Alert.alert("已加入排餐");
              }
            },
          });
        },
      });
    } else {
      addShoppingM.mutate({
        items: planRecipe.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: categorizeIngredient(ing.name) })),
        fromRecipeName: planRecipe.name, plannedDate: planDate,
      });
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
                  <Image key={idx} source={{ uri: block.image_url.url }} style={s.msgImage} resizeMode="cover" />
                ) : (
                  <Text key={idx} style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{block.text}</Text>
                )
              )}
            </>
          ) : isUser ? (
            <Text style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{contentToText(item.content)}</Text>
          ) : (
            <View style={{ minWidth: 200 }}>
              {renderMarkdown(contentToText(item.content), s)}
            </View>
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
          <TouchableOpacity key={a.id} style={s.quickBtn} onPress={() => handleQuickAction(a.id)} disabled={chatMutation.isPending}>
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
        title: "AI 食譜助手",
        headerStyle: { backgroundColor: BG }, headerTintColor: BRAND,
        headerTitleStyle: { fontWeight: "800" },
        headerLeft: () => (
          <TouchableOpacity onPress={() => setShowSessions(true)} style={s.headerBtn}>
            <Ionicons name="chatbubbles-outline" size={20} color={BRAND} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={handleNewChat} style={s.headerBtn}>
            <Ionicons name="create-outline" size={20} color={BRAND} />
          </TouchableOpacity>
        ),
      }} />

      {renderSessionsSidebar()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <SafeAreaView style={s.root} edges={["top"]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => String(i)}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={messages.length === 0 ? s.emptyList : s.list}
          onContentSizeChange={() => messages.length > 0 && scrollToLatestMessage()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={chatMutation.isPending ? (
            <View style={s.msgRow}>
              <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>
              <View style={[s.bubbleBot, s.typing]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={[s.bubbleTxt, { color: BRAND, fontWeight: "600" }]}>思考中</Text>
                </View>
                <Text style={[s.bubbleTxt, { fontSize: 12, color: SUB }]}>{LOADING_STEPS[loadingStep]}</Text>
              </View>
            </View>
          ) : null}
        />

        {!chatMutation.isPending && mealStep === "idle" && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
          <View style={s.followUpBar}>
            <Text style={s.followUpLabel}>下一步：</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.followUpScroll}>
              {aiNextSteps.length > 0 ? (
                <>
                  {aiNextSteps.map((chip, i) => (
                    <TouchableOpacity key={i} style={s.followUpChip} onPress={() => handleNextStep(chip)} disabled={chatMutation.isPending}>
                      <Text style={s.followUpTxt}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[s.followUpChip, s.followUpChipAction]} onPress={handleQuickPlanFromText} disabled={chatMutation.isPending}>
                    <Text style={[s.followUpTxt, { color: "#fff" }]}>加入排餐</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity style={[s.followUpChip, s.followUpChipAction]} onPress={handleQuickPlanFromText} disabled={chatMutation.isPending}>
                    <Text style={[s.followUpTxt, { color: "#fff" }]}>加入排餐</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )}

        {recommendedRecipes.length > 0 && !chatMutation.isPending && (
          <View style={s.recBar}>
            <View style={s.recHead}>
              <Text style={s.recTitle}><Ionicons name="restaurant-outline" size={13} /> {mealResult ? "今晚 3餸1湯" : "AI 推薦食譜"}</Text>
              {mealResult && mealResult.length === 4 && (
                <View style={s.recBatch}>
                  <TouchableOpacity style={s.batchMealBtn} onPress={() => addMealPlanBatch(mealResult)} disabled={saveRecipeM.isPending || addPlanM.isPending}>
                    <Text style={s.batchMealTxt}>{saveRecipeM.isPending || addPlanM.isPending ? "處理中..." : "全部加一排餐"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.batchShopBtn} onPress={() => openShoppingSelection(mealResult)} disabled={addShoppingM.isPending}>
                    <Text style={s.batchShopTxt}>加入採購</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
              {recommendedRecipes.map((r, i) => (
                <View key={i} style={s.recCard}>
                  <View style={s.recCardHeader}>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Ionicons name="restaurant-outline" size={14} color={BRAND} />
                      <Text style={s.recCardDiff}>{r.recipeCategory || "其他"}</Text>
                      <Text style={[s.recCardDiff, { color: SUB }]}>·</Text>
                      <Text style={s.recCardDiff}>{r.difficulty}</Text>
                    </View>
                  </View>
                  <View style={s.recCardBody}>
                    <Text style={s.recCardName} numberOfLines={2}>{r.name}</Text>
                    <View style={s.recCardMeta}>
                      <Text style={s.recCardMetaTxt}>{r.cookTime}分</Text>
                      <Text style={s.recCardMetaTxt}>{r.servings}人</Text>
                      <Text style={s.recCardMetaTxt}>{(r.ingredients || []).length}食材</Text>
                      <Text style={[s.recCardMetaTxt, { color: (r.steps || []).length > 0 ? GREEN : SUB }]}>{(r.steps || []).length}步驟</Text>
                    </View>
                    <View style={s.recCardBtns}>
                      <TouchableOpacity
                        style={[s.btnMeal, !isValidRecipe(r) && { opacity: 0.4 }]}
                        onPress={() => {
                          if (isValidRecipe(r)) {
                            console.log("[AI Chef] Recipe card '加排餐' clicked:", r.name);
                            setPlanRecipe(r);
                            setPlanAction("meal");
                            setPlanDate(new Date().toISOString().split("T")[0]); // Reset to today
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
                        style={[s.btnFavorite, !isValidRecipe(r) && { opacity: 0.4 }]}
                        onPress={() => handleFavoriteRecipe(r)}
                        disabled={!isValidRecipe(r) || saveRecipeM.isPending}
                      >
                        <Ionicons name="bookmark-outline" size={14} color={BRAND} />
                        <Text style={s.btnFavoriteTxt}>收藏</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
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

        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + keyboardH }]}>
          <TouchableOpacity style={s.camBtn} onPress={handleCamera} disabled={chatMutation.isPending}>
            <Ionicons name="camera-outline" size={22} color={chatMutation.isPending ? HINT : BRAND} />
          </TouchableOpacity>
          <TextInput
            style={s.input} value={input} onChangeText={setInput}
            placeholder="告訴我你想吃什麼..." placeholderTextColor={HINT}
            multiline maxLength={500} returnKeyType="send" onSubmitEditing={handleSend} blurOnSubmit
          />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || chatMutation.isPending) && s.sendOff]} onPress={handleSend} disabled={!input.trim() || chatMutation.isPending}>
            {chatMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
        <Text style={s.disclaimer}>AI Chef 由 AI 生成內容，可能會出錯，請仔細檢查食材及步驟。</Text>
      </SafeAreaView>
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
            <Text style={m.title}>{planAction === "meal" ? "加入排餐" : "加入採購"}</Text>
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
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
            {planAction === "meal" && <>
              <Text style={m.label}>餐次</Text>
              <View style={m.mealRow}>
                {MEAL_TYPES.map(mt => (
                  <TouchableOpacity key={mt.id} style={[m.mealChip, planMeal === mt.id && m.mealChipOn]} onPress={() => setPlanMeal(mt.id)}>
                    <Text style={[m.mealChipTxt, planMeal === mt.id && { color: "#fff" }]}>{mt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>}
            <Text style={m.label}>日期</Text>
            <PlanDatePicker value={planDate} onChange={setPlanDate} />
            {planRecipe && !batchRecipes && (
              <View style={m.preview}>
                <Text style={m.label}>食材</Text>
                {(planRecipe.ingredients || []).slice(0, 5).map((ing, i) => (
                  <Text key={i} style={m.previewItem}>· {ing.name} {ing.quantity}{ing.unit}</Text>
                ))}
                {(planRecipe.ingredients || []).length > 5 && <Text style={m.previewMore}>還有 {(planRecipe.ingredients || []).length - 5} 項...</Text>}
              </View>
            )}
            {planRecipe && !batchRecipes && (planRecipe.steps || []).length > 0 && (
              <View style={[m.preview, { marginTop: -8 }]}>
                <Text style={m.label}>烹飪步驟</Text>
                {(planRecipe.steps || []).slice(0, 4).map((step, i) => (
                  <Text key={i} style={m.previewItem}>{i + 1}. {step}</Text>
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
            style={[m.btn, (saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))) && { opacity: 0.6 }]}
            onPress={confirmAction}
            disabled={saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending || !!(planRecipe && !batchRecipes && !isValidRecipe(planRecipe))}
          >
            {(saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending) ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.btnTxt}>確認</Text>}
          </TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showShopModal} transparent animationType="slide">
        <View style={m.overlay}><View style={[m.sheet, { paddingTop: Math.max(insets.top, 8) + 16 }]}>
          <View style={m.handle} />
          <View style={m.head}>
            <Text style={m.title}>加入購物清單</Text>
            <TouchableOpacity onPress={() => setShowShopModal(false)}><Ionicons name="close" size={22} color={TEXT} /></TouchableOpacity>
          </View>
          <Text style={m.rname}>{shopRecipes.length} 個食譜 · {shopSelected.size} 項食材已選</Text>

          <View style={m.shopActions}>
            <TouchableOpacity style={m.shopActionChip} onPress={() => {
              const all = new Set<string>();
              shopRecipes.forEach(r => r.ingredients.forEach((_, i) => all.add(`${r.name}::${i}`)));
              setShopSelected(all);
            }}>
              <Text style={m.shopActionTxt}>全部</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.shopActionChip} onPress={() => setShopSelected(new Set())}>
              <Text style={m.shopActionTxt}>全部取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.shopActionChip, m.shopActionCancel]} onPress={() => setShowShopModal(false)}>
              <Text style={m.shopActionCancelTxt}>唔加</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.45 }}>
            {shopRecipes.map((r, ri) => (
              <View key={ri} style={m.shopGroup}>
                <Text style={m.shopGroupTitle}>{r.name}</Text>
                {r.ingredients.map((ing, ii) => {
                  const key = `${r.name}::${ii}`;
                  const selected = shopSelected.has(key);
                  return (
                    <TouchableOpacity key={ii} style={[m.shopItem, selected && m.shopItemOn]} onPress={() => toggleShopIngredient(key)}>
                      <Ionicons name={selected ? "checkbox-outline" : "square-outline"} size={18} color={selected ? BRAND : SUB} />
                      <Text style={[m.shopItemTxt, selected && { color: TEXT }]}>{ing.name} {ing.quantity}{ing.unit}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={[m.btn, (addShoppingM.isPending || shopSelected.size === 0) && { opacity: 0.6 }]} onPress={confirmShopBatch} disabled={addShoppingM.isPending || shopSelected.size === 0}>
            {addShoppingM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.btnTxt}>確認加入 {shopSelected.size} 項</Text>}
          </TouchableOpacity>
        </View></View>
      </Modal>

      <IngredientPickerModal
        visible={!!planPickerRecipe}
        recipes={planPickerRecipe ? [planPickerRecipe] : []}
        loading={addShoppingM.isPending}
        onConfirm={(items) => {
          if (items.length > 0) {
            addShoppingM.mutate({
              items: items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                category: i.category,
              })),
              fromRecipeId: items[0].recipeId,
              fromRecipeName: items[0].recipeName,
              plannedDate: items[0].plannedDate,
            });
          } else {
            setPlanPickerRecipe(null);
            showToast("排餐已記錄");
          }
        }}
        onSkip={() => {
          setPlanPickerRecipe(null);
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
  recCardBody: { padding: 10, paddingTop: 4, justifyContent: "space-between" },
  recCardName: { fontSize: 13, fontWeight: "800", color: TEXT, lineHeight: 18, minHeight: 36, marginBottom: 6 },
  recCardMeta: { flexDirection: "row", gap: 8, marginBottom: 8 },
  recCardMetaTxt: { fontSize: 10, color: SUB },
  recCardBtns: { flexDirection: "row", gap: 6 },
  btnMeal: { flex: 1, backgroundColor: BRAND, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  btnMealTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnFavorite: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BRAND, paddingVertical: 6, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  btnFavoriteTxt: { fontSize: 11, fontWeight: "700", color: BRAND },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD },
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
  sheet: { width: '100%', backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingVertical: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24, height: Dimensions.get("window").height * 0.45 },
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
