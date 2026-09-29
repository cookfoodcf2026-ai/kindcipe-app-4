/**
 * Unit tests for the AI Chef pure helpers (no React/RN needed).
 * Run:  node __tests__/mealIntent.test.mjs
 */
import { strict as assert } from "node:assert";
import { detectMealIntent, detectFlavorConstraint } from "../lib/mealIntent.js";

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

console.log(`\n結果：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
