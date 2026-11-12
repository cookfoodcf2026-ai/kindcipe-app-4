import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UNKNOWN_UNIT_FALLBACK_KEY,
  UNIT_ZH_TO_KEY,
  isQuantityLabel,
  quantityKeyFor,
  quantityNumberFor,
  unitKeyFor,
} from "./unitLocalization";

const LOCALES = ["zh-TW", "en", "fil", "id"];
const UNITS = [
  "湯匙", "克", "茶匙", "隻", "毫升", "條", "個", "片", "瓣", "杯",
  "粒", "塊", "包", "碗", "朵", "磚", "張", "棵", "罐", "大束", "頭",
];
const QUANTITIES = ["適量", "少許"];

function locale(lang: string): any {
  return JSON.parse(readFileSync(join(process.cwd(), "locales", `${lang}.json`), "utf8"));
}

test("maps every production unit and quantity without Chinese leakage", () => {
  for (const value of UNITS) {
    const key = unitKeyFor(value);
    assert.ok(key, `missing unit mapping: ${value}`);
  }
  for (const value of QUANTITIES) {
    assert.equal(isQuantityLabel(value), true, `quantity not recognized: ${value}`);
    assert.ok(quantityKeyFor(value), `missing quantity mapping: ${value}`);
  }
  assert.equal(isQuantityLabel("適量"), true);
  assert.equal(isQuantityLabel("少許"), true);
  assert.equal(quantityNumberFor("半"), "½");
  for (const value of QUANTITIES) assert.equal(UNIT_ZH_TO_KEY[value], undefined, `${value} must not be in unit map`);
});

test("all mapped unit and quantity keys exist in four locales", () => {
  const unitKeys = new Set([...UNITS.map(unitKeyFor), UNKNOWN_UNIT_FALLBACK_KEY]);
  const quantityKeys = new Set(QUANTITIES.map(quantityKeyFor));
  for (const lang of LOCALES) {
    const data = locale(lang);
    for (const key of unitKeys) assert.ok(data.enums?.unit?.[key!], `${lang} missing enums.unit.${key}`);
    for (const key of quantityKeys) assert.ok(data.enums?.quantity?.[key!], `${lang} missing enums.quantity.${key}`);
  }
});

test("every count-driven unit plural in en exists in all four locales", () => {
  const en = locale("en");
  const pluralKeys = Object.keys(en.enums?.unitPlural ?? {});
  assert.ok(pluralKeys.length > 0, "en has no enums.unitPlural keys");
  for (const lang of LOCALES) {
    const data = locale(lang);
    for (const key of pluralKeys) {
      assert.ok(data.enums?.unitPlural?.[key], `${lang} missing enums.unitPlural.${key}`);
    }
  }
});

test("unmapped Chinese unit has an explicit localised fallback key", () => {
  assert.equal(unitKeyFor("神秘單位"), undefined);
  for (const lang of LOCALES) {
    const data = locale(lang);
    assert.ok(data.enums?.unit?.[UNKNOWN_UNIT_FALLBACK_KEY], `${lang} missing fallback unit`);
  }
});
