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

import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc, apiClient } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const { width, height } = Dimensions.get("window");
const getOnboardingKey = (userId: string | number) => `kindcipe_onboarding_done_${userId}`;

type OnboardingStep = "signin" | "choice" | "create" | "join" | "guide" | "import";

export default function OnboardingScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("signin");
  const [loading, setLoading] = useState(false);
  
  // 建立廚房表單
  const [kitchenName, setKitchenName] = useState("");
  const [userName, setUserName] = useState("");
  
  // 加入廚房表單
  const [inviteCode, setInviteCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  
  // 匯入食譜表單
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"url" | "text">("url");
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<string>("");
  const isParsingRef = useRef(false);
  
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
    if (isParsingRef.current) return;
    if (importMode === "url" && !importUrl) {
      setParseError("請輸入 URL");
      return;
    }
    if (importMode === "text" && !importText) {
      setParseError("請貼上食譜文字");
      return;
    }
    
    try {
      isParsingRef.current = true;
      setParseLoading(true);
      setParseError(null);
      setParseProgress("讀取中...");
      
      if (importMode === "url") {
        setParseProgress("正在擷取網頁內容...");
        const result = await apiClient.recipes.parseUrl.mutate({ url: importUrl });
        if (result.parseReason === "ok") {
          setParseProgress("識別食材與步驟...");
          await new Promise(resolve => setTimeout(resolve, 100));
          setPreviewData(result);
          setSelectedCategory(result.recipeCategory || "中菜");
          setParseProgress("");
        } else {
          setParseError(`無法解析: ${result.description}`);
        }
      } else if (importMode === "text") {
        setParseProgress("正在分析文字內容...");
        const result = await apiClient.recipes.parseText.mutate({ text: importText });
        if (result.name !== "無法解析" && result.name !== "需要手動輸入") {
          setParseProgress("整理食譜資料...");
          await new Promise(resolve => setTimeout(resolve, 100));
          setPreviewData(result);
          setSelectedCategory(result.recipeCategory || "中菜");
          setParseProgress("");
        } else {
          setParseError(result.description);
        }
      }
    } catch (error) {
      console.error("解析失敗:", error);
      setParseError("解析失敗，請重試");
    } finally {
      setParseLoading(false);
      isParsingRef.current = false;
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
      
      const result = await apiClient.recipes.importUser.mutate({
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
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("已在你的食譜庫中")) {
        console.log("食譜已存在，跳過");
        await finishOnboarding();
        return;
      }
      console.error("保存失敗:", error);
      setParseError("保存失敗，請重試");
    } finally {
      setImportSaving(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    setInviteCode(data);
  };

  // QR Code Scanner modal
  if (showScanner) {
    return (
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>掃描邀請 QR Code</Text>
          <TouchableOpacity
            style={styles.scannerCloseButton}
            onPress={() => { setShowScanner(false); scannedRef.current = false; }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    );
  }

  // 第一屏：Sign In
  if (step === "signin") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Image
            source={require("../assets/logo-full.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle} adjustsFontSizeToFit numberOfLines={1}>告別 每日煩惱 「今晚食咩？」</Text>
          <Text style={styles.heroSubtitle}>AI 智慧排餐 · 家人傭人同步</Text>
          <Text style={styles.heroDesc}>拒絕每日選擇困難</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setStep("choice")}
          >
            <Text style={styles.primaryBtnText}>開始使用 Kindcipe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={logout}
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
          <Image
            source={require("../assets/logo-full.png")}
            style={styles.logoImageSmall}
            resizeMode="contain"
          />
          <Text style={styles.title}>開始使用 Kindcipe</Text>
          <Text style={styles.subtitle}>先建立你的廚房，再邀請家人一起使用</Text>
        </View>

        <View style={styles.choiceContainer}>
          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnPrimary]}
            onPress={() => setStep("create")}
          >
            <View style={styles.choiceIconWrapper}>
              <View style={styles.choiceIconCircle}>
                <Text style={styles.choiceIconText}>+</Text>
              </View>
            </View>
            <Text style={styles.choiceTitle}>建立廚房</Text>
            <Text style={styles.choiceDesc}>
              建立你的家庭廚房{"\n"}
              設定廚房名稱，邀請家人加入{"\n"}
              一起規劃餐單、同步購物清單
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnSecondary]}
            onPress={() => setStep("join")}
          >
            <View style={styles.choiceIconWrapper}>
              <View style={styles.choiceIconCircleSecondary}>
                <Text style={styles.choiceIconTextSecondary}>←</Text>
              </View>
            </View>
            <Text style={styles.choiceTitle}>加入廚房</Text>
            <Text style={styles.choiceDesc}>
              輸入家人給你的邀請碼{"\n"}
              加入已有廚房，與家人共享{"\n"}
              食譜、餐單、採購即時同步
            </Text>
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
          <Text style={styles.formTitle}>設定你的廚房</Text>
          <Text style={styles.formSubtitle}>為你的廚房取個名字吧</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>廚房名字</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：陳家廚房、小豬之家"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={kitchenName}
              onChangeText={setKitchenName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>你的名字</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：陳太太、小明"
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
                onPress={async () => {
              try {
                setLoading(true);
                if (meQuery.data?.activeFamilyId) {
                  setStep("guide");
                  return;
                }
                await apiClient.family.create.mutate({ name: kitchenName, nickname: userName.trim() || undefined });
                setStep("guide");
              } catch (err: any) {
                const msg = err?.message || err?.data?.message || "";
                console.error("建立廚房失敗:", err);
                Alert.alert("建立廚房失敗", msg || "請重試");
              } finally {
                setLoading(false);
              }
            }}
            disabled={!kitchenName || !userName || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#013E77" size={18} />
                <Text style={styles.parseProgressText}>建立中...</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>建立廚房</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.formNote}>建立後可隨時邀請家人加入</Text>
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
          <Text style={styles.formTitle}>加入家人廚房</Text>
          <Text style={styles.formSubtitle}>輸入家人給你的邀請碼</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>邀請碼</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：ABC123"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.scanQrButton}
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  const perm = await requestCameraPermission();
                  if (!perm.granted) {
                    Alert.alert("需要相機權限", "請在設定中允許 Kindcipe 使用相機以掃描 QR Code");
                    return;
                  }
                }
                scannedRef.current = false;
                setShowScanner(true);
              }}
            >
              <Ionicons name="camera-outline" size={18} color="#013E77" />
              <Text style={styles.scanQrButtonText}>掃描 QR Code</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !inviteCode && styles.disabledBtn,
            ]}
            onPress={async () => {
              try {
                setLoading(true);
                if (meQuery.data?.activeFamilyId) {
                  setStep("guide");
                  return;
                }
                await apiClient.family.join.mutate({ inviteCode });
                setStep("guide");
              } catch (err: any) {
                const msg = err?.message || err?.data?.message || "";
                console.error("加入廚房失敗:", err);
                Alert.alert("加入廚房失敗", msg || "請重試");
              } finally {
                setLoading(false);
              }
            }}
            disabled={!inviteCode || loading}
          >
            {loading ? (
              <View style={styles.parseProgressRow}>
                <ActivityIndicator color="#013E77" size={18} />
                <Text style={styles.parseProgressText}>加入中...</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>加入廚房</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.formNote}>邀請碼可以向廚房管理員索取</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 第四屏：空廚房引導
  if (step === "guide") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guideWrap}>
          <View style={styles.guideHeader}>
            <Image
              source={require("../assets/logo-full.png")}
              style={styles.guideLogo}
              resizeMode="contain"
            />
            <Text style={styles.title}>廚房已就緒！</Text>
            <Text style={styles.subtitle}>以後管理家庭飲食就靠 Kindcipe</Text>
          </View>

          <View style={styles.benefitList}>
            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Ionicons name="restaurant-outline" size={20} color="#013E77" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>告別 每日煩惱 「今晚食咩？」</Text>
                <Text style={styles.benefitDesc}>AI 智慧排餐，家人傭人同步，拒絕每日選擇困難</Text>
              </View>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Ionicons name="people-outline" size={20} color="#013E77" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>家庭資訊零時差</Text>
                <Text style={styles.benefitDesc}>排餐庫存全家共享，不再為「買咗未？」吵架</Text>
              </View>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Ionicons name="cart-outline" size={20} color="#013E77" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>購物清單智慧避雷</Text>
                <Text style={styles.benefitDesc}>食材缺貨隨手記，全家即時同步，杜絕重複購買</Text>
              </View>
            </View>

            <View style={styles.benefitCard}>
              <View style={styles.benefitIconCircle}>
                <Ionicons name="phone-portrait-outline" size={20} color="#013E77" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>網紅食譜一鍵還原</Text>
                <Text style={styles.benefitDesc}>IG 美食直接導入，AI 自動拆解步驟與清單</Text>
              </View>
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
                <Text style={styles.primaryBtnText}>開始匯入第一個食譜</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 第五屏：匯入食譜
  if (step === "import") {
    // 如果還沒有預覽數據，顯示 URL/文字輸入
    if (!previewData) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep("guide")}>
              <Text style={styles.backBtn}>← 返回</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.formTitle}>匯入第一個食譜</Text>
            <Text style={styles.formSubtitle}>貼上連結自動偵測，或手動輸入文字</Text>

            {/* 輸入方式切換 */}
            <View style={styles.importMethodTabs}>
              <TouchableOpacity
                style={[styles.importMethodTab, importMode === "url" && styles.importMethodTabActive]}
                onPress={() => setImportMode("url")}
              >
                <Text style={[styles.importMethodTabText, importMode === "url" && styles.importMethodTabTextActive]}>貼上連結</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importMethodTab, importMode === "text" && styles.importMethodTabActive]}
                onPress={() => setImportMode("text")}
              >
                <Text style={[styles.importMethodTabText, importMode === "text" && styles.importMethodTabTextActive]}>貼上文字</Text>
              </TouchableOpacity>
            </View>

            {/* URL 輸入 */}
            {importMode === "url" && (
              <View style={styles.formGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="貼上食譜連結，例如 https://www.instagram.com/reel/..."
                  placeholderTextColor="#9CA3AF"
                  value={importUrl}
                  onChangeText={(text) => {
                    setImportUrl(text);
                    setParseError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!parseLoading}
                />

                <View style={styles.supportedPlatforms}>
                  {["Instagram", "YouTube", "Threads", "小紅書", "Facebook", "TikTok"].map((p) => (
                    <View key={p} style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>{p}</Text>
                    </View>
                  ))}
                </View>

                {parseError && (
                  <Text style={styles.errorText}>{parseError}</Text>
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
                    <View style={styles.parseProgressRow}>
                      <ActivityIndicator color="#013E77" size="small" />
                      <Text style={styles.parseProgressText}>{parseProgress}</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>AI 解析食譜</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 文字輸入 */}
            {importMode === "text" && (
              <View style={styles.formGroup}>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  placeholder={"貼上食譜文字內容...\n\n例如：\n材料：\n- 雞肉 500g\n- 蒜頭 3瓣\n\n做法：\n1. 雞肉切塊..."}
                  placeholderTextColor="#9CA3AF"
                  value={importText}
                  onChangeText={(text) => {
                    setImportText(text);
                    setParseError(null);
                  }}
                  multiline
                  numberOfLines={10}
                  editable={!parseLoading}
                />

                {parseError && (
                  <Text style={styles.errorText}>{parseError}</Text>
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
                    <View style={styles.parseProgressRow}>
                      <ActivityIndicator color="#013E77" size="small" />
                      <Text style={styles.parseProgressText}>{parseProgress}</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>AI 解析食譜</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 跳過按鈕 */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={finishOnboarding}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>跳過，稍後再匯入</Text>
            </TouchableOpacity>
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
          {(() => {
            const imgUri = previewData.image || previewData.thumbnailUrl;
            const isValidUri = imgUri && typeof imgUri === "string" && imgUri.startsWith("http");
            return isValidUri ? (
              <Image source={{ uri: imgUri }} style={styles.previewImage} />
            ) : null;
          })()}

          {/* 食譜名稱 */}
          <Text style={styles.previewTitle}>{previewData.name}</Text>

          {/* 食譜信息 */}
          <View style={styles.previewInfoContainer}>
            {previewData.cookTime > 0 && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>烹飪時間</Text>
                <Text style={styles.previewInfoValue}>{previewData.cookTime} 分鐘</Text>
              </View>
            )}
            {previewData.servings > 0 && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>人份</Text>
                <Text style={styles.previewInfoValue}>{previewData.servings} 人</Text>
              </View>
            )}
            {previewData.difficulty && (
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoLabel}>難度</Text>
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
              <View style={styles.ingredientListContainer}>
                {previewData.ingredients.map((ing: any, idx: number) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <View style={styles.ingredientCheckbox}>
                      <Text style={styles.ingredientCheckmark}>✓</Text>
                    </View>
                    <Text style={styles.ingredientItem}>
                      {ing.name}{ing.quantity ? ` ${ing.quantity}` : ""}{ing.unit ? ` ${ing.unit}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 錯誤提示 */}
          {parseError && (
            <Text style={styles.errorText}>{parseError}</Text>
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
              <Text style={styles.primaryBtnText}>確認匯入</Text>
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
    backgroundColor: "#FFFFFF",
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
    color: "#013E77",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  logoImage: {
    width: 240,
    height: 240,
    marginBottom: 16,
  },
  logoImageSmall: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#013E77",
    textAlign: "center",
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#013E77",
    textAlign: "center",
    marginBottom: 12,
  },
  heroDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#013E77",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 40,
  },
  formNote: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
  desc: {
    fontSize: 16,
    color: "#333D4B",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#013E77",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#013E77",
  },
  secondaryBtnText: {
    color: "#013E77",
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
    backgroundColor: "#FFFFFF",
  },
  choiceBtnPrimary: {
    borderWidth: 2,
    borderColor: "#013E77",
  },
  choiceBtnSecondary: {
    borderWidth: 2,
    borderColor: "#EBEBEB",
  },
  choiceEmoji: {
    fontSize: 48,
  },
  choiceIconWrapper: {
    marginBottom: 4,
  },
  choiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#013E77",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  choiceIconCircleSecondary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconTextSecondary: {
    fontSize: 24,
    fontWeight: "700",
    color: "#013E77",
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#013E77",
    textAlign: "center",
  },
  choiceDesc: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  formContainer: {
    flex: 1,
    paddingVertical: 24,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#013E77",
    marginBottom: 12,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333D4B",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333D4B",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  scrollContent: {
    flexGrow: 1,
  },
  guideWrap: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  guideHeader: {
    alignItems: "center",
    paddingTop: 16,
  },
  guideLogo: {
    width: 100,
    height: 100,
    marginBottom: 8,
  },
  benefitList: {
    gap: 10,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  benefitIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#013E77",
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
  },
  platformContainer: {
    gap: 12,
    paddingVertical: 20,
  },
  importMethodTabs: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  importMethodTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  importMethodTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  importMethodTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  importMethodTabTextActive: {
    color: "#013E77",
    fontWeight: "800",
  },
  supportedPlatforms: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  platformBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformBadgeText: {
    fontSize: 12,
    color: "#013E77",
    fontWeight: "600",
  },
  textAreaInput: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#F5F5F5",
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#013E77",
    marginBottom: 16,
  },
  previewInfoContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  previewInfo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  previewInfoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  previewInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    overflow: "hidden",
  },
  picker: {
    color: "#013E77",
    backgroundColor: "#FFFFFF",
  },
  ingredientListContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    padding: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  ingredientCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#013E77",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientCheckmark: {
    fontSize: 12,
    color: "#013E77",
    fontWeight: "700",
  },
  ingredientItem: {
    flex: 1,
    fontSize: 14,
    color: "#333D4B",
    lineHeight: 20,
  },
  parseProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  parseProgressText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scanQrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: "#013E77",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  scanQrButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#013E77",
  },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  scannerText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 24,
  },
  scannerCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
