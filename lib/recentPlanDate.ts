/**
 * 記住用戶上一次揀嘅排餐日期。
 *
 * 用戶喺 planner 排「聽日」，跟住去食譜頁撳「加入排餐」，
 * 之前個掣永遠預設今日，要再揀一次。呢個 module 只負責記住最後一次用嘅日期，
 * 呼叫方仍然可以覆蓋（例如用戶明確喺 sheet 改日期）。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "kindcipe_last_plan_date";

/** YYYY-MM-DD（本地時區，唔用 UTC，避免跨時區差一日） */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function rememberPlanDate(date?: string | null): Promise<void> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  try {
    await AsyncStorage.setItem(KEY, date);
  } catch {
    /* 記唔到就算，唔影響排餐 */
  }
}

/**
 * 上次排餐日期；未曾用過、或者已經過去（OC 指出嘅 regression）就回 null
 * → 呼叫方 fallback 今日，唔會排落一個已過去嘅日子。
 */
export async function getLastPlanDate(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    // ISO 字串可以直接比大細；過去日期一律唔用
    return raw < localISODate() ? null : raw;
  } catch {
    return null;
  }
}
