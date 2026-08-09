/**
 * 食譜匯入頁面 — 零摩擦體驗
 * 支援：剪貼板自動偵測 URL、Universal Smart Input、截圖上傳、文字貼上
 */
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Modal,
  KeyboardAvoidingView, Platform, Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import UnitPicker from "@/src/components/UnitPicker";
import { compressImage } from "@/lib/image-utils";
import i18n from "@/lib/i18n";

type ImportStep = "input" | "parsing" | "preview" | "success" | "failed";
type EditableIngredient = { id: string; name: string; quantity: string; unit: string };
type EditableStep = { id: number; instruction: string; duration: number; imageUri?: string | null; imageBase64?: string | null };

// 高成功率平台清單（顯示 Magic Card）
const SUPPORTED_PLATFORMS = ["Instagram", "YouTube", "Threads", "Facebook"];

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ onboarding?: string; clipboardUrl?: string }>();
  const isOnboarding = params.onboarding === "true";
  const { user: authUser } = useAuth();
  
  const [step, setStep] = useState<ImportStep>("input");
  const [universalInput, setUniversalInput] = useState("");
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [failedInput, setFailedInput] = useState<{ type: "url" | "text"; value: string } | null>(null);
  const [pendingScreenshot, setPendingScreenshot] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
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
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStepIdx, setSaveStepIdx] = useState(0);
  const saveStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const SAVE_STEPS = ["上載圖片...", "整理食譜資料...", "儲存到食譜庫..."];
  const PARSE_STEPS = ["讀取內容", "識別食材", "整理步驟", "生成食譜"];

  // 渲染圖片來源選擇 Modal（封裝成函式，可在多個 step 中复用）
  const renderPhotoSourceModal = () => (
    <Modal
      visible={showPhotoSourceModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPhotoSourceModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowPhotoSourceModal(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>選擇圖片來源</Text>
          
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => handlePickImage("camera")}
          >
            <Ionicons name="camera" size={24} color="#013E77" />
            <Text style={styles.modalOptionText}>拍照</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => handlePickImage("library")}
          >
            <Ionicons name="image" size={24} color="#013E77" />
            <Text style={styles.modalOptionText}>從相簿選擇</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => setShowPhotoSourceModal(false)}
          >
            <Text style={styles.modalCancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
    setImageError(false);
    // Set image from backend R2 URL (rehosted from Instagram CDN)
    if (recipe.thumbnailUrl) {
      console.log("[initEditFromParsed] Setting thumbnailUrl:", recipe.thumbnailUrl.substring(0, 80));
      setRecipeImageUri(recipe.thumbnailUrl);
    } else if (recipe.image) {
      console.log("[initEditFromParsed] Setting image:", recipe.image.substring(0, 80));
      setRecipeImageUri(recipe.image);
    } else {
      console.log("[initEditFromParsed] No image from backend");
    }
  };

  // Pick recipe image
  const handlePickRecipeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageError(false);
      const asset = result.assets[0];
      try {
        const compressed = await compressImage(asset.uri);
        setRecipeImageUri(compressed.uri);
        setRecipeImageBase64(compressed.base64);
      } catch {
        setRecipeImageUri(asset.uri);
        setRecipeImageBase64(asset.base64 || null);
      }
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
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const compressed = await compressImage(result.assets[0].uri);
        setEditSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: compressed.uri, imageBase64: compressed.base64,
        } : s));
      } catch {
        setEditSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: result.assets[0].uri, imageBase64: result.assets[0].base64,
        } : s));
      }
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

  const handleCancelParsing = () => {
    stopParseProgress();
    parseUrlMutation.reset();
    parseTextMutation.reset();
    parseImageMutation.reset();
    isParsingRef.current = false;
    setStep("input");
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

  // 偵測剪貼板（只對高成功率平台）
  useEffect(() => {
    checkClipboard();
    
    // 如果有 params.clipboardUrl（從首頁提示跳轉過來），自動填充
    if (params.clipboardUrl) {
      const url = params.clipboardUrl as string;
      setUniversalInput(url);
      const platform = detectPlatform(url);
      if (platform && SUPPORTED_PLATFORMS.includes(platform)) {
        setClipboardUrl(url);
        setDetectedPlatform(platform);
      }
    }
  }, []);

  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && isValidUrl(text.trim())) {
        const platform = detectPlatform(text);
        // 只對高成功率平台顯示 Magic Card
        if (platform && SUPPORTED_PLATFORMS.includes(platform)) {
          setClipboardUrl(text);
          setDetectedPlatform(platform);
          setClipboardContent(text);
        }
      } else if (text) {
        // 非 URL 的文字內容也儲存（用於貼上按鈕）
        setClipboardContent(text);
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
      console.log("[parseUrlMutation.onSuccess] parseReason:", data.parseReason);
      console.log("[parseUrlMutation.onSuccess] thumbnailUrl:", data.thumbnailUrl?.substring(0, 80));
      if (data.parseReason === "ok") {
        setParsedRecipe(data);
        initEditFromParsed(data);
        setStep("preview");
      } else if (data.parseReason === "no_recipe_content") {
        const platform = detectPlatform(universalInput);
        const platformHelp = platform ? `\n\n平台提示（${platform}）：\n${getPlatformHelp(platform)}` : "";
        setErrorMsg(
          `這個帖子沒有完整的食譜內容（例如只是用餐照片、產品推廣等）。${platformHelp}\n\n一般建議：\n• 試試截圖上傳帖子內的食材/步驟圖片\n• 換另一個包含完整食材和步驟的帖子`
        );
        setFailedInput({ type: "url", value: universalInput });
        setStep("failed");
      } else {
        const platform = detectPlatform(universalInput);
        let msg = "無法讀取此連結的內容，可能需要登入或內容已被刪除。";
        if (platform === "小紅書") {
          msg += "\n\n小紅書限制了自動讀取，請改用「截圖上傳」或「貼上文字」功能。";
        } else {
          msg += "\n\n建議改用截圖上傳。";
        }
        setErrorMsg(msg);
        setFailedInput({ type: "url", value: universalInput });
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      console.error("[parseUrlMutation.onError]", err);
      setErrorMsg(err.message || "無法連接到解析服務，請稍後重試");
      setFailedInput({ type: "url", value: universalInput });
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
        setFailedInput({ type: "text", value: universalInput });
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      setErrorMsg(err.message || "無法解析文字內容");
      setFailedInput({ type: "text", value: universalInput });
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
        setFailedInput({ type: "url", value: "" });
        setStep("failed");
      }
    },
    onError: (err) => {
      isParsingRef.current = false;
      stopParseProgress();
      setErrorMsg(err.message || "無法解析圖片，請確保圖片清晰");
      setFailedInput({ type: "url", value: "" });
      setStep("failed");
    },
  });

  const uploadImageMutation = trpc.recipes.uploadRecipeImage.useMutation();

  const importMutation = trpc.recipes.importUser.useMutation({
    onSuccess: async (data) => {
      if (isOnboarding) {
        try {
          if (authUser?.id) {
            await AsyncStorage.setItem(`kindcipe_onboarding_done_${authUser.id}`, "true");
          }
        } catch {}
        setStep("success");
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 2000);
      } else {
        setStep("success");
        setTimeout(() => {
          router.replace({
            pathname: "/recipe/[id]",
            params: { id: `user_${data.id}` },
          });
        }, 1500);
      }
    },
    onError: (err) => {
      isImportingRef.current = false;
      Alert.alert("儲存失敗", err.message);
    },
  });

  // ── Platform detection ────────────────
  function detectPlatform(url: string): string | null {
    const u = url.toLowerCase();
    if (u.includes("instagram.com") || u.includes("ig.me")) return "Instagram";
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
    if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "小紅書";
    if (u.includes("threads.net")) return "Threads";
    if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return "Facebook";
    if (u.includes("tiktok.com") || u.includes("douyin.com")) return "TikTok/抖音";
    if (u.includes("weibo.com")) return "微博";
    if (u.includes("bilibili.com") || u.includes("b23.tv")) return "B 站";
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

  // Extract Instagram thumbnail URL using /media endpoint (most reliable free method)
  async function extractInstagramThumbnail(url: string): Promise<string | undefined> {
    try {
      // Clean URL: remove query parameters
      const cleanUrl = url.split("?")[0];
      
      // Extract shortcode from URL (e.g., /reel/DYtC5HfIEEU/ → DYtC5HfIEEU)
      const shortcodeMatch = cleanUrl.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
      const shortcode = shortcodeMatch?.[1];
      
      if (!shortcode) {
        console.log("[Instagram Thumbnail] No shortcode found");
        return undefined;
      }
      
      // Strategy 1: Instagram /media endpoint (returns JSON with direct image URL)
      try {
        console.log("[Instagram Thumbnail] Trying /media endpoint:", shortcode);
        const mediaController = new AbortController();
        const mediaTimeout = setTimeout(() => mediaController.abort(), 8000);
        const mediaResp = await fetch(
          `https://www.instagram.com/${shortcode}/media/?__a=1&__d=dis`,
          {
            signal: mediaController.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
              "Accept": "application/json",
              "X-IG-App-ID": "936619743392459",
            },
          }
        );
        clearTimeout(mediaTimeout);
        
        if (mediaResp.ok) {
          const json = await mediaResp.json() as any;
          // Handle both reel and post structures
          const items = json.items || json.graphql?.shortcode_media || json;
          const mediaItem = Array.isArray(items) ? items[0] : items;
          
          // Extract thumbnail URL from various possible structures
          let imageUrl: string | undefined;
          
          if (mediaItem?.image_versions2?.candidates?.[0]?.url) {
            // Reel/video structure
            imageUrl = mediaItem.image_versions2.candidates[0].url;
          } else if (mediaItem?.display_url) {
            // Post structure
            imageUrl = mediaItem.display_url;
          } else if (mediaItem?.thumbnail_src) {
            // Fallback structure
            imageUrl = mediaItem.thumbnail_src;
          }
          
          if (imageUrl) {
            console.log("[Instagram Thumbnail] Found via /media:", imageUrl.substring(0, 80));
            return imageUrl;
          }
        }
      } catch (mediaErr) {
        console.log("[Instagram Thumbnail] /media endpoint failed:", mediaErr);
        // Continue to fallback
      }
      
      // Strategy 2: Fallback to og:image meta tag
      console.log("[Instagram Thumbnail] Fallback: fetching HTML");
      const htmlController = new AbortController();
      const htmlTimeout = setTimeout(() => htmlController.abort(), 8000);
      const resp = await fetch(cleanUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: htmlController.signal,
      });
      clearTimeout(htmlTimeout);
      if (!resp.ok) {
        console.log("[Instagram Thumbnail] HTTP error:", resp.status);
        return undefined;
      }
      const html = await resp.text();
      
      // og:image meta tag
      const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/) ||
                          html.match(/content="([^"]+)"\s+property="og:image"/);
      if (ogImageMatch && ogImageMatch[1]) {
        console.log("[Instagram Thumbnail] Found via og:image:", ogImageMatch[1].substring(0, 80));
        return ogImageMatch[1];
      }
      
      console.log("[Instagram Thumbnail] No thumbnail found");
      return undefined;
    } catch (e: any) {
      console.log("[Instagram Thumbnail] Extraction error:", e?.message || e);
      return undefined;
    }
  }

  // 通用解析函數（自動偵測 URL 或文字）
  const handleUniversalParse = async (input: string) => {
    if (isParsingRef.current) return;
    const trimmed = input.trim();
    if (!trimmed) {
      Alert.alert("請輸入連結或食譜內容");
      return;
    }
    isParsingRef.current = true;
    setStep("parsing");
    startParseProgress();
    
    if (isValidUrl(trimmed)) {
      // For Instagram URLs, extract thumbnail URL and pass to backend for rehosting to R2
      let clientThumbnail: string | undefined;
      if (trimmed.includes("instagram.com")) {
        const extractedUrl = await extractInstagramThumbnail(trimmed);
        if (extractedUrl) {
          // Don't set recipeImageUri here - Instagram CDN URLs get blocked (403)
          // Wait for backend to rehost to R2 and return permanent URL
          clientThumbnail = extractedUrl;
          console.log("[Instagram Thumbnail] Got URL, passing to backend for rehost");
        } else {
          console.log("[Instagram Thumbnail] Extraction failed, using backend fallback");
        }
      }
      // Reset imageError before parsing
      setImageError(false);
      parseUrlMutation.mutate({ url: trimmed, language: i18n.language, clientThumbnail });
    } else {
      parseTextMutation.mutate({ text: trimmed, language: i18n.language });
    }
  };

  // 貼上按鈕邏輯
  const handlePaste = async () => {
    const content = await Clipboard.getStringAsync();
    if (content) {
      setUniversalInput(content);
    }
  };

  // 選擇截圖（顯示 Modal 問用戶拍照定相簿）
  const handlePickImage = async (source: "camera" | "library") => {
    let result: ImagePicker.ImagePickerResult | undefined;
    try {
      result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    } catch (e: any) {
      Alert.alert("開啟失敗", e?.message || "請重試");
      return;
    } finally {
      setShowPhotoSourceModal(false);
    }

    if (!result || result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const compressed = await compressImage(asset.uri);
      setPendingScreenshot({
        uri: compressed.uri,
        base64: compressed.base64 || "",
        mimeType: compressed.mimeType,
      });
      setUniversalInput("");
      setClipboardUrl(null);
      setDetectedPlatform(null);
      setStep("input");
    } catch {
      setPendingScreenshot({
        uri: asset.uri,
        base64: asset.base64 || "",
        mimeType: asset.mimeType || "image/jpeg",
      });
      setUniversalInput("");
      setClipboardUrl(null);
      setDetectedPlatform(null);
      setStep("input");
    }
  };

  // 確認截圖並開始解析
  const handleConfirmScreenshot = async () => {
    if (!pendingScreenshot) return;
    setStep("parsing");
    startParseProgress();
    try {
      console.log("[handleConfirmScreenshot] Uploading image:", {
        base64Length: pendingScreenshot.base64?.length || 0,
        mimeType: pendingScreenshot.mimeType,
        uri: pendingScreenshot.uri,
      });
      const uploadResult = await uploadImageMutation.mutateAsync({
        base64: pendingScreenshot.base64,
        mimeType: pendingScreenshot.mimeType,
      });
      console.log("[handleConfirmScreenshot] Upload result:", uploadResult);
      await parseImageMutation.mutateAsync({ storageKey: uploadResult.key });
      // parseImageMutation.onSuccess will handle the result
    } catch (e: any) {
      console.error("[handleConfirmScreenshot] Error:", e);
      stopParseProgress();
      isParsingRef.current = false;
      parseImageMutation.reset();
      uploadImageMutation.reset();
      // Check if error is from backend AI analysis
      const isNoContent = e.message?.includes("沒有足夠") || e.message?.includes("無法識別") || e.message?.includes("no recipe") || e.message?.includes("需要手動輸入");
      setErrorMsg(
        isNoContent
          ? e.message
          : "無法分析這張圖片的食譜內容。\n\n可能原因：\n• 食物特徵不明顯（太遠/太模糊/只拍表面）\n• 圖片缺少可識別的食材或步驟文字"
      );
      setFailedInput(null);
      setStep("failed");
    }
    setPendingScreenshot(null);
  };

  // 重新選擇截圖
  const handleReselectImage = () => {
    setPendingScreenshot(null);
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
      let imageUrl = recipeImageUri || parsedRecipe?.image || parsedRecipe?.thumbnailUrl || "";
      if (recipeImageBase64) {
        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: recipeImageBase64,
          mimeType: "image/jpeg",
        });
        imageUrl = uploadResult?.url || "";
      }

      const stepImages: (string | null)[] = [];
      for (const s of validSteps) {
        if (s.imageBase64) {
          try {
            const up = await uploadImageMutation.mutateAsync({ base64: s.imageBase64, mimeType: "image/jpeg" });
            stepImages.push(up?.url || null);
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
        sourceUrl: parsedRecipe?.sourceUrl || "",
        sourceAuthor: parsedRecipe?.sourceAuthor || "",
        visibility: "private" as const,
      });
    } catch (e: any) {
      setIsSaving(false);
      if (saveStepTimer.current) { clearInterval(saveStepTimer.current); saveStepTimer.current = null; }
      Alert.alert("儲存失敗", e?.message || "圖片上傳失敗，請重試");
    }
  };

  // Reset saving state when import completes
  useEffect(() => {
    if (!importMutation.isPending && isSaving) {
      setIsSaving(false);
      if (saveStepTimer.current) { clearInterval(saveStepTimer.current); saveStepTimer.current = null; }
    }
  }, [importMutation.isPending]);

  // ── 離開確認 ──
  const hasUnsavedImport = () => {
    if (step === "preview" && parsedRecipe) {
      return true;
    }
    if (step === "input") {
      return (
        universalInput.trim().length > 0 ||
        !!pendingScreenshot
      );
    }
    return false;
  };

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e: any) => {
      if (!hasUnsavedImport()) return;
      e.preventDefault();
      const leaveAction = () => {
        if (step === "preview" && parsedRecipe) {
          setStep("input");
          setParsedRecipe(null);
        } else {
          navigation.dispatch(e.data.action);
        }
      };
      Alert.alert(
        "確定要離開？",
        "已輸入或編輯的內容將不會儲存",
        [
          { text: "繼續編輯", style: "cancel" },
          { text: "離開", style: "destructive", onPress: leaveAction },
        ]
      );
    });
    return sub;
  }, [navigation, step, parsedRecipe, universalInput, pendingScreenshot]);

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
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelParsing}>
          <Ionicons name="close-circle-outline" size={16} color="#9CA3AF" />
          <Text style={styles.cancelBtnText}>取消解析</Text>
        </TouchableOpacity>
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
            {recipeImageUri && !imageError ? (
              <Image source={{ uri: recipeImageUri }} style={es.recipeImage} onError={() => setImageError(true)} />
            ) : parsedRecipe.thumbnailUrl && !imageError ? (
              <Image source={{ uri: parsedRecipe.thumbnailUrl }} style={es.recipeImage} onError={() => setImageError(true)} />
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

          {/* Save Reminder Banner */}
          <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="information-circle" size={18} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}>請按下方「儲存到食譜庫」</Text>
              <Text style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>儲存後才會出現在「我的食譜」中</Text>
            </View>
          </View>

          {/* Save Button */}
          <View style={{ marginHorizontal: 16, marginBottom: Math.max(insets.bottom + 12, 40), marginTop: 16 }}>
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
            <TouchableOpacity style={styles.retryButton} onPress={() => {
              Alert.alert(
                "重新匯入？",
                "目前的編輯內容將會遺失",
                [
                  { text: "取消", style: "cancel" },
                  { text: "重新匯入", style: "destructive", onPress: () => { setStep("input"); setParsedRecipe(null); } },
                ]
              );
            }}>
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
        {!isOnboarding && (
          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => {
                if (parsedRecipe?.id) {
                  router.replace({ pathname: "/recipe/[id]", params: { id: `user_${parsedRecipe.id}` } });
                }
              }}
            >
              <Ionicons name="restaurant-outline" size={18} color="#fff" />
              <Text style={styles.successPrimaryBtnText}>查看食譜</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => { setStep("input"); setParsedRecipe(null); setUniversalInput(""); setPendingScreenshot(null); setFailedInput(null); }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#013E77" />
              <Text style={styles.successSecondaryBtnText}>繼續匯入</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── 解析失敗 ──
  if (step === "failed") {
    return (
      <>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
        >
          <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle" size={64} color="#EF4444" />
              <Text style={styles.failedTitle}>解析失敗</Text>
              <Text style={styles.failedMsg}>{errorMsg}</Text>

              <View style={styles.failedActions}>
                {/* 按鈕 1：換一張照片（主按鈕） */}
                <TouchableOpacity
                  style={styles.tryScreenshotButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowPhotoSourceModal(true);
                    setErrorMsg("");
                    setFailedInput(null);
                  }}
                >
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.tryScreenshotText}>
                    換一張照片（拍清晰食物本體）
                  </Text>
                </TouchableOpacity>

                {/* 按鈕 2：貼上連結（次要） */}
                <TouchableOpacity
                  style={styles.tryTextButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep("input");
                    setErrorMsg("");
                    setFailedInput(null);
                    // Preserve clipboardUrl and repost to input field
                    if (clipboardUrl) {
                      setUniversalInput(clipboardUrl);
                    }
                  }}
                >
                  <Ionicons name="link-outline" size={18} color="#013E77" />
                  <Text style={styles.tryTextButtonText}>試另一條連結</Text>
                </TouchableOpacity>

                {/* 按鈕 3：自訂食譜（最後手段） */}
                <TouchableOpacity
                  style={styles.tryTextButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    router.push("/recipe-editor");
                  }}
                >
                  <Ionicons name="create-outline" size={18} color="#013E77" />
                  <Text style={styles.tryTextButtonText}>自訂食譜</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {renderPhotoSourceModal()}
      </>
    );
  }

  // ── 主要輸入畫面 ──
  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.headerSection, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.pageTitle, { marginBottom: 0 }]}>新增食譜</Text>
          </View>
        </View>

        {/* Magic Clipboard Card */}
        {clipboardUrl && detectedPlatform && (
          <View style={styles.magicClipboardCard}>
            <View style={styles.clipboardHeader}>
              <Ionicons name="sparkles" size={20} color="#013E77" />
              <Text style={styles.clipboardTitle}>偵測到 {detectedPlatform} 連結</Text>
            </View>
            <Text style={styles.clipboardUrl} numberOfLines={1}>{clipboardUrl}</Text>
            <TouchableOpacity
              style={styles.magicButton}
              onPress={() => {
                setUniversalInput(clipboardUrl);
                handleUniversalParse(clipboardUrl);
              }}
            >
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.magicButtonText}>一鍵 AI 匯入此食譜</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Universal Smart Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>貼上連結或食譜內文</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.universalInput}
              placeholder="貼上 IG / YouTube / Threads 連結或食譜文字..."
              placeholderTextColor="#9CA3AF"
              value={universalInput}
              onChangeText={setUniversalInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              textAlignVertical="top"
            />
            {!universalInput && clipboardContent && (
              <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
                <Ionicons name="document" size={16} color="#013E77" />
                <Text style={styles.pasteButtonText}>貼上</Text>
              </TouchableOpacity>
            )}
            {!!universalInput && (
              <TouchableOpacity style={styles.clearButton} onPress={() => setUniversalInput("")}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.parseButton, !universalInput.trim() && styles.parseButtonDisabled]}
            onPress={() => handleUniversalParse(universalInput)}
            disabled={!universalInput.trim()}
          >
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.parseButtonText}>開始 AI 解析</Text>
          </TouchableOpacity>
        </View>

        {/* 截圖預覽 */}
        {pendingScreenshot && (
          <View style={styles.screenshotSection}>
            <Image source={{ uri: pendingScreenshot.uri }} style={styles.screenshotPreview} resizeMode="cover" />
            <Text style={styles.previewHint}>確認圖片清晰，包含食材和步驟</Text>
            <View style={styles.screenshotActions}>
              <TouchableOpacity style={styles.screenshotReselectBtn} onPress={handleReselectImage}>
                <Ionicons name="refresh-outline" size={16} color="#6B7280" />
                <Text style={styles.screenshotReselectText}>重新選擇</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.screenshotConfirmBtn} onPress={handleConfirmScreenshot}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.screenshotConfirmText}>開始解析</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Secondary Action Buttons */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowPhotoSourceModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={24} color="#013E77" />
            <Text style={styles.secondaryButtonText}>拍照上傳分析</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/recipe-editor")}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={24} color="#013E77" />
            <Text style={styles.secondaryButtonText}>自訂食譜</Text>
          </TouchableOpacity>
        </View>

        {/* Xiaohongshu Tip */}
        <View style={styles.xiaohongshuTip}>
          <Ionicons name="information-circle" size={16} color="#6B7280" />
          <Text style={styles.xiaohongshuTipText}>小紅書用戶請用：截圖上傳 或 貼上文字</Text>
        </View>

        <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
      </ScrollView>
    </KeyboardAvoidingView>
    {renderPhotoSourceModal()}
    </>
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
  pageTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  
  // Magic Clipboard Card
  magicClipboardCard: {
    margin: 16,
    padding: 16,
    backgroundColor: "#E8F0F8",
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  clipboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clipboardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
  },
  clipboardUrl: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 8,
  },
  magicButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#013E77",
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 4,
  },
  magicButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Universal Input
  inputSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    position: "relative",
  },
  universalInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    paddingRight: 80,
    fontSize: 14,
    color: "#1A1A1A",
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: "#E5E0D8",
    textAlignVertical: "top",
  },
  pasteButton: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F0F8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pasteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#013E77",
  },
  clearButton: {
    position: "absolute",
    top: 14,
    right: 16,
    padding: 6,
  },
  parseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#013E77",
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 12,
  },
  parseButtonDisabled: {
    backgroundColor: "#013E77",
    opacity: 0.6,
  },
  parseButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Secondary Actions
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  screenshotSection: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  screenshotPreview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#EEF4FB",
  },
  previewHint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  screenshotActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 12,
  },
  screenshotReselectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#A8C5E0",
    backgroundColor: "#FFFFFF",
  },
  screenshotReselectText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  screenshotConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#013E77",
  },
  screenshotConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#A8C5E0",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
  },
  
  // Xiaohongshu Tip
  xiaohongshuTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  xiaohongshuTipText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  
  // Parsing
  parsingTitle: { fontSize: 18, fontWeight: "800", color: "#013E77", marginTop: 16 },
  parsingSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 24 },
  parsingSteps: { gap: 12 },
  parsingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  parsingStepActive: { backgroundColor: "#F0F5FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: -10 },
  parsingStepText: { fontSize: 14, color: "#9CA3AF" },
  parsingStepTextActive: { fontSize: 14, color: "#013E77", fontWeight: "700" },
  parsingStepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#D1D5DB" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 32, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 24, borderWidth: 1.5, borderColor: "#E5E0D8",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },
  
  // Preview
  previewHeader: { alignItems: "center", padding: 20, paddingBottom: 12 },
  previewTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginTop: 8 },
  previewSubtitle: { fontSize: 13, color: "#6B7280" },
  
  // Success
  successTitle: { fontSize: 22, fontWeight: "900", color: "#22C55E", marginTop: 16 },
  successSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  successActions: { width: "100%", marginTop: 32, gap: 10 },
  successPrimaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", paddingVertical: 16, borderRadius: 14,
  },
  successPrimaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  successSecondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EEF4FB", paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#C5D9F0",
  },
  successSecondaryBtnText: { fontSize: 16, fontWeight: "700", color: "#013E77" },
  
  // Failed
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
  retryButton: {
    alignItems: "center", padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E0D8",
  },
  retryButtonText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  tipBox: {
    backgroundColor: "#FFF7ED", borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: "#FED7AA",
    marginBottom: 16, width: "100%", gap: 8,
  },
  tipBoxTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  tipBoxTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  tipBoxRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  tipBoxText: { flex: 1, fontSize: 12, color: "#78350F", lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#F5F8FC",
    borderRadius: 12,
    marginBottom: 12,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#013E77",
  },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
});

const es = StyleSheet.create({
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
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: "#E5D5C0",
  },
  chipActive: { backgroundColor: "#013E77", borderColor: "#013E77" },
  chipTxt: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  chipTxtActive: { color: "#fff" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
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
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FCA5A5",
  },
  delBtnDisabled: { backgroundColor: "#F3F4F6", borderColor: "#E5E0D8" },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#013E77", alignItems: "center", justifyContent: "center",
  },
  stepNumTxt: { fontSize: 12, fontWeight: "800", color: "#fff" },
  stepImageWrap: { position: "relative", marginBottom: 8 },
  stepImage: { width: 100, height: 100, borderRadius: 8 },
  stepImageDel: {
    position: "absolute", top: -8, right: -8,
    backgroundColor: "#fff", borderRadius: 12,
  },
  stepCameraBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: "#F3F4F6",
  },
  stepCameraTxt: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", paddingVertical: 16, borderRadius: 14,
  },
  saveBtnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },
  saveOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  saveOverlayBox: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    alignItems: "center", width: "85%",
  },
  saveOverlayTitle: { fontSize: 18, fontWeight: "800", color: "#013E77", marginTop: 16 },
  saveOverlaySub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  saveStepsList: { width: "100%", marginTop: 20, gap: 10 },
  saveStepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveStepTxt: { fontSize: 14, color: "#6B7280" },
  saveStepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
});
