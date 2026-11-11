import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./lifestyle";
import { DEFAULT_CONFIG, computeMatch, quizComplete, answeredCount } from "./matching";
import type { Importance, LifestyleAnswers, QuestionId } from "./types";

const all = (value: number, importance: Importance = "important"): LifestyleAnswers =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, { value, importance }]));

const withAnswer = (base: LifestyleAnswers, id: QuestionId, value: number | null, importance: Importance = "important") => ({
  ...base,
  [id]: { value, importance },
});

describe("computeMatch", () => {
  it("scores identical answers at 100", () => {
    const r = computeMatch(all(1), all(1));
    expect(r.score).toBe(100);
    expect(r.band).toBe("strong");
    expect(r.discuss).toEqual([]);
    expect(r.dealbreakers).toEqual([]);
  });

  it("scores opposite answers at 0 and names what differs", () => {
    const r = computeMatch(all(0), all(2));
    expect(r.score).toBe(0);
    expect(r.band).toBe("low");
    expect(r.discuss.length).toBe(QUESTIONS.length);
  });

  it("is symmetric and deterministic", () => {
    const a = withAnswer(withAnswer(all(1), "sleep", 0), "guests", 2, "dealbreaker");
    const b = withAnswer(all(1), "cleanliness", 2, "flexible");
    const r1 = computeMatch(a, b);
    const r2 = computeMatch(b, a);
    expect(r1.score).toBe(r2.score);
    expect(computeMatch(a, b)).toEqual(r1);
  });

  it("stays within 0–100", () => {
    for (const x of [0, 1, 2]) {
      for (const y of [0, 1, 2]) {
        const s = computeMatch(all(x, "dealbreaker"), all(y, "flexible")).score!;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });

  it("applies the configured category weights", () => {
    // Only cleanliness (20%) is fully opposite; everything else matches.
    const r = computeMatch(all(0), withAnswer(all(0), "cleanliness", 2));
    expect(r.score).toBe(80);
    // Only sleep (15%) is fully opposite.
    expect(computeMatch(all(0), withAnswer(all(0), "sleep", 2)).score).toBe(85);
  });

  it("reweights fairly when a question is skipped", () => {
    // Skipping the only cleanliness question removes that category entirely.
    const a = withAnswer(all(1), "cleanliness", null);
    const r = computeMatch(a, all(1));
    expect(r.score).toBe(100);
    expect(r.coverage).toBeCloseTo(0.8);
    expect(r.categories.find((c) => c.id === "cleanliness")!.score).toBeNull();
  });

  it("does not penalise a skipped question inside a category", () => {
    const a = withAnswer(all(1), "drinking", null);
    const r = computeMatch(a, all(1));
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(1);
  });

  it("withholds a score when too little can be compared", () => {
    const a: LifestyleAnswers = { sleep: { value: 0, importance: "important" } };
    const r = computeMatch(a, all(0));
    expect(r.score).toBeNull();
    expect(r.band).toBe("unknown");
  });

  it("handles missing answers without throwing", () => {
    expect(computeMatch(null, undefined).score).toBeNull();
    expect(computeMatch({}, all(1)).score).toBeNull();
  });

  it("ignores out-of-range answer values", () => {
    const a = withAnswer(all(1), "sleep", 9);
    const r = computeMatch(a, all(1));
    expect(r.categories.find((c) => c.id === "sleep")!.score).toBeNull();
  });

  it("softens gaps when both people are flexible", () => {
    const flexible = computeMatch(all(0, "flexible"), all(2, "flexible")).score!;
    const firm = computeMatch(all(0, "important"), all(2, "important")).score!;
    expect(flexible).toBeGreaterThan(firm);
    expect(flexible).toBe(Math.round((1 - DEFAULT_CONFIG.flexibleSoftening) * 100));
  });

  it("gives important questions more pull inside a category", () => {
    // food category: `food` differs fully, `cooking` matches.
    const base = all(1, "flexible");
    const b = all(1, "flexible");
    const mild = computeMatch(withAnswer(base, "food", 0, "important"), withAnswer(b, "food", 2, "flexible"));
    const strong = computeMatch(withAnswer(base, "food", 0, "important"), withAnswer(b, "food", 2, "important"));
    expect(mild.score).toBe(strong.score); // strongest importance of the pair is what counts
    const cat = strong.categories.find((c) => c.id === "food")!;
    // weights: food=1 (important) at 0, cooking=0.6 (flexible) at 1 → 0.6/1.6
    expect(cat.score).toBeCloseTo((0.6 / 1.6) * 100);
  });

  it("never hides a dealbreaker behind a high score", () => {
    const a = withAnswer(all(1), "smoking", 0, "dealbreaker");
    const b = withAnswer(all(1), "smoking", 2);
    const r = computeMatch(a, b);
    expect(r.rawScore!).toBeGreaterThan(DEFAULT_CONFIG.dealbreakerCap.full);
    expect(r.score).toBe(DEFAULT_CONFIG.dealbreakerCap.full);
    expect(r.capped).toBe(true);
    expect(r.dealbreakers).toHaveLength(1);
    expect(r.dealbreakers[0]).toContain("smoking at home");
    expect(r.band).toBe("low");
  });

  it("uses the softer cap for a one-step miss on a non-negotiable", () => {
    const a = withAnswer(all(1), "smoking", 0, "dealbreaker");
    const r = computeMatch(a, all(1));
    expect(r.score).toBe(DEFAULT_CONFIG.dealbreakerCap.partial);
    expect(r.dealbreakers).toHaveLength(1);
  });

  it("does not flag a non-negotiable that is met", () => {
    const a = withAnswer(all(1), "smoking", 0, "dealbreaker");
    const b = withAnswer(all(1), "smoking", 0);
    const r = computeMatch(a, b);
    expect(r.dealbreakers).toEqual([]);
    expect(r.capped).toBe(false);
  });

  it("explains alignment in plain language", () => {
    const r = computeMatch(all(1), all(1));
    expect(r.aligned[0]).toMatch(/^You both /);
    expect(r.aligned[0]).toContain("like a tidy home");
  });

  it("respects a custom configuration", () => {
    const config = { ...DEFAULT_CONFIG, categoryWeights: { ...DEFAULT_CONFIG.categoryWeights, cleanliness: 0 } };
    const r = computeMatch(all(0), withAnswer(all(0), "cleanliness", 2), config);
    expect(r.score).toBe(100);
  });

  it("category weights add up to 100", () => {
    const sum = Object.values(DEFAULT_CONFIG.categoryWeights).reduce((s, w) => s + w, 0);
    expect(sum).toBe(100);
  });
});

describe("quiz progress helpers", () => {
  it("counts answers and treats skips as complete but unanswered", () => {
    const a = withAnswer(all(1), "food", null);
    expect(answeredCount(a)).toBe(QUESTIONS.length - 1);
    expect(quizComplete(a)).toBe(true);
    expect(quizComplete({ sleep: { value: 1, importance: "flexible" } })).toBe(false);
  });
});
