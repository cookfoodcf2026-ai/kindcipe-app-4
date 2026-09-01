import { useState, useMemo, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal, ActivityIndicator, Linking, Platform, KeyboardAvoidingView, Keyboard
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/src/components/Toast";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import UnitPicker from "@/src/components/UnitPicker";
import { DateUtil } from "@/src/lib/DateUtil";
import {
  SHOPPING_TEMPLATES,
  templateToShoppingItems,
  calculateQuantityByPeople
} from "@/lib/shopping-templates";
import type {
  ShoppingTemplate,
  TemplateCategory,
} from "@/lib/shopping-templates";

const BRAND = "#013E77";
const BG = "#FFFBF5";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const BORDER = "#F0E8DC";
const ACCENT = "#FF8C00"; // 亮橙色

type CustomItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price?: number;
};

const safeParseArray = <T,>(raw: string): T[] | null => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export default function ShoppingTemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const templateIdParam = params.templateId as string;
  const dateParam = params.date as string;

  // 1. 核心狀態
  const [selectedTemplate, setSelectedTemplate] = useState<ShoppingTemplate | null>(null);
  const [peopleCount, setPeopleCount] = useState(4); // 預設 4 人
  const [planDate, setPlanDate] = useState<string | null>(DateUtil.todayISO());
  const planDateLabel = planDate ?? "未設定";
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({});
  const [unitOverrides, setUnitOverrides] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // 自訂項目狀態
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [activeInputCategory, setActiveInputCategory] = useState<string | null>(null);
  const [customInputName, setCustomInputName] = useState("");
  const [customInputQty, setCustomInputQty] = useState("1");
  const [customInputUnit, setCustomInputUnit] = useState("包");
  const [customInputPrice, setCustomInputPrice] = useState("");
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // AA制計數狀態
  const [showAASplitModal, setShowAASplitModal] = useState(false);
  const [actualSpent, setActualSpent] = useState("");

  // 多語言分享狀態
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLanguage, setShareLanguage] = useState<"zh" | "en" | "id" | "ph">("zh");
  
  // 價錢輸入狀態
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceItem, setPriceItem] = useState<{ id: string; name: string; price: string } | null>(null);
  
  // 儲存清單狀態
  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [savedListName, setSavedListName] = useState("");
  const [savedLists, setSavedLists] = useState<{ id: string; name: string; template: string; people: number; items: string[] }[]>([]);

  // 鍵盤高度（令底部浮動結算欄唔會被鍵盤遮住）
  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // TRPC Mutation
  const addShoppingBatchM = trpc.shopping.addBatch.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
      showToast(`✅ 已將所選食材加入購物車（預定日子：${planDateLabel}）`);
      setSelectedTemplate(null);
      setSelectedItems(new Set());
      setQuantityOverrides({});
      setCustomItems([]);
    },
    onError: (e) => showToast(`加入失敗：${e.message}`, "error"),
  });
  
  // 載入已儲存清單
  useEffect(() => {
    loadSavedLists();
  }, []);
  
  const loadSavedLists = async () => {
    try {
      const stored = await AsyncStorage.getItem("@kindcipe:saved-shopping-lists");
      if (stored) {
        const parsed = safeParseArray<any>(stored);
        if (parsed) setSavedLists(parsed);
      }
    } catch (e) {
      console.error("Failed to load saved lists:", e);
    }
  };
  
  const saveCurrentList = async () => {
    if (!savedListName.trim()) {
      Alert.alert("請輸入清單名稱");
      return;
    }
    
    const selectedIds = Array.from(selectedItems).filter(id => !id.startsWith("custom_"));
    const newList = {
      id: `list_${Date.now()}`,
      name: savedListName.trim(),
      template: selectedTemplate?.id || "",
      people: peopleCount,
      items: selectedIds,
      customItems: customItems.filter(i => selectedItems.has(i.id)),
    };
    
    const updatedLists = [...savedLists, newList];
    setSavedLists(updatedLists);
    
    try {
      await AsyncStorage.setItem("@kindcipe:saved-shopping-lists", JSON.stringify(updatedLists));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("已儲存", `清單「${savedListName}」已儲存，方便下次重用！`);
      setShowSaveListModal(false);
      setSavedListName("");
    } catch (e) {
      Alert.alert("儲存失敗", e instanceof Error ? e.message : "未知錯誤");
    }
  };
  
  const loadSavedList = async (list: any) => {
    // 載入模板
    const template = SHOPPING_TEMPLATES.find(t => t.id === list.template);
    if (!template) {
      Alert.alert("錯誤", "找不到對應嘅模板");
      return;
    }
    
    setSelectedTemplate(template);
    setPeopleCount(list.people);
    setSelectedItems(new Set([...list.items, ...list.customItems.map((i: any) => i.id)]));
    setCustomItems(list.customItems || []);
    setExpandedCategories(new Set([template.categories[0]?.id || ""]));
    
    Alert.alert("已載入", `已載入清單「${list.name}」`);
  };
  
  const deleteSavedList = async (listId: string) => {
    Alert.alert(
      "刪除清單",
      "確定要刪除呢個清單？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: async () => {
            const updatedLists = savedLists.filter(l => l.id !== listId);
            setSavedLists(updatedLists);
            try {
              await AsyncStorage.setItem("@kindcipe:saved-shopping-lists", JSON.stringify(updatedLists));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              console.error("Failed to delete list:", e);
            }
          }
        }
      ]
    );
  };

  // 2. 路由參數與初始化載入
  useEffect(() => {
    if (templateIdParam) {
      // templateIdParam 可能係 "template_hotpot" 或 "template_bbq"
      const found = SHOPPING_TEMPLATES.find((t) => t.id === templateIdParam);
      if (found) {
        setSelectedTemplate(found);
        setExpandedCategories(new Set([found.categories[0]?.id || ""]));
      } else {
        // 如果搵唔到，嘗試移除 "template_" 前綴再匹配
        const cleanedId = templateIdParam.replace("template_", "");
        const foundAlt = SHOPPING_TEMPLATES.find((t) => t.id.replace("template_", "") === cleanedId);
        if (foundAlt) {
          setSelectedTemplate(foundAlt);
          setExpandedCategories(new Set([foundAlt.categories[0]?.id || ""]));
        }
      }
    }
    if (dateParam) {
      setPlanDate(dateParam);
    }
  }, [templateIdParam, dateParam]);

  // 3. 處理選擇新模板
  const handleSelectTemplate = (template: ShoppingTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTemplate(template);
    setExpandedCategories(new Set([template.categories[0]?.id]));
    setSelectedItems(new Set()); // 預設全部不勾選，由用戶自選！
    setQuantityOverrides({});
    setCustomItems([]);
  };

  // 4. 人數加減 Stepper (1-20 人)
  const handleIncrementPeople = () => {
    if (peopleCount < 20) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPeopleCount(prev => prev + 1);
    }
  };

  const handleDecrementPeople = () => {
    if (peopleCount > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPeopleCount(prev => prev - 1);
    }
  };

  // 5. 分類展開與折疊
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // 6. 食材剔選
  const toggleItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // 7. 分類全選 / 全消
  const toggleCategorySelection = (category: TemplateCategory, selectAll: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItems(prev => {
      const next = new Set(prev);
      category.items.forEach(item => {
        if (selectAll) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  // 9. 自訂項目添加
  const handleAddCustomItem = (categoryId: string) => {
    if (!customInputName.trim()) {
      Alert.alert("請輸入項目名稱");
      return;
    }
    const qty = parseFloat(customInputQty) || 1;
    const price = parseFloat(customInputPrice) || 0;
    const newItem: CustomItem = {
      id: `custom_${Date.now()}`,
      name: customInputName.trim(),
      quantity: qty,
      unit: customInputUnit.trim(),
      category: categoryId,
      price: price > 0 ? price : undefined,
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCustomItems(prev => [...prev, newItem]);
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.add(newItem.id);
      return next;
    });
    setCustomInputName("");
    setCustomInputQty("1");
    setCustomInputPrice("");
    setIngredientSuggestions([]);
    setShowSuggestions(false);
    setActiveInputCategory(null);
  };

  // 從模板提取所有食材名稱
  const getAllIngredientNames = () => {
    const names = new Set<string>();
    SHOPPING_TEMPLATES.forEach(template => {
      template.categories.forEach(cat => {
        cat.items.forEach(item => {
          names.add(item.name);
        });
      });
    });
    return Array.from(names);
  };

  // 過濾建議
  const filterSuggestions = (input: string) => {
    if (!input.trim()) {
      setIngredientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const allNames = getAllIngredientNames();
    const filtered = allNames
      .filter(name => name.includes(input))  // 直接包含匹配（支援中文）
      .slice(0, 10);  // 增加建議數量到 10 個
    setIngredientSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  // 選擇建議
  const handleSelectSuggestion = (name: string) => {
    setCustomInputName(name);
    setShowSuggestions(false);
    setIngredientSuggestions([]);
  };

  // 刪除自訂項目
  const handleDeleteCustomItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomItems(prev => prev.filter(i => i.id !== itemId));
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  // 10. 計算總項目數量同預計總開支
  const { totalSelectedCount, totalEstimatedPrice } = useMemo(() => {
    if (!selectedTemplate) return { totalSelectedCount: 0, totalEstimatedPrice: 0 };
    let count = 0;
    let totalPrice = 0;
    
    selectedTemplate.categories.forEach(category => {
      category.items.forEach(item => {
        if (selectedItems.has(item.id)) {
          count++;
          // 優先使用用戶輸入嘅價錢，如果無就用預設估算
          const userPrice = quantityOverrides[item.id + "_price"];
          if (userPrice !== undefined) {
            totalPrice += userPrice;
          } else if (item.estimatedPricePerUnit) {
            const qty = calculateQuantityByPeople(quantityOverrides[item.id] || item.baseQuantity, peopleCount);
            totalPrice += qty * item.estimatedPricePerUnit;
          }
        }
      });
    });
    
    customItems.forEach(item => {
      if (selectedItems.has(item.id)) {
        count++;
        if (item.price) {
          totalPrice += item.price;
        }
      }
    });
    
    return { totalSelectedCount: count, totalEstimatedPrice: Math.round(totalPrice) };
  }, [selectedTemplate, selectedItems, customItems, peopleCount, quantityOverrides]);

  // 11. 確定加入購物車
  const handleConfirmAddToCart = () => {
    if (!selectedTemplate) return;
    if (totalSelectedCount === 0) {
      Alert.alert("未選取任何食材", "請至少勾選一項食材");
      return;
    }

    Alert.alert(
      "加入購物車",
      `確定將 ${totalSelectedCount} 項食材加入購物清單嗎？\n預定聚餐日子：${planDateLabel}`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "確定",
          onPress: () => {
            // A. 模板預設食材
            const templateSelectedIds = Array.from(selectedItems).filter(id => !id.startsWith("custom_"));
            const items = templateToShoppingItems(selectedTemplate, peopleCount, templateSelectedIds, quantityOverrides);
            
            // B. 自訂項目合併
            const customSelected = customItems.filter(i => selectedItems.has(i.id));
            const formattedCustom = customSelected.map(i => ({
              name: i.name,
              quantity: i.quantity.toString(),
              unit: i.unit,
              category: i.category === "soup-base" ? "湯底" : i.category === "meat" ? "肉類" : i.category === "seafood" ? "海鮮" : i.category === "vegetable" ? "蔬菜" : i.category === "staple" ? "主食" : i.category === "sauce" ? "調味料" : i.category === "tools" ? "工具" : i.category === "other" ? "其他" : "其他",
            }));

            const finalBatch = [...items, ...formattedCustom];

            addShoppingBatchM.mutate({
              items: finalBatch,
              fromRecipeName: `${selectedTemplate.name}（${peopleCount}人份）`,
              plannedDate: planDate === null ? undefined : planDate,
            });
          },
        },
      ]
    );
  };

  // 12. AA制分攤計數
  const handleAASplit = () => {
    const total = parseFloat(actualSpent);
    if (isNaN(total) || total <= 0) {
      Alert.alert("輸入錯誤", "請輸入正確的消費總金額");
      return;
    }
    const perPerson = (total / peopleCount).toFixed(1);
    const templateName = selectedTemplate?.name || "打邊爐/BBQ";
    
    const message = `📣 【和諧食譜】${templateName}開支分攤：\n📅 日期: ${planDateLabel}\n👥 聚會人數: ${peopleCount} 人\n💰 實際總開支: $${total}\n💸 每人分攤: $${perPerson}\n\n唔該晒大家！記得 PayMe / 轉數快比我啦！😘`;
    
    Alert.alert(
      "AA制分攤計算結果",
      `💰 總金額: $${total}\n👥 人數: ${peopleCount}人\n💸 每人應付: $${perPerson}\n\n已為你自動生成 WhatsApp 分攤訊息！`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "複製分攤訊息",
          onPress: async () => {
            await Clipboard.setStringAsync(message);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("已複製到剪貼簿", "可以去 WhatsApp 貼上俾隊友啦！");
            setShowAASplitModal(false);
            setActualSpent("");
          }
        }
      ]
    );
  };

  // 13. 多語言委派分享複製
  const handleCopyBilingualList = async () => {
    if (!selectedTemplate) return;
    const lang = shareLanguage;
    const titleMap = {
      zh: `📋 【和諧食譜】買餸委派便條`,
      en: `📋 【Kindcipe】Shopping List (English)`,
      id: `📋 【Kindcipe】Daftar Belanja (Indonesian)`,
      ph: `📋 【Kindcipe】Listahan ng Pamimili (Tagalog)`
    };

    let text = `${titleMap[lang]}\n📅 日期: ${planDateLabel}\n👥 人數: ${peopleCount}人份\n\n`;

    // 輪詢各分類
    selectedTemplate.categories.forEach(category => {
      const catSelected = category.items.filter(i => selectedItems.has(i.id));
      const catCustomSelected = customItems.filter(i => i.category === category.id && selectedItems.has(i.id));
      
      if (catSelected.length > 0 || catCustomSelected.length > 0) {
        const catTitle = lang === "zh" ? category.name 
                         : lang === "id" ? (category.nameId || category.nameEn)
                         : lang === "ph" ? (category.namePh || category.nameEn)
                         : category.nameEn;
        
        text += `■ ${catTitle}:\n`;

        // A. 預設食材
        catSelected.forEach(item => {
          const qty = calculateQuantityByPeople(quantityOverrides[item.id] || item.baseQuantity, peopleCount);
          const itemName = lang === "zh" ? item.name
                           : lang === "id" ? `${item.name} (${item.nameId || item.nameEn})`
                           : lang === "ph" ? `${item.name} (${item.namePh || item.nameEn})`
                           : `${item.name} (${item.nameEn})`;
          const itemUnit = lang === "zh" ? item.unit
                           : lang === "id" ? (item.unitId || item.unitEn)
                           : lang === "ph" ? (item.unitPh || item.unitEn)
                           : item.unitEn;
          
          text += `  [ ] ${itemName} - ${qty} ${itemUnit}\n`;
        });

        // B. 自訂食材
        catCustomSelected.forEach(item => {
          text += `  [ ] ${item.name} - ${item.quantity} ${item.unit}\n`;
        });
        text += `\n`;
      }
    });

    // 檢查「其他」分類
    const otherCustom = customItems.filter(i => i.category === "other" && selectedItems.has(i.id));
    if (otherCustom.length > 0) {
      const otherTitle = lang === "zh" ? "其他" : lang === "id" ? "Lainnya" : lang === "ph" ? "Iba pa" : "Others";
      text += `■ ${otherTitle}:\n`;
      otherCustom.forEach(item => {
        text += `  [ ] ${item.name} - ${item.quantity} ${item.unit}\n`;
      });
    }

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("複製成功", "已生成雙語買餸清單，快去貼上俾姐姐或幫手啦！");
    setShowShareModal(false);
  };

  // 14. WhatsApp 一鍵發送
  const handleShareToWhatsApp = async () => {
    if (!selectedTemplate) return;
    const lang = shareLanguage;
    const titleMap = {
      zh: `📋 【和諧食譜】買餸委派便條`,
      en: `📋 【Kindcipe】Shopping List`,
      id: `📋 【Kindcipe】Daftar Belanja`,
      ph: `📋 【Kindcipe】Listahan ng Pamimili`
    };

    let text = `${titleMap[lang]}\n📅 日期：${planDateLabel}\n👥 人數：${peopleCount}人份\n\n`;

    // 生成清單內容
    selectedTemplate.categories.forEach(category => {
      const catSelected = category.items.filter(i => selectedItems.has(i.id));
      const catCustomSelected = customItems.filter(i => i.category === category.id && selectedItems.has(i.id));
      
      if (catSelected.length > 0 || catCustomSelected.length > 0) {
        const catTitle = lang === "zh" ? category.name 
                         : lang === "id" ? (category.nameId || category.nameEn)
                         : lang === "ph" ? (category.namePh || category.nameEn)
                         : category.nameEn;
        
        text += `■ ${catTitle}:\n`;

        catSelected.forEach(item => {
          const qty = calculateQuantityByPeople(quantityOverrides[item.id] || item.baseQuantity, peopleCount);
          const itemName = lang === "zh" ? item.name
                           : lang === "id" ? `${item.name} (${item.nameId || item.nameEn})`
                           : lang === "ph" ? `${item.name} (${item.namePh || item.nameEn})`
                           : `${item.name} (${item.nameEn})`;
          const itemUnit = lang === "zh" ? item.unit
                           : lang === "id" ? (item.unitId || item.unitEn)
                           : lang === "ph" ? (item.unitPh || item.unitEn)
                           : item.unitEn;
          
          text += `  [ ] ${itemName} - ${qty} ${itemUnit}\n`;
        });

        catCustomSelected.forEach(item => {
          text += `  [ ] ${item.name} - ${item.quantity} ${item.unit}\n`;
        });
        text += `\n`;
      }
    });

    const otherCustom = customItems.filter(i => i.category === "other" && selectedItems.has(i.id));
    if (otherCustom.length > 0) {
      const otherTitle = lang === "zh" ? "其他" : lang === "id" ? "Lainnya" : lang === "ph" ? "Iba pa" : "Others";
      text += `■ ${otherTitle}:\n`;
      otherCustom.forEach(item => {
        text += `  [ ] ${item.name} - ${item.quantity} ${item.unit}\n`;
      });
    }

    // 嘗試打開 WhatsApp
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const supported = await Linking.canOpenURL(whatsappUrl);
    
    if (supported) {
      await Linking.openURL(whatsappUrl);
      setShowShareModal(false);
    } else {
      // Fallback: 如果無裝 WhatsApp，複製到剪貼簿
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "未安裝 WhatsApp",
        "已複製清單到剪貼簿，可以手動貼上到 WhatsApp 或其他 App",
        [{ text: "確定" }]
      );
    }
  };

  // 15. 輸入預計價錢
  const handleSetPrice = (itemId: string, itemName: string, currentPrice?: number) => {
    setPriceItem({ id: itemId, name: itemName, price: currentPrice ? String(currentPrice) : "" });
    setShowPriceModal(true);
  };

  const handleSavePrice = () => {
    if (!priceItem) return;
    const price = parseFloat(priceItem.price) || 0;
    // 更新預計價錢
    setQuantityOverrides(prev => ({
      ...prev,
      [priceItem.id + "_price"]: price
    }));
    setShowPriceModal(false);
    setPriceItem(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // 15. 返回上一頁：模板詳情 -> 返回「聚會買餸單」列表；列表 -> 返回上一頁。
  // 若有編輯過則先確認離開/留下，並提醒儲存清單。
  const handleBackPress = () => {
    Keyboard.dismiss();
    const hasEdits =
      selectedItems.size > 0 ||
      customItems.length > 0 ||
      Object.keys(quantityOverrides).length > 0 ||
      Object.keys(unitOverrides).length > 0;

    const goBack = () => {
      if (selectedTemplate) {
        // 返回到同一 screen 內嘅「聚會買餸單」列表，唔好跳返去「更多」頁
        setSelectedTemplate(null);
        setSelectedItems(new Set());
        setQuantityOverrides({});
        setUnitOverrides({});
        setCustomItems([]);
        setExpandedCategories(new Set());
      } else {
        router.back();
      }
    };

    if (hasEdits) {
      Alert.alert(
        "確定離開？",
        "你已揀選或修改咗買餸項目，離開後將不會保存。\n\n建議先「儲存清單」，下次可以直接載入重用！",
        [
          { text: "繼續編輯", style: "cancel" },
          { text: "儲存清單", onPress: () => setShowSaveListModal(true) },
          { text: "離開", style: "destructive", onPress: goBack },
        ]
      );
    } else {
      goBack();
    }
  };

  const renderBackButton = () => (
    <TouchableOpacity onPress={handleBackPress} style={{ marginLeft: 4 }}>
      <Ionicons name="chevron-back" size={24} color={TEXT} />
    </TouchableOpacity>
  );

  // 15. 渲染模板卡片（首頁）
  if (!selectedTemplate) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "聚會買餸單",
            headerShown: true,
            headerBackTitle: "",
            headerStyle: { backgroundColor: BG },
            headerTintColor: BRAND,
            headerTitleStyle: { fontWeight: "800", color: TEXT },
            headerLeft: renderBackButton,
          }}
        />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ padding: 16, backgroundColor: BRAND, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="basket-outline" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>聚會買餸單</Text>
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>一鍵買齊大時大節聚餐食材</Text>
                </View>
              </View>
            </View>
            
            {/* 已儲存清單區域 */}
            {savedLists.length > 0 && (
              <View style={{ padding: 16, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT }}>💾 已儲存清單</Text>
                  <Text style={{ fontSize: 12, color: SUB }}>{savedLists.length} 個清單</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {savedLists.slice(0, 3).map(list => (
                    <TouchableOpacity
                      key={list.id}
                      style={{
                        backgroundColor: CARD,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: BORDER,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onPress={() => {
                        Alert.alert(
                          "載入清單",
                          `載入「${list.name}」會覆蓋當前選擇，確定嗎？`,
                          [
                            { text: "取消", style: "cancel" },
                            {
                              text: "載入",
                              onPress: () => loadSavedList(list)
                            }
                          ]
                        );
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="list-outline" size={18} color={BRAND} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{list.name}</Text>
                          <Text style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{list.items.length} 項食材 · {list.people}人</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={{ padding: 6 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          deleteSavedList(list.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {savedLists.length > 3 && (
                    <TouchableOpacity
                      style={{
                        padding: 12,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: BORDER,
                        borderRadius: 12,
                        borderStyle: "dashed",
                      }}
                      onPress={() => {
                        Alert.alert(
                          "查看所有清單",
                          `你共有 ${savedLists.length} 個已儲存清單`,
                          [
                            { text: "確定", style: "cancel" }
                          ]
                        );
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: BRAND }}>
                        查看多 {savedLists.length - 3} 個清單 →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            
            {/* Template Cards */}
            <View style={{ padding: 16, gap: 12 }}>
              {SHOPPING_TEMPLATES.map((template, _idx) => (
                <TouchableOpacity
                  key={template.id}
                  style={{
                    backgroundColor: CARD,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1.5,
                    borderColor: BORDER,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={() => handleSelectTemplate(template)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: template.id === "template_hotpot" ? "#FEE2E2" : template.id === "template_bbq" ? "#FFF7ED" : "#FEF3C7",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Ionicons
                        name={template.id === "template_hotpot" ? "flame-outline" : template.id === "template_bbq" ? "restaurant-outline" : "rose-outline"}
                        size={28}
                        color={template.id === "template_hotpot" ? "#EF4444" : template.id === "template_bbq" ? "#FF8C00" : "#F59E0B"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT }}>{template.name}</Text>
                      <Text style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{template.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={SUB} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Tips */}
            <View style={{ padding: 16, marginTop: 8 }}>
              <View style={{ backgroundColor: "#EEF4FB", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#C5D9F0" }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Ionicons name="information-circle-outline" size={20} color={BRAND} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 13, color: BRAND, lineHeight: 18 }}>
                    選擇模板後，你可以微調人數、購買日子並自由挑選食材。食材可一鍵加入家庭共享購物車，更支援自動 AA 制計數同中英印菲多語言清單分享！儲存咗嘅清單可以隨時重用。
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  // 16. 詳情頁面
  return (
    <>
      <Stack.Screen
        options={{
          title: selectedTemplate.name,
          headerShown: true,
          headerBackTitle: "",
          headerStyle: { backgroundColor: BG },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "800", color: TEXT },
          headerLeft: renderBackButton,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 }}>
              {/* 儲存清單掣 */}
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: "#DCFCE7", borderRadius: 10 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSaveListModal(true);
                }}
                disabled={!selectedTemplate || totalSelectedCount === 0}
              >
                <Ionicons 
                  name="save-outline" 
                  size={18} 
                  color={selectedTemplate && totalSelectedCount > 0 ? "#16A34A" : SUB} 
                />
              </TouchableOpacity>
              {/* AA 制掣 */}
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: "#E8F0FE", borderRadius: 10 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAASplitModal(true);
                }}
              >
                <Ionicons name="calculator" size={18} color={BRAND} />
              </TouchableOpacity>
              {/* 委派分享掣 */}
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: "#FFF7ED", borderRadius: 10 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowShareModal(true);
                }}
              >
                <Ionicons name="share-social-outline" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>
          )
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: BG }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 400 }}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* A. 頂部控制區：人數與日子 */}
          <View style={s.topControlCard}>
            
            {/* 1. 人數 Stepper */}
            <View style={s.controlRow}>
              <View>
                <Text style={s.controlLabel}>👨‍👩‍👧‍👦 聚會人數</Text>
                <Text style={s.controlSub}>份量會根據人數精準比例更新</Text>
              </View>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepperBtn} onPress={handleDecrementPeople} disabled={peopleCount <= 1}>
                  <Ionicons name="remove" size={18} color={peopleCount <= 1 ? SUB : BRAND} />
                </TouchableOpacity>
                <Text style={s.stepperVal}>{peopleCount} 人</Text>
                <TouchableOpacity style={s.stepperBtn} onPress={handleIncrementPeople} disabled={peopleCount >= 20}>
                  <Ionicons name="add" size={18} color={peopleCount >= 20 ? SUB : BRAND} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 分割線 */}
            <View style={s.divider} />

            {/* 2. 原生日子選擇器 */}
            <View style={{ marginTop: 12 }}>
              <Text style={[s.controlLabel, { marginBottom: 8 }]}>📅 聚餐/購買日期</Text>
              <PlanDatePicker value={planDate} onChange={setPlanDate} showShortcuts={true} minDate={DateUtil.todayISO()} />
              {planDate && (
                <TouchableOpacity 
                  onPress={() => setPlanDate(null)} 
                  style={{ alignSelf: "flex-end", marginTop: -8 }}
                >
                  <Text style={{ fontSize: 13, color: BRAND, fontWeight: "600" }}>清除日期</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>

          {/* B. 食材清單區：各分類卡片 */}
          <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 16 }}>
            {selectedTemplate.categories.map(category => {
              const isExpanded = expandedCategories.has(category.id);
              const totalItemsCount = category.items.length;
              const selectedItemsCount = category.items.filter(item => selectedItems.has(item.id)).length;
              const categoryCustomItems = customItems.filter(i => i.category === category.id);
              const customSelectedCount = categoryCustomItems.filter(i => selectedItems.has(i.id)).length;
              const isAllSelected = selectedItemsCount === totalItemsCount && (categoryCustomItems.length === 0 || customSelectedCount === categoryCustomItems.length);

              return (
                <View key={category.id} style={s.categoryCard}>
                  
                  {/* Category Header */}
                  <TouchableOpacity
                    style={[s.categoryHeader, isExpanded && { backgroundColor: "#FAFBFD", borderBottomWidth: 1, borderBottomColor: BORDER }]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <View style={s.categoryIconContainer}>
                      <Ionicons name={category.icon as any} size={20} color={BRAND} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.categoryName}>{category.name}</Text>
                      <Text style={s.categoryProgress}>已選 {selectedItemsCount + customSelectedCount} / {totalItemsCount + categoryCustomItems.length} 項</Text>
                    </View>
                    
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <TouchableOpacity
                        style={s.selectAllBtn}
                        onPress={() => toggleCategorySelection(category, !isAllSelected)}
                      >
                        <Text style={s.selectAllBtnText}>{isAllSelected ? "全消" : "全選"}</Text>
                      </TouchableOpacity>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={SUB} />
                    </View>
                  </TouchableOpacity>

                  {/* Category Items */}
                  {isExpanded && (
                    <View style={{ backgroundColor: "#FCFCFC" }}>
                      
                      {/* 1. 預設食材列表 */}
                      {category.items.map(item => {
                        const isSelected = selectedItems.has(item.id);
                        // 湯底特殊邏輯：8 人或以上預設 2 鍋
                        let defaultBaseQty = item.baseQuantity;
                        if (category.id === "soup-base" && peopleCount >= 8) {
                          defaultBaseQty = 2;
                        }
                        const baseQty = quantityOverrides[item.id] !== undefined ? quantityOverrides[item.id] : defaultBaseQty;
                        const qty = calculateQuantityByPeople(baseQty, peopleCount);
                        const estimatedPrice = quantityOverrides[item.id + "_price"];

                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[s.itemRow, isSelected && { backgroundColor: "#FFFBEB" }]}
                            onPress={() => toggleItem(item.id)}
                            activeOpacity={0.7}
                          >
                            {/* Checkbox */}
                            <TouchableOpacity
                              style={s.checkbox}
                              onPress={() => toggleItem(item.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <View style={[s.checkboxBox, isSelected && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                              </View>
                            </TouchableOpacity>

                            {/* Item Info */}
                            <View style={{ flex: 1 }}>
                              <Text style={[s.itemName, isSelected && { fontWeight: "700" }]}>
                                {item.name}
                                {item.isOptional && <Text style={{ fontSize: 10, color: SUB, fontWeight: "400" }}> (可選)</Text>}
                              </Text>
                            </View>

                            {/* Quantity & Price */}
                            {isSelected ? (
                              <View style={s.itemActionsRight}>
                                <View style={s.quantityRow}>
                                  <TextInput
                                    style={s.quantityInput}
                                    value={String(qty)}
                                    keyboardType="number-pad"
                                    onChangeText={(text) => {
                                      const newQty = parseFloat(text) || 0;
                                      const ratio = peopleCount / 2;
                                      const newBase = newQty / ratio;
                                      setQuantityOverrides(prev => ({
                                        ...prev,
                                        [item.id]: newBase
                                      }));
                                    }}
                                    textAlign="right"
                                    editable
                                    placeholder="0"
                                    placeholderTextColor="#D1D5DB"
                                  />
                                  <UnitPicker
                                    value={unitOverrides[item.id] || item.unit}
                                    onChange={(newUnit) => {
                                      setUnitOverrides(prev => ({
                                        ...prev,
                                        [item.id]: newUnit
                                      }));
                                    }}
                                    quantity={qty}
                                    onQuantityChange={(newQty) => {
                                      const ratio = peopleCount / 2;
                                      const newBase = newQty / ratio;
                                      setQuantityOverrides(prev => ({
                                        ...prev,
                                        [item.id]: newBase
                                      }));
                                    }}
                                    style={s.quantityUnitPicker}
                                  />
                                </View>
                                <TouchableOpacity
                                  style={s.priceBtn}
                                  onPress={() => handleSetPrice(item.id, item.name, estimatedPrice)}
                                >
                                  <Ionicons name="pricetag-outline" size={14} color={BRAND} />
                                  <Text style={s.priceBtnText}>
                                    {estimatedPrice ? `$${estimatedPrice}` : "價錢"}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={s.quantityRow}>
                                <Text style={s.quantityDisplay}>{qty} </Text>
                                <Text style={[s.quantityDisplay, { color: BRAND }]}>{unitOverrides[item.id] || item.unit}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {/* 2. 自訂食材列表 */}
                      {categoryCustomItems.map(item => {
                        const isSelected = selectedItems.has(item.id);
                        return (
                          <View key={item.id} style={[s.itemRow, isSelected && { backgroundColor: "#FFFBEB" }]}>
                            {/* Checkbox */}
                            <TouchableOpacity style={s.checkbox} onPress={() => toggleItem(item.id)}>
                              <View style={[s.checkboxBox, isSelected && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                              </View>
                            </TouchableOpacity>

                            {/* Item Info */}
                            <View style={{ flex: 1 }}>
                              <Text style={[s.itemName, isSelected && { fontWeight: "700" }]}>{item.name}</Text>
                              <Text style={s.itemQty}>
                                {item.quantity} {item.unit}
                                {item.price ? ` · $${item.price}` : ''}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={{ padding: 4, marginRight: 4 }}
                              onPress={() => handleDeleteCustomItem(item.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}

                      {/* 3. 內嵌式「新增自訂項目」 */}
                      {activeInputCategory === category.id ? (
                        <View style={{ position: "relative" }}>
                          <View style={s.inlineInputRow}>
                            <TextInput
                              style={[s.input, { flex: 2 }]}
                              placeholder="食材名稱"
                              placeholderTextColor="#999"
                              value={customInputName}
                              onChangeText={(text) => {
                                setCustomInputName(text);
                                filterSuggestions(text);
                              }}
                              onFocus={() => {
                                if (customInputName.trim()) {
                                  filterSuggestions(customInputName);
                                }
                              }}
                              autoFocus
                            />
                          <TextInput
                            style={[s.input, { flex: 0.8, textAlign: "center" }]}
                            placeholder="數量"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={customInputQty}
                            onChangeText={setCustomInputQty}
                          />
                          <UnitPicker
                            value={customInputUnit}
                            onChange={setCustomInputUnit}
                            style={[s.unitPicker, { flex: 0.6 }]}
                          />
                          <TextInput
                            style={[s.input, { flex: 0.8, textAlign: "center" }]}
                            placeholder="$"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={customInputPrice}
                            onChangeText={setCustomInputPrice}
                          />
                          <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleAddCustomItem(category.id)}>
                            <Ionicons name="checkmark-circle" size={24} color={BRAND} />
                          </TouchableOpacity>
                          <TouchableOpacity style={s.inlineCancelBtn} onPress={() => setActiveInputCategory(null)}>
                            <Ionicons name="close-circle" size={24} color={SUB} />
                          </TouchableOpacity>
                        </View>
                        {/* 建議列表 */}
                        {showSuggestions && ingredientSuggestions.length > 0 && (
                          <View style={s.suggestionsBox}>
                            {ingredientSuggestions.map(name => (
                              <TouchableOpacity
                                key={name}
                                style={s.suggestionItem}
                                onPress={() => handleSelectSuggestion(name)}
                              >
                                <Text style={s.suggestionText}>{name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                        <TouchableOpacity
                          style={s.addCustomRowBtn}
                          onPress={() => {
                            setCustomInputUnit("包");
                            setActiveInputCategory(category.id);
                          }}
                        >
                          <Ionicons name="add" size={14} color={BRAND} />
                          <Text style={s.addCustomRowText}>新增{category.name}自訂食材...</Text>
                        </TouchableOpacity>
                      )}

                    </View>
                  )}
                </View>
              );
            })}

            {/* C. 專門「其他」自訂分類 */}
            <View style={s.categoryCard}>
              <TouchableOpacity
                style={[s.categoryHeader, expandedCategories.has("other") && { backgroundColor: "#FAFBFD", borderBottomWidth: 1, borderBottomColor: BORDER }]}
                onPress={() => toggleCategory("other")}
              >
                <View style={s.categoryIconContainer}>
                  <Ionicons name="ellipsis-horizontal-outline" size={20} color={BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.categoryName}>其他</Text>
                  <Text style={s.categoryProgress}>自訂雜項（飲料、炭、紙巾等）</Text>
                </View>
                <Ionicons name={expandedCategories.has("other") ? "chevron-up" : "chevron-down"} size={16} color={SUB} />
              </TouchableOpacity>

              {expandedCategories.has("other") && (
                <View style={{ backgroundColor: "#FCFCFC" }}>
                  {customItems.filter(i => i.category === "other").map(item => {
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <View key={item.id} style={[s.itemRow, isSelected && { backgroundColor: "#FFFBEB" }]}>
                        <TouchableOpacity style={s.checkbox} onPress={() => toggleItem(item.id)}>
                          <View style={[s.checkboxBox, isSelected && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.itemName, isSelected && { fontWeight: "700" }]}>{item.name}</Text>
                          <Text style={s.itemQty}>
                            {item.quantity} {item.unit}
                            {item.price ? ` · $${item.price}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity style={{ padding: 4, marginRight: 4 }} onPress={() => handleDeleteCustomItem(item.id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {activeInputCategory === "other" ? (
                    <View style={{ position: "relative" }}>
                      <View style={s.inlineInputRow}>
                        <TextInput
                          style={[s.input, { flex: 2 }]}
                          placeholder="自訂雜項/飲料..."
                          placeholderTextColor="#999"
                          value={customInputName}
                          onChangeText={(text) => {
                            setCustomInputName(text);
                            filterSuggestions(text);
                          }}
                          onFocus={() => {
                            if (customInputName.trim()) {
                              filterSuggestions(customInputName);
                            }
                          }}
                          autoFocus
                        />
                      <TextInput
                        style={[s.input, { flex: 0.8, textAlign: "center" }]}
                        placeholder="數量"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={customInputQty}
                        onChangeText={setCustomInputQty}
                      />
                      <UnitPicker
                        value={customInputUnit}
                        onChange={setCustomInputUnit}
                        style={[s.unitPicker, { flex: 0.6 }]}
                      />
                      <TextInput
                        style={[s.input, { flex: 0.8, textAlign: "center" }]}
                        placeholder="$"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={customInputPrice}
                        onChangeText={setCustomInputPrice}
                      />
                      <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleAddCustomItem("other")}>
                        <Ionicons name="checkmark-circle" size={24} color={BRAND} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.inlineCancelBtn} onPress={() => setActiveInputCategory(null)}>
                        <Ionicons name="close-circle" size={24} color={SUB} />
                      </TouchableOpacity>
                    </View>
                    {/* 建議列表 */}
                    {showSuggestions && ingredientSuggestions.length > 0 && (
                      <View style={s.suggestionsBox}>
                        {ingredientSuggestions.map(name => (
                          <TouchableOpacity
                            key={name}
                            style={s.suggestionItem}
                            onPress={() => handleSelectSuggestion(name)}
                          >
                            <Text style={s.suggestionText}>{name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                    <TouchableOpacity
                      style={s.addCustomRowBtn}
                      onPress={() => {
                        setCustomInputUnit("件");
                        setActiveInputCategory("other");
                      }}
                    >
                      <Ionicons name="add" size={14} color={BRAND} />
                      <Text style={s.addCustomRowText}>新增其他雜物 (如飲料、炭、紙巾)...</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

          </View>
        </ScrollView>

        {/* D. 底部懸浮結算列 */}
        <View style={[s.floatingBar, { bottom: Platform.OS === "ios" ? 0 : keyboardH, paddingBottom: keyboardH > 0 ? 12 : Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.floatingSelectedCount}>已選 {totalSelectedCount} 項食材</Text>
            <Text style={s.floatingSubtitle}>適合 {peopleCount} 人份量 · {planDateLabel}</Text>
            {totalEstimatedPrice > 0 && (
              <Text style={s.floatingBudget}>💰 預計總開支：${totalEstimatedPrice}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[s.floatingCartBtn, addShoppingBatchM.isPending && { backgroundColor: SUB }]}
            onPress={handleConfirmAddToCart}
            disabled={addShoppingBatchM.isPending}
          >
            {addShoppingBatchM.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={s.floatingCartBtnText}>加入購物車</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── AA 制 Modal ─── */}
        <Modal visible={showAASplitModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
          <View style={s.modalOverlay}>
            <View style={s.modalContainer}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>💸 實際購買 AA 制計數機</Text>
                <TouchableOpacity onPress={() => setShowAASplitModal(false)}>
                  <Ionicons name="close" size={20} color={TEXT} />
                </TouchableOpacity>
              </View>
              
              <View style={{ padding: 20 }}>
                <Text style={s.modalInputLabel}>輸入本次買餸實際總開支 ($)：</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="例如：680"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={actualSpent}
                  onChangeText={setActualSpent}
                  autoFocus
                />
                
                <View style={s.modalStatsBox}>
                  <Text style={s.modalStatsText}>👥 分攤人數：{peopleCount} 人</Text>
                  {parseFloat(actualSpent) > 0 ? (
                    <Text style={s.modalStatsResult}>💸 每人分攤：${(parseFloat(actualSpent) / peopleCount).toFixed(1)} / 人</Text>
                  ) : null}
                </View>

                <TouchableOpacity style={s.modalActionBtn} onPress={handleAASplit}>
                  <Text style={s.modalActionBtnText}>計算並生成 WhatsApp 訊息</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ─── 委派/分享 Modal ─── */}
        <Modal visible={showShareModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalContainer}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>📲 委派幫手/姐姐買餸</Text>
                <TouchableOpacity onPress={() => setShowShareModal(false)}>
                  <Ionicons name="close" size={20} color={TEXT} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                <Text style={s.modalInputLabel}>選擇委派語言：</Text>
                
                <View style={s.languageGrid}>
                  <TouchableOpacity
                    style={[s.langBtn, shareLanguage === "zh" && s.langBtnActive]}
                    onPress={() => setShareLanguage("zh")}
                  >
                    <Text style={[s.langBtnText, shareLanguage === "zh" && s.langBtnTextActive]}>🇭🇰 繁中 (家人)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.langBtn, shareLanguage === "en" && s.langBtnActive]}
                    onPress={() => setShareLanguage("en")}
                  >
                    <Text style={[s.langBtnText, shareLanguage === "en" && s.langBtnTextActive]}>🇬🇧 中英雙語 (通用)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.langBtn, shareLanguage === "id" && s.langBtnActive]}
                    onPress={() => setShareLanguage("id")}
                  >
                    <Text style={[s.langBtnText, shareLanguage === "id" && s.langBtnTextActive]}>🇮🇩 中印雙語 (印尼)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.langBtn, shareLanguage === "ph" && s.langBtnActive]}
                    onPress={() => setShareLanguage("ph")}
                  >
                    <Text style={[s.langBtnText, shareLanguage === "ph" && s.langBtnTextActive]}>🇵🇭 中菲雙語 (菲律賓)</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.qrPlaceholderBox}>
                  <Ionicons name="qr-code-outline" size={80} color={BRAND} />
                  <Text style={{ fontSize: 11, color: SUB, marginTop: 8, textAlign: "center" }}>
                    已開啟家庭自動同步。若幫手無安裝 App，亦可一鍵複製雙語清單至 WhatsApp。
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[s.modalActionBtn, { flex: 1, backgroundColor: BRAND }]}
                    onPress={handleCopyBilingualList}
                  >
                    <Ionicons name="copy-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={s.modalActionBtnText}>複製清單</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalActionBtn, { flex: 1, backgroundColor: "#25D366" }]}
                    onPress={handleShareToWhatsApp}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={s.modalActionBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── 價錢輸入 Modal ─── */}
        <Modal visible={showPriceModal} transparent animationType="slide">
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={s.modalOverlay}>
              <ScrollView 
                contentContainerStyle={{ flex: 1, justifyContent: "flex-end" }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={s.modalContainer}>
                  <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>💰 輸入預計價錢</Text>
                    <TouchableOpacity onPress={() => { setShowPriceModal(false); setPriceItem(null); }}>
                      <Ionicons name="close" size={20} color={TEXT} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ padding: 20 }}>
                    <Text style={s.modalInputLabel}>食材：{priceItem?.name}</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="例如：50"
                      placeholderTextColor="#999"
                      keyboardType="number-pad"
                      value={priceItem?.price}
                      onChangeText={(text) => setPriceItem(prev => prev ? { ...prev, price: text } : null)}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        setShowPriceModal(false);
                        handleSavePrice();
                      }}
                    />
                    
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { flex: 1, backgroundColor: "#F3F4F6" }]}
                        onPress={() => { setShowPriceModal(false); setPriceItem(null); }}
                      >
                        <Text style={[s.modalActionBtnText, { color: SUB }]}>取消</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { flex: 1, backgroundColor: BRAND }]}
                        onPress={handleSavePrice}
                      >
                        <Text style={s.modalActionBtnText}>保存</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
        {/* ─── 儲存清單 Modal ─── */}
        <Modal visible={showSaveListModal} transparent animationType="slide">
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView 
              contentContainerStyle={{ flex: 1, justifyContent: "flex-end" }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.modalOverlay}>
                <View style={s.modalContainer}>
                  <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>💾 儲存常用清單</Text>
                    <TouchableOpacity onPress={() => setShowSaveListModal(false)}>
                      <Ionicons name="close" size={20} color={TEXT} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ padding: 20 }}>
                    <Text style={s.modalInputLabel}>清單名稱：</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="例如：打邊爐常用清單、BBQ 聚會..."
                      placeholderTextColor="#999"
                      value={savedListName}
                      onChangeText={setSavedListName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={saveCurrentList}
                    />
                    
                    {savedLists.length > 0 && (
                      <>
                        <Text style={[s.modalInputLabel, { marginTop: 16 }]}>已儲存清單（點擊載入）：</Text>
                        <ScrollView style={{ maxHeight: 200 }}>
                          {savedLists.map(list => (
                            <TouchableOpacity
                              key={list.id}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: 14,
                                backgroundColor: CARD,
                                borderRadius: 10,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: BORDER,
                              }}
                              onPress={() => {
                                Alert.alert(
                                  "載入清單",
                                  `載入「${list.name}」會覆蓋當前選擇，確定嗎？`,
                                  [
                                    { text: "取消", style: "cancel" },
                                    {
                                      text: "載入",
                                      onPress: () => loadSavedList(list)
                                    }
                                  ]
                                );
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" }}>
                                  <Ionicons name="list-outline" size={16} color={BRAND} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>{list.name}</Text>
                                  <Text style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{list.items.length} 項食材 · {list.people}人</Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                style={{ padding: 6 }}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  deleteSavedList(list.id);
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}
                    
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { flex: 1, backgroundColor: "#F3F4F6" }]}
                        onPress={() => setShowSaveListModal(false)}
                      >
                        <Text style={[s.modalActionBtnText, { color: SUB }]}>取消</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.modalActionBtn, { flex: 1, backgroundColor: "#16A34A" }]}
                        onPress={saveCurrentList}
                      >
                        <Ionicons name="save-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={s.modalActionBtnText}>儲存清單</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  topControlCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT,
  },
  controlSub: {
    fontSize: 11,
    color: SUB,
    marginTop: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 2,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperVal: {
    fontSize: 15,
    fontWeight: "900",
    color: TEXT,
    paddingHorizontal: 12,
    textAlign: "center",
    minWidth: 54,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  categoryCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT,
  },
  categoryProgress: {
    fontSize: 11,
    color: SUB,
    marginTop: 1,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  selectAllBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  checkbox: {
    paddingRight: 12,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  itemName: {
    fontSize: 13,
    color: TEXT,
  },
  itemQty: {
    fontSize: 11,
    color: SUB,
    marginTop: 2,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quantityInput: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    width: 60,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
    paddingBottom: 2,
    backgroundColor: "#fff",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  quantityUnit: {
    fontSize: 11,
    color: SUB,
    minWidth: 30,
    textAlign: "right",
  },
  quantityUnitPicker: {
    minWidth: 70,
    maxWidth: 90,
  },
  unitPicker: {
    minWidth: 70,
    maxWidth: 90,
    height: 36,
  },
  quantityDisplay: {
    fontSize: 12,
    color: SUB,
    fontWeight: "600",
  },
  itemActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF4FB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 85,
  },
  priceBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND,
  },
  microStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  microBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderWidth: 1,
    borderColor: BRAND,
    margin: 8,
    borderRadius: 8,
  },
  input: {
    backgroundColor: "#fff",
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 8,
    fontSize: 12,
    color: TEXT,
  },
  inlineAddBtn: {
    padding: 4,
  },
  inlineCancelBtn: {
    padding: 4,
  },
  suggestionsBox: {
    position: "absolute",
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    maxHeight: 200,
    overflow: "scroll",
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  suggestionText: {
    fontSize: 13,
    color: TEXT,
    fontWeight: "500",
  },
  addCustomRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    gap: 4,
  },
  addCustomRowText: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND,
  },
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  floatingSelectedCount: {
    fontSize: 15,
    fontWeight: "900",
    color: TEXT,
  },
  floatingSubtitle: {
    fontSize: 11,
    color: SUB,
    marginTop: 2,
  },
  floatingBudget: {
    fontSize: 12,
    fontWeight: "800",
    color: "#16A34A",
    marginTop: 4,
  },
  floatingCartBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 130,
  },
  floatingCartBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: TEXT,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: BG,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 16,
  },
  modalStatsBox: {
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalStatsText: {
    fontSize: 13,
    color: SUB,
    fontWeight: "700",
  },
  modalStatsResult: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND,
    marginTop: 4,
  },
  modalActionBtn: {
    backgroundColor: BRAND,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  modalActionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  langBtn: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  langBtnActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT,
  },
  langBtnTextActive: {
    color: "#fff",
  },
  qrPlaceholderBox: {
    backgroundColor: "#FAFBFD",
    padding: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  }
});
