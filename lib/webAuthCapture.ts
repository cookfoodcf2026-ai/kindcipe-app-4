/**
 * Web OAuth 回程 token 擷取（Apple / Google）。
 *
 * 問題：expo-router 喺 web 會先處理 URL，將 `#token=…` fragment 清走，
 * 之後 login screen 嘅 useEffect 讀 window.location.hash 已經係空 →
 * Apple redirect 登入成功但 App 仍然停在 /login。
 *
 * 解法：喺 app 最早嘅 module import 時（router mount 之前）即刻讀走
 * location 上嘅 token，寫入 localStorage（同 lib/auth 用同一個 key），
 * 然後用 replaceState 清乾淨，避免 refresh 再觸發。
 */
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "kindcipe_auth_token";

function capture(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const match = `${search}${hash}`.match(/[#&?]token=(eyJ[A-Za-z0-9._-]+)/);
    if (!match) return;

    const token = decodeURIComponent(match[1]);
    if (token.length < 40) return;

    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    window.history.replaceState({}, "", window.location.pathname);
    // 標記：登入頁見到就會 refresh auth state
    window.sessionStorage.setItem("kindcipe_oauth_return", "apple");
  } catch {
    /* 任何錯誤都唔可以阻 app 啟動 */
  }
}

capture();
