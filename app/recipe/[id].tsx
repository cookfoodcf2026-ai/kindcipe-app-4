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
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import UnitPicker from "@/src/components/UnitPicker";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import IngredientPickerModal from "@/src/components/IngredientPickerModal";
import Toast from "@/src/components/Toast";
import type { PickerRecipe } from "@/src/components/IngredientPickerModal";
import { COOKING_TERMS, COOKING_TERM_LIST } from "@/lib/cookingTerms";
import CookingTermTooltip from "@/app/components/CookingTermTooltip";
import PriceCompareModal from "@/src/components/PriceCompareModal";
import { isSeasoning, calcAdjustedQty, NON_SCALABLE_CATS } from "@/constants/ingredients";

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

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const WEEKDAYS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

function formatPlannedDate(dateStr: string): string {
  const today = toISODate(new Date());
  const tomorrow = toISODate(new Date(Date.now() + 86400000));
  
  if (dateStr === today) return "今日";
  if (dateStr === tomorrow) return "聽日";
  
  const date = new Date(dateStr + "T00:00:00");
  return `${WEEKDAYS[date.getDay()]} (${dateStr.slice(5).replace("-", "/")})`;
}

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
  const [autoAddCart, setAutoAddCart] = useState(true);
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
  // Added to cart feedback
  const [addedToCart, setAddedToCart] = useState(false);
  const [lastAddedShoppingDate, setLastAddedShoppingDate] = useState<string | null>(null);
  // Ingredient picker for add-to-cart
  const [showIngPicker, setShowIngPicker] = useState(false);
  const [editIngs, setEditIngs] = useState<any[]>([]);
  const [selectedIngs, setSelectedIngs] = useState<Set<number>>(new Set());
  const [shoppingDate, setShoppingDate] = useState<string | null>(() => toISODate(new Date()));
  const [showShoppingDatePicker, setShowShoppingDatePicker] = useState(false);
  // Ingredient picker after addPlanM success
  const [planPickerRecipe, setPlanPickerRecipe] = useState<PickerRecipe | null>(null);
  const autoAddCartRef = useRef(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({ visible: false, message: "", type: "success" });
  const [showAllMealPlans, setShowAllMealPlans] = useState(false);
  // Track hero image load error to fall back to placeholder
  const [heroImgError, setHeroImgError] = useState(false);
  const deleteMealM = trpc.mealPlan.delete.useMutation({
    onSuccess: () => {
      utils.mealPlan.listByDateRange.invalidate();
      setToast({ visible: true, message: "已移除排餐", type: "success" });
    },
    onError: (e: any) => setToast({ visible: true, message: `移除失敗：${e.message}`, type: "error" }),
  });

  // 返回：若烹飪備註有未送出嘅文字，先提醒用戶
  const handleBack = () => {
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
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [noteInput]);

  const utils = trpc.useUtils();

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

  const savePriceM = (trpc as any).shopping.savePrice.useMutation({
    onSuccess: (_data: any, variables: any) => {
      utils.shopping.list.invalidate();
      if (variables?.itemName) {
        setIngredientPrices(prev => ({ ...prev, [variables.itemName]: variables.price }));
      }
      Alert.alert("已記錄", "價格已儲存到購物清單");
    },
    onError: (e: any) => Alert.alert("儲存失敗", e.message),
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

  const ingredients: any[] = recipe?.ingredients ?? [];
  const steps: any[] = recipe?.steps ?? [];

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
  
  // Check for local image
  const getLocalImage = (recipeName: string) => {
    const nameMap: Record<string, any> = {
      '番茄炒蛋': require('@/assets/recipes/scrambled-eggs-tomatoes.png'),
      '蒜蓉炒菜心': require('@/assets/recipes/garlic-choy-sum.png'),
      '紅燒肉': require('@/assets/recipes/braised-pork-belly.png'),
      '宮保雞丁': require('@/assets/recipes/kung-pao-chicken.png'),
      '麻婆豆腐': require('@/assets/recipes/mapo-tofu.png'),
      '糖醋排骨': require('@/assets/recipes/sweet-sour-ribs.png'),
      '清蒸鱸魚': require('@/assets/recipes/steamed-sea-bass.png'),
      '豉油王炒麵': require('@/assets/recipes/soy-sauce-noodles.png'),
      '臘味煲仔飯': require('@/assets/recipes/claypot-rice.png'),
      '紅蘿蔔粟米豬骨湯': require('@/assets/recipes/carrot-corn-soup.png'),
      '回鍋肉': require('@/assets/recipes/twice-cooked-pork.png'),
      '干煸四季豆': require('@/assets/recipes/dry-fried-beans.png'),
      '蝦仁炒蛋': require('@/assets/recipes/shrimp-scrambled-eggs.png'),
      '梅菜扣肉': require('@/assets/recipes/preserved-vegetable-pork.png'),
      '薑蔥蒸雞': require('@/assets/recipes/steamed-chicken.png'),
      '魚香茄子': require('@/assets/recipes/fish-fragrant-eggplant.png'),
      '腐乳通菜': require('@/assets/recipes/fermented-water-spinach.png'),
      '鹽焗雞翼': require('@/assets/recipes/salt-baked-wings.png'),
      '蠔油冬菇炆雞': require('@/assets/recipes/braised-chicken-mushroom.png'),
      '榨菜肉絲湯米粉': require('@/assets/recipes/rice-noodle-soup.png'),
      '原味蒸肉餅': require('@/assets/recipes/原味蒸肉餅.png'),
      '咸蛋蒸肉餅': require('@/assets/recipes/咸蛋蒸肉餅.png'),
      '梅菜蒸肉餅': require('@/assets/recipes/梅菜蒸肉餅.png'),
      '魷魚絲蒸肉餅': require('@/assets/recipes/魷魚絲蒸肉餅.png'),
      '馬蹄土魷蒸肉餅': require('@/assets/recipes/馬蹄土魷蒸肉餅.png'),
      '冬菇蒸雞': require('@/assets/recipes/冬菇蒸雞.png'),
      '雲耳勝瓜蒸雞': require('@/assets/recipes/雲耳勝瓜蒸雞.png'),
      '蟲草花蒸雞': require('@/assets/recipes/蟲草花蒸雞.png'),
      '豉汁蒸排骨': require('@/assets/recipes/豉汁蒸排骨.png'),
      '南瓜蒸排骨': require('@/assets/recipes/南瓜蒸排骨.png'),
      '榨菜蒸牛肉': require('@/assets/recipes/榨菜蒸牛肉.png'),
      '陳皮蒸牛肉球': require('@/assets/recipes/陳皮蒸牛肉球.png'),
      '清蒸海上鮮': require('@/assets/recipes/清蒸海上鮮.png'),
      '豉汁蒸鯇魚': require('@/assets/recipes/豉汁蒸鯇魚.png'),
      '薑蔥蒸魚雲': require('@/assets/recipes/薑蔥蒸魚雲.png'),
      '豉汁蒸生蠔': require('@/assets/recipes/豉汁蒸生蠔.png'),
      '蒜蓉粉絲蒸生蠔': require('@/assets/recipes/蒜蓉粉絲蒸生蠔.png'),
      '蒜蓉粉絲蒸大蝦': require('@/assets/recipes/蒜蓉粉絲蒸大蝦.png'),
      '蒜蓉粉絲蒸帶子': require('@/assets/recipes/蒜蓉粉絲蒸帶子.png'),
      '蒸三色蛋': require('@/assets/recipes/蒸三色蛋.png'),
      '西芹炒雞柳': require('@/assets/recipes/西芹炒雞柳.png'),
      '西芹炒牛肉': require('@/assets/recipes/西芹炒牛肉.png'),
      '腰果炒雞丁': require('@/assets/recipes/腰果炒雞丁.png'),
      '中式牛柳': require('@/assets/recipes/中式牛柳.png'),
      '黑椒牛仔骨': require('@/assets/recipes/黑椒牛仔骨.png'),
      '豉汁炒蜆': require('@/assets/recipes/豉汁炒蜆.png'),
      '豉椒炒牛肉': require('@/assets/recipes/豉椒炒牛肉.png'),
      '豉椒苦瓜炒牛肉': require('@/assets/recipes/豉椒苦瓜炒牛肉.png'),
      '菜脯炒蛋': require('@/assets/recipes/菜脯炒蛋.png'),
      '韭黃炒蛋': require('@/assets/recipes/韭黃炒蛋.png'),
      '韭菜花炒豬頸肉': require('@/assets/recipes/韭菜花炒豬頸肉.png'),
      '蝦醬炒鮮魷': require('@/assets/recipes/蝦醬炒鮮魷.png'),
      '九層塔炒蜆': require('@/assets/recipes/九層塔炒蜆.png'),
      '炒三鮮': require('@/assets/recipes/炒三鮮.png'),
      '生炒芥蘭': require('@/assets/recipes/生炒芥蘭.png'),
      '椒絲腐乳炒通菜': require('@/assets/recipes/椒絲腐乳炒通菜.png'),
      '蔥爆牛肉': require('@/assets/recipes/蔥爆牛肉.png'),
      '金沙鹹蛋黃炒蝦仁': require('@/assets/recipes/金沙鹹蛋黃炒蝦仁.png'),
      '薑蔥炒蟹': require('@/assets/recipes/薑蔥炒蟹.png'),
      '避風塘炒蟹': require('@/assets/recipes/避風塘炒蟹.png'),
      '柱侯蘿蔔牛腩煲': require('@/assets/recipes/柱侯蘿蔔牛腩煲.png'),
      '清湯蘿蔔牛腩': require('@/assets/recipes/清湯蘿蔔牛腩.png'),
      '港式咖喱牛腩煲': require('@/assets/recipes/港式咖喱牛腩煲.png'),
      '港式咖喱雞煲': require('@/assets/recipes/港式咖喱雞煲.png'),
      '啫啫滑雞煲': require('@/assets/recipes/啫啫滑雞煲.png'),
      '三杯雞': require('@/assets/recipes/三杯雞.png'),
      '栗子炆雞': require('@/assets/recipes/栗子炆雞.png'),
      '鮑汁冬菇炆花膠': require('@/assets/recipes/鮑汁冬菇炆花膠.png'),
      '北菇炆海參': require('@/assets/recipes/北菇炆海參.png'),
      '紅燒豆腐煲': require('@/assets/recipes/紅燒豆腐煲.png'),
      '琵琶豆腐': require('@/assets/recipes/琵琶豆腐.png'),
      '鹹魚雞粒豆腐煲': require('@/assets/recipes/鹹魚雞粒豆腐煲.png'),
      '海鮮豆腐煲': require('@/assets/recipes/海鮮豆腐煲.png'),
      '南乳粗齋煲': require('@/assets/recipes/南乳粗齋煲.png'),
      '雙冬支竹羊腩煲': require('@/assets/recipes/雙冬支竹羊腩煲.png'),
      '支竹炆豬腩肉': require('@/assets/recipes/支竹炆豬腩肉.png'),
      '芋頭扣肉': require('@/assets/recipes/芋頭扣肉.png'),
      '欖菜肉碎四季豆': require('@/assets/recipes/欖菜肉碎四季豆.png'),
      '魚香茄子煲': require('@/assets/recipes/魚香茄子煲.png'),
      '鮑汁海參花菇大鴨': require('@/assets/recipes/鮑汁海參花菇大鴨.png'),
      '煎釀三寶': require('@/assets/recipes/煎釀三寶.png'),
      '香煎紅衫魚': require('@/assets/recipes/香煎紅衫魚.png'),
      '香煎黃花魚': require('@/assets/recipes/香煎黃花魚.png'),
      '香煎馬友魚': require('@/assets/recipes/香煎馬友魚.png'),
      '香煎肉餅': require('@/assets/recipes/香煎肉餅.png'),
      '香煎蓮藕餅': require('@/assets/recipes/香煎蓮藕餅.png'),
      '煎釀蓮藕夾': require('@/assets/recipes/煎釀蓮藕夾.png'),
      '香煎生薯仔餅': require('@/assets/recipes/香煎生薯仔餅.png'),
      '生煎肉餅': require('@/assets/recipes/生煎肉餅.png'),
      '香煎蛋餃': require('@/assets/recipes/香煎蛋餃.png'),
      '韭菜煎蛋角': require('@/assets/recipes/韭菜煎蛋角.png'),
      '椒鹽豬扒': require('@/assets/recipes/椒鹽豬扒.png'),
      '椒鹽九吐魚': require('@/assets/recipes/椒鹽九吐魚.png'),
      '椒鹽鮮魷': require('@/assets/recipes/椒鹽鮮魷.png'),
      '椒鹽豆腐': require('@/assets/recipes/椒鹽豆腐.png'),
      '脆皮炸大腸': require('@/assets/recipes/脆皮炸大腸.png'),
      '生炸雞翼': require('@/assets/recipes/生炸雞翼.png'),
      '南乳炸雞翼': require('@/assets/recipes/南乳炸雞翼.png'),
      '吉列豬扒': require('@/assets/recipes/吉列豬扒.png'),
      '咕嚕肉': require('@/assets/recipes/咕嚕肉.png'),
      '口水雞': require('@/assets/recipes/口水雞.png'),
      '沙薑手撕雞': require('@/assets/recipes/沙薑手撕雞.png'),
      '沙薑浸滑雞': require('@/assets/recipes/沙薑浸滑雞.png'),
      '白切雞': require('@/assets/recipes/白切雞.png'),
      '豉油雞': require('@/assets/recipes/豉油雞.png'),
      '潮州滷水拼盤': require('@/assets/recipes/潮州滷水拼盤.png'),
      '五香牛肉': require('@/assets/recipes/五香牛肉.png'),
      '花雕醉雞': require('@/assets/recipes/花雕醉雞.png'),
      '涼拌皮蛋豆腐': require('@/assets/recipes/涼拌皮蛋豆腐.png'),
      '涼拌拍青瓜': require('@/assets/recipes/涼拌拍青瓜.png'),
      '上湯浸莧菜': require('@/assets/recipes/上湯浸莧菜.png'),
      '金銀蛋浸絲瓜': require('@/assets/recipes/金銀蛋浸絲瓜.png'),
      '鮮蝦蒸水蛋': require('@/assets/recipes/鮮蝦蒸水蛋.png'),
      '魚湯勝瓜浸魚餅': require('@/assets/recipes/魚湯勝瓜浸魚餅.png'),
      '港式辣子雞': require('@/assets/recipes/港式辣子雞.png'),
      '酸甜咕嚕魚塊': require('@/assets/recipes/酸甜咕嚕魚塊.png'),
      '粟米斑塊': require('@/assets/recipes/粟米斑塊.png'),
      '賽螃蟹': require('@/assets/recipes/賽螃蟹.png'),
      '什錦炒雜菜': require('@/assets/recipes/什錦炒雜菜.png'),
      '日式親子丼': require('@/assets/recipes/日式親子丼.png'),
      '日式照燒雞': require('@/assets/recipes/日式照燒雞.png'),
      '日式咖喱豬扒飯': require('@/assets/recipes/日式咖喱豬扒飯.png'),
      '日式味噌湯': require('@/assets/recipes/日式味噌湯.png'),
      '日式大根燉五花肉': require('@/assets/recipes/日式大根燉五花肉.png'),
      '豚汁': require('@/assets/recipes/豚汁.png'),
      '日式生薑燒肉': require('@/assets/recipes/日式生薑燒肉.png'),
      '日式壽喜燒': require('@/assets/recipes/日式壽喜燒.png'),
      '天婦羅炸大蝦': require('@/assets/recipes/天婦羅炸大蝦.png'),
      '日式章魚小丸子': require('@/assets/recipes/日式章魚小丸子.png'),
      '日式玉子燒': require('@/assets/recipes/日式玉子燒.png'),
      '日式漢堡排': require('@/assets/recipes/日式漢堡排.png'),
      '韓式拌飯': require('@/assets/recipes/韓式拌飯.png'),
      '韓式泡菜豆腐湯': require('@/assets/recipes/韓式泡菜豆腐湯.png'),
      '韓式炸雞': require('@/assets/recipes/韓式炸雞.png'),
      '韓式海鮮煎餅': require('@/assets/recipes/韓式海鮮煎餅.png'),
      '韓式泡菜炒飯': require('@/assets/recipes/韓式泡菜炒飯.png'),
      '韓式人參雞湯': require('@/assets/recipes/韓式人參雞湯.png'),
      '韓式大醬湯': require('@/assets/recipes/韓式大醬湯.png'),
      '韓式炒年糕': require('@/assets/recipes/韓式炒年糕.png'),
      '韓式部隊鍋': require('@/assets/recipes/韓式部隊鍋.png'),
      '韓式烤牛肉': require('@/assets/recipes/韓式烤牛肉.png'),
      '韓式安東燉雞': require('@/assets/recipes/韓式安東燉雞.png'),
      '韓式辣豆腐湯': require('@/assets/recipes/韓式辣豆腐湯.png'),
      '泰式青咖喱雞': require('@/assets/recipes/泰式青咖喱雞.png'),
      '泰式冬蔭功湯': require('@/assets/recipes/泰式冬蔭功湯.png'),
      '越式牛肉河粉': require('@/assets/recipes/越式牛肉河粉.png'),
      '泰式炒金邊粉': require('@/assets/recipes/泰式炒金邊粉.png'),
      '印尼炒飯': require('@/assets/recipes/印尼炒飯.png'),
      '新加坡海南雞飯': require('@/assets/recipes/新加坡海南雞飯.png'),
      '泰式香葉肉碎炒飯': require('@/assets/recipes/泰式香葉肉碎炒飯.png'),
      '肉骨茶': require('@/assets/recipes/肉骨茶.png'),
      '越式春卷': require('@/assets/recipes/越式春卷.png'),
      '新加坡叻沙湯麵': require('@/assets/recipes/新加坡叻沙湯麵.png'),
      '馬來沙嗲雞肉串': require('@/assets/recipes/馬來沙嗲雞肉串.png'),
      '泰式芒果糯米飯': require('@/assets/recipes/泰式芒果糯米飯.png'),
      '粟米忌廉湯': require('@/assets/recipes/粟米忌廉湯.png'),
      '粟米蛋花湯': require('@/assets/recipes/粟米蛋花湯.png'),
      '紫菜豆腐魚蛋湯': require('@/assets/recipes/紫菜豆腐魚蛋湯.png'),
      '番茄紅衫魚': require('@/assets/recipes/番茄紅衫魚.png'),
      '蒜蓉粉絲蒸魷魚': require('@/assets/recipes/蒜蓉粉絲蒸魷魚.png'),
      '雜菜炒粉絲': require('@/assets/recipes/雜菜炒粉絲.png'),
      '揚州炒飯': require('@/assets/recipes/揚州炒飯.png'),
      '星洲炒米': require('@/assets/recipes/星洲炒米.png'),
      '乾炒牛河': require('@/assets/recipes/乾炒牛河.png'),
      '鹹魚雞粒炒飯': require('@/assets/recipes/鹹魚雞粒炒飯.png'),
      '瑤柱蛋白炒飯': require('@/assets/recipes/瑤柱蛋白炒飯.png'),
      '肉絲炒麵': require('@/assets/recipes/肉絲炒麵.png'),
      '廈門炒米': require('@/assets/recipes/廈門炒米.png'),
      '餐蛋炒飯': require('@/assets/recipes/餐蛋炒飯.png'),
      '羅漢齋炒麵': require('@/assets/recipes/羅漢齋炒麵.png'),
      '肉片炒麵': require('@/assets/recipes/肉片炒麵.png'),
      '炒雞絲烏冬': require('@/assets/recipes/炒雞絲烏冬.png'),
      '日式牛肉炒烏冬': require('@/assets/recipes/日式牛肉炒烏冬.png'),
      '意式番茄肉醬意粉': require('@/assets/recipes/意式番茄肉醬意粉.png'),
      '凱撒沙律': require('@/assets/recipes/凱撒沙律.png'),
      '奶油蘑菇湯': require('@/assets/recipes/奶油蘑菇湯.png'),
      '蒜蓉炒時蔬': require('@/assets/recipes/蒜蓉炒時蔬.png'),
      '咖哩魚蛋': require('@/assets/recipes/咖哩魚蛋.png'),
      '碗仔翅': require('@/assets/recipes/碗仔翅.png'),
      '生菜魚肉': require('@/assets/recipes/生菜魚肉.png'),
      '懷舊砵仔糕': require('@/assets/recipes/懷舊砵仔糕.png'),
      '椰汁紅豆糕': require('@/assets/recipes/椰汁紅豆糕.png'),
      '香煎蘿蔔糕': require('@/assets/recipes/香煎蘿蔔糕.png'),
      '豉汁蒸鳳爪': require('@/assets/recipes/豉汁蒸鳳爪.png'),
      '青紅蘿蔔椰子豬骨湯': require('@/assets/recipes/青紅蘿蔔椰子豬骨湯.png'),
      '粉葛赤小豆扁豆鯪魚湯': require('@/assets/recipes/粉葛赤小豆扁豆鯪魚湯.png'),
      '海底椰無花果雪梨瘦肉湯': require('@/assets/recipes/海底椰無花果雪梨瘦肉湯.png'),
      '花膠響螺片燉雞湯': require('@/assets/recipes/花膠響螺片燉雞湯.png'),
      '木瓜花生排骨湯': require('@/assets/recipes/木瓜花生排骨湯.png'),
      '五指毛桃土茯苓煲豬骨湯': require('@/assets/recipes/五指毛桃土茯苓煲豬骨湯.png'),
      '楊枝甘露': require('@/assets/recipes/楊枝甘露.png'),
      '腐竹白果雞蛋糖水': require('@/assets/recipes/腐竹白果雞蛋糖水.png'),
      '番薯薑汁糖水': require('@/assets/recipes/番薯薑汁糖水.png'),
      '生磨芝麻糊': require('@/assets/recipes/生磨芝麻糊.png'),
      '竹蔗茅根馬蹄水': require('@/assets/recipes/竹蔗茅根馬蹄水.png'),
      '生薑紅棗桂圓茶': require('@/assets/recipes/生薑紅棗桂圓茶.png'),
      '港式絲襪奶茶': require('@/assets/recipes/港式絲襪奶茶.png'),
      '日式蛋包飯': require('@/assets/recipes/日式蛋包飯.png'),
      '番茄芝士焗肉丸': require('@/assets/recipes/番茄芝士焗肉丸.png'),
      '南瓜薯仔雞肉泥': require('@/assets/recipes/南瓜薯仔雞肉泥.png'),
      '肉餅蒸蛋': require('@/assets/recipes/肉餅蒸蛋.png'),
      '芝士焗西蘭花': require('@/assets/recipes/芝士焗西蘭花.png'),
      '香脆魚柳條': require('@/assets/recipes/香脆魚柳條.png'),
      '霸王花煲豬骨湯': require('@/assets/recipes/霸王花煲豬骨湯.png'),
      '極品鮑汁花菇炆扣肉': require('@/assets/recipes/極品鮑汁花菇炆扣肉.png'),
      '當紅炸子雞': require('@/assets/recipes/當紅炸子雞.png'),
      '富貴黃金大蝦': require('@/assets/recipes/富貴黃金大蝦.png'),
      '發財好市炆豬手': require('@/assets/recipes/發財好市炆豬手.png'),
      '豉汁排骨蒸陳村粉': require('@/assets/recipes/豉汁排骨蒸陳村粉.png'),
      '蓮藕炆排骨': require('@/assets/recipes/蓮藕炆排骨.png'),
      '港式沙爹牛肉公仔麵': require('@/assets/recipes/港式沙爹牛肉公仔麵.png'),
      '花雕醉溏心蛋': require('@/assets/recipes/花雕醉溏心蛋.png'),
      '朱古力心太軟': require('@/assets/recipes/朱古力心太軟.png'),
      '日式炒烏冬': require('@/assets/recipes/日式炒烏冬.png'),
      '台式滷肉飯': require('@/assets/recipes/台式滷肉飯.png'),
      '意大利千層麵': require('@/assets/recipes/意大利千層麵.png'),
      '經典芝士漢堡': require('@/assets/recipes/經典芝士漢堡.png'),
      '意式提拉米蘇': require('@/assets/recipes/意式提拉米蘇.png'),
      '順德雙皮奶': require('@/assets/recipes/順德雙皮奶.png'),
      '港式街頭雞蛋仔': require('@/assets/recipes/港式街頭雞蛋仔.png'),
      '蒜泥白肉': require('@/assets/recipes/蒜泥白肉.png'),
      '薑蔥生蠔煲': require('@/assets/recipes/薑蔥生蠔煲.png'),
      '電飯煲香菇滑雞飯': require('@/assets/recipes/電飯煲香菇滑雞飯.png'),
      '電飯煲臘味糯米飯': require('@/assets/recipes/電飯煲臘味糯米飯.png'),
      '電飯煲台式香菇油飯': require('@/assets/recipes/電飯煲台式香菇油飯.png'),
      '電飯煲南瓜排骨燜飯': require('@/assets/recipes/電飯煲南瓜排骨燜飯.png'),
      '電飯煲意式奶油煙肉野菌燉飯': require('@/assets/recipes/電飯煲意式奶油煙肉野菌燉飯.png'),
      '電飯煲日式蒲燒鰻魚滑蛋飯': require('@/assets/recipes/電飯煲日式蒲燒鰻魚滑蛋飯.png'),
      '電飯煲台式高麗菜鹹飯': require('@/assets/recipes/電飯煲台式高麗菜鹹飯.png'),
      '電飯煲川味麻辣牛肉豆腐飯': require('@/assets/recipes/電飯煲川味麻辣牛肉豆腐飯.png'),
      '電飯煲豉油皇肥牛煲仔飯': require('@/assets/recipes/電飯煲豉油皇肥牛煲仔飯.png'),
      '電飯煲韓式春川辣炒雞拉麵': require('@/assets/recipes/電飯煲韓式春川辣炒雞拉麵.png'),
      '電飯煲豉油皇雞翼飯': require('@/assets/recipes/電飯煲豉油皇雞翼飯.png'),
      '電飯煲番茄芝士肉醬意粉': require('@/assets/recipes/電飯煲番茄芝士肉醬意粉.png'),
      '電飯煲日式鮭魚菇菌炊飯': require('@/assets/recipes/電飯煲日式鮭魚菇菌炊飯.png'),
      '電飯煲南洋風味椰漿雞肉飯': require('@/assets/recipes/電飯煲南洋風味椰漿雞肉飯.png'),
      '電飯煲廣東經典滑蛋牛肉粥': require('@/assets/recipes/電飯煲廣東經典滑蛋牛肉粥.png'),
      '電飯煲海南雞飯': require('@/assets/recipes/電飯煲海南雞飯.png'),
      '蒜香煙肉蘑菇意粉': require('@/assets/recipes/蒜香煙肉蘑菇意粉.png'),
      '焗芝士菠菜': require('@/assets/recipes/焗芝士菠菜.png'),
      '韓式水冷麵': require('@/assets/recipes/韓式水冷麵.png'),
      '經典南乳花生炆豬手': require('@/assets/recipes/經典南乳花生炆豬手.png'),
      '忌廉南瓜湯': require('@/assets/recipes/忌廉南瓜湯.png'),
      '忌廉周打蜆湯': require('@/assets/recipes/忌廉周打蜆湯.png'),
      '支竹冬菇炆牛筋腩': require('@/assets/recipes/支竹冬菇炆牛筋腩.png'),
      '勝瓜炒蝦仁': require('@/assets/recipes/勝瓜炒蝦仁.png'),
      '八寶豆腐': require('@/assets/recipes/八寶豆腐.png'),
      '肉碎豆腐煲': require('@/assets/recipes/肉碎豆腐煲.png'),
      '韓式炸醬麵': require('@/assets/recipes/韓式炸醬麵.png'),
      '泰式酸辣無骨雞爪': require('@/assets/recipes/泰式酸辣無骨雞爪.png'),
      '俄式羅宋湯': require('@/assets/recipes/俄式羅宋湯.png'),
      '豉油雞翼': require('@/assets/recipes/豉油雞翼.png'),
      '經典紅豆沙': require('@/assets/recipes/經典紅豆沙.png'),
      '忌廉蘑菇湯': require('@/assets/recipes/忌廉蘑菇湯.png'),
      '日式叉燒豬骨拉麵': require('@/assets/recipes/日式叉燒豬骨拉麵.png'),
      '西班牙海鮮鐵鍋飯': require('@/assets/recipes/西班牙海鮮鐵鍋飯.png'),
      '無水雞肉椰菜煲': require('@/assets/recipes/無水雞肉椰菜煲.png'),
      '雪菜牛肉米粉': require('@/assets/recipes/雪菜牛肉米粉.png'),
      '洋蔥炒豬肉片': require('@/assets/recipes/洋蔥炒豬肉片.png'),
      '日式茶碗蒸': require('@/assets/recipes/日式茶碗蒸.png'),
      '台式紅燒牛肉麵': require('@/assets/recipes/台式紅燒牛肉麵.png'),
      '花甲蒸水蛋': require('@/assets/recipes/花甲蒸水蛋.png'),
      '白灼蠔油生菜': require('@/assets/recipes/白灼蠔油生菜.png'),
      '白灼蠔油菜心': require('@/assets/recipes/白灼蠔油菜心.png'),
      '白灼蠔油芥蘭': require('@/assets/recipes/白灼蠔油芥蘭.png'),
      '白灼蠔油西蘭花': require('@/assets/recipes/白灼蠔油西蘭花.png'),
      '上湯枸杞浸菜心': require('@/assets/recipes/上湯枸杞浸菜心.png'),
      '匈牙利牛肉湯': require('@/assets/recipes/匈牙利牛肉湯.png'),
      '大牌檔風味薑蔥炒牛肉': require('@/assets/recipes/大牌檔風味薑蔥炒牛肉.png'),
      '海南雞飯': require('@/assets/recipes/海南雞飯.png'),
      '清蒸白切鮮魷': require('@/assets/recipes/清蒸白切鮮魷.png'),
      '港式洋蔥豬扒飯': require('@/assets/recipes/港式洋蔥豬扒飯.png'),
      '港式蔥油撈麵': require('@/assets/recipes/港式蔥油撈麵.png'),
      '焗蜜汁金沙骨': require('@/assets/recipes/焗蜜汁金沙骨.png'),
      '焗蜜糖雞翼': require('@/assets/recipes/焗蜜糖雞翼.png'),
      '生煎土魷肉餅': require('@/assets/recipes/生煎土魷肉餅.png'),
      '番茄肥牛過橋米線': require('@/assets/recipes/番茄肥牛過橋米線.png'),
      '經典榨菜肉絲米粉': require('@/assets/recipes/經典榨菜肉絲米粉.png'),
      '經典港式生炒牛肉飯': require('@/assets/recipes/經典港式生炒牛肉飯.png'),
      '花雕醉大蝦': require('@/assets/recipes/花雕醉大蝦.png'),
      '花雕醉小鮑魚': require('@/assets/recipes/花雕醉小鮑魚.png'),
      '蒜蓉豆豉蒸雞髀肉': require('@/assets/recipes/蒜蓉豆豉蒸雞髀肉.png'),
      '蒜香焗金沙骨': require('@/assets/recipes/蒜香焗金沙骨.png'),
      '蜜汁焗叉燒': require('@/assets/recipes/蜜汁焗叉燒.png'),
      '蝦仁豆腐蒸水蛋': require('@/assets/recipes/蝦仁豆腐蒸水蛋.png'),
      '避風塘炒蝦仁': require('@/assets/recipes/避風塘炒蝦仁.png'),
      '金銀蛋浸莧菜': require('@/assets/recipes/金銀蛋浸莧菜.png'),
      '電飯煲三色藜麥時蔬雞胸肉飯': require('@/assets/recipes/電飯煲三色藜麥時蔬雞胸肉飯.png'),
      '電飯煲日式咖喱雞肉燉飯': require('@/assets/recipes/電飯煲日式咖喱雞肉燉飯.png'),
      '電飯煲番茄牛肉燉飯': require('@/assets/recipes/電飯煲番茄牛肉燉飯.png'),
      '電飯煲韓式泡菜五花肉燜飯': require('@/assets/recipes/電飯煲韓式泡菜五花肉燜飯.png'),
      '香煎三文魚配檸檬牛油汁': require('@/assets/recipes/香煎三文魚配檸檬牛油汁.png'),
      '希臘檸檬雞湯': require('@/assets/recipes/希臘檸檬雞湯.png'),
      '意大利牛肝菌燉飯': require('@/assets/recipes/意大利牛肝菌燉飯.png'),
      '意大利蔬菜湯': require('@/assets/recipes/意大利蔬菜湯.png'),
      '日式五目炊飯': require('@/assets/recipes/日式五目炊飯.png'),
      '正宗意式卡邦尼意粉': require('@/assets/recipes/正宗意式卡邦尼意粉.png'),
      '法式洋蔥湯': require('@/assets/recipes/法式洋蔥湯.png'),
      '法式焦糖燉蛋': require('@/assets/recipes/法式焦糖燉蛋.png'),
      '法式白汁燉雞': require('@/assets/recipes/法式白汁燉雞.png'),
      '波蘭酸黑麥湯': require('@/assets/recipes/波蘭酸黑麥湯.png'),
      '牧羊人派': require('@/assets/recipes/牧羊人派.png'),
      '番茄大蝦意粉': require('@/assets/recipes/番茄大蝦意粉.png'),
      '番茄肉醬意粉': require('@/assets/recipes/番茄肉醬意粉.png'),
      '白汁煙肉意粉': require('@/assets/recipes/白汁煙肉意粉.png'),
      '經典瑪格麗特薄餅': require('@/assets/recipes/經典瑪格麗特薄餅.png'),
      '經典芝士焗通心粉': require('@/assets/recipes/經典芝士焗通心粉.png'),
      '經典西冷牛排': require('@/assets/recipes/經典西冷牛排.png'),
      '美式BBQ烤豬肋骨': require('@/assets/recipes/美式BBQ烤豬肋骨.png'),
      '芒果班戟': require('@/assets/recipes/芒果班戟.png'),
      '芒果西米露': require('@/assets/recipes/芒果西米露.png'),
      '英式下午茶鬆餅': require('@/assets/recipes/英式下午茶鬆餅.png'),
      '蒜香橄欖油大蝦意粉': require('@/assets/recipes/蒜香橄欖油大蝦意粉.png'),
      '薑汁撞奶': require('@/assets/recipes/薑汁撞奶.png'),
      '西式番茄濃湯': require('@/assets/recipes/西式番茄濃湯.png'),
      '西式香草檸檬焗雞': require('@/assets/recipes/西式香草檸檬焗雞.png'),
    };
    const exactMatch = nameMap[recipeName];
    if (exactMatch) return exactMatch;

    const cleanName = recipeName
      .replace(/^(港式|日式|韓式|泰式|西式|意式|台式|電飯煲|經典|正宗|傳統|風味|大牌檔風味)/g, '')
      .replace(/\s*\([^)]+\)\s*$/g, '');
    return nameMap[cleanName];
  };
  
  const localImage = recipe ? getLocalImage(recipe.name) : null;
  const imgUrl = localImage || (recipe as any)?.image || (recipe as any)?.thumbnailUrl;
  // recipeImage 只接受字串 URL；require() 回傳的數字 asset id 不能送出後端
  const remoteImageUrl = (recipe as any)?.image || (recipe as any)?.thumbnailUrl || undefined;
  const isUserRecipe = (recipe as any)?.source === "user";
  const sourceUrl = (recipe as any)?.sourceUrl;
  const sourceAuthor = (recipe as any)?.sourceAuthor;
  const recipeNumericId = id ? (parseInt(id.replace("user_", "").replace("official_", ""), 10) || 0) : 0;
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

  // Can this user delete this recipe?
  const canDelete = isUserRecipe || user?.role === "admin";

  // Mutations
  const updateTagsM = trpc.recipes.updateUser.useMutation({
    onSuccess: (data: any) => { setLocalTags(data.tags ?? []); setShowTagEditor(false); },
    onError: (e: any) => Alert.alert("失敗", e.message),
  });
  const addPlanM = trpc.mealPlan.add.useMutation({
    onSuccess: (result) => {
      // 檢查排餐是否成功
      if (!result.newPlanId) {
        Alert.alert("排餐失敗", "請稍後再試", [{ text: "確定" }]);
        return;
      }
      
      const ings = adjustedIngredients.map((ing: any) => ({
        name: ing.name,
        quantity: ing.adjustedQty ?? ing.quantity ?? "",
        unit: ing.unit ?? "",
        category: ing.category ?? "食材",
      }));

      const continueFlow = () => {
        setShowPlan(false);
        utils.mealPlan.listByDateRange.invalidate();
        if (autoAddCartRef.current) {
          utils.shopping.list.invalidate();
          setToast({
            visible: true,
            message: `✅ 已加入排餐及購物車（${adjustedIngredients.length} 項食材）`,
            type: "success",
          });
        } else if (ings.length > 0) {
          setPlanPickerRecipe({
            id: recipeStringId,
            name: recipe?.name ?? "",
            ingredients: ings,
            date: planDate ?? undefined,
            fromMealPlanId: result.newPlanId,
          });
        } else {
          Alert.alert("已加入排餐");
        }
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
      utils.shopping.list.invalidate();
      utils.mealPlan.listByDateRange.invalidate();
      setAddedToCart(true);
      setPlanPickerRecipe(null);
      const count = variables.items.length;
      const dateLabel = variables.plannedDate ? formatMealDate(variables.plannedDate) : "";
      setToast({ 
        visible: true, 
        message: `✅ ${count} 件食材已加入購物清單${dateLabel ? `，採購日：${dateLabel}` : ""}`, 
        type: "success" 
      });
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

  const aiEditM = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => setAIEditResult(data.content),
    onError: (e) => Alert.alert("AI Edit 失敗", e.message),
  });

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
            {imgUrl && !heroImgError ? (
              sourceUrl ? (
                // User imported recipe: make image clickable to open source URL
                <TouchableOpacity
                  style={{ width: SW, height: SW }}
                  onPress={() => Linking.openURL(sourceUrl)}
                  activeOpacity={0.85}
                >
                  {localImage
                    ? <Image source={localImage} style={s.heroImg} resizeMode="cover" />
                    : <Image source={{ uri: imgUrl }} style={s.heroImg} resizeMode="cover" onError={() => setHeroImgError(true)} />}
                  {/* Source link overlay indicator */}
                  <View style={s.sourceLinkOverlay}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                    <Text style={s.sourceLinkOverlayText}>觀看教學影片</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                localImage
                  ? <Image source={localImage} style={s.heroImg} resizeMode="cover" />
                  : <Image source={{ uri: imgUrl }} style={s.heroImg} resizeMode="cover" onError={() => setHeroImgError(true)} />
              )
            ) : (
              <View style={[s.heroImg, s.heroPlaceholder]}>
                <Ionicons name="restaurant" size={56} color={HINT} />
              </View>
            )}
            {/* Back button */}
            <TouchableOpacity style={[s.heroBack, { backgroundColor: "rgba(255,255,255,0.9)" }]} onPress={handleBack}>
              <Ionicons name="chevron-back" size={22} color="#013E77" />
            </TouchableOpacity>
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
                  recipe?.servings ? `👥 ${recipe.servings} 人份` : "",
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
          {sourceUrl && sourceAuthor && (
            <TouchableOpacity
              style={s.sourceBar}
              onPress={() => Linking.openURL(sourceUrl)}
            >
              <View style={s.sourceIcon}>
                <Ionicons name="logo-instagram" size={14} color="#fff" />
              </View>
              <Text style={s.sourceText}>教學影片 by {sourceAuthor}</Text>
              <Text style={s.sourceLink}>查看 →</Text>
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
                <Text style={[s.btnSecTxt, addedToCart && { color: GREEN }]}>{addedToCart ? "已加入" : "加入採購"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnAI} onPress={() => { setAIEditPrompt(""); setAIEditResult(null); setShowAIEdit(true); }}>
                <Ionicons name="sparkles" size={14} color="#7C3AED" />
                <Text style={s.btnAITxt}>AI Edit</Text>
              </TouchableOpacity>
            </View>

            {/* 已加入採購提示 Banner */}
            {addedToCart && (
              <View style={s.addedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                <Text style={s.addedBannerText}>已加入採購</Text>
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
                  {allRecipeMealPlans.slice(0, 3).map((plan: any, idx: number) => {
                    const planDate = new Date(plan.date + "T00:00:00");
                    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][planDate.getDay()];
                    const mealTypeLabel = plan.mealType === "dinner" ? "晚餐" : plan.mealType === "lunch" ? "午餐" : plan.mealType === "breakfast" ? "早餐" : "小食";
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={s.mealPlanItem}
                        onPress={() => {
                          // 點擊日期→跳轉排餐頁
                          router.push({
                            pathname: "/(tabs)/planner",
                            params: { openRecommend: "true" }
                          });
                        }}
                      >
                        <View style={s.mealPlanDateBox}>
                          <Text style={s.mealPlanDate}>{planDate.getMonth() + 1}/{planDate.getDate()}</Text>
                          <Text style={s.mealPlanDay}>({dayOfWeek})</Text>
                        </View>
                        <Text style={s.mealPlanMealType}>{mealTypeLabel}</Text>
                        <TouchableOpacity
                          style={s.mealPlanRemove}
                          onPress={() => {
                            Alert.alert(
                              "移除排餐",
                              `確定要移除${planDate.getMonth() + 1}/${planDate.getDate()}(${dayOfWeek})${mealTypeLabel}嗎？`,
                              [
                                { text: "取消", style: "cancel" },
                                {
                                  text: "移除",
                                  style: "destructive",
                                  onPress: () => {
                                    deleteMealM.mutate({ id: plan.id });
                                    utils.mealPlan.listByDateRange.invalidate();
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="close-circle" size={14} color="#DC2626" />
                        </TouchableOpacity>
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
                  {showAllMealPlans && allRecipeMealPlans.slice(3).map((plan: any, idx: number) => {
                    const planDate = new Date(plan.date + "T00:00:00");
                    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][planDate.getDay()];
                    const mealTypeLabel = plan.mealType === "dinner" ? "晚餐" : plan.mealType === "lunch" ? "午餐" : plan.mealType === "breakfast" ? "早餐" : "小食";
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={s.mealPlanItem}
                        onPress={() => {
                          router.push({
                            pathname: "/(tabs)/planner",
                            params: { openRecommend: "true" }
                          });
                        }}
                      >
                        <View style={s.mealPlanDateBox}>
                          <Text style={s.mealPlanDate}>{planDate.getMonth() + 1}/{planDate.getDate()}</Text>
                          <Text style={s.mealPlanDay}>({dayOfWeek})</Text>
                        </View>
                        <Text style={s.mealPlanMealType}>{mealTypeLabel}</Text>
                        <TouchableOpacity
                          style={s.mealPlanRemove}
                          onPress={() => {
                            Alert.alert(
                              "移除排餐",
                              `確定要移除${planDate.getMonth() + 1}/${planDate.getDate()}(${dayOfWeek})${mealTypeLabel}嗎？`,
                              [
                                { text: "取消", style: "cancel" },
                                {
                                  text: "移除",
                                  style: "destructive",
                                  onPress: () => {
                                    deleteMealM.mutate({ id: plan.id });
                                    utils.mealPlan.listByDateRange.invalidate();
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="close-circle" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
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
              <TouchableOpacity style={s.igBtn} onPress={() => Linking.openURL(sourceUrl)}>
                <Ionicons name="logo-instagram" size={18} color="#fff" />
                <Text style={s.igBtnTxt}>在 Instagram 觀看完整影片</Text>
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
              <PlanDatePicker value={planDate} onChange={setPlanDate} showShortcuts={true} />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => {
                    const newAutoAdd = !autoAddCart;
                    setAutoAddCart(newAutoAdd);
                    if (newAutoAdd && planDate) {
                      const d = new Date(planDate + "T00:00:00");
                      d.setDate(d.getDate() - 1);
                      setShoppingDate(d.toISOString().split("T")[0]);
                    }
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: autoAddCart ? BRAND : "#D1D5DB",
                    backgroundColor: autoAddCart ? BRAND : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {autoAddCart && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAutoAddCart(!autoAddCart)} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: TEXT, fontWeight: "500" }}>同時加入購物車（{adjustedIngredients.length} 項食材）</Text>
                </TouchableOpacity>
              </View>
              {autoAddCart && planDate && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={s.sheetLabel}>採購日期</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#F9FAFB",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                    }}
                    onPress={() => setShowShoppingDatePicker(true)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                      <Text style={{ fontSize: 14, color: TEXT }}>
                        {shoppingDate ? formatMealDate(shoppingDate) : "請選擇"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    ⚠️ 採購日期唔可以遲過排餐日（{formatMealDate(planDate)}）
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[s.confirmBtn, addPlanM.isPending && { opacity: 0.6 }]}
                onPress={() => {
                  if (!planDate) {
                    Alert.alert("日期無效", "請選擇排餐日期", [{ text: "確定" }]);
                    return;
                  }
                  autoAddCartRef.current = autoAddCart;
                  const shoppingDateForBackend = autoAddCart ? (shoppingDate || (() => {
                    const d = new Date(planDate + "T00:00:00");
                    d.setDate(d.getDate() - 1);
                    return d.toISOString().split("T")[0];
                  })()) : undefined;
                  addPlanM.mutate({
                    date: planDate,
                    mealType: planMeal as any,
                    recipeId: recipeStringId,
                    recipeName: recipe.name,
                    recipeImage: remoteImageUrl,
                    autoAddIngredients: autoAddCart,
                    shoppingDate: shoppingDateForBackend,
                    ingredients: autoAddCart ? adjustedIngredients.map((ing: any) => ({
                      name: ing.name,
                      quantity: ing.adjustedQty ?? ing.quantity ?? "",
                      unit: ing.unit ?? "",
                    })) : undefined,
                  });
                }}
                disabled={addPlanM.isPending}
              >
                {addPlanM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnTxt}>確認加入</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Shopping date picker modal ── */}
        <Modal visible={showShoppingDatePicker} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>選擇採購日期</Text>
                <TouchableOpacity onPress={() => setShowShoppingDatePicker(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <Text style={s.sheetLabel}>採購日期（唔可以遲過排餐日）</Text>
              <PlanDatePicker
                value={shoppingDate}
                onChange={(date) => {
                  setShoppingDate(date);
                  setShowShoppingDatePicker(false);
                }}
                maxDate={planDate || undefined}
                showShortcuts={true}
              />
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
                  <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>記錄價格到購物清單</Text>
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
                  maxDate={planDate || undefined}
                  showShortcuts={true}
                />
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                  ⚠️ 採購日期唔可以遲過排餐日（{planDate ? formatMealDate(planDate) : ""}）
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
                  <Text style={s.dateHintText}>已關聯 {latestMealPlan.date} 晚餐，建議採購日為前一日</Text>
                </View>
              )}
              {latestMealPlan && shoppingDate && shoppingDate > latestMealPlan.date && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 16 }}>
                  <Ionicons name="warning" size={14} color="#DC2626" />
                  <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600" }}>
                    ⚠️ 採購日期（{shoppingDate}）晚於排餐日期（{latestMealPlan.date}）
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
                    // 情況 1 驗證：有排餐時，採購日期不能遲於排餐日
                    if (!shoppingDate) {
                      Alert.alert("日期無效", "請選擇購物日期", [{ text: "確定" }]);
                      return;
                    }
                    if (latestMealPlan && shoppingDate > latestMealPlan.date) {
                      Alert.alert(
                        "日期無效",
                        `採購日期（${shoppingDate}）不能遲於排餐日期（${latestMealPlan.date}）\n\n建議選擇 ${getDayBefore(latestMealPlan.date)} 或更早的日期`,
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
                      (item: any) => item.fromRecipeId === recipeStringId && item.status !== "bought"
                    );
                    
                    const toUpdate: { id: number; name: string; quantity: string; unit: string; plannedDate: string }[] = [];
                    const toAdd: typeof selectedItems = [];
                    
                    // 建立現有項目的映射，方便查找
                    const existingMap = new Map<string, any>();
                    existingItems.forEach((item: any) => {
                      existingMap.set(`${item.name.trim()}::${item.unit}`, item);
                    });
                    
                    // 處理勾選的項目：更新或新增
                    for (const selected of selectedItems) {
                      const key = `${selected.name.trim()}::${selected.unit}`;
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
                        setAddedToCart(true);
                        // 延遲關閉 Modal，然後顯示成功提示（避免被 Modal 擋住）
                        setTimeout(() => {
                          utils.shopping.list.invalidate();
                          setShowIngPicker(false);
                          setToast({
                            visible: true,
                            message: toUpdate.length > 0 
                              ? `✅ 已更新 ${toUpdate.length} 項食材` 
                              : `✅ 已更新採購日：${formatMealDate(shoppingDate)}`,
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
              setToast({ visible: true, message: "排餐已記錄", type: "info" });
            }
          }}
          onSkip={() => {
            setPlanPickerRecipe(null);
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
