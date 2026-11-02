import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Web HTML shell（Expo Router）。
 * 主要用途：加 OG / Twitter meta，令 IG、WhatsApp、Telegram 分享 app.kindcipe.com 時有預覽卡。
 */
export default function Root({ children }: PropsWithChildren) {
  const title = "Kindcipe 和諧食譜 — 一撳配好三餸一湯";
  const description =
    "香港家庭嘅 AI 食譜助手：一鍵配好三餸一湯、自動出買餸清單、貼 IG／YouTube 連結就變食譜。免費開始。";
  const image = "https://kindcipe.com/og-home.png";
  const url = "https://app.kindcipe.com/";

  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>{title}</title>
        <meta name="description" content={description} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kindcipe 和諧食譜" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={url} />
        <meta property="og:locale" content="zh_HK" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={image} />

        <meta name="theme-color" content="#FFF8EF" />
        <meta name="apple-mobile-web-app-title" content="Kindcipe" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
