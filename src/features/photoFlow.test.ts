import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePhoto,
  buildVisionOutcome,
  isPhotoLimitError,
  parseVisionAnalysis,
  processPhoto,
  searchVisionLibrary,
  visionItems,
} from "./photoFlow";

test("parses strict JSON string and keeps only analysis fields", () => {
  const parsed = parseVisionAnalysis('xx {"scene":"dish","dishName":"炒蛋","ingredients":["蛋","番茄"],"extra":"ignored"} yy');
  assert.deepEqual(parsed, { scene: "dish", dishName: "炒蛋", ingredients: ["蛋", "番茄"], requestId: undefined });
});

test("rejects invalid scene and invalid JSON", () => {
  assert.equal(parseVisionAnalysis({ scene: "uncertain", ingredients: ["蛋"] }), null);
  assert.equal(parseVisionAnalysis("not json"), null);
});

test("zero ingredients becomes failed unless there is a dish name", () => {
  const empty = buildVisionOutcome({ scene: "fridge", dishName: "", ingredients: [] }, [], "key", "url");
  assert.equal(empty.kind, "failed");
  const named = buildVisionOutcome({ scene: "dish", dishName: "炒蛋", ingredients: [] }, [], "key", "url");
  assert.deepEqual(visionItems(named.kind === "failed" ? { scene: "dish", dishName: "炒蛋", ingredients: [] } : named.analysis), ["炒蛋"]);
  assert.equal(named.kind, "ai");
});

test("cards produce library hit; no cards produce AI quick reply", () => {
  const hit = buildVisionOutcome({ scene: "fridge", dishName: "", ingredients: ["蛋"] }, [{ name: "炒蛋" }], "key", "url");
  assert.equal(hit.kind, "cards");
  assert.equal(hit.messageKey, "aiChef.visionFridgeLibraryHit");
  const miss = buildVisionOutcome({ scene: "dish", dishName: "炒蛋", ingredients: ["蛋"] }, [], "key", "url");
  assert.equal(miss.kind, "ai");
  assert.equal(miss.quickReplies[0].actionId, "similar_ai");
});

test("analyzePhoto rejects invalid model payload", async () => {
  await assert.rejects(
    analyzePhoto({ aiRecipe: { analyzeImage: { mutate: async () => ({ scene: "bad" }) } } }, { storageKey: "key" }),
    /invalid_vision_analysis/,
  );
});

test("processPhoto uploads, analyzes and searches through injected API", async () => {
  const api = {
    recipes: {
      uploadRecipeImage: { mutate: async () => ({ key: "recipe-screenshots/f13/a.jpg", url: "https://img.test/a.jpg" }) },
      search: { query: async () => ({ recipes: [{ name: "炒蛋", ingredientList: ["蛋"] }] }) },
    },
    aiRecipe: {
      analyzeImage: { mutate: async () => ({ scene: "dish", dishName: "炒蛋", ingredients: ["蛋"], requestId: "req_1" }) },
    },
  };
  const phases: string[] = [];
  const out = await processPhoto(api, {
    uri: "data:image/jpeg;base64,AA==",
    lang: "zh-TW",
    compress: async () => ({ base64: "AA==", mimeType: "image/jpeg" }),
    onProgress: (phase) => phases.push(phase),
  });
  assert.equal(out.analysis.scene, "dish");
  assert.equal(out.outcome.kind, "cards");
  assert.equal(out.imageKey, "recipe-screenshots/f13/a.jpg");
  assert.deepEqual(phases, ["uploading", "analyzing"]);
});

test("recognizes a TOO_MANY_REQUESTS limit error", () => {
  assert.equal(isPhotoLimitError({ data: { code: "TOO_MANY_REQUESTS" } }), true);
  assert.equal(isPhotoLimitError({ data: { code: "INTERNAL_SERVER_ERROR" } }), false);
});

test("dish search uses ingredient combinations and retries top 3 when thin", async () => {
  const queries: string[] = [];
  const api = {
    recipes: {
      search: {
        query: async ({ query }: { query: string }) => {
          queries.push(query);
          return { recipes: query === "魚 青瓜 甘筍 南瓜" ? [{ name: "魚" }, { name: "青瓜" }] : [{ name: "甘筍" }, { name: "南瓜" }, { name: "湯" }] };
        },
      },
    },
  };
  const result = await searchVisionLibrary(api, {
    scene: "dish",
    dishName: "完全唔同菜名",
    ingredients: ["魚", "青瓜", "甘筍", "南瓜"],
  });
  assert.deepEqual(queries, ["魚 青瓜 甘筍 南瓜", "魚 青瓜 甘筍"]);
  assert.equal(result.query1Count, 2);
  assert.equal(result.query2Count, 3);
  assert.equal(result.cards.length, 5);
});
