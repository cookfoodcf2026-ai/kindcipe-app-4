import assert from "node:assert/strict";
import test from "node:test";
import { getLocalizedTip } from "./tipLocalization";

const recipe = {
  tips: "中文貼士",
  tipsEn: "English tip",
  tipsFil: "Filipino tip",
  tipsId: "Indonesian tip",
};

test("picks the current locale and never marks translated tips as Original", () => {
  assert.deepEqual(getLocalizedTip("zh-TW", recipe), { text: "中文貼士", isOriginal: false });
  assert.deepEqual(getLocalizedTip("en", recipe), { text: "English tip", isOriginal: false });
  assert.deepEqual(getLocalizedTip("fil", recipe), { text: "Filipino tip", isOriginal: false });
  assert.deepEqual(getLocalizedTip("id", recipe), { text: "Indonesian tip", isOriginal: false });
});

test("falls back fil/id to English before the original Chinese", () => {
  const noTarget = { tips: "中文貼士", tipsEn: "English tip" };
  assert.deepEqual(getLocalizedTip("fil", noTarget), { text: "English tip", isOriginal: false });
  assert.deepEqual(getLocalizedTip("id", noTarget), { text: "English tip", isOriginal: false });
});

test("marks Original only when the Chinese source is shown in a non-Chinese locale", () => {
  assert.deepEqual(getLocalizedTip("fil", { tips: "中文貼士" }), { text: "中文貼士", isOriginal: true });
  assert.deepEqual(getLocalizedTip("en", { tips: "中文貼士" }), { text: "中文貼士", isOriginal: true });
  assert.deepEqual(getLocalizedTip("zh-TW", { tips: "中文貼士" }), { text: "中文貼士", isOriginal: false });
});

test("accepts snake_case fields from the API contract", () => {
  assert.equal(getLocalizedTip("id", { tips: "中文", tips_id: "Tips ID" }).text, "Tips ID");
  assert.equal(getLocalizedTip("fil", { tips: "中文", tips_fil: "Tip FIL" }).text, "Tip FIL");
});
