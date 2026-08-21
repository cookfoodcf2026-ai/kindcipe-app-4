/**
 * 自訂食譜編輯器 — 新增 / 編輯 用戶自訂食譜
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image, Modal, BackHandler,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActionSheetIOS,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation, Stack } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import { useInvalidateMealPlanAndCart } from "@/hooks/useInvalidateMealPlanAndCart";
import { useInvalidateRecipesAndWeekly } from "@/hooks/useInvalidateRecipesAndWeekly";
import UnitPicker from "@/src/components/UnitPicker";
import { compressImage } from "@/lib/image-utils";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#E5D5C0";
const GREEN = "#4CAF50";
const ROSE = "#EF4444";

// 從「caption + link」混合文字抽出真正嘅 URL；抽唔到就回空
const extractSourceUrl = (raw: string): string => {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/https?:\/\/[^\s，,、；;）)\"']+/i);
  if (match?.[0]) {
    try {
      const u = new URL(match[0]);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {
      /* fall through */
    }
  }
  return "";
};

const DIFFICULTY_OPTIONS = ["簡單", "中等", "困難"];
const SUGGESTED_TAGS = ["蒸", "炒", "炆", "焗", "煎", "炸", "燉", "涼拌", "烤", "紅燒", "清淡", "鹹香", "酸甜", "辛辣", "鮮味", "家常菜", "快手菜", "宴客菜", "高蛋白", "低卡", "素食", "減脂餐", "小朋友", "30 分鐘內"];
const CATEGORY_OPTIONS = [
  { key: "中菜",   label: "中菜",   icon: "restaurant-outline" },
  { key: "西餐",   label: "西餐",   icon: "leaf-outline" },
  { key: "日式",   label: "日式",   icon: "fish-outline" },
  { key: "韓式",   label: "韓式",   icon: "flame-outline" },
  { key: "東南亞", label: "東南亞", icon: "restaurant-outline" },
  { key: "甜品",   label: "甜品",   icon: "star-outline" },
  { key: "飲品",   label: "飲品",   icon: "cafe-outline" },
  { key: "其他",   label: "其他",   icon: "grid-outline" },
] as const;

type Ingredient = { id: string; name: string; quantity: string; unit: string };
type Step = { id: number; instruction: string; duration: number; imageUri?: string | null; imageBase64?: string | null };

export default function RecipeEditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const hydratedRef = useRef(false);
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const editingId = params.id ? parseInt(params.id) : null;
  const isEditing = !!editingId && !isNaN(editingId);
  const utils = trpc.useUtils();
  const invalidateRecipesAndWeekly = useInvalidateRecipesAndWeekly();

  const [name, setName] = useState(params.name ?? "");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("4");
  const [prepTime, setPrepTime] = useState("15");
  const [cookTime, setCookTime] = useState("30");
  const [difficulty, setDifficulty] = useState("中等");
  const [category, setCategory] = useState("中菜");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: `ing_${Date.now()}`, name: "", quantity: "", unit: "克" },
  ]);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, instruction: "", duration: 0 },
  ]);
  const ingredientInputRefs = useRef<Map<string, TextInput>>(new Map());
  const stepInputRefs = useRef<Map<number, TextInput>>(new Map());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [saveStep, setSaveStep] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

// 用 RN 官方方法 scrollResponderScrollNativeHandleToKeyboard：
// 內部自行 measureLayout（攞相對於 ScrollView 內容嘅正確座標）
// + 用 ScrollView 自己 subscribe 嘅 _keyboardMetrics.screenY（keyboard 頂部）
// + scrollTo({ y: top - keyboardTop + height + offset })
// 唔會再搞亂 window vs content 座標，唔會過份 scroll 去頂部
// ※ KAV 用 behavior="position"（成個視圖移上鍵盤頂），唔會 resize ScrollView，
//   令呢個方法嘅 window 座標計法保持正確，唔會同 padding 雙重補償。
const scrollToFocused = useCallback((e: any) => {
    const tag = e?.nativeEvent?.target;
    if (tag == null || !scrollRef.current) return;
    // 等 keyboard 動畫開始+ScrollView 內部收到 keyboardWillShow 再 call，
    // 確保 _keyboardMetrics 已 set；延遲少少等 animation 起咗身。
    setTimeout(() => {
      try {
        const sv = scrollRef.current as unknown as {
          scrollResponderScrollNativeHandleToKeyboard?: (node: number, offset?: number) => void;
        };
        // 少少 offset 令 focus 嘅輸入框貼住鍵盤頂
        sv.scrollResponderScrollNativeHandleToKeyboard?.(tag, 40);
      } catch { /* 忽略 scroll 失敗 */ }
    }, 250);
  }, []);


  const currentTagList = useMemo(
    () => tags.split(/[\s,，]+/).map(t => t.replace(/^#/, "").trim()).filter(t => t.length > 0),
    [tags]
  );

  const toggleTag = useCallback((tag: string) => {
    setTags(prev => {
      const list = prev.split(/[\s,，]+/).map(t => t.replace(/^#/, "").trim()).filter(t => t.length > 0);
      const idx = list.findIndex(t => t === tag);
      if (idx >= 0) {
        list.splice(idx, 1);
        return list.join(" ");
      }
      return [...list, tag].join(" ");
    });
  }, []);

  // Load existing recipe if editing
  const recipeQ = trpc.recipes.getById.useQuery(
    { id: String(editingId ?? "") },
    { enabled: isEditing },
  );

  useEffect(() => {
    if (recipeQ.data && isEditing && !hydratedRef.current) {
      hydratedRef.current = true;
      const r = recipeQ.data as any;
      setIsDraft(!!r.isDraft);
      if (r.isDraft && r.id) {
        const parsed = parseInt(String(r.id).replace("user_", ""), 10);
        setDraftId(isNaN(parsed) ? null : parsed);
      }
      setName(r.name ?? "");
      setDescription(r.description ?? "");
      setServings(String(r.servings ?? 4));
      setPrepTime(String(r.prepTime ?? 15));
      setCookTime(String(r.cookTime ?? 30));
      setDifficulty(r.difficulty ?? "中等");
      setCategory(r.recipeCategory ?? "中菜");
      setSourceUrl(r.sourceUrl ?? "");
      setTags((r.tags || []).join(" "));
      setImageError(false);
      if (r.image || r.thumbnailUrl) setImageUri(r.thumbnailUrl || r.image);
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
        setIngredients(r.ingredients.map((ing: any, i: number) => ({
          id: `ing_${i}`,
          name: ing.name ?? "",
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit ?? "克",
        })));
      }
      if (Array.isArray(r.steps) && r.steps.length > 0) {
        setSteps(r.steps.map((s: any, i: number) => ({
          id: i + 1,
          instruction: typeof s === "string" ? s : (s.instruction ?? s.description ?? ""),
          duration: s.duration ?? 0,
          imageUri: s.image || undefined,
          imageBase64: undefined,
        })));
      }
    }
  }, [recipeQ.data]);

  // 新增食譜模式：自動續寫最近一份草稿（Instagram 式 Drafts）
  const draftQ = trpc.recipes.getDraft.useQuery(undefined, { enabled: !isEditing });

  useEffect(() => {
    if (isEditing || !draftQ.data || hydratedRef.current) return;
    const d = draftQ.data as any;
    if (!d) return;
    // 淨係真係有內容先續寫；空頭草稿當全新開始
    const hasRealContent = !!d.name
      || (Array.isArray(d.ingredients) && d.ingredients.length > 0)
      || (Array.isArray(d.steps) && d.steps.length > 0)
      || !!d.description || !!d.image || !!d.thumbnailUrl
      || (Array.isArray(d.tags) && d.tags.length > 0);
    if (!hasRealContent) return;
    hydratedRef.current = true;
    const parsed = parseInt(String(d.id).replace("user_", ""), 10);
    setDraftId(isNaN(parsed) ? null : parsed);
    setIsDraft(true);
    setName(d.name ?? "");
    setDescription(d.description ?? "");
    setServings(String(d.servings ?? 4));
    setPrepTime(String(d.prepTime ?? 15));
    setCookTime(String(d.cookTime ?? 30));
    setDifficulty(d.difficulty ?? "中等");
    setCategory(d.recipeCategory ?? "中菜");
    setSourceUrl(d.sourceUrl ?? "");
    setTags((d.tags || []).join(" "));
    setImageError(false);
    if (d.image || d.thumbnailUrl) setImageUri(d.thumbnailUrl || d.image);
    if (Array.isArray(d.ingredients) && d.ingredients.length > 0) {
      setIngredients(d.ingredients.map((ing: any, i: number) => ({
        id: `ing_${i}`,
        name: ing.name ?? "",
        quantity: String(ing.quantity ?? ""),
        unit: ing.unit ?? "克",
      })));
    }
    if (Array.isArray(d.steps) && d.steps.length > 0) {
      setSteps(d.steps.map((s: any, i: number) => ({
        id: i + 1,
        instruction: typeof s === "string" ? s : (s.instruction ?? s.description ?? ""),
        duration: s.duration ?? 0,
        imageUri: s.image || undefined,
        imageBase64: undefined,
      })));
    }
  }, [draftQ.data, isEditing]);

  const goToRecipeDetail = (recipeId?: string | number | null) => {
    if (recipeId != null) {
      router.replace({ pathname: "/recipe/[id]", params: { id: `user_${recipeId}` } });
    } else {
      router.back();
    }
  };

  const createM = trpc.recipes.createBlank.useMutation({
    onSuccess: async (data) => {
      await invalidateRecipesAndWeekly();
      goToRecipeDetail(data?.id);
    },
    onError: (e) => { setIsSaving(false); Alert.alert("儲存失敗", e.message); },
  });
  const updateM = trpc.recipes.updateUser.useMutation({
    onSuccess: async () => {
      await invalidateRecipesAndWeekly();
      const hitId =
        draftId != null ? draftId
        : isEditing && editingId ? editingId
        : null;
      if (hitId != null) {
        utils.recipes.getById.invalidate({ id: String(hitId) });
        utils.recipes.getById.invalidate({ id: `user_${hitId}` });
      }
      goToRecipeDetail(hitId);
    },
    onError: (e) => { setIsSaving(false); Alert.alert("更新失敗", e.message); },
  });

  // 草稿專用 mutations：無導航副作用，由 saveDraftAndLeave 自己控制離開
  const createDraftM = trpc.recipes.createBlank.useMutation({
    onSuccess: async () => {
      await invalidateRecipesAndWeekly();
    },
  });
  const updateDraftM = trpc.recipes.updateUser.useMutation({
    onSuccess: async () => {
      await invalidateRecipesAndWeekly();
      if (editingId) {
        utils.recipes.getById.invalidate({ id: String(editingId) });
        utils.recipes.getById.invalidate({ id: `user_${editingId}` });
      }
    },
  });

  const uploadImageM = trpc.recipes.uploadRecipeImage.useMutation();

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, []);

  const captureFromSource = async (source: "camera" | "library", kind: "cover" | "step", idx?: number) => {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("需要相機權限", "請在系統設定中允許存取相機，才能拍攝食譜圖片。");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("需要相簿權限", "請在系統設定中允許存取相簿，才能選擇圖片。");
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.8,
      base64: false,
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (kind === "cover") {
      setImageError(false);
      try {
        const compressed = await compressImage(asset.uri);
        setImageUri(compressed.uri);
        setImageBase64(compressed.base64);
      } catch {
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
      }
    } else if (idx != null) {
      try {
        const compressed = await compressImage(asset.uri);
        setSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: compressed.uri, imageBase64: compressed.base64,
        } : s));
      } catch {
        setSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: asset.uri, imageBase64: asset.base64,
        } : s));
      }
    }
  };

  const askImageSource = (kind: "cover" | "step", idx?: number) => {
    const onPick = (source: "camera" | "library") => {
      captureFromSource(source, kind, idx).catch((e: any) => {
        Alert.alert("無法開啟相機/相簿", e?.message || "請檢查權限設定");
      });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["📷 影相", "🖼 從相簿選擇", "取消"],
          cancelButtonIndex: 2,
        },
        (btnIdx) => {
          if (btnIdx === 0) onPick("camera");
          else if (btnIdx === 1) onPick("library");
        },
      );
    } else {
      Alert.alert("加入圖片", "選擇來源", [
        { text: "📷 影相", onPress: () => onPick("camera") },
        { text: "🖼 從相簿選擇", onPress: () => onPick("library") },
        { text: "取消", style: "cancel" },
      ]);
    }
  };

  const pickImage = async () => askImageSource("cover");

  // Ingredient ops
  const addIngredient = () => {
    const newId = `ing_${Date.now()}`;
    setIngredients(prev => [
      ...prev, { id: newId, name: "", quantity: "", unit: "克" },
    ]);
    setTimeout(() => {
      ingredientInputRefs.current.get(newId)?.focus();
      // 由 onFocus 統一 scroll（scrollToFocused），唔再喺度重複 scroll
    }, 100);
  };
  const updateIngredient = (idx: number, field: keyof Ingredient, val: string) =>
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing));
  const removeIngredient = (idx: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Step ops
  const addStep = () => {
    const newId = steps.length + 1;
    setSteps(prev => [
      ...prev, { id: newId, instruction: "", duration: 0, imageUri: undefined, imageBase64: undefined },
    ]);
    setTimeout(() => {
      stepInputRefs.current.get(newId)?.focus();
      // 由 onFocus 統一 scroll（scrollToFocused），唔再喺度重複 scroll
    }, 100);
  };
  const updateStep = (idx: number, field: keyof Step, val: string | number) =>
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const pickStepImage = async (idx: number) => askImageSource("step", idx);
  const removeStepImage = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i === idx ? {
      ...s, imageUri: undefined, imageBase64: undefined,
    } : s));
  };
  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, id: i + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("請輸入食譜名稱"); return; }
    const validIngredients = ingredients.filter(i => i.name.trim());
    const validSteps = steps.filter(s => s.instruction.trim());
    if (validIngredients.length === 0) { Alert.alert("請至少輸入一種食材"); return; }
    if (validSteps.length === 0) { Alert.alert("請至少輸入一個步驟"); return; }

    // Numeric field validation (prevent NaN / negative values)
    const numRe = /^(\d+)$/;
    if (!numRe.test(servings.trim())) { Alert.alert("份量", "請輸入正整數（例如 2、4）"); return; }
    if (!numRe.test(cookTime.trim())) { Alert.alert("烹調時間", "請輸入正整數（分鐘）"); return; }
    if (!numRe.test(prepTime.trim())) { Alert.alert("備料時間", "請輸入正整數（分鐘）"); return; }

    setIsSaving(true);
    setSaveStep(0);
    const timer = setInterval(() => setSaveStep(prev => Math.min(prev + 1, 2)), 2500);
    saveTimerRef.current = timer;

    try {
      let imageUrl = imageUri || "";
      if (imageBase64) {
        setSaveStep(1);
        const up = await uploadImageM.mutateAsync({ base64: imageBase64, mimeType: "image/jpeg" });
        imageUrl = up?.url || "";
      }

      const stepImages: (string | null)[] = [];
      for (const s of validSteps) {
        if (s.imageBase64) {
          try {
            const up = await uploadImageM.mutateAsync({ base64: s.imageBase64, mimeType: "image/jpeg" });
            stepImages.push(up?.url || null);
          } catch { stepImages.push(null); }
        } else {
          stepImages.push(s.imageUri || null);
        }
      }
      setSaveStep(2);

      const recipeTags = tags.split(/[\s,，]+/).map(t => t.replace(/^#/, "").trim()).filter(t => t.length > 0);
      const recipeData = {
        name: name.trim(),
        description: description.trim(),
        image: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl: extractSourceUrl(sourceUrl),
        servings: parseInt(servings) || 4,
        prepTime: parseInt(prepTime) || 15,
        cookTime: parseInt(cookTime) || 30,
        difficulty,
        recipeCategory: category,
        tags: recipeTags.length > 0 ? recipeTags : ["自訂"],
        ingredients: validIngredients.map(i => ({
          name: i.name, quantity: i.quantity, unit: i.unit, category: "食材",
        })),
        steps: validSteps.map((s, i) => ({
          instruction: s.instruction, duration: s.duration || 0,
          image: stepImages[i] || undefined,
        })),
        isDraft: false as const,
      };

      clearInterval(timer);
      saveTimerRef.current = null;
      if (draftId != null) {
        updateM.mutate({ ...recipeData, id: draftId } as any);
      } else if (isEditing && editingId) {
        updateM.mutate({ ...recipeData, id: editingId } as any);
      } else {
        createM.mutate(recipeData as any);
      }
    } catch (e: any) {
      clearInterval(timer);
      saveTimerRef.current = null;
      setIsSaving(false);
      Alert.alert("儲存失敗", e?.message || "圖片上傳失敗，請重試");
    }
  };

  // 有未儲存內容？（供 iOS 滑動返回／header ✕／Android back 統一攔截判斷）
  const hasUnsaved = useMemo(() => {
    if (
      name.trim() || description.trim() || sourceUrl.trim() || tags.trim() ||
      servings !== "4" || prepTime !== "15" || cookTime !== "30" ||
      difficulty !== "中等" || category !== "中菜"
    ) return true;
    if (ingredients.some(i => i.name.trim())) return true;
    if (steps.some(s => s.instruction.trim())) return true;
    if (imageUri || imageBase64) return true;
    if (steps.some(s => s.imageUri || s.imageBase64)) return true;
    return false;
  }, [name, description, sourceUrl, tags, servings, prepTime, cookTime, difficulty, category, ingredients, steps, imageUri, imageBase64]);

  // 是否可發佈（完整：有名 + ≥1 食材 + ≥1 步驟 + 數字有效）
  const isComplete = useMemo(() => {
    if (!name.trim()) return false;
    if (!ingredients.some(i => i.name.trim())) return false;
    if (!steps.some(s => s.instruction.trim())) return false;
    const numRe = /^(\d+)$/;
    if (!numRe.test(servings.trim()) || !numRe.test(cookTime.trim()) || !numRe.test(prepTime.trim())) return false;
    return true;
  }, [name, ingredients, steps, servings, cookTime, prepTime]);

  // 已確認離開／已儲存成功：放行，唔再彈「放棄編輯？」
  const [allowLeave, setAllowLeave] = useState(false);

  const leave = useCallback((opts: { action?: any } = {}) => {
    setAllowLeave(true);
    if (opts.action) navigation.dispatch(opts.action);
    else router.back();
  }, [navigation, router]);

  // 未完成內容自動存草稿（Option 1：唔問，靜默儲存後離開）
  const saveDraftAndLeave = useCallback(async (opts: { action?: any } = {}) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      let imageUrl = imageUri || "";
      if (imageBase64) {
        const up = await uploadImageM.mutateAsync({ base64: imageBase64, mimeType: "image/jpeg" });
        imageUrl = up?.url || "";
      }
      const stepImages: (string | null)[] = [];
      for (const s of steps) {
        if (s.imageBase64) {
          try {
            const up = await uploadImageM.mutateAsync({ base64: s.imageBase64, mimeType: "image/jpeg" });
            stepImages.push(up?.url || null);
          } catch { stepImages.push(s.imageUri || null); }
        } else {
          stepImages.push(s.imageUri || null);
        }
      }
      const recipeTags = tags.split(/[\s,，]+/).map(t => t.replace(/^#/, "").trim()).filter(t => t.length > 0);
      const recipeData: any = {
        name: name.trim() || "未命名草稿",
        description: description.trim(),
        image: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl: extractSourceUrl(sourceUrl),
        servings: parseInt(servings) || 4,
        prepTime: parseInt(prepTime) || 15,
        cookTime: parseInt(cookTime) || 30,
        difficulty,
        recipeCategory: category,
        tags: recipeTags.length > 0 ? recipeTags : ["自訂"],
        ingredients: ingredients.map(i => ({
          name: i.name || "", quantity: i.quantity, unit: i.unit || "克", category: "食材",
        })),
        steps: steps.map((s, i) => ({
          instruction: s.instruction, duration: s.duration || 0,
          image: stepImages[i] || undefined,
        })),
        isDraft: true,
      };

      let targetId: number | null = draftId;
      if (targetId == null && isDraft && editingId) targetId = editingId;
      if (targetId == null) {
        // getDraft 壞咗都唔好封死用戶：當冇現有草稿，直接開新一份
        try {
          const existing = await utils.recipes.getDraft.fetch();
          if (existing && existing.id) {
            const parsed = parseInt(String(existing.id).replace("user_", ""), 10);
            if (!isNaN(parsed)) targetId = parsed;
          }
        } catch { /* fall through → create */ }
      }
      if (targetId != null) {
        setDraftId(targetId);
        await updateDraftM.mutateAsync({ ...recipeData, id: targetId } as any);
      } else {
        await createDraftM.mutateAsync(recipeData as any);
      }
    } catch (e: any) {
      setIsSaving(false);
      Alert.alert("儲存草稿失敗", e?.message || "請重試");
      return;
    }
    setIsSaving(false);
    leave(opts);
  }, [isSaving, imageUri, imageBase64, steps, tags, name, description, sourceUrl, servings, prepTime, cookTime, difficulty, category, ingredients, isDraft, editingId, draftId, uploadImageM, updateDraftM, createDraftM, utils, leave]);

  // 統一退出入口：header ✕ / iOS 滑動返回 / Android back / usePreventRemove
  const onExitRequested = useCallback((opts: { action?: any } = {}) => {
    if (isSaving) return;
    if (!hasUnsaved) { leave(opts); return; }
    // 已發佈食譜編輯中途 → 唔會用草稿覆蓋，只問「放棄」
    if (isEditing && !isDraft) {
      Alert.alert("放棄編輯？", "已輸入的內容將不會保存", [
        { text: "繼續編輯", style: "cancel" },
        { text: "放棄", style: "destructive", onPress: () => leave(opts) },
      ]);
      return;
    }
    // 全新／草稿 → Instagram 式「儲存草稿？」
    Alert.alert(
      "儲存草稿？",
      isComplete ? "內容完整，可先儲存為草稿，之後隨時發佈。" : "未完成嘅食譜會保存為草稿，之後可繼續編輯。",
      [
        { text: "取消", style: "cancel" },
        { text: "放棄", style: "destructive", onPress: () => leave(opts) },
        { text: "儲存草稿", onPress: () => saveDraftAndLeave(opts) },
      ],
    );
  }, [isSaving, hasUnsaved, isComplete, isEditing, isDraft, saveDraftAndLeave, leave]);

  const handleDiscard = useCallback(() => onExitRequested(), [onExitRequested]);

  // 刪除草稿（只有草稿狀態先顯示）
  const deleteDraftM = trpc.recipes.deleteUser.useMutation({
    onSuccess: async () => {
      await invalidateRecipesAndWeekly();
      setAllowLeave(true);
      router.back();
    },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });
  const handleDeleteDraft = useCallback(() => {
    const id = draftId != null ? draftId
      : isDraft && editingId != null ? editingId
      : null;
    if (id == null) return;
    Alert.alert("刪除草稿？", "草稿刪除後無法復原。", [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: () => deleteDraftM.mutate({ id }) },
    ]);
  }, [draftId, isDraft, editingId, deleteDraftM]);

  // iOS 滑動返回 / header 返回 / 程式導航：統一攔截（保留 swipe 手勢）
  usePreventRemove(
    hasUnsaved && !isSaving && !allowLeave,
    ({ data }) => {
      onExitRequested({ action: data.action });
    }
  );

  // Android 硬件返回：同 header ✕ 一致
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleDiscard();
      return true;
    });
    return () => sub.remove();
  }, [handleDiscard]);

  const validIngCount = ingredients.filter(i => i.name.trim()).length;
  const validStepCount = steps.filter(s => s.instruction.trim()).length;
  const isPending = createM.isPending || updateM.isPending || isSaving;

  return (
    <>
      <Stack.Screen
        options={{
          title: isDraft ? "草稿 ✏️" : (isEditing ? "編輯食譜" : "新增食譜 ✨"),
          headerShown: true,
          headerBackTitle: '',
          headerBackButtonMenuEnabled: false,
          headerStyle: { backgroundColor: BG },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "800", color: TEXT },
          gestureEnabled: true,
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} style={{ marginLeft: 4 }}>
              <Ionicons name="close" size={24} color={TEXT} />
            </TouchableOpacity>
          ),
          headerRight: () => (isDraft && (draftId != null || editingId != null)) ? (
            <TouchableOpacity onPress={handleDeleteDraft} style={{ marginRight: 4 }}>
              <Ionicons name="trash-outline" size={20} color={ROSE} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={st.root}
        behavior={Platform.OS === "ios" ? "position" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
        {/* Recipe Photo */}
        <TouchableOpacity style={st.card} onPress={pickImage} activeOpacity={0.85}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#FDF2F8" }]}>
              <Ionicons name="camera-outline" size={18} color="#DB2777" />
            </View>
            <Text style={st.cardTitle}>食譜相片</Text>
          </View>
          {imageUri && !imageError ? (
            <Image source={{ uri: imageUri }} style={st.recipeImage} onError={() => setImageError(true)} />
          ) : (
            <View style={st.imagePH}>
              <Ionicons name="image-outline" size={48} color="#B0BAC9" />
              <Text style={st.imagePHTxt}>點擊上載食譜圖片</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Recipe Details */}
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#EEF4FB" }]}>
              <Ionicons name="document-text-outline" size={18} color={BRAND} />
            </View>
            <Text style={st.cardTitle}>食譜資訊</Text>
          </View>

          <Text style={st.label}>食譜名稱 *</Text>
          <TextInput style={st.input} value={name} onChangeText={setName}
            onFocus={scrollToFocused}
            placeholder="例：媽媽的秘製紅燒肉" placeholderTextColor={HINT} />

          <Text style={st.label}>描述</Text>
          <TextInput style={[st.input, st.multi]} value={description} onChangeText={setDescription}
            onFocus={scrollToFocused}
            placeholder="描述這道菜的特色..." placeholderTextColor={HINT} multiline numberOfLines={2} />

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>準備時間 (分鐘)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={prepTime}
                onChangeText={setPrepTime} onFocus={scrollToFocused} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>烹飪時間 (分鐘)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={cookTime}
                onChangeText={setCookTime} onFocus={scrollToFocused} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
          </View>

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>份量 (人份)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={servings}
                onChangeText={setServings} onFocus={scrollToFocused} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>難度</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {DIFFICULTY_OPTIONS.map(d => (
                  <TouchableOpacity key={d}
                    style={[st.chip, st.chipFlex, difficulty === d && st.chipActive]}
                    onPress={() => setDifficulty(d)}>
                    <Text style={[st.chipTxt, difficulty === d && st.chipTxtActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={st.label}>分類</Text>
          <View style={st.catGrid}>
            {CATEGORY_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.key}
                style={[st.catChip, category === opt.key && st.catChipActive]}
                onPress={() => setCategory(opt.key)}>
                <Ionicons name={opt.icon as any} size={18} color={category === opt.key ? "#fff" : BRAND} />
                <Text style={[st.catLabel, category === opt.key && st.catLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[st.label, { marginTop: 12 }]}>標籤</Text>
          <TextInput style={st.input} value={tags} onChangeText={setTags}
            onFocus={scrollToFocused}
            placeholder="例：家常菜 快手菜 雞肉" placeholderTextColor={HINT} />
          <Text style={st.tagSuggestLabel}>常用標籤</Text>
          <View style={st.catGrid}>
            {SUGGESTED_TAGS.map(tag => {
              const active = currentTagList.includes(tag);
              return (
                <TouchableOpacity key={tag}
                  style={[st.catChip, active && st.catChipActive]}
                  onPress={() => toggleTag(tag)}>
                  <Text style={[st.catLabel, active && st.catLabelActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[st.label, { marginTop: 16 }]}>來源連結（選填）</Text>
          <TextInput style={st.input} value={sourceUrl} onChangeText={setSourceUrl}
            onFocus={scrollToFocused}
            placeholder="例：https://www.instagram.com/reel/xxx 或 YouTube 連結"
            placeholderTextColor={HINT}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={st.hint}>新增來源連結後，食譜詳情頁將顯示「教學影片 by 作者」</Text>
        </View>

        {/* Ingredients */}
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="basket-outline" size={18} color={GREEN} />
            </View>
            <Text style={st.cardTitle}>食材清單 ({validIngCount} 項)</Text>
          </View>

          <View style={st.ingHdr}>
            <Text style={[st.ingHdrTxt, { flex: 1 }]}>食材名稱</Text>
            <Text style={[st.ingHdrTxt, { width: 64, textAlign: "center" }]}>份量</Text>
            <Text style={[st.ingHdrTxt, { width: 64, textAlign: "center" }]}>單位</Text>
            <View style={{ width: 32 }} />
          </View>

          {ingredients.map((ing, idx) => (
            <View key={ing.id} style={st.ingRow}>
              <TextInput style={[st.ingInput, { flex: 1 }]} value={ing.name}
                onChangeText={v => updateIngredient(idx, "name", v)}
                onFocus={scrollToFocused}
                ref={ref => {
                  if (ref) ingredientInputRefs.current.set(ing.id, ref);
                  else ingredientInputRefs.current.delete(ing.id);
                }}
                placeholder="食材名稱" placeholderTextColor={HINT} />
              <TextInput style={[st.ingInput, { width: 64, textAlign: "center" }]} value={ing.quantity}
                onChangeText={v => updateIngredient(idx, "quantity", v)}
                onFocus={scrollToFocused}
                placeholder="份量" placeholderTextColor={HINT} />
              <UnitPicker value={ing.unit} onChange={v => updateIngredient(idx, "unit", v)}
                style={{ width: 64, height: 40 }} />
              <TouchableOpacity style={[st.delBtn, ingredients.length <= 1 && st.delDisabled]}
                onPress={() => removeIngredient(idx)} disabled={ingredients.length <= 1}>
                <Ionicons name="close" size={14}
                  color={ingredients.length <= 1 ? HINT : ROSE} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={st.addBtn} onPress={addIngredient} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color={GREEN} />
            <Text style={st.addBtnTxt}>新增食材</Text>
          </TouchableOpacity>
        </View>
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#E8F0FA" }]}>
              <Ionicons name="list-outline" size={18} color={BRAND} />
            </View>
            <Text style={st.cardTitle}>烹飪步驟 ({validStepCount} 步)</Text>
          </View>

          {steps.map((step, idx) => (
            <View key={step.id} style={[st.stepBlock, idx < steps.length - 1 && st.stepBorder]}>
              <View style={st.stepNum}>
                <Text style={st.stepNumTxt}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput style={[st.ingInput, st.multi, { marginBottom: 6 }]} value={step.instruction}
                  onChangeText={v => updateStep(idx, "instruction", v)}
                  onFocus={scrollToFocused}
                  ref={ref => {
                    if (ref) stepInputRefs.current.set(step.id, ref);
                    else stepInputRefs.current.delete(step.id);
                  }}
                  placeholder={`第 ${idx + 1} 步驟說明...`}
                  placeholderTextColor={HINT} multiline numberOfLines={2} />

                {/* Step image thumbnail */}
                {step.imageUri ? (
                  <View style={st.stepImageWrap}>
                    <Image source={{ uri: step.imageUri }} style={st.stepImage} />
                    <TouchableOpacity style={st.stepImageDel} onPress={() => removeStepImage(idx)}>
                      <Ionicons name="close-circle" size={22} color={ROSE} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 12, color: SUB }}>時間（分鐘）：</Text>
                  <TextInput style={[st.ingInput, { width: 64, textAlign: "center" }]}
                    value={String(step.duration || 0)}
                    onChangeText={v => updateStep(idx, "duration", parseInt(v) || 0)}
                    onFocus={scrollToFocused}
                    keyboardType="numeric" placeholderTextColor={HINT} />
                  <TouchableOpacity style={st.stepCameraBtn} onPress={() => pickStepImage(idx)}>
                    <Ionicons name="camera-outline" size={14} color={step.imageUri ? BRAND : SUB} />
                    <Text style={[st.stepCameraTxt, step.imageUri && { color: BRAND }]}>
                      {step.imageUri ? "已上載" : "教學圖片"}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={[st.delBtn, steps.length <= 1 && st.delDisabled]}
                    onPress={() => removeStep(idx)} disabled={steps.length <= 1}>
                    <Ionicons name="close" size={14}
                      color={steps.length <= 1 ? HINT : ROSE} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[st.addBtn, st.addBtnStep]} onPress={addStep} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color={BRAND} />
            <Text style={[st.addBtnTxt, { color: BRAND }]}>新增步驟</Text>
          </TouchableOpacity>
        </View>

        {/* Save / Discard */}
        <View style={[st.actions, { marginBottom: Math.max(insets.bottom + 12, 44) }]}>
          <TouchableOpacity style={[st.saveBtn, isPending && { opacity: 0.6 }]}
            onPress={handleSave} disabled={isPending}>
            {isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={st.saveBtnTxt}>儲存食譜</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={st.discardBtn} onPress={handleDiscard}>
            <Text style={st.discardBtnTxt}>放棄</Text>
          </TouchableOpacity>
        </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Saving overlay */}
        <Modal visible={isSaving && !isPending} transparent animationType="fade">
          <View style={st.overlay}>
            <View style={st.overlayBox}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={st.overlayTitle}>儲存中</Text>
              <View style={st.overlaySteps}>
                {["驗證資料...", "上載圖片...", "儲存到食譜庫..."].map((s, i) => (
                  <View key={s} style={st.overlayStep}>
                    {i < saveStep ? (
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    ) : i === saveStep ? (
                      <ActivityIndicator size="small" color={BRAND} />
                    ) : (
                      <View style={st.overlayDot} />
                    )}
                    <Text style={[st.overlayStepTxt,
                      i < saveStep && { color: "#22C55E" },
                      i === saveStep && { color: BRAND, fontWeight: "700" },
                    ]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Cards
  card: {
    backgroundColor: "#FFFFFF", marginHorizontal: 16, marginTop: 14,
    borderRadius: 20, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: TEXT },

  // Image
  recipeImage: { width: "100%", height: 200, borderRadius: 14, marginTop: 4 },
  imagePH: {
    width: "100%", height: 140, borderRadius: 14, marginTop: 4,
    backgroundColor: "#F9FAFB", borderWidth: 2, borderColor: "#E5E7EB",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8,
  },
  imagePHTxt: { fontSize: 14, color: HINT, fontWeight: "600" },

  // Form
  label: { fontSize: 13, fontWeight: "700", color: "#5A4A3A", marginBottom: 6 },
  hint: { fontSize: 12, color: HINT, marginBottom: 14, marginTop: -8 },
  input: {
    backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: TEXT, marginBottom: 14,
  },
  multi: { height: 72, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 14 },

  // Chips
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: BORDER,
  },
  chipFlex: { flex: 1, alignItems: "center" },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipTxt: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  chipTxtActive: { color: "#fff" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagSuggestLabel: { fontSize: 12, fontWeight: "700", color: SUB, marginBottom: 8, marginTop: -4 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: BORDER,
  },
  catChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  catLabel: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  catLabelActive: { color: "#fff" },

  // Ingredient
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    minWidth: 150, alignSelf: "flex-start",
    backgroundColor: "#E8F5E9", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnTxt: { fontSize: 12, fontWeight: "700", color: GREEN },
  addBtnStep: { backgroundColor: "#E8F0FA" },
  ingHdr: { flexDirection: "row", gap: 8, marginBottom: 6, paddingHorizontal: 2 },
  ingHdrTxt: { fontSize: 11, fontWeight: "700", color: SUB },
  ingRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  ingInput: {
    backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: TEXT,
  },
  delBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  delDisabled: { backgroundColor: "#EEF4FB" },

  // Steps
  stepBlock: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: "#F9F6F2" },
  stepNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 8,
  },
  stepNumTxt: { fontSize: 13, fontWeight: "900", color: "#fff" },
  stepImageWrap: { marginBottom: 8, position: "relative" as const },
  stepImage: { width: "100%", height: 140, borderRadius: 10 },
  stepImageDel: { position: "absolute" as const, top: -6, right: -6 },
  stepCameraBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    backgroundColor: "#F5F8FC", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  stepCameraTxt: { fontSize: 11, fontWeight: "600", color: SUB },

  // Actions
  actions: { marginHorizontal: 16, marginTop: 24, marginBottom: 44, gap: 12 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: BRAND, paddingVertical: 18, borderRadius: 20,
    shadowColor: BRAND, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  saveBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "900" },
  discardBtn: {
    alignItems: "center", paddingVertical: 14, borderRadius: 16,
  },
  discardBtnTxt: { fontSize: 14, color: SUB, fontWeight: "600" },

  // Saving overlay
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
  },
  overlayBox: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32,
    width: "80%", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  overlayTitle: { fontSize: 18, fontWeight: "800", color: BRAND, marginTop: 16, marginBottom: 24 },
  overlaySteps: { width: "100%", gap: 12 },
  overlayStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  overlayStepTxt: { fontSize: 14, color: SUB },
  overlayDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
});
