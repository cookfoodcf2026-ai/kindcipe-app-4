/**
 * 食譜詳情頁 — 完整版
 * 功能：
 * - 份量調整（自動換算食材用量）
 * - 每步倒數計時器（start/pause/reset，可自訂時間）
 * - 步驟貼士（紫色 💡 框）
 * - 家庭備註（trpc.recipeNotes）
 * - 食材分類顏色（綠/藍圓點）
 * - 烹飪術語 ❓ tooltip
 * - 加入排餐 / 加入採購清單
 * - 比價（HKTVmall / 百佳 / 惠康）
 * - Instagram 影片連結
 * - AI Edit
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal, Linking, Platform,
  Dimensions, TextInput, Share,
} from "react-native";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import UnitPicker from "@/src/components/UnitPicker";
import { COOKING_TERMS, COOKING_TERM_LIST } from "@/lib/cookingTerms";
import CookingTermTooltip from "@/app/components/CookingTermTooltip";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BRAND_LIGHT = "#FFF3D6";
const COPPER = "#F5A823";
const BG = "#FAFAF8";
const CARD = "#FFFFFF";
const TEXT = "#1C1C1E";
const SUB = "#8E8E93";
const HINT = "#C7C7CC";
const BORDER = "#F0EDE8";
const GREEN = "#4CAF50";
const PURPLE = "#9C27B0";

// ── Cooking terms glossary ──────────────────────────────────────────
const PACKAGED_CATS = new Set(["調味料", "乾貨", "醬料", "罐頭", "飲品"]);
const SEASONING_CATS = new Set(["調味料", "醬料"]);
const SPOON_UNITS = new Set(["湯匙", "茶匙", "tbsp", "tsp"]);
const COUNTABLE_UNITS = new Set(["個", "隻", "條", "塊", "片", "支", "根", "包", "罐", "盤", "顆", "粒"]);

function calcAdjustedQty(rawQty: string, unit: string, category: string, ratio: number): string {
  const num = parseFloat(rawQty);
  if (isNaN(num)) return rawQty;
  if (SEASONING_CATS.has(category)) return rawQty; // seasonings don't scale
  const adj = num * ratio;
  if (SPOON_UNITS.has(unit)) {
    const r = Math.round(adj * 2) / 2;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  }
  if (COUNTABLE_UNITS.has(unit)) return String(Math.round(adj));
  return String(Math.round(adj));
}

// ── Per-step timer component ────────────────────────────────────────
function StepTimer({ defaultSeconds = 0 }: { defaultSeconds?: number }) {
  const [mode, setMode] = useState<"idle" | "input" | "counting">("idle");
  const [totalSec, setTotalSec] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const [inputMin, setInputMin] = useState(defaultSeconds > 0 ? String(Math.floor(defaultSeconds / 60)) : "");
  const [inputSec, setInputSec] = useState(defaultSeconds > 0 ? String(defaultSeconds % 60) : "0");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const isDone = remaining === 0 && totalSec > 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleConfirm = () => {
    const m = parseInt(inputMin || "0");
    const s = parseInt(inputSec || "0");
    const total = (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
    if (total <= 0) return;
    setTotalSec(total);
    setRemaining(total);
    setMode("counting");
    setRunning(true);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(totalSec);
    if (totalSec > 0) setMode("counting");
  };

  // Idle — show "設定計時" if no default, or "X分鐘 開始" if has default
  if (mode === "idle") {
    if (totalSec === 0) {
      return (
        <TouchableOpacity
          style={s.timerIdle}
          onPress={() => setMode("input")}
        >
          <Ionicons name="timer-outline" size={12} color={SUB} />
          <Text style={s.timerIdleTxt}>設定計時</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={s.timerIdleActive}
        onPress={() => { setMode("counting"); setRunning(true); }}
      >
        <Ionicons name="timer-outline" size={12} color={BRAND} />
        <Text style={s.timerIdleActiveTxt}>{Math.round(totalSec / 60)} 分鐘 · 開始計時</Text>
      </TouchableOpacity>
    );
  }

  // Input mode
  if (mode === "input") {
    return (
      <View style={s.timerInput}>
        <Ionicons name="timer-outline" size={13} color={BRAND} />
        <Text style={s.timerInputLabel}>計時：</Text>
        <TextInput
          style={s.timerNumInput}
          value={inputMin}
          onChangeText={setInputMin}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={HINT}
          maxLength={2}
        />
        <Text style={s.timerInputLabel}>分</Text>
        <TextInput
          style={s.timerNumInput}
          value={inputSec}
          onChangeText={setInputSec}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={HINT}
          maxLength={2}
        />
        <Text style={s.timerInputLabel}>秒</Text>
        <TouchableOpacity style={s.timerStartBtn} onPress={handleConfirm}>
          <Text style={s.timerStartBtnTxt}>開始</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode("idle")}>
          <Text style={{ fontSize: 12, color: SUB }}>取消</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Counting mode
  const progress = totalSec > 0 ? ((totalSec - remaining) / totalSec) : 0;
  return (
    <View style={[s.timerCounting, isDone && s.timerDone, running && !isDone && s.timerRunning]}>
      <Ionicons name="timer-outline" size={14} color={isDone ? "#EA580C" : running ? BRAND : SUB} />
      <Text style={[s.timerDisplay, isDone && { color: "#EA580C" }, running && !isDone && { color: BRAND }]}>
        {isDone ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="notifications-outline" size={14} color="#EA580C" />
            <Text style={[s.timerDisplay, { color: "#EA580C" }]}>時間到！</Text>
          </View>
        ) : fmt(remaining)}
      </Text>
      {!isDone && totalSec > 0 && (
        <View style={s.timerProgress}>
          <View style={[s.timerProgressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 4, marginLeft: "auto" as any }}>
        {isDone ? (
          <TouchableOpacity style={s.timerStopBtn} onPress={() => { setRunning(false); handleReset(); }}>
            <Text style={s.timerStopBtnTxt}>停止</Text>
          </TouchableOpacity>
        ) : running ? (
          <TouchableOpacity style={s.timerControlBtn} onPress={() => setRunning(false)}>
            <Ionicons name="pause" size={13} color={BRAND} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.timerControlBtn, { backgroundColor: BRAND }]} onPress={() => setRunning(true)}>
            <Ionicons name="play" size={13} color="#fff" />
          </TouchableOpacity>
        )}
        {!isDone && (
          <>
            <TouchableOpacity style={s.timerControlBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={13} color={SUB} />
            </TouchableOpacity>
            <TouchableOpacity style={s.timerControlBtn} onPress={() => { setRunning(false); setMode("input"); }}>
              <Ionicons name="pencil" size={11} color={SUB} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Price comparison helpers ────────────────────────────────────────
function cleanIngredientName(name: string): string {
  return name
    .replace(/\s*\d+(\.\d+)?\s*(g|kg|ml|l|斤|兩|磅|包|個|條|隻|塊|份|碗|盒|罐|瓶|克|公斤|毫升|升|片|束|把|顆|粒|支|枝)/gi, "")
    .replace(/[一二三四五六七八九十百千]+[包個條隻塊份碗盒罐瓶片束把顆粒支枝]/g, "")
    .trim();
}

const FRESH_KEYWORDS = ["豬","牛","雞","魚","蝦","蟹","豆腐","排骨","肉","菜","菠菜","白菜","椰菜","生菜","芥蘭","通菜","菜心","番茄","茄子","青椒","洋蔥","薑","蒜","蔥","芹菜","蘿蔔","薯","瓜","豆","芽","蘑菇","冬菇"];

function isFreshIngredient(name: string): boolean {
  return FRESH_KEYWORDS.some(kw => name.includes(kw));
}

const SM_STYLE: Record<string, { color: string; bg: string; border: string; logo: string }> = {
  WELLCOME:  { color: "#0066CC", bg: "#EFF6FF", border: "#BFDBFE", logo: "W" },
  PARKNSHOP: { color: "#C8102E", bg: "#FFF5F5", border: "#FECACA", logo: "P" },
  JASONS:    { color: "#2D6A4F", bg: "#F0FDF4", border: "#BBF7D0", logo: "J" },
  WATSONS:   { color: "#005BAC", bg: "#EFF6FF", border: "#BFDBFE", logo: "W" },
  AEON:      { color: "#E60012", bg: "#FFF1F2", border: "#FECDD3", logo: "A" },
  DCHFOOD:   { color: "#FF6B00", bg: "#FFF7ED", border: "#FED7AA", logo: "D" },
};

const REDIRECT_PLATFORMS = [
  {
    name: "HKTVmall", nameEn: "HKTVmall", logo: "H", bg: "#FFF1F2", border: "#FECACA",
    // Custom URL scheme deep link — opens app directly if installed
    url: (kw: string) => `https://www.hktvmall.com/hktv/zh/search_a?keyword=${encodeURIComponent(kw)}`,
    app: (kw: string) => `hktvmall://search?keyword=${encodeURIComponent(kw)}`,
    hint: "有 App 可直接開啟",
  },
  {
    name: "pandamart", nameEn: "pandamart 24/7超市", logo: "P", bg: "#FFF0F6", border: "#FBCFE8",
    // pandamart search inside foodpanda darkstore
    url: (kw: string) => `https://www.foodpanda.hk/darkstore/x0ad/pandamart-24-7-supermarket-central/search?q=${encodeURIComponent(kw)}`,
    app: (kw: string) => `foodpanda://darkstore/search?q=${encodeURIComponent(kw)}`,
    hint: "有 App 可直接開啟",
  },
  {
    name: "惠康 Wellcome", nameEn: "Wellcome Supermarket", logo: "W", bg: "#EFF6FF", border: "#BFDBFE",
    // Universal Link — iOS automatically opens Wellcome app if installed
    url: (kw: string) => `https://www.wellcome.com.hk/zh-hant/search?keyword=${encodeURIComponent(kw)}`,
    app: null,
    hint: "裝有 App 自動開啟",
  },
  {
    name: "百佳 PARKnSHOP", nameEn: "PARKnSHOP", logo: "P", bg: "#FFF5F5", border: "#FECACA",
    // Universal Link — iOS automatically opens PARKnSHOP app if installed
    url: (kw: string) => `https://www.pns.hk/zh-hk/search?text=${encodeURIComponent(kw)}`,
    app: null,
    hint: "裝有 App 自動開啟",
  },
  {
    name: "吉之島 AEON", nameEn: "AEON City Online", logo: "A", bg: "#FFF1F2", border: "#FECDD3",
    url: (kw: string) => `https://www.aeoncity.com.hk/kh_zh/catalogsearch/result/?q=${encodeURIComponent(kw)}`,
    app: null,
    hint: "網頁版",
  },
];

async function openPlatform(p: typeof REDIRECT_PLATFORMS[0], keyword: string) {
  // Try app deep link first; fall back to web URL
  if (p.app) {
    try {
      const appUrl = p.app(keyword);
      const can = await Linking.canOpenURL(appUrl);
      if (can) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {}
  }
  // Open web URL
  try {
    await Linking.openURL(p.url(keyword));
  } catch (e) {
    Alert.alert("無法開啟", "請手動前往該平台搜尋「" + keyword + "」");
  }
}

const MEAL_TYPES = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" },
  { id: "snack", label: "小食" },
];

// ── Main component ──────────────────────────────────────────────────
export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  useKeepAwake();

  // Serving size
  const [servings, setServings] = useState(0); // 0 = use recipe default
  // Sections collapsed
  const [showIngredients, setShowIngredients] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  // Plan modal
  const [showPlan, setShowPlan] = useState(false);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [planMeal, setPlanMeal] = useState("dinner");
  // Price modal
  const [showPrice, setShowPrice] = useState(false);
  const [priceKw, setPriceKw] = useState("");
  const [priceIngCat, setPriceIngCat] = useState("");
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [showAllResults, setShowAllResults] = useState(false);
  // Tags
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [localTags, setLocalTags] = useState<string[] | null>(null);
  // Cooking term tooltip
  const [tooltipTerm, setTooltipTerm] = useState<string | null>(null);
  // Notes
  const [noteInput, setNoteInput] = useState("");
  // AI Edit
  const [showAIEdit, setShowAIEdit] = useState(false);
  const [aiEditPrompt, setAIEditPrompt] = useState("");
  const [aiEditResult, setAIEditResult] = useState<string | null>(null);
  // Added to cart feedback
  const [addedToCart, setAddedToCart] = useState(false);
  // Ingredient picker for add-to-cart
  const [showIngPicker, setShowIngPicker] = useState(false);
  const [editIngs, setEditIngs] = useState<any[]>([]);
  const [selectedIngs, setSelectedIngs] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  const recipeQ = trpc.recipes.getById.useQuery({ id: id! }, { enabled: !!id });
  const cleanPriceKw = useMemo(() => cleanIngredientName(priceKw), [priceKw]);
  const isFreshIng = useMemo(() => isFreshIngredient(priceKw), [priceKw]);
  const priceQ = trpc.priceWatch.search.useQuery(
    { keyword: cleanPriceKw },
    { enabled: showPrice && !!cleanPriceKw && !isFreshIng, staleTime: 1000 * 60 * 60 * 6 }
  );

  // Auto-select cheapest product when results load
  useEffect(() => {
    if (!priceQ.data || priceQ.data.length === 0) return;
    let cheapestIdx = 0;
    let cheapestPrice = Infinity;
    priceQ.data.forEach((item: any, idx: number) => {
      const validPrices = (item.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => !isNaN(v) && v > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : Infinity;
      if (minPrice < cheapestPrice) { cheapestPrice = minPrice; cheapestIdx = idx; }
    });
    setSelectedResultIdx(cheapestIdx);
  }, [priceQ.data]);

  const recipe = recipeQ.data;
  const ingredients: any[] = recipe?.ingredients ?? [];
  const steps: any[] = recipe?.steps ?? [];
  const imgUrl = (recipe as any)?.image || (recipe as any)?.thumbnailUrl;
  const isUserRecipe = (recipe as any)?.source === "user";
  const sourceUrl = (recipe as any)?.sourceUrl;
  const sourceAuthor = (recipe as any)?.sourceAuthor;
  const recipeNumericId = id ? (parseInt(id.replace("user_", "").replace("official_", ""), 10) || 0) : 0;
  const recipeStringId = id ?? "";
  const displayTags: string[] = localTags ?? ((recipe as any)?.tags ?? []);

  // Family notes
  const recipeNoteId = recipe
    ? ((recipe as any).source === "user" ? `custom_${recipeNumericId}` : `official_${recipeNumericId}`)
    : "";
  const notesQ = trpc.recipeNotes.list.useQuery(
    { recipeId: recipeNoteId },
    { enabled: isAuthenticated && !!user && !!recipeNoteId },
  );
  const addNoteM = trpc.recipeNotes.add.useMutation({
    onSuccess: () => { setNoteInput(""); utils.recipeNotes.list.invalidate({ recipeId: recipeNoteId }); },
    onError: (e) => Alert.alert("儲存失敗", e.message),
  });
  const deleteNoteM = trpc.recipeNotes.delete.useMutation({
    onSuccess: () => utils.recipeNotes.list.invalidate({ recipeId: recipeNoteId }),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  // Delete mutations
  const deleteUserM = trpc.recipes.deleteUser.useMutation({
    onSuccess: () => {
      utils.recipes.listUser.invalidate();
      Alert.alert("已刪除", "食譜已從你的食譜庫刪除");
      router.back();
    },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });
  const deleteOfficialM = trpc.recipes.deleteOfficial.useMutation({
    onSuccess: () => {
      utils.recipes.listOfficial.invalidate();
      Alert.alert("已刪除", "官方食譜已刪除");
      router.back();
    },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const handleDelete = () => {
    if (!recipe) return;
    const recipeName = recipe.name;
    if (isUserRecipe) {
      Alert.alert(
        "刪除食譜",
        `確定要刪除「${recipeName}」？此動作無法還原。`,
        [
          { text: "取消", style: "cancel" },
          { text: "刪除", style: "destructive", onPress: () => deleteUserM.mutate({ id: recipeNumericId }) },
        ]
      );
    } else if (user?.role === "admin") {
      Alert.alert(
        "刪除官方食譜",
        `確定要刪除官方食譜「${recipeName}」？此動作無法還原。`,
        [
          { text: "取消", style: "cancel" },
          { text: "刪除", style: "destructive", onPress: () => deleteOfficialM.mutate({ id: recipeNumericId }) },
        ]
      );
    }
  };

  // Can this user delete this recipe?
  const canDelete = isUserRecipe || user?.role === "admin";

  // Mutations
  const updateTagsM = trpc.recipes.updateUser.useMutation({
    onSuccess: (data: any) => { setLocalTags(data.tags ?? []); setShowTagEditor(false); },
    onError: (e: any) => Alert.alert("失敗", e.message),
  });
  const addPlanM = trpc.mealPlan.add.useMutation({
    onSuccess: () => { setShowPlan(false); Alert.alert("已加入排餐"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: () => { setAddedToCart(true); Alert.alert("已加入採購清單"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });
  const aiEditM = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => setAIEditResult(data.content),
    onError: (e) => Alert.alert("AI Edit 失敗", e.message),
  });

  // Cooking terms for highlighting
  const cookingTerms = useMemo(() => COOKING_TERM_LIST, []);

  const highlightStepText = useCallback((text: string) => {
    if (!text) return <Text>{text}</Text>;
    const parts: { text: string; isTerm: boolean }[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      let matched = false;
      for (const term of cookingTerms) {
        const idx = remaining.indexOf(term);
        if (idx >= 0) {
          if (idx > 0) parts.push({ text: remaining.slice(0, idx), isTerm: false });
          parts.push({ text: term, isTerm: true });
          remaining = remaining.slice(idx + term.length);
          matched = true;
          break;
        }
      }
      if (!matched) { parts.push({ text: remaining, isTerm: false }); break; }
    }
    return (
      <Text>
        {parts.map((p, i) =>
          p.isTerm ? (
            <Text key={i} style={{ color: BRAND, fontWeight: "700" }} onPress={() => setTooltipTerm(p.text)}>
              {p.text}<Ionicons name="help-circle-outline" size={11} color={BRAND} />
            </Text>
          ) : <Text key={i}>{p.text}</Text>
        )}
      </Text>
    );
  }, [cookingTerms]);

  // Adjusted ingredients based on serving ratio
  const effectiveServings = servings > 0 ? servings : ((recipe?.servings ?? 0) || 2);
  const baseServings = (recipe?.servings ?? 0) || effectiveServings;
  const ratio = baseServings > 0 ? effectiveServings / baseServings : 1;

  const adjustedIngredients = useMemo(() => {
    return ingredients.map((ing: any) => {
      const rawQty = String(ing.quantity ?? "");
      const adjusted = ratio === 1 ? rawQty : calcAdjustedQty(rawQty, ing.unit ?? "", ing.category ?? "", ratio);
      return { ...ing, adjustedQty: adjusted };
    });
  }, [ingredients, ratio]);

  const dateOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label = i === 0 ? "今天" : i === 1 ? "明天" : d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric", weekday: "short" });
    return { iso, label };
  }), []);

  if (recipeQ.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={BRAND} size="large" />
        <Text style={{ fontSize: 14, color: SUB, marginTop: 12 }}>載入食譜中...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={52} color={HINT} />
        <Text style={{ fontSize: 15, color: SUB, marginTop: 8 }}>找不到食譜</Text>
        <TouchableOpacity style={s.backBtnSolid} onPress={() => router.back()}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── Hero Image ── */}
          <View style={s.hero}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={s.heroImg} resizeMode="cover" />
            ) : (
              <View style={[s.heroImg, s.heroPlaceholder]}>
                <Ionicons name="restaurant" size={56} color={HINT} />
              </View>
            )}
            <View style={s.heroGrad} />
            {/* Back button */}
            <TouchableOpacity style={s.heroBack} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            {/* Share button */}
            <TouchableOpacity
              style={s.heroShare}
              onPress={() => {
                const ingText = ingredients.map((i: any) => `• ${i.name}${i.quantity ? ` ${i.quantity}` : ""}${i.unit ? ` ${i.unit}` : ""}`).join("\n");
                const stepText = steps.map((s: any, i: number) => `${i + 1}. ${typeof s === "string" ? s : s.description}`).join("\n");
                const shareText = [
                  `🍽️ ${recipe.name}`,
                  recipe.cookTime ? `⏱ ${recipe.cookTime} 分鐘` : "",
                  recipe.servings ? `👥 ${recipe.servings} 人份` : "",
                  "",
                  "📋 食材：",
                  ingText,
                  "",
                  "👨‍🍳 做法：",
                  stepText,
                  "",
                  `— 來自 Kindcipe 家庭廚房`,
                ].filter(Boolean).join("\n");
                Share.share({ message: shareText, title: recipe.name });
              }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
            {/* Recipe info overlay */}
            <View style={s.heroInfo}>
              {(recipe as any).source === "official" && (
                <View style={s.officialBadge}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={s.officialTxt}>官方食譜</Text>
                </View>
              )}
              <Text style={s.heroTitle}>{recipe.name}</Text>
              <View style={s.heroMeta}>
                {(recipe.cookTime ?? 0) > 0 && (
                  <View style={s.metaChip}>
                    <Ionicons name="time-outline" size={12} color="#fff" />
                    <Text style={s.metaChipTxt}>{recipe.cookTime} 分鐘</Text>
                  </View>
                )}
                {(recipe.servings ?? 0) > 0 && (
                  <View style={s.metaChip}>
                    <Ionicons name="people-outline" size={12} color="#fff" />
                    <Text style={s.metaChipTxt}>{recipe.servings} 人份</Text>
                  </View>
                )}
                {(recipe as any).difficulty && (
                  <View style={s.metaChip}>
                    <Text style={s.metaChipTxt}>{(recipe as any).difficulty}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Source author bar ── */}
          {sourceAuthor && (
            <TouchableOpacity
              style={s.sourceBar}
              onPress={() => sourceUrl && Linking.openURL(sourceUrl)}
            >
              <View style={s.sourceIcon}>
                <Ionicons name="logo-instagram" size={14} color="#fff" />
              </View>
              <Text style={s.sourceText}>教學影片 by {sourceAuthor}</Text>
              {sourceUrl && <Text style={s.sourceLink}>查看 →</Text>}
            </TouchableOpacity>
          )}

          <View style={{ paddingHorizontal: 16 }}>

            {/* ── Description ── */}
            {(recipe as any).description ? (
              <Text style={s.description}>{(recipe as any).description}</Text>
            ) : null}

            {/* ── Serving size scaler ── */}
            {(recipe.servings ?? 0) > 0 && (
              <View style={s.scalerCard}>
                <View style={s.scalerLeft}>
                  <Text style={s.scalerTitle}>份量調整</Text>
                  <Text style={s.scalerSub}>食材用量自動換算</Text>
                </View>
                <View style={s.scalerControls}>
                  <TouchableOpacity style={s.scalerBtn} onPress={() => setServings(Math.max(1, effectiveServings - 1))}>
                    <Text style={s.scalerBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <View style={s.scalerCount}>
                    <Text style={s.scalerNum}>{effectiveServings}</Text>
                    <Text style={s.scalerLabel}>人份</Text>
                  </View>
                  <TouchableOpacity style={s.scalerBtn} onPress={() => setServings(effectiveServings + 1)}>
                    <Text style={s.scalerBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Action buttons ── */}
            <View style={s.actionRow}>
              <TouchableOpacity style={s.btnPrimary} onPress={() => {
                if (!isAuthenticated) { router.push("/login"); return; }
                setShowPlan(true);
              }}>
                <Ionicons name="calendar-outline" size={16} color="#fff" />
                <Text style={s.btnPriTxt}>加入排餐</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSecondary, addedToCart && s.btnSecondaryDone]} onPress={() => {
                if (!isAuthenticated) { router.push("/login"); return; }
                const ings = adjustedIngredients.map((ing: any, i: number) => ({
                  ...ing, _idx: i, _qty: String(ing.adjustedQty ?? ing.quantity ?? ""), _unit: ing.unit ?? "",
                }));
                if (ings.length === 0) { Alert.alert("沒有食材資訊"); return; }
                setEditIngs(ings);
                setSelectedIngs(new Set(ings.map((_: any, i: number) => i)));
                setShowIngPicker(true);
              }}>
                <Ionicons name={addedToCart ? "checkmark-circle" : "cart-outline"} size={16} color={addedToCart ? GREEN : BRAND} />
                <Text style={[s.btnSecTxt, addedToCart && { color: GREEN }]}>{addedToCart ? "已加入" : "加入採購"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnAI} onPress={() => { setAIEditPrompt(""); setAIEditResult(null); setShowAIEdit(true); }}>
                <Ionicons name="sparkles" size={14} color="#7C3AED" />
                <Text style={s.btnAITxt}>AI Edit</Text>
              </TouchableOpacity>
            </View>

            {/* ── Housewife Tips ── */}
            {(recipe as any).housewifeTips && (
              <View style={s.tipsCard}>
                <View style={s.tipsRow}>
                  <Ionicons name="bulb-outline" size={15} color="#F59E0B" />
                  <Text style={s.tipsTitle}>主婦貼士</Text>
                </View>
                <Text style={s.tipsTxt}>{(recipe as any).housewifeTips}</Text>
              </View>
            )}

            {/* ── Ingredients ── */}
            <View style={s.card}>
              <TouchableOpacity style={s.cardHeaderRow} onPress={() => setShowIngredients(!showIngredients)}>
                <View style={s.cardIconBox}>
                  <Ionicons name="basket-outline" size={16} color={GREEN} />
                </View>
                <Text style={s.cardTitle}>食材清單 ({adjustedIngredients.length} 項)</Text>
                <Ionicons name={showIngredients ? "chevron-up" : "chevron-down"} size={18} color={SUB} />
              </TouchableOpacity>

              {showIngredients && (
                <>
                  <View style={s.divider} />
                  {adjustedIngredients.map((ing: any, i: number) => {
                    const isPackaged = PACKAGED_CATS.has(ing.category ?? "");
                    const isScaled = ratio !== 1 && !SEASONING_CATS.has(ing.category ?? "");
                    return (
                      <View key={i} style={[s.ingRow, i < adjustedIngredients.length - 1 && s.ingBorder]}>
                        {/* Color dot: green=fresh, blue=packaged */}
                        <View style={[s.ingDot, { backgroundColor: isPackaged ? BRAND : GREEN }]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.ingName}>{ing.name}</Text>
                          {ing.category && (
                            <View style={[s.ingCatTag, { backgroundColor: isPackaged ? "#E8F0FA" : "#E8F5E9" }]}>
                              <Text style={[s.ingCatTxt, { color: isPackaged ? "#012D56" : "#166534" }]}>{ing.category}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[s.ingQty, isScaled && { color: COPPER, fontWeight: "700" }]}>
                          {ing.unit === "適量" ? "適量" : `${ing.adjustedQty} ${ing.unit ?? ""}`}
                        </Text>
                        <TouchableOpacity style={s.priceBtn} onPress={() => {
                          setPriceKw(ing.name);
                          setPriceIngCat(ing.category ?? "");
                          setSelectedResultIdx(0);
                          setShowAllResults(false);
                          setShowPrice(true);
                        }}>
                          <Text style={{ fontSize: 10, color: BRAND, fontWeight: "700" }}>比價</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* ── Steps ── */}
            <View style={s.card}>
              <TouchableOpacity style={s.cardHeaderRow} onPress={() => setShowSteps(!showSteps)}>
                <View style={[s.cardIconBox, { backgroundColor: "#E8F0FA" }]}>
                  <Ionicons name="restaurant-outline" size={16} color={BRAND} />
                </View>
                <Text style={s.cardTitle}>烹飪步驟 ({steps.length} 步)</Text>
                <Ionicons name={showSteps ? "chevron-up" : "chevron-down"} size={18} color={SUB} />
              </TouchableOpacity>

              {showSteps && (
                <>
                  <View style={s.divider} />
                  {steps.map((step: any, i: number) => {
                    const instruction = typeof step === "string" ? step : (step.instruction ?? step.description ?? step.step ?? "");
                    const tip = step.tip ?? step.tips ?? null;
                    const isOptional = step.optional === true;
                    const durSeconds = step.duration ? parseInt(String(step.duration)) * (parseInt(String(step.duration)) < 20 ? 60 : 1) : 0;
                    const stepImage = step.image ?? null;

                    return (
                      <View key={i} style={[s.stepRow, i < steps.length - 1 && s.stepBorder]}>
                        {/* Step number bubble */}
                        <View style={s.stepNumBubble}>
                          <Text style={s.stepNumTxt}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          {/* Instruction with term highlighting */}
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
                            <Text style={{ flex: 1, fontSize: 15, color: TEXT, lineHeight: 22 }}>
                              {highlightStepText(instruction)}
                            </Text>
                            {isOptional && (
                              <View style={s.optionalBadge}>
                                <Text style={s.optionalBadgeTxt}>可略過</Text>
                              </View>
                            )                            }
                          </View>

                          {/* Step image */}
                          {stepImage && (
                            <Image source={{ uri: stepImage }} style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 8 }} resizeMode="cover" />
                          )}

                          {/* Tip — purple box */}
                          {tip && (
                            <View style={[s.tipBox, isOptional && s.tipBoxGray]}>
                              <Text style={[s.tipBoxTxt, isOptional && { color: SUB }]}>
                                {isOptional ? <Ionicons name="play-forward" size={12} color={SUB} /> : <Ionicons name="bulb" size={12} color={PURPLE} />} {tip}
                              </Text>
                            </View>
                          )}

                          {/* Per-step timer */}
                          <StepTimer defaultSeconds={durSeconds} />
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* ── Tags ── */}
            {(displayTags.length > 0 || isUserRecipe) && (
              <View style={s.tagsCard}>
                <View style={s.tagsHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="pricetags-outline" size={15} color={BRAND} />
                    <Text style={s.tagsTitle}>標籤</Text>
                  </View>
                  {isUserRecipe && isAuthenticated && (
                    <TouchableOpacity style={s.editTagBtn} onPress={() => { setLocalTags(displayTags); setShowTagEditor(true); }}>
                      <Ionicons name="pencil-outline" size={13} color={BRAND} />
                      <Text style={s.editTagTxt}>編輯</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {displayTags.length === 0 ? (
                  <Text style={{ fontSize: 13, color: HINT, fontStyle: "italic" }}>尚未添加標籤</Text>
                ) : (
                  <View style={s.tagsRow}>
                    {displayTags.map((tag: string, i: number) => (
                      <View key={i} style={s.tagChip}>
                        <Text style={s.tagChipTxt}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Family Notes ── */}
            {isAuthenticated && (
              <View style={s.notesCard}>
                <View style={s.notesHeader}>
                  <Ionicons name="chatbubble-outline" size={15} color={COPPER} />
                  <Text style={s.notesTitle}>家庭備註</Text>
                  {(notesQ.data?.length ?? 0) > 0 && (
                    <View style={s.notesBadge}>
                      <Text style={s.notesBadgeTxt}>{notesQ.data!.length}</Text>
                    </View>
                  )}
                </View>

                {/* Existing notes */}
                {notesQ.data && notesQ.data.map((note: any) => (
                  <View key={note.id} style={s.noteItem}>
                    <View style={s.noteAvatar}>
                      <Text style={s.noteAvatarTxt}>{(note.userName ?? "?")[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <Text style={s.noteName}>{note.userName ?? "家庭成員"}</Text>
                        <Text style={s.noteDate}>{new Date(note.createdAt).toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}</Text>
                      </View>
                      <Text style={s.noteContent}>{note.content}</Text>
                    </View>
                    {note.userId === user?.id && (
                      <TouchableOpacity
                        onPress={() => deleteNoteM.mutate({ id: note.id })}
                        disabled={deleteNoteM.isPending}
                        style={{ padding: 4, opacity: deleteNoteM.isPending ? 0.5 : 1 }}
                      >
                        <Ionicons name="trash-outline" size={14} color={HINT} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Add note input */}
                <View style={s.noteInputRow}>
                  <TextInput
                    style={s.noteInput}
                    value={noteInput}
                    onChangeText={setNoteInput}
                    placeholder="留下烹飪備註，例如：少鹽、下次加多點蒜…"
                    placeholderTextColor={HINT}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[s.noteSendBtn, (!noteInput.trim() || addNoteM.isPending) && { backgroundColor: "#E5E7EB" }]}
                    onPress={() => {
                      if (noteInput.trim()) {
                        addNoteM.mutate({ recipeId: recipeNoteId, recipeName: recipe.name, content: noteInput.trim() });
                      }
                    }}
                    disabled={!noteInput.trim() || addNoteM.isPending}
                  >
                    {addNoteM.isPending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={15} color={noteInput.trim() ? "#fff" : HINT} />
                    }
                  </TouchableOpacity>
                </View>
                <Text style={s.noteHint}>{noteInput.length}/500 · 僅家庭成員可見</Text>
              </View>
            )}

            {/* ── Instagram source link ── */}
            {sourceUrl && (
              <TouchableOpacity style={s.igBtn} onPress={() => Linking.openURL(sourceUrl)}>
                <Ionicons name="logo-instagram" size={18} color="#fff" />
                <Text style={s.igBtnTxt}>在 Instagram 觀看完整影片</Text>
                {sourceAuthor && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>by {sourceAuthor}</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* ── Cooking term tooltip ── */}
        <CookingTermTooltip visible={!!tooltipTerm} term={tooltipTerm || ""} onClose={() => setTooltipTerm(null)} />

        {/* ── Add to plan modal ── */}
        <Modal visible={showPlan} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>加入排餐</Text>
                <TouchableOpacity onPress={() => setShowPlan(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <Text style={s.sheetLabel}>選擇日期</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {dateOptions.map(d => (
                  <TouchableOpacity key={d.iso} style={[s.dateChip, planDate === d.iso && s.dateChipActive]} onPress={() => setPlanDate(d.iso)}>
                    <Text style={[s.dateChipTxt, planDate === d.iso && { color: "#fff" }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.sheetLabel}>餐次</Text>
              <View style={s.mealRow}>
                {MEAL_TYPES.map(m => (
                  <TouchableOpacity key={m.id} style={[s.mealChip, planMeal === m.id && s.mealChipActive]} onPress={() => setPlanMeal(m.id)}>
                    <Text style={[s.mealChipTxt, planMeal === m.id && { color: "#fff" }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.confirmBtn, addPlanM.isPending && { opacity: 0.6 }]}
                onPress={() => addPlanM.mutate({
                  date: planDate,
                  mealType: planMeal as any,
                  recipeId: recipeStringId,
                  recipeName: recipe.name,
                  recipeImage: imgUrl ?? undefined,
                  autoAddIngredients: false,
                })}
                disabled={addPlanM.isPending}
              >
                {addPlanM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnTxt}>確認加入</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Price comparison modal — full implementation ── */}
        <Modal visible={showPrice} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={[s.sheet, { maxHeight: "88%" }]}>
              <View style={s.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={s.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sheetTitle}>各平台比價</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: BRAND, marginTop: 2 }}>{priceKw}</Text>
                    {cleanPriceKw !== priceKw && (
                      <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>搜尋關鍵字：「{cleanPriceKw}」</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => { setShowPrice(false); setPriceKw(""); }}>
                    <Ionicons name="close" size={22} color={TEXT} />
                  </TouchableOpacity>
                </View>

                {/* Fresh ingredient notice */}
                {isFreshIng && (
                  <View style={s.priceNotice}>
                    <Ionicons name="leaf-outline" size={13} color={GREEN} />
                    <Text style={s.priceNoticeTxt}>新鮮食材建議到街市或超市比價，消委會格價未涵蓋此類商品</Text>
                  </View>
                )}

                {/* Loading */}
                {!isFreshIng && priceQ.isLoading && (
                  <View style={s.priceNotice}>
                    <ActivityIndicator size="small" color={BRAND} />
                    <Text style={{ fontSize: 12, color: BRAND }}>正在查詢消委會格價資料…</Text>
                  </View>
                )}

                {/* Error */}
                {!isFreshIng && priceQ.isError && (
                  <View style={[s.priceNotice, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                    <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                    <Text style={{ fontSize: 12, color: "#DC2626", flex: 1 }}>無法載入消委會格價資料</Text>
                    <TouchableOpacity onPress={() => priceQ.refetch()}>
                      <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "700" }}>重試</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* No results */}
                {!isFreshIng && !priceQ.isLoading && !priceQ.isError && priceQ.data?.length === 0 && (
                  <View style={[s.priceNotice, { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }]}>
                    <Text style={{ fontSize: 12, color: SUB }}>消委會格價中未找到「{cleanPriceKw}」，可直接前往各平台搜尋</Text>
                  </View>
                )}

                {/* Consumer Council data */}
                {!isFreshIng && (priceQ.data?.length ?? 0) > 0 && (() => {
                  const results = priceQ.data ?? [];
                  const selectedResult = results[selectedResultIdx] ?? results[0];
                  const sortedPrices = [...(selectedResult?.prices ?? [])]
                    .filter((p: any) => !isNaN(Number(p.price)) && Number(p.price) > 0)
                    .sort((a: any, b: any) => Number(a.price) - Number(b.price));
                  const lowestPrice = sortedPrices[0] ? Number((sortedPrices[0] as any).price) : null;

                  return (
                    <>
                      {/* CC data badge */}
                      <View style={s.ccBadge}>
                        <Text style={s.ccBadgeTxt}>消委會數據 · 今日更新</Text>
                      </View>

                      {/* Product selector — multiple results */}
                      {results.length > 1 && (
                        <View style={{ marginBottom: 10 }}>
                          <TouchableOpacity
                            style={s.productSelector}
                            onPress={() => setShowAllResults(v => !v)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10, color: SUB }}>產品規格</Text>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }} numberOfLines={1}>
                                {selectedResult?.brand ? `${selectedResult.brand} ` : ""}{selectedResult?.name}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              {lowestPrice !== null && (
                                <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>
                                  最低 HK${lowestPrice.toFixed(1)}
                                </Text>
                              )}
                              <Ionicons name={showAllResults ? "chevron-up" : "chevron-down"} size={14} color={BRAND} />
                            </View>
                          </TouchableOpacity>

                          {showAllResults && (
                            <View style={s.productList}>
                              {results.map((r: any, idx: number) => {
                                const rPrices = (r.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => v > 0);
                                const rMin = rPrices.length > 0 ? Math.min(...rPrices) : null;
                                const allMins = results.map((item: any) => {
                                  const ps = (item.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => v > 0);
                                  return ps.length > 0 ? Math.min(...ps) : Infinity;
                                });
                                const globalMin = Math.min(...allMins);
                                const isCheapest = rMin !== null && rMin === globalMin;
                                const isSelected = idx === selectedResultIdx;
                                return (
                                  <TouchableOpacity
                                    key={r.code ?? idx}
                                    style={[s.productItem, isSelected && s.productItemSelected]}
                                    onPress={() => { setSelectedResultIdx(idx); setShowAllResults(false); }}
                                  >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <Text style={{ fontSize: 12, fontWeight: isSelected ? "800" : "600", color: TEXT }} numberOfLines={1}>
                                        {r.brand ? `${r.brand} ` : ""}{r.name}
                                      </Text>
                                      {r.category && <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{r.category}</Text>}
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                      {isCheapest && (
                                        <View style={{ backgroundColor: "#DCFCE7", borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#15803D" }}>最便宜</Text>
                                        </View>
                                      )}
                                      {rMin !== null && (
                                        <Text style={{ fontSize: 13, fontWeight: "800", color: isCheapest ? "#15803D" : TEXT }}>
                                          HK${rMin.toFixed(1)}起
                                        </Text>
                                      )}
                                      {isSelected && <Ionicons name="checkmark-outline" size={10} color={BRAND} />}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Single product name */}
                      {results.length === 1 && selectedResult && (
                        <View style={s.singleProduct}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }}>{selectedResult.name}</Text>
                          {selectedResult.brand && <Text style={{ fontSize: 11, color: SUB, marginLeft: 6 }}>{selectedResult.brand}</Text>}
                        </View>
                      )}

                      {/* Supermarket prices */}
                      <View style={{ gap: 8, marginBottom: 14 }}>
                        {sortedPrices.map((p: any, idx: number) => {
                          const st = SM_STYLE[p.supermarketCode] ?? { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", logo: "?" };
                          const isLowest = idx === 0;
                          return (
                            <View key={p.supermarketCode} style={[s.smPriceRow, { backgroundColor: st.bg, borderColor: isLowest ? "#22C55E" : st.border }]}>
                              {isLowest && (
                                <View style={s.lowestBadge}>
                                  <Ionicons name="checkmark-outline" size={10} color="#fff" />
                                  <Text style={s.lowestBadgeTxt}>最低格價</Text>
                                </View>
                              )}
                              <View style={s.smLogo}>
                                <Text style={{ fontSize: 18 }}>{st.logo}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>{p.supermarketName}</Text>
                                <Text style={{ fontSize: 10, color: SUB }}>{p.supermarketCode}</Text>
                              </View>
                              <Text style={{ fontSize: 20, fontWeight: "900", color: isLowest ? "#15803D" : TEXT }}>
                                HK${Number(p.price).toFixed(1)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Special offers */}
                      {selectedResult?.offers && selectedResult.offers.length > 0 && (
                        <View style={{ marginBottom: 14 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 6 }}>特別優惠</Text>
                          {selectedResult.offers.map((o: any, i: number) => (
                            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: "8px 12px" as any, borderRadius: 10, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
                              <Ionicons name="pricetag-outline" size={12} color="#92400E" />
                              <Text style={{ fontSize: 11, color: "#92400E" }}>{o.supermarketName}：{o.text}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  );
                })()}

                {/* Platform redirect buttons */}
                <View style={{ marginBottom: 14 }}>
                  {(priceQ.data?.length ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 8 }}>其他平台（點擊前往搜尋）</Text>
                  )}
                  <View style={{ gap: 8 }}>
                    {REDIRECT_PLATFORMS.map(p => (
                      <TouchableOpacity
                        key={p.name}
                        style={[s.platformRow, { backgroundColor: p.bg, borderColor: p.border }]}
                        onPress={() => openPlatform(p, cleanPriceKw)}
                      >
                        <View style={s.smLogo}>
                          <Text style={{ fontSize: 18 }}>{p.logo}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>{p.name}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                            {p.app && (
                              <View style={{ backgroundColor: "#DCFCE7", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", color: "#15803D" }}>App 優先</Text>
                              </View>
                            )}
                            {!p.app && (
                              <View style={{ backgroundColor: "#EEF4FB", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", color: BRAND }}>Universal Link</Text>
                              </View>
                            )}
                            <Text style={{ fontSize: 9, color: SUB }}>{p.hint}</Text>
                          </View>
                        </View>
                        <View style={s.goBuyBtn}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>搜尋</Text>
                          <Ionicons name="open-outline" size={11} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Consumer Council website link */}
                <TouchableOpacity
                  style={s.ccLink}
                  onPress={() => Linking.openURL(`https://online-price-watch.consumer.org.hk/opw/?keyword=${encodeURIComponent(cleanPriceKw)}`)}
                >
                  <View style={s.ccLinkIcon}>
                    <Ionicons name="business-outline" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: BRAND }}>消委會格價網查詢</Text>
                    <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>Consumer Council · 網上價格一覽通</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={BRAND} />
                </TouchableOpacity>

                {/* Disclaimer */}
                <View style={s.disclaimer}>
                  <Text style={s.disclaimerTxt}>
                    {(priceQ.data?.length ?? 0) > 0
                      ? "格價來自消委會「網上價格一覽通」，每日更新。實際售價以各平台為準。"
                      : "消委會格價涵蓋惠康、百佳等超市，不包括 HKTVmall、pandamart 及街市鮮貨。"
                    }
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Tag editor modal ── */}
        <Modal visible={showTagEditor} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>編輯標籤</Text>
                <TouchableOpacity onPress={() => setShowTagEditor(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <View style={s.tagsRow}>
                {(localTags ?? []).map((tag: string, i: number) => (
                  <TouchableOpacity key={i} style={s.tagChipRemovable} onPress={() => setLocalTags(prev => (prev ?? []).filter((_, idx) => idx !== i))}>
                    <Text style={s.tagChipTxt}>{tag}</Text>
                    <Ionicons name="close" size={12} color={BRAND} />
                  </TouchableOpacity>
                ))}
              </View>
              {(localTags ?? []).length < 10 && (
                <View style={s.tagInputRow}>
                  <TextInput
                    style={s.tagInput}
                    placeholder="新增標籤"
                    placeholderTextColor={HINT}
                    value={newTag}
                    onChangeText={setNewTag}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const t = newTag.trim();
                      if (t && !(localTags ?? []).includes(t)) setLocalTags(prev => [...(prev ?? []), t]);
                      setNewTag("");
                    }}
                  />
                  <TouchableOpacity style={s.tagAddBtn} onPress={() => {
                    const t = newTag.trim();
                    if (t && !(localTags ?? []).includes(t)) setLocalTags(prev => [...(prev ?? []), t]);
                    setNewTag("");
                  }}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[s.confirmBtn, updateTagsM.isPending && { opacity: 0.6 }]}
                onPress={() => {
                  if (!recipe) return;
                  updateTagsM.mutate({
                    id: recipeNumericId,
                    name: recipe.name,
                    description: (recipe as any).description ?? "",
                    cookTime: recipe.cookTime ?? 30,
                    servings: recipe.servings ?? 4,
                    difficulty: (recipe as any).difficulty ?? "中等",
                    recipeCategory: (recipe as any).recipeCategory ?? "mixed",
                    ingredients: ingredients.map((i: any) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
                    steps: steps.map((step: any) => ({ instruction: typeof step === "string" ? step : (step.instruction ?? ""), duration: step.duration ?? 0 })),
                    tags: localTags ?? [],
                  });
                }}
                disabled={updateTagsM.isPending}
              >
                {updateTagsM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnTxt}>儲存標籤</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── AI Edit modal ── */}
        <Modal visible={showAIEdit} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={[s.sheet, { maxHeight: "80%" }]}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={16} color="#7C3AED" />
                  </View>
                  <Text style={s.sheetTitle}>AI Edit</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAIEdit(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {["改成素食版", "份量加倍", "翻譯成英文", "簡化步驟", "減少用油"].map(p => (
                  <TouchableOpacity key={p} style={{ backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#DDD6FE" }} onPress={() => setAIEditPrompt(p)}>
                    <Text style={{ fontSize: 12, color: "#7C3AED", fontWeight: "600" }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={{ backgroundColor: "#F5F3FF", borderRadius: 12, padding: 12, fontSize: 14, color: TEXT, borderWidth: 1.5, borderColor: "#DDD6FE", marginBottom: 12, minHeight: 60 }}
                value={aiEditPrompt}
                onChangeText={setAIEditPrompt}
                placeholder="例如：把這個食譜改成素食版..."
                placeholderTextColor={HINT}
                multiline
              />
              <TouchableOpacity
                style={{ backgroundColor: "#7C3AED", paddingVertical: 13, borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16, opacity: aiEditM.isPending || !aiEditPrompt.trim() ? 0.6 : 1 }}
                onPress={() => {
                  if (!aiEditPrompt.trim()) return;
                  const ctx = `食譜：${recipe.name}\n食材：${ingredients.map((i: any) => `${i.name} ${i.quantity}${i.unit}`).join("、")}\n\n要求：${aiEditPrompt}`;
                  setAIEditResult(null);
                  aiEditM.mutate({ messages: [{ role: "user", content: ctx }] });
                }}
                disabled={aiEditM.isPending || !aiEditPrompt.trim()}
              >
                {aiEditM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={16} color="#fff" />}
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{aiEditM.isPending ? "處理中..." : "開始 AI Edit"}</Text>
              </TouchableOpacity>
              {aiEditResult && (
                <ScrollView style={{ backgroundColor: "#FAFAFA", borderRadius: 12, padding: 12, maxHeight: 180, borderWidth: 1, borderColor: "#E5E7EB" }}>
                  <Text style={{ fontSize: 13, color: TEXT, lineHeight: 21 }}>{aiEditResult}</Text>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Ingredient Picker Modal ── */}
        <Modal visible={showIngPicker} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.ingPickerSheet}>
              <View style={s.ingPickerHeader}>
                <Text style={s.ingPickerTitle}>選擇食材加入採購清單</Text>
                <TouchableOpacity onPress={() => setShowIngPicker(false)}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: BRAND }}>取消</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: 16 }}>
                {editIngs.map((ing: any, i: number) => (
                  <View key={i} style={s.ingPickerRow}>
                    <TouchableOpacity
                      style={s.ingPickerCheck}
                      onPress={() => {
                        setSelectedIngs(prev => {
                          const n = new Set(prev);
                          if (n.has(i)) n.delete(i); else n.add(i);
                          return n;
                        });
                      }}
                    >
                      <View style={[s.ingPickerDot, selectedIngs.has(i) && s.ingPickerDotActive]}>
                        {selectedIngs.has(i) && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <Text style={s.ingPickerName}>{ing.name}</Text>
                    <TextInput
                      style={s.ingPickerQtyInput}
                      value={ing._qty}
                      onChangeText={v => {
                        setEditIngs((prev: any[]) => prev.map((x, idx) => idx === i ? { ...x, _qty: v } : x));
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                    <UnitPicker
                      value={ing._unit}
                      onChange={(v: string) => {
                        setEditIngs((prev: any[]) => prev.map((x, idx) => idx === i ? { ...x, _unit: v } : x));
                      }}
                      style={{ width: 80, height: 36 }}
                    />
                  </View>
                ))}
              </ScrollView>
              <View style={{ padding: 16 }}>
                <TouchableOpacity
                  style={s.ingPickerConfirm}
                  onPress={() => {
                    const toAdd = editIngs
                      .filter((_: any, i: number) => selectedIngs.has(i))
                      .map((ing: any) => ({
                        name: ing.name,
                        quantity: ing._qty,
                        unit: ing._unit,
                        category: ing.category || "食材",
                      }));
                    if (toAdd.length > 0) {
                      addShoppingM.mutate({ items: toAdd, fromRecipeId: recipeStringId, fromRecipeName: recipe.name });
                    } else {
                      Alert.alert("未選擇任何食材");
                    }
                    setShowIngPicker(false);
                  }}
                >
                  <Text style={s.ingPickerConfirmTxt}>
                    {selectedIngs.size > 0 ? `加入 ${selectedIngs.size} 項食材` : "關閉"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: BG },
  backBtnSolid: { backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 8 },

  // Hero
  hero: { width: "100%", height: 300, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroPlaceholder: { backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  heroGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: 180, backgroundColor: "rgba(0,0,0,0.6)" },
  heroBack: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  heroShare: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  heroInfo: { position: "absolute", bottom: 16, left: 16, right: 16 },
  officialBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(245,158,11,0.25)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, alignSelf: "flex-start", marginBottom: 6 },
  officialTxt: { fontSize: 11, color: "#FCD34D", fontWeight: "700" },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#fff", marginBottom: 8, lineHeight: 30 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  metaChipTxt: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Source bar
  sourceBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#F9F0FF" },
  sourceIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: "#E1306C", alignItems: "center", justifyContent: "center" },
  sourceText: { flex: 1, fontSize: 13, color: "#1C1C1E", fontWeight: "600" },
  sourceLink: { fontSize: 12, color: BRAND, fontWeight: "700" },

  // Description
  description: { fontSize: 14, color: SUB, lineHeight: 21, marginTop: 12, marginBottom: 4 },

  // Serving scaler
  scalerCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: CARD, borderRadius: 18, padding: 16, marginTop: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  scalerLeft: {},
  scalerTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  scalerSub: { fontSize: 12, color: SUB, marginTop: 2 },
  scalerControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  scalerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  scalerBtnTxt: { fontSize: 22, color: "#fff", fontWeight: "300", lineHeight: 28 },
  scalerCount: { alignItems: "center", minWidth: 48 },
  scalerNum: { fontSize: 28, fontWeight: "900", color: BRAND },
  scalerLabel: { fontSize: 11, color: SUB },

  // Action buttons
  actionRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: CARD, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND },
  btnSecondaryDone: { borderColor: GREEN, backgroundColor: "#F0FDF4" },
  btnSecTxt: { color: BRAND, fontSize: 13, fontWeight: "800" },
  btnAI: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F5F3FF", paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#DDD6FE" },
  btnAITxt: { color: "#7C3AED", fontSize: 12, fontWeight: "800" },

  // Tips
  tipsCard: { backgroundColor: "#FFFBEB", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
  tipsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  tipsTitle: { fontSize: 14, fontWeight: "800", color: "#92400E" },
  tipsTxt: { fontSize: 13, color: "#78350F", lineHeight: 20 },

  // Card
  card: { backgroundColor: CARD, marginTop: 16, borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: TEXT },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },

  // Ingredients
  ingRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 8 },
  ingBorder: { borderBottomWidth: 1, borderBottomColor: "#F9F6F2" },
  ingDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  ingName: { fontSize: 15, fontWeight: "500", color: TEXT, lineHeight: 20 },
  ingCatTag: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  ingCatTxt: { fontSize: 10 },
  ingQty: { fontSize: 13, color: SUB, fontWeight: "600", textAlign: "right" as any },
  priceBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#E8F0FA", borderWidth: 1, borderColor: "#BFDBFE" },

  // Steps
  stepRow: { flexDirection: "row", gap: 14, paddingVertical: 14 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  stepNumBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumTxt: { fontSize: 14, fontWeight: "900", color: "#fff" },
  // Step tip - PURPLE box (the "purple line" the user mentioned)
  tipBox: { backgroundColor: "#F3E5F5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8, borderLeftWidth: 3, borderLeftColor: PURPLE },
  tipBoxGray: { backgroundColor: "#F9FAFB", borderLeftColor: "#9CA3AF" },
  tipBoxTxt: { fontSize: 12, color: PURPLE, lineHeight: 18 },
  optionalBadge: { backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2, borderWidth: 1, borderColor: "#E5E7EB" },
  optionalBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#6B7280" },

  // Per-step timer
  timerIdle: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#F9F6F2", borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, alignSelf: "flex-start" as any, borderStyle: "dashed" as any },
  timerIdleTxt: { fontSize: 12, color: SUB, fontWeight: "600" },
  timerIdleActive: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#E8F0FA", borderRadius: 10, borderWidth: 1.5, borderColor: COPPER, alignSelf: "flex-start" as any },
  timerIdleActiveTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  timerInput: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, padding: 8, backgroundColor: "#E8F0FA", borderRadius: 12, borderWidth: 1.5, borderColor: COPPER, flexWrap: "wrap" as any },
  timerInputLabel: { fontSize: 12, color: SUB },
  timerNumInput: { width: 44, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5, borderColor: COPPER, fontSize: 14, fontWeight: "700", textAlign: "center" as any, backgroundColor: CARD, color: TEXT },
  timerStartBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: BRAND, borderRadius: 8 },
  timerStartBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  timerCounting: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, padding: 8, backgroundColor: "#F9F6F2", borderRadius: 12, borderWidth: 1.5, borderColor: BORDER },
  timerRunning: { backgroundColor: "#E8F0FA", borderColor: COPPER },
  timerDone: { backgroundColor: "#FFF7ED", borderColor: "#FB923C" },
  timerDisplay: { fontVariant: ["tabular-nums"] as any, fontSize: 17, fontWeight: "900", color: SUB, minWidth: 52 },
  timerProgress: { flex: 1, height: 4, backgroundColor: "#E5E7EB", borderRadius: 99, overflow: "hidden" },
  timerProgressFill: { height: "100%" as any, backgroundColor: BRAND, borderRadius: 99 },
  timerControlBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#E8F0FA", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: BORDER },
  timerStopBtn: { paddingHorizontal: 12, paddingVertical: 5, height: 30, borderRadius: 8, backgroundColor: "#EA580C", alignItems: "center", justifyContent: "center" },
  timerStopBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Tags
  tagsCard: { backgroundColor: "#F0F4FF", marginTop: 16, borderRadius: 16, padding: 16 },
  tagsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  tagsTitle: { fontSize: 14, fontWeight: "800", color: BRAND },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: "#E0EAFF", borderWidth: 1, borderColor: "#C7D9FF" },
  tagChipRemovable: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: "#E0EAFF", borderWidth: 1, borderColor: BRAND },
  tagChipTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  editTagBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#E0EAFF" },
  editTagTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  tagInputRow: { flexDirection: "row", gap: 10, marginBottom: 8, marginTop: 12 },
  tagInput: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT },
  tagAddBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },

  // Notes
  notesCard: { backgroundColor: "#FFFBF5", marginTop: 16, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER },
  notesHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  notesTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: TEXT },
  notesBadge: { backgroundColor: "rgba(245,168,35,0.12)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  notesBadgeTxt: { fontSize: 11, fontWeight: "700", color: COPPER },
  noteItem: { flexDirection: "row", gap: 10, marginBottom: 10, backgroundColor: CARD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER },
  noteAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COPPER, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  noteAvatarTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  noteName: { fontSize: 12, fontWeight: "700", color: TEXT },
  noteDate: { fontSize: 11, color: SUB },
  noteContent: { fontSize: 13, color: TEXT, lineHeight: 20 },
  noteInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", backgroundColor: "#F9F6F2", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: BORDER },
  noteInput: { flex: 1, backgroundColor: "transparent", fontSize: 13, color: TEXT, lineHeight: 20, maxHeight: 80 },
  noteSendBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COPPER, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  noteHint: { fontSize: 11, color: HINT, marginTop: 4, textAlign: "right" as any },

  // Instagram button
  igBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: "#E1306C", shadowColor: "#E1306C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  igBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Modal / Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: TEXT },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 10, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", marginRight: 8 },
  dateChipActive: { backgroundColor: BRAND },
  dateChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  mealChip: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  mealChipActive: { backgroundColor: BRAND },
  mealChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  confirmBtn: { backgroundColor: BRAND, paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  // Price comparison modal styles
  priceNotice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#FFF7ED", borderWidth: 1.5, borderColor: "#FED7AA", marginBottom: 12 },
  priceNoticeTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: "#92400E" },
  ccBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, backgroundColor: "#EEF4FB", borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 10 },
  ccBadgeTxt: { fontSize: 10, color: BRAND, fontWeight: "700" },
  productSelector: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: CARD, borderWidth: 1.5, borderColor: "#BFDBFE" },
  productList: { borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, overflow: "hidden", marginTop: 4 },
  productItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  productItemSelected: { backgroundColor: "#DBEAFE" },
  singleProduct: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  smPriceRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, position: "relative" },
  lowestBadge: { position: "absolute", top: -8, right: 10, backgroundColor: "#22C55E", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 2 },
  lowestBadgeTxt: { fontSize: 9, fontWeight: "700", color: "#fff" },
  smLogo: { width: 38, height: 38, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  platformRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  goBuyBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#1A1A1A" },
  ccLink: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: CARD, borderWidth: 1.5, borderColor: BRAND, marginBottom: 10 },
  ccLinkIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  disclaimer: { padding: 10, borderRadius: 12, backgroundColor: "#EEF4FB", marginBottom: 8 },
  disclaimerTxt: { fontSize: 10, color: SUB, lineHeight: 15 },

  // Ingredient picker
  ingPickerSheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "80%" as any, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  ingPickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  ingPickerTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  ingPickerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  ingPickerCheck: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  ingPickerDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BRAND, alignItems: "center", justifyContent: "center" },
  ingPickerDotActive: { backgroundColor: BRAND },
  ingPickerName: { flex: 1, fontSize: 14, color: TEXT, minWidth: 0 },
  ingPickerQtyInput: { width: 60, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: TEXT, textAlign: "center" as any },
  ingPickerConfirm: { backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ingPickerConfirmTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
