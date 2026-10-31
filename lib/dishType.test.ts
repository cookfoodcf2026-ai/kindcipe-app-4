import assert from "node:assert/strict";
import test from "node:test";
import { dishTypeLabel, normalizeDishType } from "./dishType";

const ENGLISH_TO_ZH: Array<[string, string]> = [
  ["meat", "肉類"],
  ["seafood", "海鮮"],
  ["vegetable", "蔬菜"],
  ["soup", "湯"],
  ["carb", "麵飯"],
  ["appetizer", "小食"],
  ["dessert", "甜品"],
  ["drink", "飲品"],
  ["other", "其他"],
];

const CHINESE_TO_ZH: Array<[string, string]> = [
  ["肉類", "肉類"],
  ["海鮮", "海鮮"],
  ["蔬菜", "蔬菜"],
  ["湯", "湯"],
  ["麵飯", "麵飯"],
  ["小食", "小食"],
  ["甜品", "甜品"],
  ["飲品", "飲品"],
  ["其他", "其他"],
];

test("dishTypeLabel maps all English enum values", () => {
  for (const [input, expected] of ENGLISH_TO_ZH) {
    assert.equal(dishTypeLabel(input), expected, `dishTypeLabel(${input})`);
  }
});

test("dishTypeLabel maps Chinese values", () => {
  for (const [input, expected] of CHINESE_TO_ZH) {
    assert.equal(dishTypeLabel(input), expected, `dishTypeLabel(${input})`);
  }
});

test("dishTypeLabel falls back to 其他 for unknown values", () => {
  assert.equal(dishTypeLabel("unknown"), "其他");
  assert.equal(dishTypeLabel(""), "其他");
  assert.equal(dishTypeLabel(undefined), "其他");
});

test("dishTypeLabel uses translator when provided", () => {
  const translate = (key: string) => (key === "enums.dishTypeShort.meat" ? "Meat" : key);
  assert.equal(dishTypeLabel("meat", translate), "Meat");
  assert.equal(dishTypeLabel("肉類", translate), "Meat");
});

test("normalizeDishType accepts English and Chinese enum values", () => {
  assert.equal(normalizeDishType("meat"), "meat");
  assert.equal(normalizeDishType("肉類"), "meat");
  assert.equal(normalizeDishType("麵飯"), "carb");
  assert.equal(normalizeDishType("unknown"), "other");
});
