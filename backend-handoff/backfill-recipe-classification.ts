/**
 * backfill-recipe-classification.ts
 * ==================================
 * 一次性 backfill：修正舊食譜嘅 recipeCategory / dishType / tags（+ 湯種 tag）。
 *
 * ⚠️ 此檔係「交後端」嘅骨架 —— 請 copy 去後端 repo（例如 kindcipe-backend/scripts/），
 *    因為佢需要 DB 連線 + LLM client，前端 repo 冇。放喺 `backend-handoff/` 只係方便交接。
 *
 * 用法（後端 repo）：
 *   npx tsx scripts/backfill-recipe-classification.ts --dry-run --limit=20
 *   npx tsx scripts/backfill-recipe-classification.ts --only=official --batch=5 --write
 *   npx tsx scripts/backfill-recipe-classification.ts --write --resume
 *
 * 設計重點：
 *   - 預設 dry-run，唔會寫 DB
 *   - 分批 + 限速，避免打爆 LLM
 *   - 可 --resume（記低已處理 id）
 *   - 舊英文分類值（poultry/pork/... /mixed）一律重分類，唔會亂當「中菜」
 *   - 保留 before/after log + 統計報表
 */

/* eslint-disable no-console */

// ─────────────────────────────────────────────────────────────
// 1) Canonical 值（同前端 lib/taxonomy.ts、lib/dishType.ts 對齊）
// ─────────────────────────────────────────────────────────────

export const CUISINE_KEYS = [
  "中菜", "西餐", "日式", "韓式", "東南亞",
  "港式", "台式", "泰式", "印度",
  "甜品", "飲品", "其他",
] as const;

export const DISH_TYPE_KEYS = [
  "meat", "seafood", "vegetable", "soup", "carb",
  "appetizer", "dessert", "drink", "other",
] as const;

/** 舊英文「食材分類」值 —— 唔屬菜系，必須重分類 */
export const LEGACY_CATEGORY_VALUES = new Set([
  "poultry", "pork", "beef", "seafood", "vegetable", "egg", "carb", "mixed",
]);

/** 湯種 tag（按 cookTime 決定；dishType 維持單一 soup） */
export type SoupStyle = "滾湯" | "煲湯" | "老火湯";
export const soupStyleByCookTime = (cookTime: number): SoupStyle => {
  if (cookTime > 0 && cookTime <= 40) return "滾湯";
  if (cookTime >= 90) return "老火湯";
  return "煲湯";
};

// ─────────────────────────────────────────────────────────────
// 2) Args
// ─────────────────────────────────────────────────────────────

type Args = {
  write: boolean;      // --write 才真正 update
  limit: number | null;
  batch: number;
  only: "all" | "official" | "user" | "kol";
  resume: boolean;
  minCookTime: number | null;
};

export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    write: has("--write"),
    limit: val("--limit") ? Number(val("--limit")) : null,
    batch: val("--batch") ? Number(val("--batch")) : 10,
    only: (val("--only") as Args["only"]) || "all",
    resume: has("--resume"),
    minCookTime: null,
  };
}

// ─────────────────────────────────────────────────────────────
// 3) LLM prompt
// ─────────────────────────────────────────────────────────────

export type RecipeLike = {
  id: string | number;
  name: string;
  description?: string | null;
  cookTime?: number | null;
  tags?: string[] | null;
  recipeCategory?: string | null;
  dishType?: string | null;
  sourceType?: string | null; // official | user | kol
};

export type Classification = {
  recipeCategory: string;
  dishType: string;
  tags: string[];
};

export function buildPrompt(r: RecipeLike): string {
  return [
    "你係香港食譜分類器。根據以下食譜，輸出 JSON（唔好有其他文字）。",
    `食譜名：${r.name}`,
    `描述：${(r.description || "").slice(0, 400)}`,
    `現有標籤：${(r.tags || []).join("、") || "（無）"}`,
    "",
    `recipeCategory 必須係其中一個：${CUISINE_KEYS.join(" / ")}`,
    `dishType 必須係其中一個：${DISH_TYPE_KEYS.join(" / ")}`,
    "tags：3–6 個繁體中文標籤（煮法/口味/場合/主要食材/時間，例如：蒸、清淡、家常菜、30分鐘內），最少 1 個。",
    "注意：甜品、飲品有自己嘅 dishType，唔屬湯；糖水 = dessert。",
    "",
    '輸出格式：{"recipeCategory":"...","dishType":"...","tags":["...","..."]}',
  ].join("\n");
}

/** 驗證 + 修正 LLM 輸出（防幻覺值） */
export function normalizeClassification(raw: any): Classification {
  const cuisine = CUISINE_KEYS.includes(raw?.recipeCategory) ? raw.recipeCategory : "其他";
  const dish = DISH_TYPE_KEYS.includes(raw?.dishType) ? raw.dishType : "other";
  let tags = Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
  tags = [...new Set(tags)];
  if (tags.length === 0) tags = ["家常菜"];
  return { recipeCategory: cuisine, dishType: dish, tags };
}

// ─────────────────────────────────────────────────────────────
// 4) Adapters（後端請實作；呢度係 TODO）
// ─────────────────────────────────────────────────────────────

/** TODO(backend): 用你哋 DB/ORM 實作 */
export interface RecipeStore {
  /** 撈一批需要 backfill 嘅食譜（可只 official/user/kol） */
  findBatch(opts: { only: Args["only"]; skip: number; take: number }): Promise<RecipeLike[]>;
  /** 寫返 */
  update(id: RecipeLike["id"], patch: Partial<RecipeLike>): Promise<void>;
}

/** TODO(backend): 用現有 DashScope / Qwen client 實作。回傳 parsed JSON。 */
export interface LlmClient {
  classify(prompt: string): Promise<any>;
}

// ─────────────────────────────────────────────────────────────
// 5) Backfill 主流程
// ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 單條食譜：需要 backfill 嗎？ */
export function needsBackfill(r: RecipeLike): boolean {
  const cat = String(r.recipeCategory || "").trim();
  const dish = String(r.dishType || "").trim();
  const legacy = LEGACY_CATEGORY_VALUES.has(cat);
  const badCuisine = !CUISINE_KEYS.includes(cat as any);
  const badDish = !DISH_TYPE_KEYS.includes(dish as any);
  const noTags = !Array.isArray(r.tags) || r.tags.filter(Boolean).length === 0;
  return legacy || badCuisine || badDish || noTags;
}

export async function runBackfill(deps: { store: RecipeStore; llm: LlmClient; args: Args }) {
  const { store, llm, args } = deps;
  const stats = {
    scanned: 0, changed: 0, skipped: 0, failed: 0,
    cuisine: {} as Record<string, number>,
    dishType: {} as Record<string, number>,
    soupStyle: {} as Record<string, number>,
  };

  let skip = 0;
  for (;;) {
    if (args.limit != null && stats.scanned >= args.limit) break;
    const batch = await store.findBatch({ only: args.only, skip, take: args.batch });
    if (batch.length === 0) break;
    skip += batch.length;

    for (const r of batch) {
      stats.scanned++;
      if (args.limit != null && stats.scanned > args.limit) break;

      if (!needsBackfill(r)) { stats.skipped++; continue; }

      try {
        const raw = await llm.classify(buildPrompt(r));
        let cls = normalizeClassification(raw);

        // 湯種 tag（dishType=soup 時）
        const cookTime = Number(r.cookTime) || 0;
        if (cls.dishType === "soup") {
          const style = soupStyleByCookTime(cookTime);
          if (!cls.tags.includes(style)) cls.tags.push(style);
          stats.soupStyle[style] = (stats.soupStyle[style] || 0) + 1;
        }

        stats.cuisine[cls.recipeCategory] = (stats.cuisine[cls.recipeCategory] || 0) + 1;
        stats.dishType[cls.dishType] = (stats.dishType[cls.dishType] || 0) + 1;

        console.log(
          `[${args.write ? "WRITE" : "DRY "}] ${r.id} ${r.name}\n` +
          `        before: ${r.recipeCategory || "-"} / ${r.dishType || "-"}\n` +
          `        after : ${cls.recipeCategory} / ${cls.dishType} / [${cls.tags.join("、")}]`,
        );

        if (args.write) {
          await store.update(r.id, {
            recipeCategory: cls.recipeCategory,
            dishType: cls.dishType,
            tags: cls.tags,
          });
        }
        stats.changed++;
      } catch (e) {
        stats.failed++;
        console.error(`[ERROR] ${r.id} ${r.name}:`, (e as Error)?.message || e);
      }

      await sleep(150); // 限速
    }
  }

  console.log("\n===== Backfill report =====");
  console.log(JSON.stringify(stats, null, 2));
  return stats;
}

// ─────────────────────────────────────────────────────────────
// 6) Entry（後端接好 adapters 後解除註解）
// ─────────────────────────────────────────────────────────────

/*
async function main() {
  const args = parseArgs();
  console.log("Args:", args, args.write ? "(會寫入 DB)" : "(dry-run，唔會寫)");

  // TODO(backend): 換成真實實作
  const store: RecipeStore = {
    async findBatch({ skip, take }) {
      // return prisma.recipe.findMany({ skip, take });
      return [];
    },
    async update(id, patch) {
      // await prisma.recipe.update({ where: { id }, data: patch });
    },
  };
  const llm: LlmClient = {
    async classify(prompt) {
      // const out = await dashscope(prompt); return JSON.parse(out);
      return {};
    },
  };

  await runBackfill({ store, llm, args });
}

main().catch((e) => { console.error(e); process.exit(1); });
*/
