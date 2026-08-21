/**
 * Kindcipe 統一食譜 ID 格式工具
 * 
 * 設計原則：
 * 1. 只准用一個格式：official_{id} / user_{id}
 * 2. 移除所有 official: / custom_ 混用
 * 3. 提供統一匹配邏輯，避免購物車/排餐匹配失敗
 */

export type RecipeType = 'official' | 'user';

export interface RecipeRef {
  type: RecipeType;
  id: number;
}

/**
 * 將 RecipeRef 轉為字符串
 * @param ref RecipeRef object
 * @returns "official_123" 或 "user_456"
 */
export const toString = (ref: RecipeRef): string => {
  return `${ref.type}_${ref.id}`;
};

/**
 * 解析字符串為 RecipeRef
 * @param str ID 字符串（支援 official_ / user_ / official: 格式）
 * @returns RecipeRef object
 */
export const parse = (str: string): RecipeRef => {
  if (!str) {
    throw new Error(`Invalid recipe ref: empty string`);
  }
  
  // 兼容舊格式 official:123 → official_123
  const normalized = str.replace(/^official:/, 'official_');
  
  if (normalized.startsWith('official_')) {
    const id = parseInt(normalized.replace('official_', ''), 10);
    if (isNaN(id)) {
      throw new Error(`Invalid official recipe ID: ${normalized}`);
    }
    return { type: 'official', id };
  }
  
  if (normalized.startsWith('user_')) {
    const id = parseInt(normalized.replace('user_', ''), 10);
    if (isNaN(id)) {
      throw new Error(`Invalid user recipe ID: ${normalized}`);
    }
    return { type: 'user', id };
  }
  
  // 如果無 prefix，假設係數字 ID，預設為 user
  const id = parseInt(normalized, 10);
  if (!isNaN(id)) {
    return { type: 'user', id };
  }
  
  throw new Error(`Invalid recipe ref format: ${str}`);
};

/**
 * 從數字 ID 創建 RecipeRef
 */
export const fromId = (id: number, type: RecipeType = 'user'): RecipeRef => {
  return { type, id };
};

/**
 * 獲取數值 ID（移除 prefix）
 */
export const getNumericId = (str: string): number => {
  try {
    return parse(str).id;
  } catch {
    // 如果解析失敗，嘗試直接 parse 數字
    const id = parseInt(str.replace(/[^0-9]/g, ''), 10);
    return isNaN(id) ? 0 : id;
  }
};

/**
 * 判斷兩個 RecipeRef 是否相同
 */
export const equals = (ref1: RecipeRef, ref2: RecipeRef): boolean => {
  return ref1.type === ref2.type && ref1.id === ref2.id;
};

/**
 * 判斷字符串 ID 是否匹配 RecipeRef
 */
export const matchesString = (ref: RecipeRef, strId: string): boolean => {
  try {
    const parsed = parse(strId);
    return equals(ref, parsed);
  } catch {
    return false;
  }
};

/**
 * 從 AI Recipe object 提取 RecipeRef
 */
export const fromAIRecipe = (recipe: any): RecipeRef | null => {
  if (!recipe) return null;
  
  if (recipe.source === 'official' && typeof recipe.officialId === 'number') {
    return { type: 'official', id: recipe.officialId };
  }
  
  if (recipe.source === 'custom' && typeof recipe.customId === 'number') {
    return { type: 'user', id: recipe.customId };
  }
  
  if (recipe.source === 'user' && typeof recipe.id === 'number') {
    return { type: 'user', id: recipe.id };
  }
  
  // AI 生成但未儲存嘅食譜，無 ID
  return null;
};

/**
 * 從 Library Recipe object 提取 RecipeRef
 */
export const fromLibraryRecipe = (recipe: any): RecipeRef => {
  if (recipe._source === 'official' || recipe.source === 'official') {
    return { type: 'official', id: recipe.id };
  }
  return { type: 'user', id: recipe.id };
};

/**
 * 為購物車/排餐匹配提供統一 key 生成
 */
export const getShoppingKey = (recipeRef: RecipeRef, date: string): string => {
  return `${toString(recipeRef)}__${date}`;
};

/**
 * 解析購物車 key 為 RecipeRef + date
 */
export const parseShoppingKey = (key: string): { recipeRef: RecipeRef; date: string } | null => {
  const parts = key.split('__');
  if (parts.length !== 2) return null;
  
  try {
    const recipeRef = parse(parts[0]);
    const date = parts[1];
    return { recipeRef, date };
  } catch {
    return null;
  }
};
