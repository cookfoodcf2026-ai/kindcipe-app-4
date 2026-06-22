import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@kindcipe/custom-categories";

export interface CategoryDef {
  key: string;
  label: string;
  emoji: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { key: "中菜",   label: "中菜",   emoji: "🥟" },
  { key: "西餐",   label: "西餐",   emoji: "🥗" },
  { key: "日式",   label: "日式",   emoji: "🍣" },
  { key: "韓式",   label: "韓式",   emoji: "🥘" },
  { key: "東南亞", label: "東南亞", emoji: "🍜" },
  { key: "甜品",   label: "甜品",   emoji: "🍰" },
  { key: "飲品",   label: "飲品",   emoji: "🧋" },
  { key: "其他",   label: "其他",   emoji: "📦" },
];

export async function loadCustomCategories(): Promise<CategoryDef[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: CategoryDef[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

export async function saveCustomCategories(categories: CategoryDef[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function validateCategory(label: string, emoji: string): string | null {
  if (!label.trim()) return "請輸入分類名稱";
  if (!emoji.trim()) return "請輸入表情符號";
  return null;
}
