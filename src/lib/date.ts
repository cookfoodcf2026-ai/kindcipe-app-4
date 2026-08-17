/**
 * 本地日期時間 Helper
 * 避免 toISOString() 嘅 UTC 陷阱（香港 UTC+8 凌晨會變前一日）
 */

/** 將 Date 轉為本地 ISO 日期字串 (YYYY-MM-DD) */
export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** 返回今日嘅本地 ISO 日期字串 */
export const todayISO = (): string => toISODate(new Date());

/** 返回聽日嘅本地 ISO 日期字串 */
export const tomorrowISO = (): string => toISODate(new Date(Date.now() + 86400000));

/** 格式化日期為友好標籤（例如：今日、聽日、週幾） */
export const formatDateLabel = (dateStr: string): string => {
  const today = todayISO();
  const tomorrow = tomorrowISO();
  if (dateStr === today) return "今日";
  if (dateStr === tomorrow) return "聽日";
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return weekdays[d.getDay()];
};

/** 計算指定日期嘅前一日 */
export const getDayBefore = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  } catch {
    return dateStr;
  }
};

/** 計算指定日期嘅後一日 */
export const getDayAfter = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  } catch {
    return dateStr;
  }
};

/** 判斷是否今日 */
export const isToday = (dateStr: string): boolean => dateStr === todayISO();

/** 判斷是否聽日 */
export const isTomorrow = (dateStr: string): boolean => dateStr === tomorrowISO();

/** 判斷是否本週內 */
export const isThisWeek = (dateStr: string): boolean => {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
};
