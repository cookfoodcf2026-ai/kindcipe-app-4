export type ScenarioKey = "quick" | "healthy" | "ricecooker" | "kids" | "guest";

export const SCENARIO_KEYS: ScenarioKey[] = ["quick", "healthy", "ricecooker", "kids", "guest"];

export const SCENARIO_LABEL_KEYS: Record<ScenarioKey, string> = {
  quick: "enums.scenario.quick",
  healthy: "enums.scenario.healthy",
  ricecooker: "enums.scenario.ricecooker",
  kids: "enums.scenario.kids",
  guest: "enums.scenario.guest",
};

const VALID_SCENARIOS = new Set<string>(SCENARIO_KEYS);

export function normalizeScenarios(value: unknown): ScenarioKey[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,，]+/)
      : [];
  const out: ScenarioKey[] = [];
  for (const item of raw) {
    const key = String(item ?? "").trim().toLowerCase();
    if (VALID_SCENARIOS.has(key) && !out.includes(key as ScenarioKey)) {
      out.push(key as ScenarioKey);
    }
  }
  return out;
}

export function deriveScenarioSuggestions(input: {
  name?: string;
  cookTime?: number | string;
  dishType?: string;
  tags?: string[] | string;
  difficulty?: string;
}): ScenarioKey[] {
  const cookMinutes = parseInt(String(input.cookTime ?? ""), 10);
  const dishType = String(input.dishType ?? "").trim().toLowerCase();
  const tagsText = Array.isArray(input.tags) ? input.tags.join(" ") : String(input.tags ?? "");
  const haystack = `${input.name ?? ""} ${tagsText} ${dishType}`.toLowerCase();
  const out: ScenarioKey[] = [];

  if (Number.isFinite(cookMinutes) && cookMinutes > 0 && cookMinutes <= 30) {
    out.push("quick");
  }
  if (
    dishType === "vegetable" ||
    dishType === "soup" ||
    /健康|清淡|少油|低卡|低脂|減脂|养生|有營|healthy|light|low.?cal|diet/.test(haystack)
  ) {
    out.push("healthy");
  }
  if (/電飯煲|电饭煲|一鍋|一锅|煲仔|rice.?cooker|one.?pot/.test(haystack)) {
    out.push("ricecooker");
  }
  if (/小朋友|兒童|儿童|bb|kid|child|family.?friendly/.test(haystack)) {
    out.push("kids");
  }
  if (
    /宴客|請客|请客|派對|派对|party|guest|節日|节日|大菜/.test(haystack) ||
    input.difficulty === "困難" ||
    input.difficulty === "hard"
  ) {
    out.push("guest");
  }
  return out;
}
