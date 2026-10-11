import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Build output goes to ../docs (GitHub Pages root for kindcipe.com).
// For local verification without touching the committed site, override:
//   MARKETING_OUT_DIR=dist npm run build
const outDir = process.env.MARKETING_OUT_DIR || "../docs";

// Old recipe URLs used the Chinese dish name; the new canonical slug is
// English/pinyin. Keep the old URLs working with 301 redirects (zh + en).
const recipeSlugs = {
  "番茄炒蛋": "tomato-scrambled-eggs",
  "紅燒肉": "braised-pork-belly",
  "糖醋排骨": "sweet-and-sour-pork-ribs",
  "麻婆豆腐": "mapo-tofu",
  "宮保雞丁": "kung-pao-chicken",
  "清蒸鱸魚": "steamed-sea-bass",
  "干煸四季豆": "dry-fried-green-beans",
  "魚香茄子": "yuxiang-eggplant",
  "薑蔥蒸雞": "steamed-chicken-ginger-scallion",
  "臘味煲仔飯": "claypot-rice-lap-cheong",
  "蠔油冬菇炆雞": "braised-chicken-mushroom",
  "鹽焗雞翼": "salt-baked-chicken-wings",
  "蝦仁炒蛋": "shrimp-scrambled-eggs",
  "豉油王炒麵": "soy-sauce-fried-noodles",
  "蒜蓉炒菜心": "garlic-stir-fried-choy-sum",
  "腐乳通菜": "fermented-bean-curd-morning-glory",
  "榨菜肉絲湯米粉": "pickled-mustard-pork-noodles",
  "回鍋肉": "twice-cooked-pork",
  "梅菜扣肉": "preserved-mustard-pork-belly",
  "紅蘿蔔粟米豬骨湯": "carrot-corn-pork-bone-soup",
};

const recipeRedirects = Object.fromEntries(
  Object.entries(recipeSlugs).flatMap(([zh, slug]) => [
    [`/recipes/${zh}/`, `/recipes/${slug}/`],
    [`/en/recipes/${zh}/`, `/en/recipes/${slug}/`],
  ]),
);

export default defineConfig({
  site: "https://kindcipe.com",
  outDir,
  trailingSlash: "always",
  build: { format: "directory" },
  redirects: recipeRedirects,
  i18n: {
    defaultLocale: "zh-HK",
    locales: ["zh-HK", "en"],
    routing: { prefixDefaultLocale: false },
    fallback: { en: "zh-HK" },
  },
  integrations: [sitemap()],
});
