/**
 * 為 Expo web 的 dist/index.html 注入 OG / Twitter meta。
 * Expo 呢個 version 唔會用 app/+html.tsx（output: single 仍輸出預設 shell），
 * 所以 export 之後直接改 dist/index.html。
 *
 * 用法：node scripts/inject-og.mjs
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve("dist/index.html");
if (!fs.existsSync(file)) {
  console.warn("[inject-og] dist/index.html 唔存在，跳過");
  process.exit(0);
}

const title = "Kindcipe 和諧食譜 — 一撳配好三餸一湯";
const description =
  "香港家庭嘅 AI 食譜助手：一鍵配好三餸一湯、自動出買餸清單、貼 IG／YouTube 連結就變食譜。免費開始。";
const image = "https://kindcipe.com/og-home.png";
const url = "https://app.kindcipe.com/";

const meta = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kindcipe 和諧食譜" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="zh_HK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="theme-color" content="#FFF8EF" />
`;

let html = fs.readFileSync(file, "utf8");

// 移除舊 title，換成新 meta 區塊（可重複執行）
html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
if (!html.includes('property="og:title"')) {
  html = html.replace("</head>", `${meta}  </head>`);
}
fs.writeFileSync(file, html, "utf8");
console.log("[inject-og] done → dist/index.html");
