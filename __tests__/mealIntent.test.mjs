/**
 * Unit tests for the AI Chef pure helpers (no React/RN needed).
 * Run:  node __tests__/mealIntent.test.mjs
 */
import { strict as assert } from "node:assert";
import { detectMealIntent, detectFlavorConstraint, extractDiet, mealCategoryPool, dietPromptLine, structuredMealDietHint, mergeAvoidLists, sessionAvoid } from "../lib/mealIntent.js";

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log("  ✅", name); }
  catch (e) { fail++; console.error("  ❌", name, "→", e.message); }
};

console.log("detectMealIntent：");
t("3餸1湯 → 3/1", () => assert.deepEqual(detectMealIntent("3餸1湯"), { dishes: 3, soups: 1, carb: false }));
t("三餸一湯 → 3/1", () => assert.deepEqual(detectMealIntent("三餸一湯"), { dishes: 3, soups: 1, carb: false }));
t("辛辣的3餸1湯 → 3/1", () => assert.deepEqual(detectMealIntent("辛辣的3餸1湯"), { dishes: 3, soups: 1, carb: false }));
t("兩個餸 → 2/0", () => assert.deepEqual(detectMealIntent("兩個餸"), { dishes: 2, soups: 0, carb: false }));
t("1個餸 → 1/0", () => assert.deepEqual(detectMealIntent("1個餸"), { dishes: 1, soups: 0, carb: false }));
t("2餸1湯 + 飯 → carb true", () => { const r = detectMealIntent("2餸1湯 加飯"); assert.equal(r.dishes, 2); assert.equal(r.soups, 1); assert.equal(r.carb, true); });
t("疑問句 → null（唔 intercept）", () => assert.equal(detectMealIntent("點樣整3餸1湯？"), null));
t("打招呼 → null", () => assert.equal(detectMealIntent("你好"), null));

console.log("detectFlavorConstraint：");
t("辛辣的3餸1湯 → spicy", () => { const f = detectFlavorConstraint("辛辣的3餸1湯"); assert.equal(f.spicy, true); assert.equal(f.light, false); });
t("唔辣 → 唔 spicy 且 light", () => { const f = detectFlavorConstraint("唔辣"); assert.equal(f.spicy, false); assert.equal(f.light, true); });
t("小辣 → 唔算 spicy", () => assert.equal(detectFlavorConstraint("小辣").spicy, false));
t("清淡 → light", () => { const f = detectFlavorConstraint("清淡為主"); assert.equal(f.light, true); assert.equal(f.spicy, false); });
t("唔食豬肉 → exclusion 有豬肉", () => assert.ok(detectFlavorConstraint("唔食豬肉").exclusions.some(x => x.includes("豬肉"))));
t("忌口：花生 → exclusion", () => assert.ok(detectFlavorConstraint("忌口：花生").exclusions.some(x => x.includes("花生"))));
t("唔要海鮮 唔要豬肉 → 2 個 exclusion", () => assert.deepEqual(detectFlavorConstraint("唔要海鮮 唔要豬肉").exclusions, ["海鮮", "豬肉"]));
t("唔要豬肉 → 豬肉 而唔係 豬", () => assert.deepEqual(detectFlavorConstraint("唔要豬肉").exclusions, ["豬肉"]));
t("唔食豬肉 → 豬肉 而唔係 豬", () => assert.deepEqual(detectFlavorConstraint("唔食豬肉").exclusions, ["豬肉"]));
t("不要蝦、忌口：花生 → 兩個 exclusion", () => assert.deepEqual(detectFlavorConstraint("不要蝦、忌口：花生").exclusions, ["蝦", "花生"]));

console.log("extractDiet：");
t("素食三餸一湯 → true", () => assert.equal(extractDiet("素食三餸一湯"), true));
t("三餸一湯 → false（回歸鎖）", () => assert.equal(extractDiet("三餸一湯"), false));
t("素菜炒肉片 → false（negative）", () => assert.equal(extractDiet("素菜炒肉片"), false));
t("素雞 → false（negative）", () => assert.equal(extractDiet("素雞"), false));
t("純素兩餸一湯 → true", () => assert.equal(extractDiet("純素兩餸一湯"), true));
t("vegan / Vegetarian → true", () => {
  assert.equal(extractDiet("vegan dinner"), true);
  assert.equal(extractDiet("Vegetarian 3 dishes"), true);
});
t("吃素／食素／全素／蛋奶素 → true", () => {
  for (const s of ["我吃素", "今晚食素", "全素", "蛋奶素"]) assert.equal(extractDiet(s), true, s);
});

console.log("mealCategoryPool：");
t("diet pool 冇肉類／海鮮", () => {
  const pool = mealCategoryPool(true).join("|");
  assert.ok(!/肉類|海鮮|豬|牛|雞|魚|蝦/.test(pool), pool);
  assert.ok(/蔬菜/.test(pool) && /豆製品/.test(pool) && /蛋/.test(pool) && /菇菌/.test(pool));
});
t("非 diet pool 維持原狀", () => assert.deepEqual(mealCategoryPool(false), [
  "肉類主菜（如豬/牛/雞）",
  "海鮮/其他蛋白主菜（如魚/蝦/豆腐蛋）",
  "蔬菜/小炒",
  "其他家常菜（如蛋/豆製品/麵飯）",
]));

console.log("dietPromptLine：");
t("diet → 含素食；非 diet → 空字串（回歸鎖）", () => {
  assert.ok(dietPromptLine(true).includes("素食"));
  assert.equal(dietPromptLine(false), "");
});

console.log("structuredMealDietHint：");
t("diet → 含素食；非 diet → 空字串（回歸鎖）", () => {
  assert.ok(structuredMealDietHint(true).includes("素食"));
  assert.equal(structuredMealDietHint(false), "");
});

console.log("structured meal 4 cases（requestInstantRecipes 無 prefs 組合）：");
const structuredPrompt = (text) => {
  const intent = detectMealIntent(text) ?? { dishes: 3, soups: 1 };
  const diet = extractDiet(text);
  return {
    prompt: ["", `${intent.dishes} 餸 ${intent.soups} 湯`, structuredMealDietHint(diet)].join(""),
    pool: mealCategoryPool(diet),
  };
};
t("素食三餸一湯 → prompt 含素食、pool 冇肉/海鮮", () => {
  const { prompt, pool } = structuredPrompt("素食三餸一湯");
  assert.equal(prompt, "3 餸 1 湯；素食（唔要肉類、海鮮、魚蝦蟹）");
  assert.ok(!/肉類|海鮮|豬|牛|雞|魚|蝦/.test(pool.join("|")));
});
t("三餸一湯 → prompt 同今日一樣（回歸鎖）", () => {
  const { prompt, pool } = structuredPrompt("三餸一湯");
  assert.equal(prompt, "3 餸 1 湯");
  assert.deepEqual(pool, mealCategoryPool(false));
});
t("素菜炒肉片 → 唔當 diet", () => {
  assert.equal(extractDiet("素菜炒肉片"), false);
  assert.ok(/肉類|海鮮/.test(mealCategoryPool(false).join("|")));
});
t("純素兩餸一湯 → diet 生效", () => {
  const { prompt, pool } = structuredPrompt("純素兩餸一湯");
  assert.equal(prompt, "2 餸 1 湯；素食（唔要肉類、海鮮、魚蝦蟹）");
  assert.ok(!/肉類|海鮮/.test(pool.join("|")));
});

console.log("mergeAvoidLists：");
t("正規化前綴 + split + 去重", () => assert.deepEqual(
  mergeAvoidLists("唔要海鮮，唔食豬肉、不要蝦", ["忌口：花生", "豬肉"]),
  ["海鮮", "豬肉", "蝦", "花生"],
));
t("問卷前綴唔會雙重否定", () => assert.deepEqual(
  mergeAvoidLists(["唔要海鮮"], "唔食豬肉", null, undefined, []),
  ["海鮮", "豬肉"],
));
t("空缺 → 空陣列", () => assert.deepEqual(mergeAvoidLists("", [], null), []));

console.log("sessionAvoid：");
t("session 有「唔要豬肉」→ 含豬肉", () => {
  const avoid = sessionAvoid([{ role: "user", content: "唔要豬肉" }], { allergens: [], dislikes: [] });
  assert.ok(avoid.includes("豬肉"));
});
t("session 冇避免詞 → 唔含豬肉", () => {
  const avoid = sessionAvoid([{ role: "user", content: "今晚食咩" }], { allergens: [], dislikes: [] });
  assert.ok(!avoid.includes("豬肉"));
});

console.log(`\n結果：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
