/**
 * 食譜詳情頁 — 完整版
 * 功能：
 * - 份量調整（自動換算食材用量）
 * - 每步倒數計時器（start/pause/reset，可自訂時間）
 * - 步驟貼士（紫色 💡 框）
 * - 家庭備註（trpc.recipeNotes）
 * - 食材分類顏色（綠/藍圓點）
 * - 烹飪術語 ❓ tooltip
 * - 加入排餐 / 加入購物清單
 * - 比價（HKTVmall / 百佳 / 惠康）
 * - Instagram 影片連結
 * - AI Edit
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal, Linking, Platform, BackHandler,
  Dimensions, TextInput, Share, KeyboardAvoidingView,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { trpc, resolveImageUrl } from "@/lib/trpc";
import { useInvalidateRecipesAndWeekly } from "@/hooks/useInvalidateRecipesAndWeekly";
import { useAuth } from "@/hooks/useAuth";
import UnitPicker from "@/src/components/UnitPicker";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";
import { COOKING_TERM_LIST } from "@/lib/cookingTerms";
import CookingTermTooltip from "@/app/components/CookingTermTooltip";
import { DateUtil } from "@/src/lib/DateUtil";
import PriceCompareModal from "@/src/components/PriceCompareModal";
import { CollectionButton } from "@/src/components/CollectionButton";
import { isSeasoning, calcAdjustedQty, NON_SCALABLE_CATS } from "@/constants/ingredients";
import { formatIngredientDisplay } from "@/src/lib/ingredientDisplay";

export const isValidHttpUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  (() => {
    try {
      const u = new URL(value.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();

const openSourceUrl = async (url: string | undefined) => {
  if (!url || !isValidHttpUrl(url)) {
    Alert.alert("無法開啟連結", "此食譜的來源連結格式無效。");
    return;
  }
  try {
    await Linking.openURL(url.trim());
  } catch {
    Alert.alert("無法開啟連結", "請在系統聲明中允許開啟外部連結。");
  }
};

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const COPPER = "#F5A823";
const BG = "#FAFAF8";
const CARD = "#FFFFFF";
const TEXT = "#1C1C1E";
const SUB = "#8E8E93";
const HINT = "#C7C7CC";
const BORDER = "#F0EDE8";
const GREEN = "#4CAF50";
const PURPLE = "#9C27B0";

const PLACEHOLDER_INGREDIENT_NAMES = new Set([
  "適量", "少許", "些許", "若干", "適宜", "適當", "隨意", "視乎口味", "依個人喜好",
]);
const isPlaceholderIngredientName = (name: string) => PLACEHOLDER_INGREDIENT_NAMES.has(String(name ?? "").trim());

// ── Cooking terms glossary ──────────────────────────────────────────
const PACKAGED_CATS = new Set(["調味料", "乾貨", "醬料", "罐頭", "飲品"]);
const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function getDayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

const WEEKDAYS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

function formatMealDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  return `${month}/${day} (${weekday})`;
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

// ── Main component ──────────────────────────────────────────────────
const MEAL_TYPES = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" },
  { id: "snack", label: "小食" },
];

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
  const [planDate, setPlanDate] = useState<string | null>(() => toISODate(new Date()));
  const [planMeal, setPlanMeal] = useState("dinner");
  // Price modal
  const [showPrice, setShowPrice] = useState(false);
  const [priceKw, setPriceKw] = useState("");
  const [priceIngCat, setPriceIngCat] = useState("");
  const [savePriceInput, setSavePriceInput] = useState("");
  const [ingredientPrices, setIngredientPrices] = useState<Record<string, number>>({});
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
  const [aiEditPreview, setAIEditPreview] = useState<any>(null);
  // Added to cart feedback
  const [lastAddedShoppingDate, setLastAddedShoppingDate] = useState<string | null>(null);
  // Ingredient picker for add-to-cart
  const [showIngPicker, setShowIngPicker] = useState(false);
  const [editIngs, setEditIngs] = useState<any[]>([]);
  const [selectedIngs, setSelectedIngs] = useState<Set<number>>(new Set());
  const [shoppingDate, setShoppingDate] = useState<string | null>(() => toISODate(new Date()));
  // Ingredient picker after addPlanM success
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);
  const [, setPlanPickerShoppingDate] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });
  const [showAllMealPlans, setShowAllMealPlans] = useState(false);
  const [showAllShopping, setShowAllShopping] = useState(false);
  // Track hero image load error to fall back to placeholder
  const [heroImgError, setHeroImgError] = useState(false);
  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: () => {
      utils.mealPlan.listByDateRange.invalidate();
      utils.shopping.list.invalidate();
      setToast({ visible: true, message: "已移除排餐", type: "success" });
    },
    onError: (e: any) => setToast({ visible: true, message: `移除失敗：${e.message}`, type: "error" }),
  });

  // 返回：若烹飪備註有未送出嘅文字，先提醒用戶
  const handleBack = useCallback(() => {
    if (noteInput.trim().length > 0) {
      Alert.alert(
        "確定離開？",
        "你輸入嘅烹飪備註尚未送出，離開後將不會保存。",
        [
          { text: "取消", style: "cancel" },
          { text: "離開", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [noteInput, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const utils = trpc.useUtils();
  const invalidateRecipesAndWeekly = useInvalidateRecipesAndWeekly();

  const recipeQ = trpc.recipes.getById.useQuery({ id: id! }, { enabled: !!id });
  const recipe = recipeQ.data;
  const recipeStringId = id ?? "";
  
  // 查詢呢個食譜係咪已經有排餐（未來 30 日）
  const mealPlansQ = trpc.mealPlan.listByDateRange.useQuery(
    { 
      startDate: toISODate(new Date()),
      endDate: toISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    },
    { enabled: isAuthenticated && !!recipeStringId }
  );
  
  // Memoize: 搵呢個食譜嘅所有排餐日期
  const allRecipeMealPlans = useMemo(() => {
    if (!mealPlansQ.data) return [];
    return mealPlansQ.data
      .filter((m: any) => m.recipeId === recipeStringId)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mealPlansQ.data, recipeStringId]);
  
  // 最近的一次排餐（用於快速顯示）
  const latestMealPlan = allRecipeMealPlans.length > 0 ? allRecipeMealPlans[0] : null;
  
  const shoppingListQ = trpc.shopping.list.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
    staleTime: 1000 * 30,
  });
  const shoppingItemsByName = useMemo(() => {
    const map: Record<string, any> = {};
    (shoppingListQ.data ?? []).forEach((item: any) => {
      if (!map[item.name]) map[item.name] = item;
    });
    return map;
  }, [shoppingListQ.data]);

  const currentShoppingDate = shoppingDate || (latestMealPlan ? getDayBefore(latestMealPlan.date) : toISODate(new Date()));

  const addedToCart = useMemo(() => {
    const items = (shoppingListQ.data ?? []) as any[];
    return items.some((item: any) => {
      if (item.status === "bought") return false;
      const itemDate = String(item.plannedDate ?? "").trim();
      if (itemDate !== currentShoppingDate) return false;
      const itemRecipeId = String(item.fromRecipeId ?? "").trim();
      const itemRecipeName = String(item.fromRecipeName ?? "").trim();
      return itemRecipeId === recipeStringId || (itemRecipeName && recipe?.name && itemRecipeName === recipe.name);
    });
  }, [shoppingListQ.data, currentShoppingDate, recipeStringId, recipe?.name]);

  // 呢個食譜喺購物清單入面嘅項目（by plannedDate 分組）
  const recipeShopping = useMemo(() => {
    const items = (shoppingListQ.data ?? []).filter(
      (i: any) =>
        (i.fromRecipeId === recipeStringId ||
          // 兜底：只有冇帶 fromRecipeId 嘅 item 先用食譜名 match（避免新食譜繼承舊食譜嘅項目）
          (!i.fromRecipeId && recipe?.name && i.fromRecipeName === recipe.name)) &&
        i.status !== "bought"
    );
    const groups: { date: string; items: any[] }[] = [];
    const map = new Map<string, any[]>();
    items.forEach((i: any) => {
      const d = i.plannedDate || "";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(i);
    });
    map.forEach((arr, d) => groups.push({ date: d, items: arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh")) }));
    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }, [shoppingListQ.data, recipeStringId, recipe?.name]);

  const visibleShopGroups = showAllShopping ? recipeShopping : recipeShopping.slice(0, 3);

   // 加入排餐後跳去購物清單選食材：已加入狀態要跟購物日期分開
   // 同一食譜如果係另一日再加入，唔應該因為舊日期而 cross 掉
  const planPickerAlreadyAdded = useMemo(() => {
    const added = new Set<string>();
    if (!planPickerRecipe || !shoppingListQ.data) return added;
    const targetRecipeId = planPickerRecipe.id;
    const targetMealPlanId = planPickerRecipe.fromMealPlanId;
    const targetDate = currentShoppingDate;
    (shoppingListQ.data as any[]).forEach((item: any) => {
      if (item.status === "bought") return;
      const itemName = String(item.name ?? "").trim();
      const itemMealPlanId = item.fromMealPlanId ? Number(item.fromMealPlanId) : null;
      const itemDate = String(item.plannedDate ?? "").trim();
      const itemRecipeId = String(item.fromRecipeId ?? "").trim();
      const itemRecipeName = String(item.fromRecipeName ?? "").trim();
      const isSameMealPlan = targetMealPlanId ? itemMealPlanId === targetMealPlanId : false;
      const isSameRecipeAndDate = itemDate === targetDate && (itemRecipeId === targetRecipeId || (planPickerRecipe.name && itemRecipeName === planPickerRecipe.name));
      if (!itemName || (!isSameMealPlan && !isSameRecipeAndDate)) return;
      (planPickerRecipe.ingredients || []).forEach((ing: any, idx: number) => {
        const nm = String(ing?.name ?? "").trim();
        if (nm && nm === itemName) added.add(`${planPickerRecipe.id}::${idx}`);
      });
    });
    return added;
  }, [planPickerRecipe, shoppingListQ.data, currentShoppingDate]);

  const savePriceM = (trpc as any).purchaseHistory.savePrice.useMutation({
    onSuccess: (_data: any, variables: any) => {
      utils.shopping.list.invalidate();
      if (variables?.itemName) {
        setIngredientPrices(prev => ({ ...prev, [variables.itemName]: variables.price }));
      }
      Alert.alert("已記錄", "購買價格已儲存到購物清單");
    },
    onError: (e: any) => Alert.alert("儲存失敗", e.message || "請檢查網絡連接"),
  });

  const getIngRecordedPrice = (ingName: string): number | null => {
    if (ingredientPrices[ingName]) return ingredientPrices[ingName];
    const shoppingItem = shoppingItemsByName[ingName];
    if (shoppingItem?.estimatedPrice) return shoppingItem.estimatedPrice;
    if (lastPricesMap[ingName]) return lastPricesMap[ingName];
    return null;
  };

  const handleSavePriceToShopping = (ingName: string, price: number, category?: string, unit?: string, quantity?: string) => {
    const existingItem = shoppingItemsByName[ingName];
    if (existingItem) {
      savePriceM.mutate({
        itemId: existingItem.id,
        itemName: ingName,
        price,
        category: category || existingItem.category || "其他",
        unit: unit || existingItem.unit || "",
        quantity: quantity || existingItem.quantity || "",
      });
    } else {
      const addM = trpc.shopping.add.useMutation({
        onSuccess: (newItem: any) => {
          if (newItem?.id) {
            savePriceM.mutate({
              itemId: newItem.id,
              itemName: ingName,
              price,
              category: category || "其他",
              unit: unit || "",
              quantity: quantity || "",
            });
          } else {
            utils.shopping.list.invalidate();
            setIngredientPrices(prev => ({ ...prev, [ingName]: price }));
            Alert.alert("已記錄", "價格已儲存");
          }
        },
        onError: (e: any) => Alert.alert("新增失敗", e.message),
      });
      addM.mutate({ name: ingName, category: category || "其他", unit: unit || "", quantity: quantity || "" });
    }
  };

  const ingredients = useMemo<any[]>(() => recipe?.ingredients ?? [], [recipe?.ingredients]);
  const steps = useMemo<any[]>(() => recipe?.steps ?? [], [recipe?.steps]);

  const allIngNames = useMemo(() => {
    const names = new Set<string>();
    ingredients.forEach((ing: any) => { if (ing.name) names.add(ing.name); });
    return Array.from(names);
  }, [ingredients]);
  const lastPricesQ = (trpc as any).shopping.lastPrices.useQuery(
    { itemNames: allIngNames },
    { enabled: isAuthenticated && !!user && allIngNames.length > 0 },
  );
  const lastPricesMap: Record<string, number> = lastPricesQ.data ?? {};
  
/**
 * Local image fallback removed — recipe covers are remote-first (R2).
 * Kept for API compatibility: getLocalImage always returns undefined in prod.
 */
  const getLocalImage = (_recipeName: string) => null;

  
  // Remote image from backend (R2) is PRIMARY; local require is only an offline fallback
  const remoteImageUrlRaw = (recipe as any)?.image || (recipe as any)?.thumbnailUrl || undefined;
  const remoteImageUrl = remoteImageUrlRaw ? resolveImageUrl(remoteImageUrlRaw) : "";
  const localImage = recipe && !remoteImageUrl ? getLocalImage(recipe.name) : null;
  const imgUrl = remoteImageUrl || "";
  const isUserRecipe = (recipe as any)?.source === "user";
  const sourceUrl = isValidHttpUrl((recipe as any)?.sourceUrl) ? (recipe as any).sourceUrl.trim() : null;
  const sourceAuthor = (recipe as any)?.sourceAuthor;
  const sourceAction = useMemo(() => {
    const url = (sourceUrl || "").toLowerCase();
    if (url.includes("instagram.com")) {
      return { icon: "logo-instagram" as const, label: "在 Instagram 觀看完整影片", bg: "#E1306C" };
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return { icon: "logo-youtube" as const, label: "在 YouTube 觀看完整影片", bg: "#FF0000" };
    }
    return { icon: "play-circle-outline" as const, label: "觀看教學影片", bg: "#6B7280" };
  }, [sourceUrl]);

  // Image cache props for aggressive offline caching
  const imageCacheProps = {
    contentFit: "cover" as const,
    cachePolicy: "memory-disk" as const,
    transition: 300,
  };
  const recipeNumericId = id ? (parseInt(id.replace("user_", "").replace("official_", ""), 10) || 0) : 0;
  const displayTags: string[] = (localTags ?? ((recipe as any)?.tags ?? [])).map((t: string) => t.trim()).filter(Boolean);

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
  const deleteRecipeImageM = trpc.recipes.deleteRecipeImage.useMutation({
    onError: (e) => console.error("[RecipeDetail] Failed to delete image:", e.message),
  });
  const deleteUserM = trpc.recipes.deleteUser.useMutation({
    onSuccess: async () => {
      // Cleanup image from R2 storage
      if (recipe?.image) {
        const imageKey = recipe.image.split('/').pop();
        if (imageKey) deleteRecipeImageM.mutate({ key: `recipe-thumbnails/${imageKey}` });
      }
      await invalidateRecipesAndWeekly();
      Alert.alert("已刪除", "食譜已從你的食譜庫刪除");
      router.back();
    },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });
  const deleteOfficialM = trpc.recipes.deleteOfficial.useMutation({
    onSuccess: () => {
      // Cleanup image from R2 storage
      if (recipe?.image) {
        const imageKey = recipe.image.split('/').pop();
        if (imageKey) deleteRecipeImageM.mutate({ key: `recipe-thumbnails/${imageKey}` });
      }
      utils.recipes.listOfficial.invalidate();
      Alert.alert("已刪除", "官方 AI 食譜已刪除");
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
        "刪除官方 AI 食譜",
        `確定要刪除官方 AI 食譜「${recipeName}」？此動作無法還原。`,
        [
          { text: "取消", style: "cancel" },
          { text: "刪除", style: "destructive", onPress: () => deleteOfficialM.mutate({ id: recipeNumericId }) },
        ]
      );
    }
  };

  // Mutations
  const updateTagsM = trpc.recipes.updateUser.useMutation({
    onSuccess: async (data: any) => {
      await invalidateRecipesAndWeekly();
      setLocalTags(data.tags ?? []);
      setShowTagEditor(false);
    },
    onError: (e: any) => Alert.alert("失敗", e.message),
  });
  const addPlanM = trpc.mealPlan.add.useMutation({
    onSuccess: (result) => {
      // 檢查排餐是否成功
      if (!result.newPlanId) {
        Alert.alert("排餐失敗", "請稍後再試", [{ text: "確定" }]);
        return;
      }
      
      const ings = adjustedIngredients
        .filter((ing: any) => !isPlaceholderIngredientName(ing?.name))
        .map((ing: any) => ({
          name: ing.name,
          quantity: ing.adjustedQty ?? ing.quantity ?? "",
          unit: ing.unit ?? "",
          category: ing.category ?? "食材",
        }));

      const continueFlow = () => {
        setShowPlan(false);
        if (ings.length > 0) {
          const shoppingDateForPlan = getDayBefore(planDate ?? toISODate(new Date()));
          setPlanPickerRecipe({
            id: recipeStringId,
            name: recipe?.name ?? "",
            ingredients: ings,
            date: planDate ?? undefined,
            fromMealPlanId: result.newPlanId,
          });
          setPlanPickerShoppingDate(shoppingDateForPlan);
        } else {
          Alert.alert("已加入排餐");
        }

        void utils.mealPlan.listByDateRange.invalidate();
      };

      // Check if there's a conflict (eatOut or duplicate recipe)
      if (result.warning && result.hasConflict) {
        const isEatOutConflict = result.warning.includes("外出");
        Alert.alert(
          isEatOutConflict ? "衝突提示" : "重複食譜提示",
          result.warning,
          [
            { text: "取消", style: "cancel", onPress: () => {
              if (result.newPlanId) {
                deleteMealM.mutate({ id: result.newPlanId });
              }
              setShowPlan(false);
              utils.mealPlan.listByDateRange.invalidate();
            }},
            { text: "確定", onPress: () => {
              continueFlow();
            }},
          ]
        );
      } else {
        continueFlow();
      }
    },
    onError: (e) => {
      Alert.alert("排餐失敗", e.message, [{ text: "確定" }]);
    },
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: (_, variables) => {
      setPlanPickerRecipe(null);
      setPlanPickerShoppingDate(null);
      const count = variables.items.length;
      const dateLabel = variables.plannedDate ? formatMealDate(variables.plannedDate) : "";
      setToast({ 
        visible: true, 
        message: `✅ ${count} 件食材已加入購物清單${dateLabel ? `，購買日：${dateLabel}` : ""}`, 
        type: "success" 
      });
      void Promise.all([
        utils.shopping.list.invalidate(),
        utils.mealPlan.listByDateRange.invalidate(),
      ]);
    },
    onError: (e) => {
      setToast({ visible: true, message: `加入食材失敗：${e.message}`, type: "error" });
    },
  });
  const updateItemM = trpc.shopping.updateItem.useMutation({
    onError: (e) => {
      setToast({ visible: true, message: `更新失敗：${e.message}`, type: "error" });
    },
  });

  // Adjusted ingredients based on serving ratio (must be before mutations that use it)
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

  const aiEditM = trpc.aiRecipe.previewEdit.useMutation({
    onSuccess: (data) => {
      setAIEditPreview(data);
      setAIEditResult(null);
    },
    onError: (e) => Alert.alert("AI Edit 失敗", e.message),
  });

  const saveEditedRecipeM = trpc.aiRecipe.saveEditedRecipe.useMutation({
    onSuccess: (data) => {
      setShowAIEdit(false);
      setAIEditPrompt("");
      setAIEditResult(null);
      setAIEditPreview(null);
      utils.recipes.listUser.invalidate();
      utils.recipes.search.invalidate();
      router.push({ pathname: "/recipe/[id]", params: { id: `user_${data.id}` } });
    },
    onError: (e) => Alert.alert("儲存失敗", e.message),
  });

  useFocusEffect(
    useCallback(() => {
      void mealPlansQ.refetch();
      void shoppingListQ.refetch();
    }, [mealPlansQ, shoppingListQ]),
  );

  // 修改購物車項目（同步食譜的購物項目）
  const handleModifyShopping = useCallback(() => {
    // 先準備食材清單
    const ings = adjustedIngredients.map((ing: any, i: number) => ({
      ...ing, _idx: i, _qty: String(ing.adjustedQty ?? ing.quantity ?? ""), _unit: ing.unit ?? "",
    }));
    setEditIngs(ings);
    const defaultSelected = new Set<number>();
    ings.forEach((_: any, i: number) => {
      if (!isSeasoning(_.name)) defaultSelected.add(i);
    });
    setSelectedIngs(defaultSelected);
    // 不重置 lastAddedShoppingDate，讓用戶在彈窗改日期
    setShowIngPicker(true);
  }, [adjustedIngredients]);

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
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: '',
          headerBackTitle: '',
          presentation: 'card',
        }} 
      />
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ─ Hero Image ── */}
          <View style={s.hero}>
            {(imgUrl || localImage) && !heroImgError ? (
              sourceUrl ? (
                // User imported recipe: make image clickable to open source URL
                <TouchableOpacity
                  style={{ width: SW, height: SW }}
                  onPress={() => openSourceUrl(sourceUrl)}
                  activeOpacity={0.85}
                >
                  {localImage
                    ? <ExpoImage source={localImage} style={s.heroImg} {...imageCacheProps} />
                    : <ExpoImage source={{ uri: imgUrl }} style={s.heroImg} {...imageCacheProps} onError={() => setHeroImgError(true)} />}
                </TouchableOpacity>
              ) : (
                localImage
                  ? <ExpoImage source={localImage} style={s.heroImg} {...imageCacheProps} />
                  : <ExpoImage source={{ uri: imgUrl }} style={s.heroImg} {...imageCacheProps} onError={() => setHeroImgError(true)} />
              )
            ) : (
              <View style={[s.heroImg, s.heroPlaceholder, { paddingHorizontal: 24 }]}>
                <Text style={{ fontSize: 28, fontWeight: "900", color: HINT, textAlign: "center", lineHeight: 34 }} numberOfLines={2}>
                  {recipe?.name || "食譜"}
                </Text>
              </View>
            )}
            {/* Back button */}
            <TouchableOpacity style={[s.heroBack, { backgroundColor: "rgba(255,255,255,0.9)" }]} onPress={handleBack}>
              <Ionicons name="chevron-back" size={22} color="#013E77" />
            </TouchableOpacity>
            {/* Collection button */}
            <View style={s.heroCollection}>
              {recipe && (
                <CollectionButton
                  recipeId={String(recipe.id)}
                  recipeType={recipe.source === "official" ? "official" : "custom"}
                  size="medium"
                />
              )}
            </View>
            {/* Share button */}
            <TouchableOpacity
              style={[s.heroShare, { backgroundColor: "rgba(255,255,255,0.9)" }]}
              onPress={() => {
                // 處理食材 - 使用 adjustedQty (已調整份量)
                const ingText = adjustedIngredients
                  .map((i: any) => {
                    const name = i.name ?? "未知食材";
                    const qty = i.adjustedQty ?? i.quantity ?? "";
                    const unit = i.unit ?? "";
                    return `• ${name}${qty ? ` ${qty}` : ""}${unit ? ` ${unit}` : ""}`;
                  })
                  .join("\n");
                
                // 處理步驟 - 支援多種屬性名稱，包含小貼士
                const stepText = steps
                  .map((s: any, i: number) => {
                    const instruction = typeof s === "string" 
                      ? s 
                      : (s.instruction ?? s.description ?? s.step ?? `步驟 ${i + 1}`);
                    const tip = s.tip ?? s.tips ?? "";
                    
                    let result = `${i + 1}. ${instruction}`;
                    if (tip) result += `\n   💡 ${tip}`;
                    return result;
                  })
                  .join("\n");
                
                // 組合完整分享文字
                const shareText = [
                  `🍽️ ${recipe?.name ?? "食譜"}`,
                  (recipe as any).description ? `${(recipe as any).description}` : "",
                  "",
                  recipe?.cookTime ? `⏱ ${recipe.cookTime} 分鐘` : "",
                  `👥 ${effectiveServings} 人份`,
                  (recipe as any).difficulty ? `📊 ${(recipe as any).difficulty}` : "",
                  "",
                  "📋 食材清單：",
                  ingText,
                  "",
                  "👨‍🍳 烹飪步驟：",
                  stepText,
                  "",
                  (recipe as any).housewifeTips ? `💡 主婦貼士：${(recipe as any).housewifeTips}` : "",
                  (recipe as any).tags && (recipe as any).tags.length > 0 
                    ? `🏷️ 標籤：${(recipe as any).tags.join(", ")}` 
                    : "",
                  "",
                  `— 來自 Kindcipe 家庭廚房`,
                ].filter(Boolean).join("\n");
                
                Share.share({ message: shareText, title: recipe?.name ?? "食譜" });
              }}
            >
              <Ionicons name="share-outline" size={20} color="#013E77" />
            </TouchableOpacity>
            {/* Recipe info overlay */}
            <View style={s.heroInfo}>
              {(recipe as any).source === "official" && (
                <View style={s.officialBadge}>
                  <Ionicons name="sparkles" size={11} color="#F59E0B" />
                  <Text style={s.officialTxt}>官方 AI 食譜</Text>
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
                    <Text style={s.metaChipTxt}>{effectiveServings} 人份</Text>
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
          {sourceUrl && sourceAuthor && (
            <TouchableOpacity
              style={s.sourceBar}
              onPress={() => openSourceUrl(sourceUrl)}
            >
              <View style={[s.sourceIcon, { backgroundColor: sourceAction.bg }]}>
                <Ionicons name={sourceAction.icon} size={14} color="#fff" />
              </View>
              <Text style={s.sourceText}>教學影片 by {sourceAuthor}</Text>
              <Text style={s.sourceLink}>查看 →</Text>
            </TouchableOpacity>
          )}

          <View style={{ paddingHorizontal: 16 }}>

            {/* ── Description ── */}
            {(recipe as any).description ? (
              <View style={s.descriptionCard}>
                <Text style={s.description}>{(recipe as any).description}</Text>
              </View>
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
                // 預設只勾非調味料（與 IngredientPickerModal 一致）
                const defaultSelected = new Set<number>();
                ings.forEach((_: any, i: number) => {
                  if (!isSeasoning(_.name)) defaultSelected.add(i);
                });
                setSelectedIngs(defaultSelected);
                
                // 智能判斷日期：預設為排餐日前一日（購物日），無排餐則為今日
                const defaultDate = latestMealPlan ? getDayBefore(latestMealPlan.date) : toISODate(new Date());
                setShoppingDate(defaultDate);
                setShowIngPicker(true);
              }}>
                <Ionicons name={addedToCart ? "checkmark-circle" : "cart-outline"} size={16} color={addedToCart ? GREEN : BRAND} />
                <Text style={[s.btnSecTxt, addedToCart && { color: GREEN }]}>{addedToCart ? "已加入" : "加入購買"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnAI} onPress={() => { setAIEditPrompt(""); setAIEditResult(null); setAIEditPreview(null); setShowAIEdit(true); }}>
                <Ionicons name="sparkles" size={14} color="#7C3AED" />
                <Text style={s.btnAITxt}>AI Edit</Text>
              </TouchableOpacity>
            </View>

            {/* 已加入購買提示 Banner */}
            {addedToCart && (
              <View style={s.addedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                <Text style={s.addedBannerText}>已加入購買</Text>
                {lastAddedShoppingDate && (
                  <>
                    <View style={s.addedBannerDivider} />
                    <Ionicons name="calendar-outline" size={14} color={GREEN} />
                    <Text style={s.addedBannerDate}>{formatMealDate(lastAddedShoppingDate)}</Text>
                  </>
                )}
                <TouchableOpacity style={s.addedBannerEdit} onPress={handleModifyShopping}>
                  <Ionicons name="create-outline" size={14} color={BRAND} />
                  <Text style={s.addedBannerEditText}>修改</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Meal Plan Display (Unified) ── */}
            {allRecipeMealPlans.length > 0 && (
              <View style={s.mealPlanCard}>
                <View style={s.mealPlanHeader}>
                  <Ionicons name="calendar-outline" size={16} color={BRAND} />
                  <Text style={s.mealPlanTitle}>📅 已排餐 ({allRecipeMealPlans.length} 次)</Text>
                </View>
                <View style={s.mealPlanList}>
                  {/* 默認顯示最近 3 次 */}
      {allRecipeMealPlans.slice(0, 3).map((plan: any, _idx: number) => {
                    const planDate = new Date(plan.date + "T00:00:00");
                    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][planDate.getDay()];
                    const mealTypeLabel = plan.mealType === "dinner" ? "晚餐" : plan.mealType === "lunch" ? "午餐" : plan.mealType === "breakfast" ? "早餐" : "小食";
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={s.mealPlanItem}
                        onPress={() => {
                          // 點擊日期→跳轉排餐頁
                          router.push("/(tabs)/planner");
                        }}
                      >
                        <View style={s.mealPlanDateBox}>
                          <Text style={s.mealPlanDate}>{planDate.getMonth() + 1}/{planDate.getDate()}</Text>
                          <Text style={s.mealPlanDay}>({dayOfWeek})</Text>
                        </View>
                        <Text style={s.mealPlanMealType}>{mealTypeLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* 展開更多 */}
                  {allRecipeMealPlans.length > 3 && (
                    <TouchableOpacity
                      style={s.mealPlanExpand}
                      onPress={() => {
                        // 展開顯示全部
                        setShowAllMealPlans(!showAllMealPlans);
                      }}
                    >
                      <Text style={s.mealPlanExpandText}>
                        {showAllMealPlans ? "收起" : `展開更多 (${allRecipeMealPlans.length - 3} 次)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* 顯示全部 */}
                  {showAllMealPlans && allRecipeMealPlans.slice(3).map((plan: any, _idx: number) => {
                    const planDate = new Date(plan.date + "T00:00:00");
                    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][planDate.getDay()];
                    const mealTypeLabel = plan.mealType === "dinner" ? "晚餐" : plan.mealType === "lunch" ? "午餐" : plan.mealType === "breakfast" ? "早餐" : "小食";
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={s.mealPlanItem}
                        onPress={() => {
                          router.push("/(tabs)/planner");
                        }}
                      >
                        <View style={s.mealPlanDateBox}>
                          <Text style={s.mealPlanDate}>{planDate.getMonth() + 1}/{planDate.getDate()}</Text>
                          <Text style={s.mealPlanDay}>({dayOfWeek})</Text>
                        </View>
                        <Text style={s.mealPlanMealType}>{mealTypeLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── 已加入購物清單 ── */}
            {recipeShopping.length > 0 && (
              <View style={s.mealPlanCard}>
                <View style={s.mealPlanHeader}>
                  <Ionicons name="cart-outline" size={16} color={BRAND} />
                  <Text style={s.mealPlanTitle}>🛒 已加入購物清單 ({recipeShopping.reduce((n, g) => n + g.items.length, 0)} 項)</Text>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/shopping")}>
                    <Text style={[s.btnAITxt, { color: BRAND }]}>去購物車</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.mealPlanList}>
                  {visibleShopGroups.map((g) => (
                    <View key={g.date || "none"} style={s.shopDateGroup}>
                      <View style={s.shopDateRow}>
                        <Ionicons name="calendar-outline" size={12} color="#013E77" />
                        <Text style={s.shopDateText}>{g.date ? formatMealDate(g.date) : "未設定日期"}</Text>
                        <Text style={s.shopDateCount}>{g.items.length} 項</Text>
                      </View>
                      {g.items.map((it) => (
                        <View key={it.id} style={s.shopItemRow}>
                          <Text style={s.shopItemName} numberOfLines={1}>{it.name}</Text>
                          {(it.quantity || it.unit) && (
                            <Text style={s.shopItemQty}>{it.quantity || ""}{it.unit ? ` ${it.unit}` : ""}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                  {recipeShopping.length > 3 && (
                    <TouchableOpacity style={s.mealPlanExpand} onPress={() => setShowAllShopping(!showAllShopping)}>
                      <Text style={s.mealPlanExpandText}>{showAllShopping ? "收起" : `展開更多 (${recipeShopping.length - 3} 組日期)`}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

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
                    const isScaled = ratio !== 1 && !NON_SCALABLE_CATS.has(ing.category ?? "");
                    const recordedPrice = getIngRecordedPrice(ing.name);
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
                        {recordedPrice !== null && (
                          <View style={s.ingPriceBadge}>
                            <Text style={s.ingPriceBadgeTxt}>${recordedPrice}</Text>
                          </View>
                        )}
                        <TouchableOpacity style={s.priceBtn} onPress={() => {
                          setPriceKw(ing.name);
                          setPriceIngCat(ing.category ?? "");
                          const existingPrice = recordedPrice;
                          setSavePriceInput(existingPrice ? String(existingPrice) : "");
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
                            <Image source={{ uri: stepImage }} style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 8 }} resizeMode="cover" onError={() => console.log('[RecipeDetail] Step image load failed, step', i + 1)} />
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
                      <Text style={s.noteAvatarTxt}>{((note.userName || "?")[0] ?? "?").toUpperCase()}</Text>
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
              <TouchableOpacity style={[s.igBtn, { backgroundColor: sourceAction.bg }]} onPress={() => openSourceUrl(sourceUrl)}>
                <Ionicons name={sourceAction.icon} size={18} color="#fff" />
                <Text style={s.igBtnTxt}>{sourceAction.label}</Text>
                {sourceAuthor && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>by {sourceAuthor}</Text>}
              </TouchableOpacity>
            )}

            {/* ── User Recipe Actions ── */}
            {isUserRecipe && (
              <View style={s.userActionsRow}>
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => router.push({ pathname: "/recipe-editor", params: { id: recipeNumericId } })}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={s.editBtnTxt}>編輯食譜</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={s.deleteBtnTxt}>刪除食譜</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Disclaimer ── */}
            <View style={s.disclaimerContainer}>
              <Text style={s.disclaimerText}>圖片及食譜只供參考</Text>
            </View>
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
              <PlanDatePicker value={planDate} onChange={setPlanDate} showShortcuts={true} minDate={DateUtil.todayISO()} />
              {planDate && (
                <TouchableOpacity 
                  onPress={() => setPlanDate(null)} 
                  style={{ alignSelf: "flex-end", marginTop: -8 }}
                >
                  <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>清除日期</Text>
                </TouchableOpacity>
              )}
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
                onPress={() => {
                  if (!planDate) {
                    Alert.alert("日期無效", "請選擇排餐日期", [{ text: "確定" }]);
                    return;
                  }
                  addPlanM.mutate({
                    date: planDate,
                    mealType: planMeal as any,
                    recipeId: recipeStringId,
                    recipeName: recipe.name,
                    recipeImage: remoteImageUrl,
                    autoAddIngredients: false,
                  });
                }}
                disabled={addPlanM.isPending}
              >
                {addPlanM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnTxt}>確認加入</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Price comparison modal (shared component) ─ */}
        <PriceCompareModal
          visible={showPrice}
          keyword={priceKw}
          onClose={() => { setShowPrice(false); setPriceKw(""); setSavePriceInput(""); }}
          renderFooter={({ keyword, results, selectedResultIdx: _selIdx }) => {
            const kw = keyword;
            const handleUseLowestPrice = () => {
              if (!results || results.length === 0) return;
              const selectedResult = results[_selIdx] ?? results[0];
              const sortedPrices = [...(selectedResult?.prices ?? [])]
                .filter((p: any) => !isNaN(Number(p.price)) && Number(p.price) > 0)
                .sort((a: any, b: any) => Number(a.price) - Number(b.price));
              if (sortedPrices.length > 0) {
                setSavePriceInput(String(Math.round(Number(sortedPrices[0].price))));
              }
            };
            return (
                <View style={{ backgroundColor: "#F9FAFB", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Ionicons name="cart-outline" size={14} color={BRAND} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>記錄購買價格到購物清單</Text>
                  </View>

                {(() => {
                  const existingItem = shoppingItemsByName[kw];
                  const lastPrice = lastPricesMap[kw];
                  const sessionPrice = ingredientPrices[kw];
                  return (
                    <>
                      {existingItem?.estimatedPrice && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, padding: 8, backgroundColor: "#EEF4FB", borderRadius: 8 }}>
                          <Ionicons name="information-circle-outline" size={12} color={BRAND} />
                          <Text style={{ fontSize: 11, color: BRAND }}>購物清單已有價格：${existingItem.estimatedPrice}</Text>
                        </View>
                      )}
                      {lastPrice && !sessionPrice && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, padding: 8, backgroundColor: "#FFFBEB", borderRadius: 8 }}>
                          <Ionicons name="time-outline" size={12} color="#92400E" />
                          <Text style={{ fontSize: 11, color: "#92400E" }}>上次記錄價格：${lastPrice}</Text>
                        </View>
                      )}
                      {sessionPrice && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, padding: 8, backgroundColor: "#DCFCE7", borderRadius: 8 }}>
                          <Ionicons name="checkmark-circle-outline" size={12} color="#15803D" />
                          <Text style={{ fontSize: 11, color: "#15803D", fontWeight: "600" }}>本次已記錄價格：${sessionPrice}</Text>
                        </View>
                      )}
                    </>
                  );
                })()}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 12, color: SUB }}>價格</Text>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: "600", color: TEXT }}
                    placeholder="輸入價格"
                    placeholderTextColor={SUB}
                    value={savePriceInput}
                    onChangeText={setSavePriceInput}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: "#E8F0FA", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#BFDBFE" }}
                    onPress={handleUseLowestPrice}
                  >
                    <Text style={{ fontSize: 11, color: BRAND, fontWeight: "700" }}>最低價</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={{ marginTop: 10, backgroundColor: BRAND, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
                  onPress={() => {
                    const price = parseInt(savePriceInput.trim(), 10);
                    if (isNaN(price) || price <= 0) { Alert.alert("請輸入有效價格"); return; }
                    const currentIng = ingredients.find((ing: any) => ing.name === kw);
                    handleSavePriceToShopping(
                      kw,
                      price,
                      priceIngCat || currentIng?.category || "其他",
                      currentIng?.unit || "",
                      currentIng?.quantity || "",
                    );
                  }}
                  disabled={savePriceM.isPending}
                >
                  {savePriceM.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                      {shoppingItemsByName[kw] ? "更新購物清單價格" : "儲存並加入購物清單"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
        {/* ── Tag editor modal ── */}
        <Modal visible={showTagEditor} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
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
          </KeyboardAvoidingView>
        </Modal>

        {/* ── AI Edit modal ── */}
        <Modal visible={showAIEdit} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
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
                {["改成素食版", "翻譯成英文", "簡化步驟", "低卡路里版", "高蛋白版", "無蛋奶過敏版", "無麩質版", "小朋友啱食版", "老人家軟腍版", "用平價食材版", "蒸焗爐版", "電飯煲版"].map(p => (
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
                  if (!recipe) return;
                  setAIEditPreview(null);
                  setAIEditResult(null);
                  aiEditM.mutate({
                    editPrompt: aiEditPrompt,
                    recipe: {
                      name: recipe.name,
                      description: (recipe as any).description ?? "",
                      image: (recipe as any).image ?? "",
                      thumbnailUrl: (recipe as any).thumbnailUrl ?? (recipe as any).image ?? "",
                      cookTime: recipe.cookTime ?? undefined,
                      servings: recipe.servings ?? undefined,
                      difficulty: (recipe as any).difficulty ?? "",
                      recipeCategory: (recipe as any).recipeCategory ?? "",
                      ingredients: ingredients.map((i: any) => ({
                        name: i.name,
                        quantity: i.quantity ?? "",
                        unit: i.unit ?? "",
                        category: i.category ?? "",
                      })),
                      steps: steps.map((s: any) => ({
                        instruction: typeof s === "string" ? s : (s.instruction ?? ""),
                        duration: typeof s === "string" ? 0 : (s.duration ?? 0),
                        tip: typeof s === "string" ? "" : (s.tip ?? ""),
                      })),
                      tags: Array.isArray((recipe as any).tags) ? (recipe as any).tags : [],
                      sourceAuthor: (recipe as any).sourceAuthor ?? "",
                    },
                  });
                }}
                disabled={aiEditM.isPending || !aiEditPrompt.trim()}
              >
                {aiEditM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={16} color="#fff" />}
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{aiEditM.isPending ? "處理中..." : "開始 AI Edit"}</Text>
              </TouchableOpacity>
              {(aiEditResult || aiEditPreview) && (
                <View style={{ gap: 10 }}>
                  <ScrollView style={{ backgroundColor: "#FAFAFA", borderRadius: 12, padding: 12, maxHeight: 200, borderWidth: 1, borderColor: "#E5E7EB" }}>
                    {aiEditPreview ? (
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 14, color: TEXT, fontWeight: "800" }}>{aiEditPreview.name}</Text>
                        {!!aiEditPreview.description && (
                          <Text style={{ fontSize: 12, color: SUB, lineHeight: 18 }}>{aiEditPreview.description}</Text>
                        )}
                        {(aiEditPreview.ingredients || []).length > 0 && (
                          <>
                            <Text style={{ fontSize: 12, color: BRAND, fontWeight: "700", marginTop: 4 }}>食材（{(aiEditPreview.ingredients || []).length}）</Text>
                            {(aiEditPreview.ingredients || []).map((ing: any, ingIdx: number) => (
                              <Text key={ingIdx} style={{ fontSize: 12, color: TEXT, lineHeight: 18 }}>
                                • {ing.name}{formatIngredientDisplay(ing.quantity, ing.unit) ? ` ${formatIngredientDisplay(ing.quantity, ing.unit)}` : ""}
                              </Text>
                            ))}
                          </>
                        )}
                        {(aiEditPreview.steps || []).length > 0 && (
                          <>
                            <Text style={{ fontSize: 12, color: BRAND, fontWeight: "700", marginTop: 4 }}>步驟（{(aiEditPreview.steps || []).length}）</Text>
                            {(aiEditPreview.steps || []).map((s: any, sIdx: number) => {
                              const instruction = typeof s === "string" ? s : (s.instruction ?? "");
                              return (
                                <Text key={sIdx} style={{ fontSize: 12, color: TEXT, lineHeight: 18 }}>
                                  {sIdx + 1}. {instruction}
                                </Text>
                              );
                            })}
                          </>
                        )}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: TEXT, lineHeight: 21 }}>{aiEditResult}</Text>
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    style={{ backgroundColor: BRAND, paddingVertical: 13, borderRadius: 12, alignItems: "center", opacity: saveEditedRecipeM.isPending ? 0.6 : 1 }}
                    onPress={() => {
                      if (!recipe || saveEditedRecipeM.isPending) return;
                      saveEditedRecipeM.mutate({
                        editPrompt: aiEditPrompt,
                        recipe: {
                          name: aiEditPreview?.name ?? recipe.name,
                          description: (aiEditPreview as any)?.description ?? (recipe as any).description ?? "",
                           image: "",
                           thumbnailUrl: "",
                          cookTime: aiEditPreview?.cookTime ?? recipe.cookTime ?? undefined,
                          servings: aiEditPreview?.servings ?? recipe.servings ?? undefined,
                          difficulty: (aiEditPreview as any)?.difficulty ?? (recipe as any).difficulty ?? "",
                          recipeCategory: (aiEditPreview as any)?.recipeCategory ?? (recipe as any).recipeCategory ?? "",
                          ingredients: ingredients.map((i: any) => ({
                            name: i.name,
                            quantity: i.quantity ?? "",
                            unit: i.unit ?? "",
                            category: i.category ?? "",
                          })),
                          steps: steps.map((s: any) => ({
                            instruction: typeof s === "string" ? s : (s.instruction ?? ""),
                            duration: typeof s === "string" ? 0 : (s.duration ?? 0),
                            tip: typeof s === "string" ? "" : (s.tip ?? ""),
                          })),
                          tags: Array.isArray((recipe as any).tags) ? (recipe as any).tags : [],
                          sourceAuthor: (recipe as any).sourceAuthor ?? "",
                        },
                      });
                    }}
                    disabled={saveEditedRecipeM.isPending}
                  >
                    {saveEditedRecipeM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>儲存為我的食譜</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Ingredient Picker Modal ── */}
        <Modal visible={showIngPicker} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.ingPickerSheet}>
              <View style={s.ingPickerHeader}>
                <Text style={s.ingPickerTitle}>選擇食材加入購物清單</Text>
                <TouchableOpacity onPress={() => setShowIngPicker(false)}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: BRAND }}>取消</Text>
                </TouchableOpacity>
              </View>
              
              {/* 日期選擇器 - 永遠直接顯示可編輯 */}
              <View style={s.datePickerRow}>
                <Ionicons name="calendar-outline" size={16} color={SUB} />
                <Text style={s.datePickerLabel}>購物日期：</Text>
                <PlanDatePicker
                  value={shoppingDate}
                  onChange={setShoppingDate}
                  maxDate={latestMealPlan?.date ?? undefined}
                  minDate={DateUtil.todayISO()}
                  showShortcuts={true}
                />
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                  ⚠️ 購買日期唔可以遲過排餐日（{latestMealPlan ? formatMealDate(latestMealPlan.date) : ""}）
                </Text>
              </View>
              {shoppingDate && (
                <TouchableOpacity 
                  onPress={() => setShoppingDate(null)} 
                  style={{ alignSelf: "flex-end", marginTop: -8, marginRight: 16 }}
                >
                  <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>清除日期</Text>
                </TouchableOpacity>
              )}
              {latestMealPlan && (
                <View style={s.dateHintRow}>
                  <Ionicons name="information-circle-outline" size={12} color={SUB} />
                  <Text style={s.dateHintText}>已關聯 {latestMealPlan.date} 晚餐，建議購買日為前一日</Text>
                </View>
              )}
              {latestMealPlan && shoppingDate && shoppingDate > latestMealPlan.date && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 16 }}>
                  <Ionicons name="warning" size={14} color="#DC2626" />
                  <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600" }}>
                    ⚠️ 購買日期（{shoppingDate}）晚於排餐日期（{latestMealPlan.date}）
                  </Text>
                </View>
              )}
              
              {/* 快捷鍵：全選主要食材／全選／取消 */}
              <View style={s.quickActionsRow}>
                <TouchableOpacity style={s.quickBtn} onPress={() => {
                  const newSet = new Set<number>();
                  editIngs.forEach((ing: any, i: number) => {
                    if (!isSeasoning(ing.name)) newSet.add(i);
                  });
                  setSelectedIngs(newSet);
                }}>
                  <Ionicons name="checkmark-done" size={14} color={BRAND} />
                  <Text style={s.quickBtnText}>全選主要食材</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn} onPress={() => {
                  const newSet = new Set<number>();
                  editIngs.forEach((_: any, i: number) => newSet.add(i));
                  setSelectedIngs(newSet);
                }}>
                  <Ionicons name="checkmark" size={14} color={BRAND} />
                  <Text style={s.quickBtnText}>全選</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn} onPress={() => setSelectedIngs(new Set())}>
                  <Ionicons name="close" size={14} color={SUB} />
                  <Text style={[s.quickBtnText, { color: SUB }]}>取消</Text>
                </TouchableOpacity>
              </View>
              <View style={s.seasoningHintRow}>
                <Text style={s.seasoningHintText}>（調味料如家中常備可不勾）</Text>
                <Text style={s.seasoningHintText}>勾選的項目將被更新，未勾選的保持原狀</Text>
              </View>
              
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
                {editIngs.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <Ionicons name="information-circle-outline" size={48} color={SUB} />
                    <Text style={{ fontSize: 14, color: SUB, marginTop: 12 }}>沒有食材資料</Text>
                  </View>
                ) : (
                  editIngs.map((ing: any, i: number) => (
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
                      <Text style={s.ingPickerName} numberOfLines={1}>{ing.name}</Text>
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
                  ))
                )}
              </ScrollView>
              <View style={{ padding: 16 }}>
                <TouchableOpacity
                  style={s.ingPickerConfirm}
                  onPress={async () => {
                      // 情況 1 驗證：有排餐時，購買日期不能遲於排餐日
                    if (!shoppingDate) {
                      Alert.alert("日期無效", "請選擇購物日期", [{ text: "確定" }]);
                      return;
                    }
                    if (latestMealPlan && shoppingDate > latestMealPlan.date) {
                      Alert.alert(
                        "日期無效",
                        `購買日期（${shoppingDate}）不能遲於排餐日期（${latestMealPlan.date}）\n\n建議選擇 ${getDayBefore(latestMealPlan.date)} 或更早的日期`,
                        [{ text: "確定" }]
                      );
                      return;
                    }
                    
                    const selectedItems = editIngs
                      .filter((_: any, i: number) => selectedIngs.has(i))
                      .map((ing: any) => ({
                        name: ing.name,
                        quantity: ing._qty,
                        unit: ing._unit,
                        category: ing.category || "食材",
                      }));
                    
                    if (selectedItems.length === 0) {
                      setToast({ visible: true, message: "未選擇任何食材", type: "info" });
                      setShowIngPicker(false);
                      return;
                    }
                    
                    // 同步邏輯（方案 A）：只更新勾選項目，不刪除未勾選的
                    // 未勾選 = 保持原狀，不處理
                    const existingItems = (shoppingListQ.data ?? []).filter(
                      (item: any) =>
                        item.fromRecipeId === recipeStringId &&
                        item.status !== "bought" &&
                        String(item.plannedDate ?? "").trim() === String(shoppingDate ?? "").trim()
                    );
                    
                    const toUpdate: { id: number; name: string; quantity: string; unit: string; plannedDate: string }[] = [];
                    const toAdd: typeof selectedItems = [];
                    
                    // 建立現有項目的映射，方便查找
                    const existingMap = new Map<string, any>();
                    existingItems.forEach((item: any) => {
                      existingMap.set(`${String(item.name ?? "").trim()}::${String(item.unit ?? "").trim()}::${String(item.plannedDate ?? "").trim()}`, item);
                    });
                    
                    // 處理勾選的項目：更新或新增
                    for (const selected of selectedItems) {
                      const key = `${String(selected.name ?? "").trim()}::${String(selected.unit ?? "").trim()}::${String(shoppingDate ?? "").trim()}`;
                      const existing = existingMap.get(key);
                      if (existing) {
                        // 已存在 → 更新
                        toUpdate.push({
                          id: existing.id,
                          name: selected.name,
                          quantity: selected.quantity,
                          unit: selected.unit,
                          plannedDate: shoppingDate,
                        });
                      } else {
                        // 不存在 → 新增
                        toAdd.push(selected);
                      }
                    }
                    
                    // 執行：先更新，再新增
                    try {
                      const updatePromises = toUpdate.map((u) =>
                        updateItemM.mutateAsync({
                          id: u.id,
                          name: u.name,
                          quantity: u.quantity,
                          unit: u.unit,
                          plannedDate: u.plannedDate,
                        })
                      );
                      await Promise.all(updatePromises);
                      
                      if (toAdd.length > 0) {
                        setLastAddedShoppingDate(shoppingDate);
                        addShoppingM.mutate({
                          items: toAdd,
                          fromRecipeId: recipeStringId,
                          fromRecipeName: recipe.name,
                          fromMealPlanId: latestMealPlan?.id,
                          plannedDate: shoppingDate,
                        });
                      } else {
                        // 沒有新增，只更新了現有項目
                        setLastAddedShoppingDate(shoppingDate);
                        // 延遲關閉 Modal，然後顯示成功提示（避免被 Modal 擋住）
                        setTimeout(() => {
                          utils.shopping.list.invalidate();
                          setShowIngPicker(false);
                          setToast({
                            visible: true,
                            message: toUpdate.length > 0 
                              ? `✅ 已更新 ${toUpdate.length} 項食材` 
                              : `✅ 已更新購買日：${formatMealDate(shoppingDate)}`,
                            type: "success",
                          });
                        }, 1500);
                        return; // 提前返回，避免重複執行
                      }
                      
                      // 刷新購物清單
                      utils.shopping.list.invalidate();
                      setShowIngPicker(false);
                    } catch (e: any) {
                      setToast({
                        visible: true,
                        message: `修改失敗：${e.message}`,
                        type: "error",
                      });
                    }
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

        <IngredientPickerModal
          visible={!!planPickerRecipe}
          recipes={planPickerRecipe ? [planPickerRecipe] : []}
          loading={addShoppingM.isPending}
          defaultDate={planPickerRecipe?.date ? getDayBefore(planPickerRecipe.date) : undefined}
          maxDate={planPickerRecipe?.date}
          onDateChange={setPlanPickerShoppingDate}
          alreadyAddedKeys={planPickerAlreadyAdded}
          onConfirm={(items) => {
            if (items.length > 0) {
              setLastAddedShoppingDate(items[0].plannedDate || toISODate(new Date()));
              addShoppingM.mutate({
                items: items.map((i) => ({
                  name: i.name,
                  quantity: i.quantity,
                  unit: i.unit,
                  category: i.category,
                })),
                fromRecipeId: items[0].recipeId,
                fromRecipeName: items[0].recipeName,
                fromMealPlanId: items[0].fromMealPlanId,
                plannedDate: items[0].plannedDate,
              });
            } else {
              setPlanPickerRecipe(null);
              setPlanPickerShoppingDate(null);
              setToast({ visible: true, message: "排餐已記錄", type: "info" });
            }
          }}
          onSkip={() => {
            setPlanPickerRecipe(null);
            setPlanPickerShoppingDate(null);
            setToast({ visible: true, message: "已跳過食材", type: "info" });
          }}
        />

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
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
  heroBack: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  heroCollection: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, right: 64, alignItems: "center", justifyContent: "center" },
  heroShare: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  heroInfo: { position: "absolute", bottom: 16, left: 16, right: 16 },
  sourceLinkOverlay: { position: "absolute", bottom: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  sourceLinkOverlayText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  officialBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, alignSelf: "flex-start", marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  officialTxt: { fontSize: 12, fontWeight: "700", color: "#1C2E4A", letterSpacing: 0.5 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 6, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  heroMeta: { flexDirection: "row", gap: 6 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  metaChipTxt: { fontSize: 12, fontWeight: "600", color: "#1C2E4A" },

  // Source bar
  sourceBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#F9F0FF" },
  sourceIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: "#E1306C", alignItems: "center", justifyContent: "center" },
  sourceText: { flex: 1, fontSize: 13, color: "#1C1C1E", fontWeight: "600" },
  sourceLink: { fontSize: 12, color: BRAND, fontWeight: "700" },

  // Description
  descriptionCard: { backgroundColor: "#FAFAFA", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12, marginBottom: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  description: { fontSize: 14, color: SUB, lineHeight: 21 },

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

  // Meal Plan Card
  mealPlanCard: { backgroundColor: "#F8FAFC", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: BRAND },
  mealPlanHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  mealPlanTitle: { fontSize: 15, fontWeight: "800", color: BRAND },
  mealPlanList: { gap: 6 },
  mealPlanItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  mealPlanDateBox: { alignItems: "center" },
  mealPlanDate: { fontSize: 13, fontWeight: "800", color: TEXT },
  mealPlanDay: { fontSize: 10, color: SUB },
  mealPlanMealType: { flex: 1, fontSize: 13, fontWeight: "600", color: TEXT },
  mealPlanRemove: { padding: 4 },
  mealPlanExpand: { paddingVertical: 8, alignItems: "center" },
  mealPlanExpandText: { fontSize: 12, fontWeight: "700", color: BRAND },
  shopDateGroup: { backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  shopDateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  shopDateText: { fontSize: 12, fontWeight: "700", color: "#013E77", flex: 1 },
  shopDateCount: { fontSize: 11, color: SUB },
  shopItemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shopItemName: { flex: 1, fontSize: 13, color: TEXT },
  shopItemQty: { fontSize: 12, color: SUB },

  // Tips
  tipsCard: { backgroundColor: "#FFFBEB", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
  tipsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  tipsTitle: { fontSize: 14, fontWeight: "800", color: "#92400E" },
  tipsTxt: { fontSize: 13, color: "#78350F", lineHeight: 20 },

  // Cooking Tips Card
  cookingTipsCard: { backgroundColor: "#FEF3C7", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
  tipsCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  cookingTipsTitle: { fontSize: 15, fontWeight: "800", color: "#92400E" },
  tipsList: { gap: 6 },
  tipItem: { flexDirection: "row", gap: 6 },
  tipItemTxt: { fontSize: 13, color: "#78350F", lineHeight: 20, flex: 1 },

  // Safety Card
  safetyCard: { backgroundColor: "#FEF2F2", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#EF4444" },
  safetyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  safetyTitle: { fontSize: 15, fontWeight: "800", color: "#991B1B" },
  safetyList: { gap: 6 },
  safetyItem: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  safetyItemTxt: { fontSize: 13, color: "#991B1B", lineHeight: 20, flex: 1 },

  // Alternative Methods Card
  alternativeCard: { backgroundColor: "#ECFEFF", marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#06B6D4" },
  alternativeHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  alternativeTitle: { fontSize: 15, fontWeight: "800", color: "#164E63" },
  altMethod: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#06B6D4" },
  altMethodTitle: { fontSize: 14, fontWeight: "700", color: "#0E7490", marginBottom: 4 },
  altMethodTxt: { fontSize: 13, color: "#155E75", lineHeight: 18 },

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
  ingPriceBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#BBF7D0" },
  ingPriceBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#15803D" },
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

  // User recipe actions
  userActionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  editBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 16, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  editBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FEE2E2", borderWidth: 1.5, borderColor: "#FCA5A5", paddingVertical: 14, borderRadius: 16 },
  deleteBtnTxt: { fontSize: 14, fontWeight: "700", color: "#EF4444" },

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
  platformRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  goBuyBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#1A1A1A" },

  // Ingredient picker
  ingPickerSheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "75%", maxHeight: "80%", paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  ingPickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  ingPickerTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  dateInfoRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    backgroundColor: "#DCFCE7", 
    borderBottomWidth: 1, 
    borderBottomColor: BORDER 
  },
  dateInfoText: { fontSize: 13, color: SUB },
  dateInfoValue: { fontSize: 13, fontWeight: "600", color: GREEN },
  datePickerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: BORDER 
  },
  datePickerLabel: { fontSize: 13, color: SUB },
  dateHintRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 20, paddingVertical: 6, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: BORDER },
  dateHintText: { fontSize: 11, color: SUB },
  quickActionsRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: BORDER },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#E8F0FE" },
  quickBtnText: { fontSize: 12, fontWeight: "600", color: BRAND },
  seasoningHintRow: { paddingHorizontal: 20, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  seasoningHintText: { fontSize: 11, color: SUB, fontStyle: "italic" },
  addedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 10, marginTop: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  addedBannerText: { fontSize: 13, fontWeight: "700", color: GREEN },
  addedBannerDivider: { width: 1, height: 14, backgroundColor: "#86EFAC" },
  addedBannerDate: { fontSize: 12, fontWeight: "600", color: GREEN },
  addedBannerEdit: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#EFF6FF" },
  addedBannerEditText: { fontSize: 12, fontWeight: "600", color: BRAND },
  ingPickerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  ingPickerCheck: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  ingPickerDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BRAND, alignItems: "center", justifyContent: "center" },
  ingPickerDotActive: { backgroundColor: BRAND },
  ingPickerName: { flex: 1, fontSize: 14, color: TEXT, minWidth: 0 },
  ingPickerQtyInput: { width: 60, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: TEXT, textAlign: "center" as any },
  ingPickerConfirm: { backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ingPickerConfirmTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  disclaimerContainer: {
    alignItems: "center" as any,
    justifyContent: "center" as any,
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center" as any,
  },
});
