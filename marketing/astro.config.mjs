import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Build output goes to ../docs (GitHub Pages root for kindcipe.com).
// For local verification without touching the committed site, override:
//   MARKETING_OUT_DIR=dist npm run build
const outDir = process.env.MARKETING_OUT_DIR || "../docs";

export default defineConfig({
  site: "https://kindcipe.com",
  outDir,
  trailingSlash: "always",
  build: { format: "directory" },
  i18n: {
    defaultLocale: "zh-HK",
    locales: ["zh-HK", "en"],
    routing: { prefixDefaultLocale: false },
    fallback: { en: "zh-HK" },
  },
  integrations: [sitemap()],
});
