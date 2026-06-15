/**
 * 食譜匯入頁面 — 最核心功能
 * 支援：剪貼板自動偵測 URL、手動貼上 URL、截圖上傳、文字貼上
 */
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Platform
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";

type ImportStep = "input" | "parsing" | "preview" | "success" | "failed";
type ImportMethod = "url" | "screenshot" | "text";

export default function ImportScreen() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("input");
  const [method, setMethod] = useState<ImportMethod>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
      setParsedRecipe(data);
      setStep("preview");
    },
    onError: (err) => {
      setErrorMsg(err.message || "無法解析此連結，請嘗試截圖上傳");
      setStep("failed");
    },
  });

  const parseTextMutation = trpc.recipes.parseText.useMutation({
    onSuccess: (data) => {
      setParsedRecipe(data);
      setStep("preview");
    },
    onError: (err) => {
      setErrorMsg(err.message || "無法解析文字內容");
      setStep("failed");
    },
  });

  const parseImageMutation = trpc.recipes.parseImage.useMutation({
    onSuccess: (data) => {
      setParsedRecipe(data);
      setStep("preview");
    },
    onError: (err) => {
      setErrorMsg(err.message || "無法解析圖片，請確保圖片清晰");
      setStep("failed");
    },
  });

  const uploadImageMutation = trpc.recipes.uploadRecipeImage.useMutation();

  const importMutation = trpc.recipes.importUser.useMutation({
    onSuccess: (data) => {
      setStep("success");
      setTimeout(() => {
        router.replace(`/recipe/${data.id}`);
      }, 1500);
    },
    onError: (err) => {
      Alert.alert("儲存失敗", err.message);
    },
  });

  // 開始解析 URL
  const handleParseUrl = (url: string) => {
    if (!url.trim()) {
      Alert.alert("請輸入連結");
      return;
    }
    setStep("parsing");
    parseUrlMutation.mutate({ url: url.trim() });
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
      // 上傳圖片後解析
      try {
        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: asset.base64!,
          mimeType: asset.mimeType || "image/jpeg",
        });
        parseImageMutation.mutate({ storageKey: uploadResult.key });
      } catch (e: any) {
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
    parseTextMutation.mutate({ text: textInput.trim() });
  };

  // 確認匯入
  const handleImport = () => {
    if (!parsedRecipe) return;
    importMutation.mutate(parsedRecipe);
  };

  // ── 解析中畫面 ──
  if (step === "parsing") {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#013E77" />
        <Text style={styles.parsingTitle}>AI 正在解析食譜...</Text>
        <Text style={styles.parsingSubtitle}>通常需要 10-30 秒</Text>
        <View style={styles.parsingSteps}>
          {["讀取內容", "識別食材", "整理步驟", "生成食譜"].map((s, i) => (
            <View key={s} style={styles.parsingStep}>
              <Ionicons name="checkmark-circle" size={16} color="#013E77" />
              <Text style={styles.parsingStepText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── 解析成功預覽 ──
  if (step === "preview" && parsedRecipe) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.previewHeader}>
          <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
          <Text style={styles.previewTitle}>解析成功！</Text>
          <Text style={styles.previewSubtitle}>請確認食譜資訊</Text>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewRecipeName}>{parsedRecipe.name}</Text>
          {parsedRecipe.cookTime > 0 && (
            <Text style={styles.previewMeta}>⏱ 烹飪時間：{parsedRecipe.cookTime} 分鐘</Text>
          )}
          {parsedRecipe.servings > 0 && (
            <Text style={styles.previewMeta}>👨‍👩‍👧 份量：{parsedRecipe.servings} 人份</Text>
          )}

          <Text style={styles.previewSectionTitle}>食材</Text>
          {parsedRecipe.ingredients?.slice(0, 5).map((ing: any, i: number) => (
            <Text key={i} style={styles.previewIngredient}>
              • {ing.name} {ing.quantity && ing.unit ? `${ing.quantity} ${ing.unit}` : ""}
            </Text>
          ))}
          {parsedRecipe.ingredients?.length > 5 && (
            <Text style={styles.previewMore}>...還有 {parsedRecipe.ingredients.length - 5} 種食材</Text>
          )}

          <Text style={styles.previewSectionTitle}>烹飪步驟</Text>
          {parsedRecipe.steps?.slice(0, 3).map((step: any, i: number) => (
            <Text key={i} style={styles.previewStep}>
              {i + 1}. {typeof step === "string" ? step : step.description}
            </Text>
          ))}
          {parsedRecipe.steps?.length > 3 && (
            <Text style={styles.previewMore}>...還有 {parsedRecipe.steps.length - 3} 個步驟</Text>
          )}
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImport}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.importButtonText}>儲存到食譜庫</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setStep("input"); setParsedRecipe(null); }}
          >
            <Text style={styles.retryButtonText}>重新匯入</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.failedTitle}>解析失敗</Text>
        <Text style={styles.failedMsg}>{errorMsg}</Text>
        <View style={styles.failedActions}>
          <TouchableOpacity
            style={styles.tryScreenshotButton}
            onPress={() => { setStep("input"); setMethod("screenshot"); }}
          >
            <Ionicons name="image" size={18} color="#fff" />
            <Text style={styles.tryScreenshotText}>改用截圖上傳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setStep("input"); setErrorMsg(""); }}
          >
            <Text style={styles.retryButtonText}>重試</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── 主要輸入畫面 ──
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>匯入食譜</Text>
        <Text style={styles.pageSubtitle}>從 Instagram、YouTube、小紅書等平台匯入</Text>
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
          { key: "screenshot", label: "截圖上傳", icon: "image" },
          { key: "text", label: "貼上文字", icon: "document-text" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.methodTab, method === tab.key && styles.methodTabActive]}
            onPress={() => setMethod(tab.key as ImportMethod)}
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

      {/* URL 輸入 */}
      {method === "url" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>貼上食譜連結</Text>
          <TextInput
            style={styles.urlInput}
            placeholder="https://www.instagram.com/reel/..."
            placeholderTextColor="#9CA3AF"
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />
          <View style={styles.supportedPlatforms}>
            {["Instagram", "YouTube", "小紅書", "TikTok"].map((p) => (
              <View key={p} style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>{p}</Text>
              </View>
            ))}
          </View>
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
          <Text style={styles.tipText}>
            💡 小貼士：對 Instagram / 小紅書食譜貼文截圖，包含食材和步驟的部分效果最佳
          </Text>
        </View>
      )}

      {/* 文字貼上 */}
      {method === "text" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>貼上食譜文字</Text>
          <TextInput
            style={styles.textInput}
            placeholder={"貼上食譜文字內容...\n\n例如：\n材料：\n- 雞肉 500g\n- 蒜頭 3瓣\n\n做法：\n1. 雞肉切塊..."}
            placeholderTextColor="#9CA3AF"
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.parseButton, !textInput.trim() && styles.parseButtonDisabled]}
            onPress={handleParseText}
            disabled={!textInput.trim()}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.parseButtonText}>AI 解析食譜</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FC" },
  centerContainer: {
    flex: 1, backgroundColor: "#F5F8FC",
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
  imagePickerArea: {
    backgroundColor: "#fff", borderRadius: 12, padding: 32,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#E5E0D8", borderStyle: "dashed",
    minHeight: 180, marginBottom: 12,
  },
  selectedImage: { width: "100%", height: 200, borderRadius: 8 },
  imagePickerText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 8 },
  imagePickerSubText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  tipText: {
    fontSize: 12, color: "#6B7280", backgroundColor: "#FFFBF5",
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#F0E8DC",
  },
  textInput: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    fontSize: 14, color: "#1A1A1A", minHeight: 200,
    borderWidth: 1.5, borderColor: "#E5E0D8",
    marginBottom: 12,
  },
  parsingTitle: { fontSize: 18, fontWeight: "800", color: "#013E77", marginTop: 16 },
  parsingSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 24 },
  parsingSteps: { gap: 8 },
  parsingStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  parsingStepText: { fontSize: 14, color: "#374151" },
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
  previewIngredient: { fontSize: 13, color: "#374151", marginBottom: 3 },
  previewStep: { fontSize: 13, color: "#374151", marginBottom: 6, lineHeight: 20 },
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
  failedMsg: { fontSize: 14, color: "#6B7280", marginTop: 8, textAlign: "center", marginBottom: 24 },
  failedActions: { gap: 10, width: "100%" },
  tryScreenshotButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", padding: 14, borderRadius: 12,
  },
  tryScreenshotText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
