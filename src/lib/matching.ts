/**
 * Roomieva compatibility engine.
 *
 * Deterministic and explainable: the same two sets of answers always give the
 * same score, and every number can be traced to a question.
 *
 *  1. Each question is a spectrum. Similarity = 1 − distance between answers.
 *  2. Questions roll up into categories; a question counts for more when either
 *     person marked it important or non-negotiable.
 *  3. Categories combine by configured weights. A category nobody can be scored
 *     on (skipped answers) is left out and the rest are reweighted, so skipping
 *     a sensitive question never counts against anyone.
 *  4. A non-negotiable answer that the other person doesn't meet is reported as
 *     a dealbreaker AND caps the score, so a high number can never hide it.
 *
 * Only lifestyle answers go in. Nothing about religion, caste, ethnicity,
 * gender or any other protected characteristic is read or scored.
 */
import { CATEGORIES, QUESTIONS, type CategoryId, type Question } from "./lifestyle";
import type { Importance, LifestyleAnswers, QuestionId } from "./types";

export interface MatchConfig {
  categoryWeights: Record<CategoryId, number>;
  importanceMultiplier: Record<Importance, number>;
  /** When both people call a question flexible, the gap between them is softened by this factor. */
  flexibleSoftening: number;
  /** Score ceiling when a non-negotiable is missed by one step / by the whole spectrum. */
  dealbreakerCap: { partial: number; full: number };
  /** Below this share of answerable weight, no score is shown. */
  minCoverage: number;
  bands: { strong: number; good: number; mixed: number };
}

export const DEFAULT_CONFIG: MatchConfig = {
  categoryWeights: Object.fromEntries(CATEGORIES.map((c) => [c.id, c.weight])) as Record<CategoryId, number>,
  importanceMultiplier: { flexible: 0.6, important: 1, dealbreaker: 1.6 },
  flexibleSoftening: 0.6,
  dealbreakerCap: { partial: 69, full: 49 },
  minCoverage: 0.4,
  bands: { strong: 85, good: 70, mixed: 50 },
};

export type Conflict = "none" | "discuss" | "dealbreaker";
export type Band = "strong" | "good" | "mixed" | "low" | "unknown";

export interface QuestionResult {
  id: QuestionId;
  /** Chosen option index for each person, or null when skipped / unanswered. */
  a: number | null;
  b: number | null;
  /** 0–1, or null when it can't be compared. */
  similarity: number | null;
  importance: Importance;
  conflict: Conflict;
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  weight: number;
  /** 0–100, or null when no question in the category could be compared. */
  score: number | null;
  /** Where each person sits on the category's spectrum (0–1), for the Orbit. */
  positionA: number | null;
  positionB: number | null;
  conflict: Conflict;
  questions: QuestionResult[];
}

export interface MatchResult {
  /** 0–100 after any dealbreaker cap, or null when there isn't enough to compare. */
  score: number | null;
  /** The weighted score before caps. */
  rawScore: number | null;
  capped: boolean;
  band: Band;
  label: string;
  /** Share (0–1) of category weight that could be compared. */
  coverage: number;
  categories: CategoryResult[];
  aligned: string[];
  discuss: string[];
  dealbreakers: string[];
}

const RANK: Record<Importance, number> = { flexible: 0, important: 1, dealbreaker: 2 };
const strongest = (x: Importance, y: Importance): Importance => (RANK[x] >= RANK[y] ? x : y);

const position = (q: Question, index: number) => (q.options.length <= 1 ? 0 : index / (q.options.length - 1));

function validIndex(q: Question, v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < q.options.length;
}

export const BAND_LABEL: Record<Band, string> = {
  strong: "Strong lifestyle match",
  good: "Good lifestyle match",
  mixed: "Mixed. Worth a conversation",
  low: "Quite different lifestyles",
  unknown: "Not enough answers to compare",
};

export function bandFor(score: number | null, config: MatchConfig = DEFAULT_CONFIG): Band {
  if (score === null) return "unknown";
  if (score >= config.bands.strong) return "strong";
  if (score >= config.bands.good) return "good";
  if (score >= config.bands.mixed) return "mixed";
  return "low";
}

export function computeMatch(
  a: LifestyleAnswers | null | undefined,
  b: LifestyleAnswers | null | undefined,
  config: MatchConfig = DEFAULT_CONFIG,
): MatchResult {
  const A = a ?? {};
  const B = b ?? {};
  let cap = 100;

  const categories: CategoryResult[] = CATEGORIES.map((cat) => {
    const questions: QuestionResult[] = QUESTIONS.filter((q) => q.category === cat.id).map((q) => {
      const ans1 = A[q.id];
      const ans2 = B[q.id];
      const v1 = validIndex(q, ans1?.value) ? ans1!.value : null;
      const v2 = validIndex(q, ans2?.value) ? ans2!.value : null;
      const importance = strongest(ans1?.importance ?? "flexible", ans2?.importance ?? "flexible");

      if (v1 === null || v2 === null) {
        return { id: q.id, a: v1, b: v2, similarity: null, importance, conflict: "none" };
      }

      const distance = Math.abs(position(q, v1) - position(q, v2));
      const bothFlexible = importance === "flexible";
      const similarity = 1 - distance * (bothFlexible ? config.flexibleSoftening : 1);

      let conflict: Conflict = "none";
      if (importance === "dealbreaker" && distance >= 0.5) {
        conflict = "dealbreaker";
        cap = Math.min(cap, distance >= 1 ? config.dealbreakerCap.full : config.dealbreakerCap.partial);
      } else if (distance >= 1 && !bothFlexible) {
        conflict = "discuss";
      }
      return { id: q.id, a: v1, b: v2, similarity, importance, conflict };
    });

    const scored = questions.filter((r) => r.similarity !== null);
    let score: number | null = null;
    let positionA: number | null = null;
    let positionB: number | null = null;

    if (scored.length > 0) {
      let weightSum = 0;
      let total = 0;
      let pa = 0;
      let pb = 0;
      for (const r of scored) {
        const w = config.importanceMultiplier[r.importance];
        const q = QUESTIONS.find((x) => x.id === r.id)!;
        weightSum += w;
        total += w * (r.similarity as number);
        pa += position(q, r.a as number);
        pb += position(q, r.b as number);
      }
      score = (total / weightSum) * 100;
      positionA = pa / scored.length;
      positionB = pb / scored.length;
    }

    const conflict: Conflict = questions.some((r) => r.conflict === "dealbreaker")
      ? "dealbreaker"
      : questions.some((r) => r.conflict === "discuss")
        ? "discuss"
        : "none";

    return {
      id: cat.id,
      label: cat.label,
      weight: config.categoryWeights[cat.id],
      score,
      positionA,
      positionB,
      conflict,
      questions,
    };
  });

  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);
  const usable = categories.filter((c) => c.score !== null);
  const usableWeight = usable.reduce((s, c) => s + c.weight, 0);
  const coverage = totalWeight === 0 ? 0 : usableWeight / totalWeight;

  let rawScore: number | null = null;
  let score: number | null = null;
  if (usableWeight > 0 && coverage >= config.minCoverage) {
    const weighted = usable.reduce((s, c) => s + c.weight * (c.score as number), 0) / usableWeight;
    rawScore = Math.round(Math.min(100, Math.max(0, weighted)));
    score = Math.min(rawScore, cap);
  }

  const band = bandFor(score, config);
  const { aligned, discuss, dealbreakers } = explain(categories, config);

  return {
    score,
    rawScore,
    capped: score !== null && rawScore !== null && score < rawScore,
    band,
    label: BAND_LABEL[band],
    coverage,
    categories,
    aligned,
    discuss,
    dealbreakers,
  };
}

const joinAnd = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

function explain(categories: CategoryResult[], config: MatchConfig) {
  const all = categories.flatMap((c) => c.questions.map((r) => ({ r, cat: c })));
  const heft = (x: (typeof all)[number]) => x.cat.weight * config.importanceMultiplier[x.r.importance];
  const q = (id: QuestionId) => QUESTIONS.find((x) => x.id === id)!;

  const same = all
    .filter((x) => x.r.similarity !== null && x.r.a === x.r.b)
    .sort((x, y) => heft(y) - heft(x));

  const aligned: string[] = [];
  if (same.length > 0) {
    const top = same.slice(0, 3).map((x) => q(x.r.id).shared[x.r.a as number]);
    aligned.push(`You both ${joinAnd(top)}.`);
  }
  if (same.length > 3) {
    const rest = same.slice(3, 6).map((x) => q(x.r.id).topic);
    aligned.push(`You also line up on ${joinAnd(rest)}.`);
  }

  const discuss = all
    .filter((x) => x.r.conflict === "discuss")
    .sort((x, y) => heft(y) - heft(x))
    .map((x) => `Your preferences around ${q(x.r.id).topic} differ.`);

  const dealbreakers = all
    .filter((x) => x.r.conflict === "dealbreaker")
    .sort((x, y) => heft(y) - heft(x))
    .map((x) => {
      const topic = q(x.r.id).topic;
      return `One of you marked ${topic} as non-negotiable, and your answers don't meet.`;
    });

  return { aligned, discuss, dealbreakers };
}

/** How many of the questions a person has answered (skips don't count). */
export function answeredCount(answers: LifestyleAnswers | null | undefined) {
  if (!answers) return 0;
  return QUESTIONS.filter((q) => validIndex(q, answers[q.id]?.value)).length;
}

/** True once every question has been either answered or deliberately skipped. */
export function quizComplete(answers: LifestyleAnswers | null | undefined) {
  if (!answers) return false;
  return QUESTIONS.every((q) => answers[q.id] !== undefined);
}
