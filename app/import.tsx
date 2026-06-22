/**
 * 食譜匯入頁面 — 最核心功能
 * 支援：剪貼板自動偵測 URL、手動貼上 URL、截圖上傳、文字貼上
 */
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import UnitPicker from "@/src/components/UnitPicker";

type ImportStep = "input" | "parsing" | "preview" | "success" | "failed";
type ImportMethod = "url" | "xiaohongshu" | "screenshot" | "manual";
type EditableIngredient = { id: string; name: string; quantity: string; unit: string };
type EditableStep = { id: number; instruction: string; duration: number; imageUri?: string | null; imageBase64?: string | null };

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("input");
  const [method, setMethod] = useState<ImportMethod>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("中菜");
  const isImportingRef = useRef(false);
  const isParsingRef = useRef(false);
  const parseStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [parseStepIndex, setParseStepIndex] = useState(0);

  // Editable recipe states
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCookTime, setEditCookTime] = useState("30");
  const [editServings, setEditServings] = useState("4");
  const [editDifficulty, setEditDifficulty] = useState("中等");
  const [editIngredients, setEditIngredients] = useState<EditableIngredient[]>([]);
  const [editSteps, setEditSteps] = useState<EditableStep[]>([]);
  const [editTags, setEditTags] = useState("");
  const [recipeImageUri, setRecipeImageUri] = useState<string | null>(null);
  const [recipeImageBase64, setRecipeImageBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStepIdx, setSaveStepIdx] = useState(0);
  const saveStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const SAVE_STEPS = ["上載圖片...", "整理食譜資料...", "儲存到食譜庫..."];

  // Initialize editable states when parsedRecipe is set
  const initEditFromParsed = (recipe: any) => {
    setEditName(recipe.name || "");
    setEditDesc(recipe.description || "");
    setEditCookTime(String(recipe.cookTime || 30));
    setEditServings(String(recipe.servings || 4));
    setEditDifficulty(recipe.difficulty || "中等");
    setSelectedCategory(recipe.recipeCategory || "中菜");
    setEditTags((recipe.tags || []).join(" "));
    setEditIngredients(
      (recipe.ingredients || []).map((ing: any, i: number) => ({
        id: `ing_${i}`,
        name: ing.name || "",
        quantity: String(ing.quantity || ""),
        unit: ing.unit || "",
      }))
    );
    setEditSteps(
      (recipe.steps || []).map((s: any, i: number) => ({
        id: i + 1,
        instruction: typeof s === "string" ? s : (s.instruction || s.description || ""),
        duration: s.duration || 0,
        imageUri: s.image || undefined,
        imageBase64: undefined,
      }))
    );
    if (recipe.image || recipe.thumbnailUrl) {
      setRecipeImageUri(recipe.thumbnailUrl || recipe.image);
    }
  };

  // Pick recipe image
  const handlePickRecipeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setRecipeImageUri(asset.uri);
      setRecipeImageBase64(asset.base64 || null);
    }
  };

  // Ingredient edit handlers
  const addIngredient = () => setEditIngredients(prev => [
    ...prev,
    { id: `ing_${Date.now()}`, name: "", quantity: "", unit: "" },
  ]);
  const updateIngredient = (idx: number, field: keyof EditableIngredient, val: string) =>
    setEditIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing));
  const removeIngredient = (idx: number) => {
    if (editIngredients.length <= 1) return;
    setEditIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Step edit handlers
  const addStep = () => setEditSteps(prev => [
    ...prev,
    { id: prev.length + 1, instruction: "", duration: 0, imageUri: undefined, imageBase64: undefined },
  ]);
  const updateStep = (idx: number, field: keyof EditableStep, val: string | number) =>
    setEditSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const pickStepImage = async (idx: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setEditSteps(prev => prev.map((s, i) => i === idx ? {
        ...s, imageUri: result.assets[0].uri, imageBase64: result.assets[0].base64,
      } : s));
    }
  };
  const removeStepImage = (idx: number) => {
    setEditSteps(prev => prev.map((s, i) => i === idx ? {
      ...s, imageUri: undefined, imageBase64: undefined,
    } : s));
  };
  const removeStep = (idx: number) => {
    if (editSteps.length <= 1) return;
    setEditSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, id: i + 1 })));
  };

  const PARSE_STEPS = ["讀取內容", "識別食材", "整理步驟", "生成食譜"];

  const startParseProgress = () => {
    setParseStepIndex(0);
    parseStepTimer.current = setInterval(() => {
      setParseStepIndex(prev => Math.min(prev + 1, PARSE_STEPS.length - 1));
    }, 4000);
  };

  const stopParseProgress = () => {
    if (parseStepTimer.current) {
      clearInterval(parseStepTimer.current);
      parseStepTimer.current = null;
    }
    setParseStepIndex(PARSE_STEPS.length - 1);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (parseStepTimer.current) {
        clearInterval(parseStepTimer.current);
        parseStepTimer.current = null;
      }
      if (saveStepTimer.current) {
        clearInterval(saveStepTimer.current);
        saveStepTimer.current = null;
      }
    };
  }, []);

  // 偵測剪貼板是否有 URL
  useEffect(() => {
    checkClipboard();
  }, []);

  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        setClipboardUrl(text);
      }
    } catch (e) {
      // 剪貼板讀取失敗，忽略
    }
  };

  // tRPC mutations
  const parseUrlMutation = trpc.recipes.parseUrl.useMutation({
    onSuccess: (data) => {
      isParsingRef.current = false;
      stopParseProgress();
      if (data.parseReason === "ok") {
        setParsedRecipe(data);
        initEditFromParsed(data);
        setStep("preview");
      } else if (data.parseReason === "no_recipe_content") {
        const platform = detectPlatform(urlInput);
        const platformHelp = platform ? `\n\n平台提示（${platform}）：\n${getPlatformHelp(platform)}` : "";
        setErrorMsg(
          `這個帖子沒有完整的食譜內容（例如只是用餐照片、產品推廣等）。${platformHelp}\n\n一般建議：\n• 試試截圖上傳帖子內的食材/步驟圖片\n• 複製帖子文字貼上解析\n• 換另一個包含完整食材和步驟的帖子`
        );
        setStep("failed");
      } else {
        const platform = detectPlatform(urlInput);
        let msg = "無法讀取此連結的內容，可能需要登入或內容已被刪除。";
        if (platform === "小紅書") {
          msg += "\n\n小紅書限制了自動讀取，請改用「貼上文字」功能：\n1. 在小紅書複製筆記的文字內容\n2. 切換到「貼上文字」分頁\n3. 貼上文字後點擊解析";
        } else {
          msg += "\n\n建議改用截圖上傳。";
        }
        setErrorMsg(msg);
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      setErrorMsg(err.message || "無法連接到解析服務，請稍後重試");
      setStep("failed");
    },
  });

  const parseTextMutation = trpc.recipes.parseText.useMutation({
    onSuccess: (data) => {
      isParsingRef.current = false;
      stopParseProgress();
      const reason = (data as any).parseReason;
      if (!reason || reason === "ok") {
        setParsedRecipe(data);
        initEditFromParsed(data);
        setStep("preview");
      } else {
        setErrorMsg("文字內容沒有足夠的食譜資訊。\n\n請確保文字包含食材清單和烹飪步驟。");
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      setErrorMsg(err.message || "無法解析文字內容");
      setStep("failed");
    },
  });

  const parseImageMutation = trpc.recipes.parseImage.useMutation({
    onSuccess: (data) => {
      isParsingRef.current = false;
      stopParseProgress();
      const reason = (data as any).parseReason;
      if (!reason || reason === "ok") {
        setParsedRecipe(data);
        initEditFromParsed(data);
        setStep("preview");
      } else {
        setErrorMsg("圖片中沒有足夠的食譜資訊。\n\n建議截取包含食材和步驟的完整截圖，避免只截取封面圖片。");
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      setErrorMsg(err.message || "無法解析圖片，請確保圖片清晰");
      setStep("failed");
    },
  });

  const uploadImageMutation = trpc.recipes.uploadRecipeImage.useMutation();

  const importMutation = trpc.recipes.importUser.useMutation({
    onSuccess: (data) => {
      setStep("success");
      setTimeout(() => {
        // recipe/[id].tsx expects "user_<numericId>" format
        router.replace({
          pathname: "/recipe/[id]",
          params: { id: `user_${data.id}` },
        });
      }, 1500);
    },
    onError: (err) => {
      isImportingRef.current = false;
      Alert.alert("儲存失敗", err.message);
    },
  });

  // ── Platform detection for better error messages ────────────────
  function detectPlatform(url: string): string | null {
    const u = url.toLowerCase();
    if (u.includes("instagram.com") || u.includes("ig.me")) return "Instagram";
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
    if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "小紅書";
    if (u.includes("threads.net")) return "Threads";
    if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return "Facebook";
    if (u.includes("tiktok.com") || u.includes("douyin.com")) return "TikTok/抖音";
    if (u.includes("weibo.com")) return "微博";
    if (u.includes("bilibili.com") || u.includes("b23.tv")) return "B站";
    return null;
  }

  function getPlatformHelp(platform: string): string {
    const tips: Record<string, string> = {
      "Instagram": "• 確認帖子包含詳細食材和步驟\n• 如只有相片，請用截圖上傳\n• 可嘗試 IG TV 版本的 Recipe",
      "YouTube": "• 確保影片描述區有食材清單\n• 某些食譜影片只用口述，建議截圖\n• 可複製影片描述文字用文字貼上",
      "小紅書": "• 小紅書限制了自動讀取，請改用「貼上文字」功能\n• 複製筆記中的文字貼上即可解析\n• 或截圖上傳帖子關鍵內容",
      "Threads": "• Threads 帖子內容可透過連結直接讀取\n• 確保帖子包含完整食材和步驟\n• 如內文較短，建議複製文字貼上解析",
      "Facebook": "• 確認帖子有文字版的食材步驟\n• 部分食譜以圖片/影片為主無法解析\n• 試試截圖上傳或複製文字",
      "TikTok/抖音": "• 確認影片描述有食材清單\n• 部分影片僅展示製作過程\n• 建議截圖關鍵畫面後上傳",
    };
    return tips[platform] || "• 確認連結包含完整食譜內容\n• 試試截圖上傳\n• 或複製文字貼上解析";
  }

  // Validate URL format
  function isValidUrl(url: string): boolean {
    try {
      const u = new URL(url.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch { return false; }
  }

  // 開始解析 URL
  const handleParseUrl = (url: string) => {
    if (isParsingRef.current) return;
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert("請輸入連結");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setErrorMsg("連結格式不正確，請輸入完整的網址（以 http:// 或 https:// 開頭）");
      setStep("failed");
      return;
    }
    isParsingRef.current = true;
    setStep("parsing");
    startParseProgress();
    parseUrlMutation.mutate({ url: trimmed });
  };

  // 選擇截圖
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      setStep("parsing");
      startParseProgress();
      // 上傳圖片後解析
      try {
        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: asset.base64!,
          mimeType: asset.mimeType || "image/jpeg",
        });
        parseImageMutation.mutate({ storageKey: uploadResult.key });
      } catch (e: any) {
        stopParseProgress();
        setErrorMsg("圖片上傳失敗，請重試");
        setStep("failed");
      }
    }
  };

  // 解析文字
  const handleParseText = () => {
    if (!textInput.trim()) {
      Alert.alert("請貼上食譜文字");
      return;
    }
    setStep("parsing");
    startParseProgress();
    parseTextMutation.mutate({ text: textInput.trim() });
  };

  // Save edited recipe with overlay
  const handleSaveEdited = async () => {
    if (!editName.trim()) { Alert.alert("請輸入食譜名稱"); return; }
    const validIngredients = editIngredients.filter(i => i.name.trim());
    const validSteps = editSteps.filter(s => s.instruction.trim());
    if (validIngredients.length === 0) { Alert.alert("請至少輸入一種食材"); return; }
    if (validSteps.length === 0) { Alert.alert("請至少輸入一個步驟"); return; }

    setIsSaving(true);
    setSaveStepIdx(0);
    saveStepTimer.current = setInterval(() => {
      setSaveStepIdx(prev => Math.min(prev + 1, SAVE_STEPS.length - 1));
    }, 3000);

    try {
      let imageUrl = parsedRecipe.image || parsedRecipe.thumbnailUrl || "";
      if (recipeImageBase64) {
        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: recipeImageBase64,
          mimeType: "image/jpeg",
        });
        imageUrl = uploadResult.url;
      }

      // Upload step images
      const stepImages: (string | null)[] = [];
      for (const s of validSteps) {
        if (s.imageBase64) {
          try {
            const up = await uploadImageMutation.mutateAsync({ base64: s.imageBase64, mimeType: "image/jpeg" });
            stepImages.push(up.url);
          } catch { stepImages.push(null); }
        } else {
          stepImages.push(s.imageUri || null);
        }
      }

      const tags = editTags
        .split(/[\s,，]+/)
        .map(t => t.replace(/^#/, "").trim())
        .filter(t => t.length > 0);

      importMutation.mutate({
        name: editName.trim(),
        description: editDesc.trim(),
        image: imageUrl,
        thumbnailUrl: imageUrl,
        cookTime: parseInt(editCookTime) || 30,
        servings: parseInt(editServings) || 4,
        difficulty: editDifficulty,
        recipeCategory: selectedCategory,
        ingredients: validIngredients.map(i => ({
          name: i.name, quantity: i.quantity, unit: i.unit, category: "食材",
        })),
        steps: validSteps.map((s, i) => ({
          instruction: s.instruction, duration: s.duration || 0,
          image: stepImages[i] || undefined,
        })),
        tags,
        sourceUrl: parsedRecipe.sourceUrl || "",
        sourceAuthor: parsedRecipe.sourceAuthor || "",
        visibility: "private" as const,
      });
    } catch (e: any) {
      setIsSaving(false);
      if (saveStepTimer.current) { clearInterval(saveStepTimer.current); saveStepTimer.current = null; }
      Alert.alert("儲存失敗", "圖片上傳失敗，請重試");
    }
  };

  // Reset saving state when import completes
  useEffect(() => {
    if (!importMutation.isPending && isSaving) {
      setIsSaving(false);
      if (saveStepTimer.current) { clearInterval(saveStepTimer.current); saveStepTimer.current = null; }
    }
  }, [importMutation.isPending]);

  // ── 解析中畫面 ──
  if (step === "parsing") {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#013E77" />
        <Text style={styles.parsingTitle}>AI 正在解析食譜...</Text>
        <Text style={styles.parsingSubtitle}>
          {parseStepIndex < PARSE_STEPS.length - 1
            ? "通常需要 10-30 秒，請耐心等候"
            : "即將完成..."}
        </Text>
        <View style={styles.parsingSteps}>
          {PARSE_STEPS.map((s, i) => {
            const isCompleted = i < parseStepIndex;
            const isActive = i === parseStepIndex;
            return (
              <View key={s} style={[styles.parsingStep, isActive && styles.parsingStepActive]}>
                {isCompleted ? (
                  <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                ) : isActive ? (
                  <ActivityIndicator size="small" color="#013E77" />
                ) : (
                  <View style={styles.parsingStepDot} />
                )}
                <Text style={[styles.parsingStepText, isActive && styles.parsingStepTextActive]}>
                  {s}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // ── 解析成功預覽（可編輯）──
  if (step === "preview" && parsedRecipe) {
    const isFormPending = importMutation.isPending || isSaving;
    return (
      <>
        <ScrollView style={styles.container}>
          <View style={styles.previewHeader}>
            <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
            <Text style={styles.previewTitle}>解析成功！</Text>
            <Text style={styles.previewSubtitle}>請編輯並確認食譜資訊</Text>
          </View>

          {/* Image section */}
          <TouchableOpacity style={es.card} onPress={handlePickRecipeImage}>
            {recipeImageUri ? (
              <Image source={{ uri: recipeImageUri }} style={es.recipeImage} />
            ) : parsedRecipe.thumbnailUrl ? (
              <Image source={{ uri: parsedRecipe.thumbnailUrl }} style={es.recipeImage} />
            ) : (
              <View style={es.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="#013E77" />
                <Text style={es.imagePlaceholderTxt}>點擊上載圖片</Text>
              </View>
            )}
            <View style={es.imageOverlay}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Text style={es.imageOverlayTxt}>更換圖片</Text>
            </View>
          </TouchableOpacity>

          {/* Basic Info */}
          <View style={es.card}>
            <Text style={es.cardTitle}>基本資訊</Text>

            <Text style={es.label}>食譜名稱</Text>
            <TextInput style={es.input} value={editName} onChangeText={setEditName} placeholder="食譜名稱" placeholderTextColor="#B0BAC9" />

            <Text style={es.label}>描述</Text>
            <TextInput style={[es.input, es.multilineInput]} value={editDesc} onChangeText={setEditDesc} placeholder="描述這道菜的特色..." placeholderTextColor="#B0BAC9" multiline numberOfLines={2} />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={es.label}>份量 (人)</Text>
                <TextInput style={[es.input, { textAlign: "center" }]} value={editServings} onChangeText={setEditServings} keyboardType="numeric" placeholderTextColor="#B0BAC9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={es.label}>時間 (分鐘)</Text>
                <TextInput style={[es.input, { textAlign: "center" }]} value={editCookTime} onChangeText={setEditCookTime} keyboardType="numeric" placeholderTextColor="#B0BAC9" />
              </View>
            </View>

            <Text style={es.label}>難度</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {["簡單", "中等", "困難"].map(d => (
                <TouchableOpacity key={d} style={[es.chip, editDifficulty === d && es.chipActive]} onPress={() => setEditDifficulty(d)}>
                  <Text style={[es.chipTxt, editDifficulty === d && es.chipTxtActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={es.label}>分類</Text>
            <View style={es.categoryRow}>
              {["中菜","西餐","日式","韓式","東南亞","甜品","飲品","其他"].map(cat => (
                <TouchableOpacity key={cat} style={[es.chip, selectedCategory === cat && es.chipActive]} onPress={() => setSelectedCategory(cat)}>
                  <Text style={[es.chipTxt, selectedCategory === cat && es.chipTxtActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[es.label, { marginTop: 14 }]}>標籤</Text>
            <TextInput style={es.input} value={editTags} onChangeText={setEditTags} placeholder="例：家常菜 快手菜 雞肉" placeholderTextColor="#B0BAC9" />
          </View>

          {/* Ingredients */}
          <View style={es.card}>
            <View style={es.cardRow}>
              <View style={[es.cardIcon, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="basket-outline" size={16} color="#4CAF50" />
              </View>
              <Text style={es.cardTitle}>食材清單 ({editIngredients.filter(i => i.name.trim()).length} 項)</Text>
              <TouchableOpacity style={es.addBtn} onPress={addIngredient}>
                <Ionicons name="add" size={13} color="#16A34A" />
                <Text style={es.addBtnTxt}>新增食材</Text>
              </TouchableOpacity>
            </View>

            {editIngredients.map((ing, idx) => (
              <View key={ing.id} style={es.ingRow}>
                <TextInput
                  style={[es.ingInput, { flex: 1 }]}
                  value={ing.name}
                  onChangeText={v => updateIngredient(idx, "name", v)}
                  placeholder="食材名稱"
                  placeholderTextColor="#B0BAC9"
                />
                <TextInput
                  style={[es.ingInput, { width: 64, textAlign: "center" }]}
                  value={ing.quantity}
                  onChangeText={v => updateIngredient(idx, "quantity", v)}
                  placeholder="份量"
                  placeholderTextColor="#B0BAC9"
                />
                <UnitPicker value={ing.unit} onChange={v => updateIngredient(idx, "unit", v)} style={{ width: 64, height: 40 }} />
                <TouchableOpacity
                  style={[es.delBtn, editIngredients.length <= 1 && es.delBtnDisabled]}
                  onPress={() => removeIngredient(idx)}
                  disabled={editIngredients.length <= 1}
                >
                  <Ionicons name="trash-outline" size={14} color={editIngredients.length <= 1 ? "#B0BAC9" : "#EF4444"} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Steps */}
          <View style={es.card}>
            <View style={es.cardRow}>
              <View style={[es.cardIcon, { backgroundColor: "#E8F0FA" }]}>
                <Ionicons name="restaurant-outline" size={16} color="#013E77" />
              </View>
              <Text style={es.cardTitle}>烹飪步驟 ({editSteps.filter(s => s.instruction.trim()).length} 步)</Text>
              <TouchableOpacity style={es.addBtn} onPress={addStep}>
                <Ionicons name="add" size={13} color="#013E77" />
                <Text style={[es.addBtnTxt, { color: "#013E77" }]}>新增步驟</Text>
              </TouchableOpacity>
            </View>

            {editSteps.map((step, idx) => (
              <View key={step.id} style={es.stepRow}>
                <View style={es.stepNum}>
                  <Text style={es.stepNumTxt}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[es.ingInput, es.multilineInput, { marginBottom: 6 }]}
                    value={step.instruction}
                    onChangeText={v => updateStep(idx, "instruction", v)}
                    placeholder={`第 ${idx + 1} 步驟說明...`}
                    placeholderTextColor="#B0BAC9"
                    multiline
                    numberOfLines={2}
                  />

                  {step.imageUri ? (
                    <View style={es.stepImageWrap}>
                      <Image source={{ uri: step.imageUri }} style={es.stepImage} />
                      <TouchableOpacity style={es.stepImageDel} onPress={() => removeStepImage(idx)}>
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 12, color: "#9CA3AF" }}>時間（分鐘）：</Text>
                    <TextInput
                      style={[es.ingInput, { width: 64, textAlign: "center" }]}
                      value={String(step.duration || 0)}
                      onChangeText={v => updateStep(idx, "duration", parseInt(v) || 0)}
                      keyboardType="numeric"
                      placeholderTextColor="#B0BAC9"
                    />
                    <TouchableOpacity style={es.stepCameraBtn} onPress={() => pickStepImage(idx)}>
                      <Ionicons name="camera-outline" size={14} color={step.imageUri ? "#013E77" : "#9CA3AF"} />
                      <Text style={[es.stepCameraTxt, step.imageUri && { color: "#013E77" }]}>
                        {step.imageUri ? "已上載" : "教學圖片"}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={[es.delBtn, editSteps.length <= 1 && es.delBtnDisabled]}
                      onPress={() => removeStep(idx)}
                      disabled={editSteps.length <= 1}
                    >
                      <Ionicons name="trash-outline" size={13} color={editSteps.length <= 1 ? "#B0BAC9" : "#EF4444"} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Save Button */}
          <View style={{ marginHorizontal: 16, marginBottom: Math.max(insets.bottom + 12, 40) }}>
            <TouchableOpacity style={es.saveBtn} onPress={handleSaveEdited} disabled={isFormPending}>
              {isFormPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={22} color="#fff" />
                  <Text style={es.saveBtnTxt}>儲存到食譜庫</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setStep("input"); setParsedRecipe(null); }}>
              <Text style={styles.retryButtonText}>重新匯入</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Saving overlay */}
        <Modal visible={isSaving} transparent animationType="fade">
          <View style={es.saveOverlay}>
            <View style={es.saveOverlayBox}>
              <ActivityIndicator size="large" color="#013E77" />
              <Text style={es.saveOverlayTitle}>正在儲存食譜</Text>
              <Text style={es.saveOverlaySub}>請稍候，不要離開此頁面</Text>
              <View style={es.saveStepsList}>
                {SAVE_STEPS.map((s, i) => {
                  const done = i < saveStepIdx;
                  const active = i === saveStepIdx;
                  return (
                    <View key={s} style={es.saveStepRow}>
                      {done ? (
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      ) : active ? (
                        <ActivityIndicator size="small" color="#013E77" />
                      ) : (
                        <View style={es.saveStepDot} />
                      )}
                      <Text style={[es.saveStepTxt, active && { color: "#013E77", fontWeight: "700" }, done && { color: "#22C55E" }]}>{s}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ── 匯入成功 ──
  if (step === "success") {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
        <Text style={styles.successTitle}>食譜已儲存！</Text>
        <Text style={styles.successSubtitle}>正在跳轉到食譜詳情...</Text>
      </View>
    );
  }

  // ── 解析失敗 ──
  if (step === "failed") {
    const isNoContent = errorMsg.includes("沒有完整的食譜") || errorMsg.includes("沒有足夠的食譜");
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.centerContainer}>
          <Ionicons
            name={isNoContent ? "information-circle" : "alert-circle"}
            size={64}
            color={isNoContent ? "#F59E0B" : "#EF4444"}
          />
          <Text style={styles.failedTitle}>
            {isNoContent ? "這個帖子沒有食譜" : "解析失敗"}
          </Text>
          <Text style={styles.failedMsg}>{errorMsg}</Text>

          {isNoContent && (
            <View style={styles.tipBox}>
              <View style={styles.tipBoxTitleRow}>
                <Ionicons name="bulb" size={16} color="#92400E" />
                <Text style={styles.tipBoxTitle}>什麼樣的帖子可以匯入？</Text>
              </View>
              <View style={styles.tipBoxRow}>
                <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                <Text style={styles.tipBoxText}>包含食材清單（如：雞肉 300g、蒜頭 3粒）</Text>
              </View>
              <View style={styles.tipBoxRow}>
                <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                <Text style={styles.tipBoxText}>包含烹飪步驟（如：1. 熱鍋下油... 2. 加入...）</Text>
              </View>
              <View style={styles.tipBoxRow}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={styles.tipBoxText}>純用餐照片或打卡帖子</Text>
              </View>
              <View style={styles.tipBoxRow}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={styles.tipBoxText}>只有食物名稱而無食材/步驟</Text>
              </View>
              <View style={styles.tipBoxRow}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={styles.tipBoxText}>廣告推廣帖子</Text>
              </View>
            </View>
          )}

          <View style={styles.failedActions}>
            <TouchableOpacity
              style={styles.tryScreenshotButton}
              onPress={() => { setStep("input"); setMethod("screenshot"); setErrorMsg(""); }}
            >
              <Ionicons name="image" size={18} color="#fff" />
              <Text style={styles.tryScreenshotText}>截圖上傳試試</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tryTextButton}
              onPress={() => router.push("/recipe-editor")}
            >
              <Ionicons name="create-outline" size={18} color="#013E77" />
              <Text style={styles.tryTextButtonText}>自訂食譜</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => { setStep("input"); setErrorMsg(""); }}
            >
              <Text style={styles.retryButtonText}>換另一個連結</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── 主要輸入畫面 ──
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.pageTitle}>匯入食譜</Text>
        <Text style={styles.pageSubtitle}>從 Instagram、YouTube、Threads、小紅書等平台匯入</Text>
      </View>

      {/* 剪貼板偵測提示 */}
      {clipboardUrl && (
        <TouchableOpacity
          style={styles.clipboardBanner}
          onPress={() => handleParseUrl(clipboardUrl)}
        >
          <Ionicons name="clipboard" size={20} color="#013E77" />
          <View style={{ flex: 1 }}>
            <Text style={styles.clipboardTitle}>偵測到剪貼板連結</Text>
            <Text style={styles.clipboardUrl} numberOfLines={1}>{clipboardUrl}</Text>
          </View>
          <View style={styles.clipboardButton}>
            <Text style={styles.clipboardButtonText}>立即解析</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 方法選擇 Tab */}
      <View style={styles.methodTabs}>
        {[
          { key: "url", label: "貼上連結", icon: "link" },
          { key: "xiaohongshu", label: "小紅書", icon: "book" },
          { key: "screenshot", label: "截圖上傳", icon: "image" },
          { key: "manual", label: "自訂食譜", icon: "create-outline" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.methodTab, method === tab.key && styles.methodTabActive]}
            onPress={() => { setMethod(tab.key as ImportMethod); setSelectedPlatform(null); }}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={method === tab.key ? "#013E77" : "#9CA3AF"}
            />
            <Text style={[styles.methodTabText, method === tab.key && styles.methodTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 匯入 — 平台選擇 */}
      {method === "url" && !selectedPlatform && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>選擇食譜來源</Text>
          <View style={styles.platformGrid}>
            {[
              { id: "instagram", label: "Instagram", icon: "logo-instagram" as any, color: "#E1306C" },
              { id: "youtube",   label: "YouTube",   icon: "logo-youtube" as any, color: "#FF0000" },
              { id: "threads",   label: "Threads",   icon: "at" as any, color: "#000" },
              { id: "tiktok",    label: "TikTok",    icon: "musical-notes" as any, color: "#000" },
              { id: "text",      label: "貼上文字",   icon: "document-text" as any, color: "#013E77" },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.platformCard}
                onPress={() => setSelectedPlatform(p.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.platformCardIcon, { backgroundColor: p.color + "18" }]}>
                  <Ionicons name={p.icon} size={26} color={p.color} />
                </View>
                <Text style={styles.platformCardLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 匯入 — 平台專屬輸入 (IG / YouTube / Threads / TikTok) */}
      {method === "url" && selectedPlatform && !["xiaohongshu", "text"].includes(selectedPlatform) && (
        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedPlatform(null); setUrlInput(""); }}>
            <Ionicons name="arrow-back" size={18} color="#013E77" />
            <Text style={styles.backRowText}>選擇其他平台</Text>
          </TouchableOpacity>
          <Text style={styles.inputLabel}>貼上 {selectedPlatform === "instagram" ? "Instagram" : selectedPlatform === "youtube" ? "YouTube" : selectedPlatform === "threads" ? "Threads" : "TikTok"} 食譜連結</Text>
          <TextInput
            style={styles.urlInput}
            placeholder={`https://www.${selectedPlatform === "youtube" ? "youtube.com" : selectedPlatform === "threads" ? "threads.net" : selectedPlatform === "tiktok" ? "tiktok.com" : "instagram.com"}/...`}
            placeholderTextColor="#9CA3AF"
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />
          <TouchableOpacity
            style={[styles.parseButton, !urlInput.trim() && styles.parseButtonDisabled]}
            onPress={() => handleParseUrl(urlInput)}
            disabled={!urlInput.trim()}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.parseButtonText}>AI 解析食譜</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 匯入 — 小紅書 */}
      {method === "url" && selectedPlatform === "xiaohongshu" && (
        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.backRow} onPress={() => setSelectedPlatform(null)}>
            <Ionicons name="arrow-back" size={18} color="#013E77" />
            <Text style={styles.backRowText}>選擇其他平台</Text>
          </TouchableOpacity>
          <Text style={styles.inputLabel}>貼上小紅書筆記連結</Text>
          <Text style={styles.inputSubLabel}>後端會嘗試讀取，如失敗可改用下方替代方法</Text>
          <TextInput
            style={styles.urlInput}
            placeholder="https://www.xiaohongshu.com/..." 
            placeholderTextColor="#9CA3AF"
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />
          <TouchableOpacity
            style={[styles.parseButton, !urlInput.trim() && styles.parseButtonDisabled]}
            onPress={() => handleParseUrl(urlInput)}
            disabled={!urlInput.trim()}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.parseButtonText}>AI 解析食譜</Text>
          </TouchableOpacity>
          <View style={styles.xhsCard}>
            <Ionicons name="information-circle" size={22} color="#FF2442" />
            <Text style={styles.xhsTitle}>如果連結讀取失敗</Text>
            <View style={styles.xhsOption}>
              <Ionicons name="copy-outline" size={18} color="#013E77" />
              <Text style={styles.xhsOptionText}>複製筆記文字，選擇「貼上文字」</Text>
            </View>
            <View style={styles.xhsOption}>
              <Ionicons name="image-outline" size={18} color="#013E77" />
              <Text style={styles.xhsOptionText}>截圖食譜內容，用「截圖上傳」</Text>
            </View>
            <View style={styles.xhsActionRow}>
              <TouchableOpacity style={styles.xhsAction} onPress={() => { setSelectedPlatform("text"); }}>
                <Text style={styles.xhsActionText}>貼上文字</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.xhsAction, { backgroundColor: "#EEF4FB" }]} onPress={() => { setMethod("screenshot"); setSelectedPlatform(null); }}>
                <Text style={[styles.xhsActionText, { color: "#013E77" }]}>截圖上傳</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 匯入 — 貼上文字 */}
      {method === "url" && selectedPlatform === "text" && (
        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.backRow} onPress={() => setSelectedPlatform(null)}>
            <Ionicons name="arrow-back" size={18} color="#013E77" />
            <Text style={styles.backRowText}>選擇其他平台</Text>
          </TouchableOpacity>
          <Text style={styles.inputLabel}>貼上食譜文字</Text>
          <Text style={styles.inputSubLabel}>從任何平台複製食材和步驟文字，貼上即可自動解析</Text>
          <TextInput
            style={[styles.urlInput, { minHeight: 160 }]}
            placeholder="例如：&#10;材料：&#10;- 雞翼 10 隻&#10;- 生抽 2 湯匙&#10;&#10;步驟：&#10;1. 雞翼洗淨抹乾&#10;2. 加入生抽醃 30 分鐘"
            placeholderTextColor="#9CA3AF"
            value={textInput}
            onChangeText={setTextInput}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.parseButton, !textInput.trim() && styles.parseButtonDisabled]}
            onPress={handleParseText}
            disabled={!textInput.trim()}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.parseButtonText}>AI 解析文字</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 小紅書 */}
      {method === "xiaohongshu" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>匯入小紅書食譜</Text>
          <View style={styles.xhsCard}>
            <Ionicons name="information-circle" size={24} color="#FF2442" />
            <Text style={styles.xhsTitle}>小紅書連結暫時未能自動讀取</Text>
            <Text style={styles.xhsDesc}>
              小紅書嘅連結係 app deeplink，複製後會跳去 app 而唔係網頁，所以後端無法讀取內容。請用以下方法：
            </Text>
            <View style={styles.xhsOption}>
              <Ionicons name="copy-outline" size={20} color="#013E77" />
              <Text style={styles.xhsOptionText}>喺小紅書 app 複製筆記嘅文字，然後用「貼上文字」功能解析</Text>
            </View>
            <View style={styles.xhsOption}>
              <Ionicons name="image-outline" size={20} color="#013E77" />
              <Text style={styles.xhsOptionText}>截圖食譜內容（食材 + 步驟），用「截圖上傳」功能</Text>
            </View>
            <View style={styles.xhsActionRow}>
              <TouchableOpacity style={styles.xhsAction} onPress={() => { setMethod("url"); setSelectedPlatform("text"); }}>
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text style={styles.xhsActionText}> 貼上文字</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.xhsAction, { backgroundColor: "#013E77" }]} onPress={() => setMethod("screenshot")}>
                <Ionicons name="image-outline" size={16} color="#fff" />
                <Text style={styles.xhsActionText}> 截圖上傳</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 截圖上傳 */}
      {method === "screenshot" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>上傳食譜截圖</Text>
          <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={48} color="#9CA3AF" />
                <Text style={styles.imagePickerText}>點擊選擇截圖</Text>
                <Text style={styles.imagePickerSubText}>支援 JPG、PNG 格式</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.tipRow}>
            <Ionicons name="bulb" size={14} color="#6B7280" />
            <Text style={styles.tipText}>
              小貼士：對 Instagram / 小紅書食譜貼文截圖，包含食材和步驟的部分效果最佳
            </Text>
          </View>
        </View>
      )}

      {/* 自訂食譜 */}
      {method === "manual" && (
        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.manualCard} onPress={() => router.push("/recipe-editor")} activeOpacity={0.85}>
            <View style={styles.manualIcon}>
              <Ionicons name="create-outline" size={40} color="#013E77" />
            </View>
            <Text style={styles.manualTitle}>自訂食譜</Text>
            <Text style={styles.manualSub}>手動建立你自己的食譜</Text>
            <View style={styles.manualBtn}>
              <Ionicons name="restaurant-outline" size={18} color="#fff" />
              <Text style={styles.manualBtnTxt}>開始建立</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContainer: {
    flex: 1, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  headerSection: {
    backgroundColor: "#013E77", padding: 20, paddingBottom: 24,
  },
  pageTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  pageSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  clipboardBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 12, padding: 12, backgroundColor: "#EFF6FF",
    borderRadius: 12, borderWidth: 1.5, borderColor: "#BFDBFE",
  },
  clipboardTitle: { fontSize: 13, fontWeight: "700", color: "#013E77" },
  clipboardUrl: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  clipboardButton: {
    backgroundColor: "#013E77", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  clipboardButtonText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  methodTabs: {
    flexDirection: "row", margin: 12, marginBottom: 0,
    backgroundColor: "#fff", borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: "#E5E0D8",
  },
  methodTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, borderRadius: 10,
  },
  methodTabActive: { backgroundColor: "#EFF6FF" },
  methodTabText: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  methodTabTextActive: { color: "#013E77" },
  inputSection: { padding: 12 },
  inputLabel: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  inputSubLabel: { fontSize: 12, color: "#6B7280", marginBottom: 10, lineHeight: 18 },
  platformGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4,
  },
  platformCard: {
    width: "30.5%", aspectRatio: 1, borderRadius: 16,
    backgroundColor: "#F9F9FB", borderWidth: 1, borderColor: "#EDE9E3",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  platformCardIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  platformCardLabel: { fontSize: 12, fontWeight: "700", color: "#374151" },
  backRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: 12,
  },
  backRowText: { fontSize: 13, fontWeight: "600", color: "#013E77" },
  xhsCard: {
    backgroundColor: "#FFF2F0", borderRadius: 14, padding: 16, marginTop: 16,
    borderWidth: 1.5, borderColor: "#FFCCC7", gap: 10,
  },
  xhsTitle: { fontSize: 14, fontWeight: "800", color: "#CF1322" },
  xhsDesc: { fontSize: 13, color: "#5A4A3A", lineHeight: 20 },
  xhsOption: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  xhsOptionText: { fontSize: 13, color: "#5A4A3A", flex: 1, lineHeight: 19 },
  xhsActionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  xhsAction: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    alignItems: "center", backgroundColor: "#FF4D4F",
  },
  xhsActionText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  urlInput: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    fontSize: 14, color: "#1A1A1A", minHeight: 80,
    borderWidth: 1.5, borderColor: "#E5E0D8",
    textAlignVertical: "top",
  },
  supportedPlatforms: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 12 },
  platformBadge: {
    backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  platformBadgeText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  parseButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", padding: 14, borderRadius: 12,
  },
  parseButtonDisabled: { backgroundColor: "#9CA3AF" },
  parseButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  manualCard: {
    backgroundColor: "#F5F8FC", borderRadius: 20, padding: 32,
    alignItems: "center", borderWidth: 2, borderColor: "#013E77",
    borderStyle: "dashed",
  },
  manualIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  manualTitle: { fontSize: 20, fontWeight: "900", color: "#013E77", marginBottom: 6 },
  manualSub: { fontSize: 14, color: "#6B7280", marginBottom: 20 },
  manualBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14,
  },
  manualBtnTxt: { fontSize: 16, fontWeight: "800", color: "#fff" },
  imagePickerArea: {
    backgroundColor: "#fff", borderRadius: 12, padding: 32,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#E5E0D8", borderStyle: "dashed",
    minHeight: 180, marginBottom: 12,
  },
  selectedImage: { width: "100%", height: 200, borderRadius: 8 },
  imagePickerText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 8 },
  imagePickerSubText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  tipRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#FFFBF5", padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#F0E8DC",
  },
  tipText: {
    flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18,
  },
  textInput: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    fontSize: 14, color: "#1A1A1A", minHeight: 200,
    borderWidth: 1.5, borderColor: "#E5E0D8",
    marginBottom: 12,
  },
  parsingTitle: { fontSize: 18, fontWeight: "800", color: "#013E77", marginTop: 16 },
  parsingSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 24 },
  parsingSteps: { gap: 12 },
  parsingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  parsingStepActive: { backgroundColor: "#F0F5FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: -10 },
  parsingStepText: { fontSize: 14, color: "#9CA3AF" },
  parsingStepTextActive: { fontSize: 14, color: "#013E77", fontWeight: "700" },
  parsingStepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#D1D5DB" },
  previewHeader: { alignItems: "center", padding: 20, paddingBottom: 12 },
  previewTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginTop: 8 },
  previewSubtitle: { fontSize: 13, color: "#6B7280" },
  previewCard: {
    margin: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  previewRecipeName: { fontSize: 18, fontWeight: "900", color: "#013E77", marginBottom: 8 },
  previewMeta: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  previewSectionTitle: { fontSize: 14, fontWeight: "800", color: "#1A1A1A", marginTop: 12, marginBottom: 6 },
  previewCategorySection: { marginTop: 12, marginBottom: 8 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#E5E0D8", backgroundColor: "#fff",
  },
  categoryChipActive: {
    borderColor: "#013E77", backgroundColor: "#013E77",
  },
  categoryChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  categoryChipTextActive: { color: "#fff" },
  previewIngredientRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 4,
  },
  ingredientCheckbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: "#013E77",
    alignItems: "center", justifyContent: "center",
  },
  previewIngredient: { flex: 1, fontSize: 13, color: "#374151" },
  previewStepRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginBottom: 8,
  },
  stepNumberCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#013E77",
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  stepNumberText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  previewStep: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 },
  previewMore: { fontSize: 12, color: "#9CA3AF", fontStyle: "italic" },
  previewActions: { padding: 12, gap: 10 },
  importButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", padding: 14, borderRadius: 12,
  },
  importButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  retryButton: {
    alignItems: "center", padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E0D8",
  },
  retryButtonText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  successTitle: { fontSize: 22, fontWeight: "900", color: "#22C55E", marginTop: 16 },
  successSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  failedTitle: { fontSize: 20, fontWeight: "800", color: "#EF4444", marginTop: 12 },
  failedMsg: { fontSize: 14, color: "#6B7280", marginTop: 8, textAlign: "center", marginBottom: 16, lineHeight: 21 },
  failedActions: { gap: 10, width: "100%", marginTop: 8 },
  tryScreenshotButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", padding: 14, borderRadius: 12,
  },
  tryScreenshotText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  tryTextButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EEF4FB", padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#C5D9F0",
  },
  tryTextButtonText: { color: "#013E77", fontSize: 14, fontWeight: "700" },
  // Tips box
  tipBox: {
    backgroundColor: "#FFF7ED", borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: "#FED7AA",
    marginBottom: 16, width: "100%", gap: 8,
  },
  tipBoxTitleRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 4,
  },
  tipBoxTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  tipBoxRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
  },
  tipBoxText: { flex: 1, fontSize: 12, color: "#78350F", lineHeight: 20 },
});

const es = StyleSheet.create({
  // Image
  card: {
    backgroundColor: "#FFFFFF", marginHorizontal: 16, marginTop: 12,
    borderRadius: 20, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    overflow: "hidden",
  },
  recipeImage: { width: "100%", height: 180, borderRadius: 14 },
  imagePlaceholder: {
    width: "100%", height: 140, borderRadius: 14,
    backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center",
    gap: 8,
  },
  imagePlaceholderTxt: { fontSize: 14, color: "#013E77", fontWeight: "600" },
  imageOverlay: {
    position: "absolute", bottom: 26, right: 26,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(1,62,119,0.8)", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16,
  },
  imageOverlayTxt: { fontSize: 12, color: "#fff", fontWeight: "700" },

  // Form
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "700", color: "#5A4A3A", marginBottom: 6 },
  input: {
    backgroundColor: "#F5F8FC", borderWidth: 1.5, borderColor: "#E5D5C0",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#1A1A1A", marginBottom: 14,
  },
  multilineInput: { height: 72, textAlignVertical: "top" },

  // Chips
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: "#E5D5C0",
  },
  chipActive: { backgroundColor: "#013E77", borderColor: "#013E77" },
  chipTxt: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  chipTxtActive: { color: "#fff" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },

  // Ingredient
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#E8F5E9", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  addBtnTxt: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  ingRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  ingInput: {
    backgroundColor: "#F5F8FC", borderWidth: 1.5, borderColor: "#E5D5C0",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: "#1A1A1A",
  },
  delBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.08)", alignItems: "center", justifyContent: "center",
  },
  delBtnDisabled: { backgroundColor: "#EEF4FB" },

  // Steps
  stepRow: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F9F6F2" },
  stepNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#013E77",
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
  stepCameraTxt: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },

  // Save
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#013E77", paddingVertical: 18, borderRadius: 20,
    shadowColor: "#013E77", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
    marginBottom: 12,
  },
  saveBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "900" },

  // Save overlay
  saveOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
  },
  saveOverlayBox: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32,
    width: "80%", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  saveOverlayTitle: { fontSize: 18, fontWeight: "800", color: "#013E77", marginTop: 16, marginBottom: 4 },
  saveOverlaySub: { fontSize: 13, color: "#9CA3AF", marginBottom: 20 },
  saveStepsList: { width: "100%", gap: 10 },
  saveStepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveStepTxt: { fontSize: 14, color: "#9CA3AF" },
  saveStepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
});
