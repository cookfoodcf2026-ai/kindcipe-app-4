import {
  MAX_CARD_HISTORY,
  buildEntry,
  cardSetKey,
  matchCardsFromSessions,
  pushCardHistory,
  sanitizeCardHistory,
} from "./cardHistory";

type Recipe = {
  name: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
};

const recipe = (name: string, ingredients: string[] = ["食材"]): Recipe => ({
  name,
  ingredients: ingredients.map((ingredient) => ({ name: ingredient, quantity: "1", unit: "份" })),
  steps: ["步驟"],
});

const isValid = (card: Recipe) => !!card.name && card.ingredients.length > 0 && card.steps.length > 0;

describe("MAX_CARD_HISTORY", () => {
  it("is 3", () => {
    expect(MAX_CARD_HISTORY).toBe(3);
  });
});

describe("cardSetKey", () => {
  it("ignores card order", () => {
    const a = recipe("番茄炒蛋", ["番茄", "雞蛋"]);
    const b = recipe("白飯", ["米"]);
    expect(cardSetKey([a, b])).toBe(cardSetKey([b, a]));
  });

  it("differs when the same-named recipe has different ingredients", () => {
    const tomatoEgg = recipe("番茄炒蛋", ["番茄", "雞蛋"]);
    const tomatoTofu = recipe("番茄炒蛋", ["番茄", "豆腐"]);
    expect(cardSetKey([tomatoEgg])).not.toBe(cardSetKey([tomatoTofu]));
  });

  it("normalizes whitespace, case, and punctuation in names", () => {
    const noisy = recipe("  Tomato  Egg！ ", ["Tomato", "Egg"]);
    const clean = recipe("tomato-egg", ["egg", "tomato"]);
    expect(cardSetKey([noisy])).toBe(cardSetKey([clean]));
  });
});

describe("buildEntry", () => {
  it("returns null when no card is valid", () => {
    const invalid = { name: "", ingredients: [], steps: [] };
    expect(buildEntry([invalid], { isValid, idFactory: () => "id" })).toBeNull();
  });

  it("filters invalid cards and keeps the ordered names + version 2", () => {
    const good = recipe("A", ["x"]);
    const bad: Recipe = { name: "B", ingredients: [], steps: [] };
    const entry = buildEntry([good, bad], { isValid, idFactory: () => "id-1", now: 123 });
    expect(entry).toMatchObject({
      id: "id-1",
      at: 123,
      names: ["A"],
      version: 2,
      cards: [good],
    });
  });

  it("uses the injected id factory so same-millisecond commits get distinct ids", () => {
    let counter = 0;
    const idFactory = () => `id-${counter++}`;
    const first = buildEntry([recipe("A")], { isValid, idFactory, now: 1 });
    const second = buildEntry([recipe("B")], { isValid, idFactory, now: 1 });
    expect(first?.id).not.toBe(second?.id);
  });
});

describe("pushCardHistory", () => {
  const idFactory = () => `id-${Math.random().toString(36).slice(2)}`;

  it("keeps only the newest 3 groups, newest first", () => {
    let history = pushCardHistory([], [recipe("0", ["0"])], { isValid, idFactory, now: 0 });
    for (let i = 1; i < 5; i += 1) {
      history = pushCardHistory(history, [recipe(String(i), [String(i)])], {
        isValid,
        idFactory,
        now: i,
      });
    }
    expect(history).toHaveLength(3);
    expect(history.map((entry) => entry.names[0])).toEqual(["4", "3", "2"]);
  });

  it("does not add a duplicate of the same card set", () => {
    const cards = [recipe("A", ["x"]), recipe("B", ["y"])];
    const first = pushCardHistory([], cards, { isValid, idFactory, now: 1 });
    const second = pushCardHistory(first, [recipe("B", ["y"]), recipe("A", ["x"])], {
      isValid,
      idFactory,
      now: 2,
    });
    expect(second).toBe(first);
    expect(second).toHaveLength(1);
  });

  it("append that contains every top card updates the top entry in place", () => {
    const a = recipe("A", ["x"]);
    const b = recipe("B", ["y"]);
    const c = recipe("C", ["z"]);
    const first = pushCardHistory([], [a, b], { isValid, idFactory, now: 10 });
    const second = pushCardHistory(first, [a, b, c], {
      isValid,
      idFactory,
      now: 20,
      operation: "append",
    });
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].at).toBe(10);
    expect(second[0].names).toEqual(["A", "B", "C"]);
    expect(second[0].key).toBe(cardSetKey([a, b, c]));
  });

  it("append that does not contain the top cards becomes a new group", () => {
    const first = pushCardHistory([], [recipe("A", ["x"])], { isValid, idFactory, now: 10 });
    const second = pushCardHistory(first, [recipe("B", ["y"])], {
      isValid,
      idFactory,
      now: 20,
      operation: "append",
    });
    expect(second).toHaveLength(2);
    expect(second[0].names).toEqual(["B"]);
  });

  it("ignores an all-invalid commit", () => {
    const first = pushCardHistory([], [recipe("A", ["x"])], { isValid, idFactory, now: 10 });
    const next = pushCardHistory(first, [{ name: "B", ingredients: [], steps: [] }], {
      isValid,
      idFactory,
      now: 20,
    });
    expect(next).toBe(first);
  });
});

describe("sanitizeCardHistory", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeCardHistory(null)).toEqual([]);
    expect(sanitizeCardHistory({})).toEqual([]);
  });

  it("drops entries without names or a numeric at", () => {
    const raw = [
      { id: "1", key: "x", names: [], at: 1 },
      { id: "2", key: "x", names: ["A"] },
      { id: "3", key: "x", names: ["B"], at: 2 },
    ];
    const out = sanitizeCardHistory<Recipe>(raw);
    expect(out).toHaveLength(1);
    expect(out[0].names).toEqual(["B"]);
  });

  it("treats cards: [] as a names-only v1 entry and recomputes the key", () => {
    const out = sanitizeCardHistory<Recipe>([
      { id: "1", key: "old-key", names: [" B ", "a"], at: 5, cards: [] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].cards).toBeUndefined();
    expect(out[0].version).toBe(1);
    expect(out[0].key).toBe("a|b");
  });

  it("recomputes the key from cards and caps at 3", () => {
    const raw = [0, 1, 2, 3].map((index) => ({
      id: String(index),
      key: "stale",
      names: [`Dish${index}`],
      at: index,
      cards: [recipe(`Dish${index}`, [`x${index}`])],
    }));
    const out = sanitizeCardHistory<Recipe>(raw);
    expect(out).toHaveLength(3);
    expect(out[0].key).toBe(cardSetKey([recipe("Dish0", ["x0"])]));
  });
});

describe("matchCardsFromSessions", () => {
  const a = recipe("番茄炒蛋", ["番茄", "雞蛋"]);
  const b = recipe("白飯", ["米"]);
  const c = recipe("例湯", ["水"]);

  it("matches equal normalized names with the same card count", () => {
    const sessions = [{ createdAt: 100, cards: [b, a] }];
    expect(matchCardsFromSessions(["番茄炒蛋", "白飯"], sessions, isValid, 100)).toEqual([b, a]);
  });

  it("rejects a session with fewer or more cards", () => {
    const fewer = [{ createdAt: 100, cards: [a] }];
    const more = [{ createdAt: 100, cards: [a, b, c] }];
    expect(matchCardsFromSessions(["番茄炒蛋", "白飯"], fewer, isValid, 100)).toBeNull();
    expect(matchCardsFromSessions(["番茄炒蛋", "白飯"], more, isValid, 100)).toBeNull();
  });

  it("rejects a session containing an invalid card", () => {
    const invalid: Recipe = { name: "白飯", ingredients: [], steps: [] };
    const sessions = [{ createdAt: 100, cards: [a, invalid] }];
    expect(matchCardsFromSessions(["番茄炒蛋", "白飯"], sessions, isValid, 100)).toBeNull();
  });

  it("picks the closest createdAt, then the latest on a tie", () => {
    const closeOlder = { createdAt: 95, cards: [a, b] };
    const closeNewer = { createdAt: 105, cards: [b, a] };
    const far = { createdAt: 500, cards: [a, b] };
    expect(matchCardsFromSessions(["番茄炒蛋", "白飯"], [far, closeOlder, closeNewer], isValid, 100)).toBe(
      closeNewer.cards,
    );
  });

  it("returns null when no session has cards", () => {
    expect(matchCardsFromSessions(["番茄炒蛋"], [{ createdAt: 1 }], isValid, 1)).toBeNull();
    expect(matchCardsFromSessions(["番茄炒蛋"], [], isValid, 1)).toBeNull();
  });
});
