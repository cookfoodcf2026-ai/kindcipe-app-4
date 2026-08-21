/**
 * Kindcipe 統一日期時間工具
 * 
 * 設計原則：
 * 1. 跟隨用戶手機時區（唔係硬編碼 HK UTC+8）
 * 2. 所有日期計算用本地時間，避免 UTC 陷阱
 * 3. 支援亞洲多個時區（HK/SG/MY/TH/ID/PH/JP/KR 等）
 */

import * as Localization from 'expo-localization';

/**
 * 獲取用戶時區
 * @returns 時區字符串，例如 "Asia/Hong_Kong"
 */
const getUserTimezone = (): string => {
  // 保留 API，實際日期計算用裝置本地時間，避免 iOS 解析字串失敗
  // @ts-ignore - timeZone 可能存在於某些平台
  return Localization.getLocales()[0]?.timeZone || 'Asia/Hong_Kong';
};

/**
 * 統一日期解析：純日期 (YYYY-MM-DD) 補 T00:00:00，完整 timestamp 直接使用
 * 容忍非字串輸入（number epoch ms / Date / null），避免 UI crash
 */
const toDateStr = (dateStr: string | number | Date | null | undefined): string => {
  if (dateStr == null || dateStr === '') return '';
  if (typeof dateStr === 'number') return new Date(dateStr).toISOString();
  if (dateStr instanceof Date) return dateStr.toISOString();
  const s = String(dateStr);
  return s.includes('T') ? s : s + 'T00:00:00';
};

/**
 * 將 Date 轉為本地 ISO 日期字串 (YYYY-MM-DD)
 * 用 toLocaleString 確保用用戶時區，避免 toISOString() 嘅 UTC 陷阱
 */
const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * 返回今日的本地 ISO 日期字串
 */
const todayISO = (): string => {
  return toISODate(new Date());
};

/**
 * 返回聽日的本地 ISO 日期字串
 */
const tomorrowISO = (): string => {
  return addDays(todayISO(), 1);
};

/**
 * 計算指定日期的前一日
 */
const getDayBefore = (dateStr: string): string => {
  return addDays(dateStr, -1);
};

/**
 * 計算指定日期的後一日
 */
const getDayAfter = (dateStr: string): string => {
  return addDays(dateStr, 1);
};

/**
 * 加減日子（本地計算）
 * @param dateStr ISO 日期字串 (YYYY-MM-DD)
 * @param days 加減的日子數（正數=加，負數=減）
 */
const addDays = (dateStr: string, days: number): string => {
  const d = new Date(toDateStr(dateStr));
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/**
 * 格式化日期為友好標籤（例如：今日、聽日、週幾）
 */
const formatDateLabel = (dateStr: string): string => {
  const today = todayISO();
  const tomorrow = tomorrowISO();
  if (dateStr === today) return '今日';
  if (dateStr === tomorrow) return '聽日';
  const d = new Date(toDateStr(dateStr));
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return weekdays[d.getDay()];
};

/**
 * 判斷是否今日（用用戶時區）
 */
const isToday = (dateStr: string): boolean => {
  return dateStr === todayISO();
};

/**
 * 判斷是否聽日（用用戶時區）
 */
const isTomorrow = (dateStr: string): boolean => {
  return dateStr === tomorrowISO();
};

/**
 * 判斷是否本週內（用用戶時區）
 */
const isThisWeek = (dateStr: string): boolean => {
  const d = new Date(toDateStr(dateStr));
  const today = new Date();
  const tz = getUserTimezone();
  const todayStr = today.toLocaleString('en-US', { timeZone: tz });
  const localToday = new Date(todayStr);
  const startOfWeek = new Date(localToday);
  startOfWeek.setDate(localToday.getDate() - localToday.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
};

/**
 * 格式化日期顯示（用用戶 locale）
 */
const formatDate = (dateStr: string, locale?: string): string => {
  const d = new Date(toDateStr(dateStr));
  const userLocale = locale || Localization.getLocales()[0]?.languageTag || 'zh-HK';
  return d.toLocaleDateString(userLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * 獲取星期幾（用用戶 locale）
 */
const getWeekday = (dateStr: string, short = false): string => {
  const d = new Date(toDateStr(dateStr));
  const locale = Localization.getLocales()[0]?.languageTag || 'zh-HK';
  return d.toLocaleDateString(locale, { weekday: short ? 'short' : 'long' });
};

/**
 * 格式化月份標籤（例如：1 月）
 */
const formatMonthLabel = (dateStr: string): string => {
  const d = new Date(toDateStr(dateStr));
  return `${d.getMonth() + 1}月`;
};

/**
 * 計算兩個日期之間的日子差
 */
const daysBetween = (dateStr1: string, dateStr2: string): number => {
  const d1 = new Date(toDateStr(dateStr1));
  const d2 = new Date(toDateStr(dateStr2));
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 解析 ISO 日期字串為 Date 對象（本地時間）
 * 支援純日期 (YYYY-MM-DD) 同完整 timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
const parseDate = (dateStr: string | number | Date | null | undefined): Date => {
  const s = toDateStr(dateStr);
  return s ? new Date(s) : new Date(NaN);
};

// Export as a single object for easier usage
export const DateUtil = {
  getUserTimezone,
  toISODate,
  todayISO,
  tomorrowISO,
  getDayBefore,
  getDayAfter,
  addDays,
  formatDateLabel,
  isToday,
  isTomorrow,
  isThisWeek,
  formatDate,
  getWeekday,
  formatMonthLabel,
  daysBetween,
  parseDate,
};

export default DateUtil;
