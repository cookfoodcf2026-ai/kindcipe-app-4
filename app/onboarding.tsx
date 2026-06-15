/**
 * Onboarding 新用戶引導流程（按產品文件 v1.2）
 * 
 * 第一屏：Sign In（登入）
 * 第二屏：你想做什麼？（建立 vs 加入廚房）
 * 第三屏 A：建立廚房（廚房名字 + 你的名字）
 * 第三屏 B：加入廚房（輸入邀請碼）
 * 第四屏：空廚房引導（三步說明）
 * 第五屏：匯入食譜（平台選擇 → URL/文字輸入 → 預覽 + 分類選擇 → 保存）
 */

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

const { width, height } = Dimensions.get("window");
const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;

type OnboardingStep = "signin" | "choice" | "create" | "join" | "guide" | "import";

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("signin");
  const [loading, setLoading] = useState(false);
  
  // 建立廚房表單
  const [kitchenName, setKitchenName] = useState("");
  const [userName, setUserName] = useState("");
  
  // 加入廚房表單
  const [inviteCode, setInviteCode] = useState("");
  
  // 匯入食譜表單
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"url" | "text" | null>(null);
  const [importPlatform, setImportPlatform] = useState<"instagram" | "youtube" | "xiaohongshu" | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // 預覽和分類選擇
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [importSaving, setImportSaving] = useState(false);
  
  const RECIPE_CATEGORIES = [
    "中菜",
    "西餐",
    "日式",
    "韓式",
    "東南亞",
    "甜品",
    "飲品",
    "其他",
  ];

  // 用戶資料（用於存儲 onboarding 狀態）
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  // 完成 Onboarding（以用戶 ID 為 key，確保不同帳號都會看到 onboarding）
  const finishOnboarding = async () => {
    try {
      setLoading(true);
      const userId = meQuery.data?.id;
      if (userId) {
        const key = getOnboardingKey(userId);
        await AsyncStorage.setItem(key, "true");
      }
      // 等待一下確保狀態更新
      await new Promise(resolve => setTimeout(resolve, 200));
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Onboarding 完成失敗:", error);
      setLoading(false);
    }
  };
  
  // 解析食譜（進入預覽頁面）
  const handleParseRecipe = async () => {
    if (importMode === "url" && !importUrl) {
      setParseError("請輸入 URL");
      return;
    }
    if (importMode === "text" && !importText) {
      setParseError("請貼上食譜文字");
      return;
    }
    
    try {
      setParseLoading(true);
      setParseError(null);
      
      if (importMode === "url") {
        const result = await trpc.recipes.parseUrl.mutate({ url: importUrl });
        if (result.parseReason === "ok") {
          setPreviewData(result);
          setSelectedCategory(result.recipeCategory || "中菜");
        } else {
          setParseError(`無法解析: ${result.description}`);
        }
      } else if (importMode === "text") {
        const result = await trpc.recipes.parseText.mutate({ text: importText });
        if (result.name !== "無法解析" && result.name !== "需要手動輸入") {
          setPreviewData(result);
          setSelectedCategory(result.recipeCategory || "中菜");
        } else {
          setParseError(result.description);
        }
      }
    } catch (error) {
      console.error("解析失敗:", error);
      setParseError("解析失敗，請重試");
    } finally {
      setParseLoading(false);
    }
  };
  
  // 確認並保存食譜
  const handleConfirmImport = async () => {
    if (!previewData || !selectedCategory) {
      setParseError("請選擇分類");
      return;
    }
    
    try {
      setImportSaving(true);
      setParseError(null);
      
      const result = await trpc.recipes.importRecipe.mutate({
        name: previewData.name,
        description: previewData.description,
        image: previewData.image || previewData.thumbnailUrl,
        thumbnailUrl: previewData.thumbnailUrl,
        cookTime: previewData.cookTime,
        servings: previewData.servings,
        difficulty: previewData.difficulty,
        recipeCategory: selectedCategory,
        ingredients: previewData.ingredients || [],
        steps: previewData.steps || [],
        tags: previewData.tags || [],
        sourceUrl: previewData.sourceUrl,
        sourceAuthor: previewData.sourceAuthor,
      });
      
      if (result.success) {
        console.log("食譜保存成功:", result.id);
        await finishOnboarding();
      } else {
        setParseError("保存失敗");
      }
    } catch (error) {
      console.error("保存失敗:", error);
      setParseError("保存失敗，請重試");
    } finally {
      setImportSaving(false);
    }
  };

  // 第一屏：Sign In
  if (step === "signin") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>歡迎使用 Kindcipe</Text>
          <Text style={styles.subtitle}>智能家庭廚房管理助手</Text>
          <Text style={styles.desc}>
            一起排餐・一起開飯{"\n"}
            由規劃到開飯，更快更輕鬆。
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setStep("choice")}
          >
            <Text style={styles.primaryBtnText}>✓ 已登入，繼續</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.secondaryBtnText}>返回登入</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第二屏：你想做什麼？
  if (step === "choice") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("signin")}>
            <Text style={styles.backBtn}>← 返回</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.title}>開始使用 Kindcipe</Text>
          <Text style={styles.subtitle}>30 秒快速設置</Text>
        </View>

        <View style={styles.choiceContainer}>
          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnPrimary]}
            onPress={() => setStep("create")}
          >
            <Text style={styles.choiceEmoji}>🏠</Text>
            <Text style={styles.choiceTitle}>建立廚房</Text>
            <Text style={styles.choiceDesc}>我是廚房的管理者</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnSecondary]}
            onPress={() => setStep("join")}
          >
            <Text style={styles.choiceEmoji}>📩</Text>
            <Text style={styles.choiceTitle}>加入廚房</Text>
            <Text style={styles.choiceDesc}>我收到了邀請碼</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第三屏 A：建立廚房
  if (step === "create") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("choice")}>
            <Text style={styles.backBtn}>← 返回</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>建立你的廚房</Text>
          <Text style={styles.formSubtitle}>1 分鐘快速設置</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>廚房名字</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：陳家廚房"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={kitchenName}
              onChangeText={setKitchenName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>你的名字</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：陳太太"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={userName}
              onChangeText={setUserName}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!kitchenName || !userName) && styles.disabledBtn,
            ]}
            onPress={() => setStep("guide")}
            disabled={!kitchenName || !userName || loading}
          >
            {loading ? (
              <ActivityIndicator color="#013E77" />
            ) : (
              <Text style={styles.primaryBtnText}>完成，進入廚房 →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 第三屏 B：加入廚房
  if (step === "join") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("choice")}>
            <Text style={styles.backBtn}>← 返回</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>加入廚房</Text>
          <Text style={styles.formSubtitle}>30 秒快速加入</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>輸入邀請碼</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：ABC123"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !inviteCode && styles.disabledBtn,
            ]}
            onPress={() => setStep("guide")}
            disabled={!inviteCode || loading}
          >
            {loading ? (
              <ActivityIndicator color="#013E77" />
            ) : (
              <Text style={styles.primaryBtnText}>加入廚房</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第四屏：空廚房引導
  if (step === "guide") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>歡迎！</Text>
          <Text style={styles.subtitle}>三步開始使用</Text>
        </View>

        <View style={styles.guideContainer}>
          <View style={styles.guideStep}>
            <Text style={styles.guideNumber}>1️⃣</Text>
            <Text style={styles.guideText}>匯入你喜歡的食譜</Text>
          </View>

          <View style={styles.guideStep}>
            <Text style={styles.guideNumber}>2️⃣</Text>
            <Text style={styles.guideText}>排好本週每日餐單</Text>
          </View>

          <View style={styles.guideStep}>
            <Text style={styles.guideNumber}>3️⃣</Text>
            <Text style={styles.guideText}>食材自動加入採購清單，即時同步給廚房所有人</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setStep("import")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#013E77" />
            ) : (
              <Text style={styles.primaryBtnText}>開始匯入第一個食譜 →</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 第五屏：匯入食譜
  if (step === "import") {
    // 如果還沒有預覽數據，顯示平台選擇 + URL/文字輸入
    if (!previewData) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep("guide")}>
              <Text style={styles.backBtn}>← 返回</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.formTitle}>匯入食譜</Text>
            <Text style={styles.formSubtitle}>支援 Instagram、YouTube、小紅書 或手動輸入</Text>

            {/* 平台選擇 */}
            {!importMode && (
              <View style={styles.platformContainer}>
                <TouchableOpacity
                  style={styles.platformBtn}
                  onPress={() => {
                    setImportPlatform("instagram");
                    setImportMode("url");
                  }}
                >
                  <Text style={styles.platformEmoji}>📱</Text>
                  <Text style={styles.platformText}>Instagram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.platformBtn}
                  onPress={() => {
                    setImportPlatform("youtube");
                    setImportMode("url");
                  }}
                >
                  <Text style={styles.platformEmoji}>📺</Text>
                  <Text style={styles.platformText}>YouTube</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.platformBtn}
                  onPress={() => {
                    setImportPlatform("xiaohongshu");
                    setImportMode("url");
                  }}
                >
                  <Text style={styles.platformEmoji}>🔴</Text>
                  <Text style={styles.platformText}>小紅書</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.platformBtn}
                  onPress={() => setImportMode("text")}
                >
                  <Text style={styles.platformEmoji}>✏️</Text>
                  <Text style={styles.platformText}>手動輸入</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* URL 輸入 */}
            {importMode === "url" && (
              <View style={styles.formGroup}>
                <View style={styles.platformHeader}>
                  <TouchableOpacity onPress={() => setImportMode(null)}>
                    <Text style={styles.backBtn}>← 返回</Text>
                  </TouchableOpacity>
                  <Text style={styles.platformTitle}>
                    {importPlatform === "instagram"
                      ? "📱 Instagram"
                      : importPlatform === "youtube"
                      ? "📺 YouTube"
                      : "🔴 小紅書"}
                  </Text>
                </View>

                <Text style={styles.label}>貼上連結</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`例如：https://www.${importPlatform}.com/...`}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={importUrl}
                  onChangeText={(text) => {
                    setImportUrl(text);
                    setParseError(null);
                  }}
                  editable={!parseLoading}
                />

                {parseError && (
                  <Text style={styles.errorText}>⚠️ {parseError}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!importUrl || parseLoading) && styles.disabledBtn,
                  ]}
                  onPress={handleParseRecipe}
                  disabled={!importUrl || parseLoading}
                >
                  {parseLoading ? (
                    <ActivityIndicator color="#013E77" />
                  ) : (
                    <Text style={styles.primaryBtnText}>解析食譜 →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 文字輸入 */}
            {importMode === "text" && (
              <View style={styles.formGroup}>
                <View style={styles.platformHeader}>
                  <TouchableOpacity onPress={() => setImportMode(null)}>
                    <Text style={styles.backBtn}>← 返回</Text>
                  </TouchableOpacity>
                  <Text style={styles.platformTitle}>✏️ 手動輸入</Text>
                </View>

                <Text style={styles.label}>貼上食譜文字</Text>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  placeholder="例如：豉汁蒸排骨\n材料：排骨 500g, 豉汁 2 湯匙...\n做法：1. 排骨洗淨...\n2. 加入豉汁...\n3. 蒸 20 分鐘..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={importText}
                  onChangeText={(text) => {
                    setImportText(text);
                    setParseError(null);
                  }}
                  multiline
                  numberOfLines={8}
                  editable={!parseLoading}
                />

                {parseError && (
                  <Text style={styles.errorText}>⚠️ {parseError}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!importText || parseLoading) && styles.disabledBtn,
                  ]}
                  onPress={handleParseRecipe}
                  disabled={!importText || parseLoading}
                >
                  {parseLoading ? (
                    <ActivityIndicator color="#013E77" />
                  ) : (
                    <Text style={styles.primaryBtnText}>解析食譜 →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 跳過按鈕 */}
            {importMode === null && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={finishOnboarding}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>⏭️ 跳過，稍後再匯入</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    // 如果有預覽數據，顯示預覽 + 分類選擇
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPreviewData(null)}>
            <Text style={styles.backBtn}>← 返回編輯</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>食譜預覽</Text>

          {/* 食譜圖片 */}
          {(previewData.image || previewData.thumbnailUrl) && (
            <Image
              source={{ uri: previewData.image || previewData.thumbnailUrl }}
              style={styles.previewImage}
            />
          )}

          {/* 食譜名稱 */}
          <Text style={styles.previewTitle}>{previewData.name}</Text>

          {/* 食譜信息 */}
          <View style={styles.previewInfoContainer}>
            {previewData.cookTime > 0 && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>⏱️ 烹飪時間</Text>
                <Text style={styles.previewInfoValue}>{previewData.cookTime} 分鐘</Text>
              </View>
            )}
            {previewData.servings > 0 && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>👥 人份</Text>
                <Text style={styles.previewInfoValue}>{previewData.servings} 人</Text>
              </View>
            )}
            {previewData.difficulty && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>📊 難度</Text>
                <Text style={styles.previewInfoValue}>{previewData.difficulty}</Text>
              </View>
            )}
          </View>

          {/* 分類選擇 */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>選擇分類</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value)}
                style={styles.picker}
              >
                {RECIPE_CATEGORIES.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          {/* 食材預覽 */}
          {previewData.ingredients && previewData.ingredients.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>食材清單 ({previewData.ingredients.length} 項)</Text>
              {previewData.ingredients.slice(0, 5).map((ing: any, idx: number) => (
                <Text key={idx} style={styles.ingredientItem}>
                  • {ing.name} {ing.quantity} {ing.unit}
                </Text>
              ))}
              {previewData.ingredients.length > 5 && (
                <Text style={styles.ingredientItem}>• 及其他 {previewData.ingredients.length - 5} 項</Text>
              )}
            </View>
          )}

          {/* 錯誤提示 */}
          {parseError && (
            <Text style={styles.errorText}>⚠️ {parseError}</Text>
          )}

          {/* 確認按鈕 */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!selectedCategory || importSaving) && styles.disabledBtn,
            ]}
            onPress={handleConfirmImport}
            disabled={!selectedCategory || importSaving}
          >
            {importSaving ? (
              <ActivityIndicator color="#013E77" />
            ) : (
              <Text style={styles.primaryBtnText}>✅ 確認匯入</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#013E77",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 16,
  },
  desc: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#013E77",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  choiceContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  choiceBtn: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  choiceBtnPrimary: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  choiceBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  choiceEmoji: {
    fontSize: 48,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  choiceDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  guideContainer: {
    flex: 1,
    gap: 20,
    paddingVertical: 20,
  },
  guideStep: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  guideNumber: {
    fontSize: 32,
    marginTop: -4,
  },
  guideText: {
    flex: 1,
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 24,
  },
  platformContainer: {
    gap: 12,
    paddingVertical: 20,
  },
  platformBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  platformEmoji: {
    fontSize: 32,
  },
  platformText: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  platformTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  textAreaInput: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  // 預覽相關樣式
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  previewInfoContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  previewInfo: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  previewInfoLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  previewInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pickerContainer: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  picker: {
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  ingredientItem: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 6,
  },
});
