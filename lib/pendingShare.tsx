/**
 * PendingShare store — 分享資料的「單一來源」（Single Source of Truth）。
 *
 * 為何要呢個？
 * - expo-share-intent 嘅 payload 通常喺 app 開咗之後 **1–2 秒** 先到。
 * - 若靠 screen focus / AppState 去「pull」，會 race（payload 未到就已經檢查完）→ 畫面空白。
 *
 * 架構（Single Writer / Single Reader）：
 *   ShareIntentBridge（唯一 writer） → setPending(payload)
 *   import.tsx（唯一 reader）        → useEffect 監聽 pending，一變即解析
 *
 * AsyncStorage 仍保留作冷啟／未登入後登入嘅持久 fallback。
 */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export type PendingSharePayload = {
  clipboardUrl?: string;
  sharedText?: string;
  sharedImageUri?: string;
  autoParse?: string;
  /** 內部用：每次 set 都不同，確保 reader effect 一定觸發。 */
  _ts?: number;
};

type Ctx = {
  pending: PendingSharePayload | null;
  /** 由 bridge 呼叫（唯一 writer）。 */
  setPending: (p: PendingSharePayload) => void;
  /** 由 import 呼叫：處理完後清除。 */
  clearPending: () => void;
};

const PendingShareContext = createContext<Ctx>({
  pending: null,
  setPending: () => {},
  clearPending: () => {},
});

export function PendingShareProvider({ children }: { children: ReactNode }) {
  const [pending, setPendingState] = useState<PendingSharePayload | null>(null);
  const setPending = useCallback((p: PendingSharePayload) => {
    // 用新 object 觸發 reader 的 effect；沿用 caller 提供嘅 _ts（令 context 與 AsyncStorage 去重一致）
    setPendingState({ ...p, _ts: (p as any)._ts ?? Date.now() } as PendingSharePayload);
  }, []);
  const clearPending = useCallback(() => setPendingState(null), []);
  const value = useMemo(() => ({ pending, setPending, clearPending }), [pending, setPending, clearPending]);
  return <PendingShareContext.Provider value={value}>{children}</PendingShareContext.Provider>;
}

export function usePendingShare() {
  return useContext(PendingShareContext);
}
