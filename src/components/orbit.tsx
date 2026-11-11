"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { QUESTION_BY_ID } from "@/lib/lifestyle";
import type { CategoryResult, MatchResult, QuestionResult } from "@/lib/matching";
import { Icon } from "./icons";

/**
 * Compatibility Orbit.
 *
 * Seven rings, one per lifestyle category; heavier categories sit further out.
 * On each ring two markers (you: solid, them: open) start far apart and travel
 * toward each other. How close they end up IS the category score, so a ring
 * where the markers interlock is a match and a ring with a long arc between
 * them is a gap. Conflicts are drawn in terracotta and repeated as text.
 */

const SIZE = 340;
const C = SIZE / 2;
const SPAN = 150;

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};

function arcPath(r: number, from: number, to: number) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function useCountUp(target: number | null, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target === null || !run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

const questionStatus = (q: QuestionResult) => {
  if (q.similarity === null) return { text: "Not compared", tone: "muted" as const };
  if (q.conflict === "dealbreaker") return { text: "Non-negotiable clash", tone: "clash" as const };
  if (q.conflict === "discuss") return { text: "Far apart", tone: "clash" as const };
  if (q.a === q.b) return { text: "Same", tone: "same" as const };
  return { text: "Close", tone: "close" as const };
};

export function CompatibilityOrbit({
  result,
  them,
  you = "You",
  className,
  defaultOpen = null,
}: {
  result: MatchResult;
  them: string;
  you?: string;
  className?: string;
  defaultOpen?: CategoryResult["id"] | null;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [selected, setSelected] = useState<CategoryResult["id"] | null>(defaultOpen);
  const score = useCountUp(result.score, seen);
  // Outer ring = heaviest category.
  const rings = [...result.categories].reverse();

  return (
    <div ref={ref} className={cx("grid items-start gap-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-10", className)}>
      <div className="mx-auto w-full max-w-[340px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={result.score === null ? "Not enough answers to compare" : `Compatibility ${result.score} percent. ${result.label}.`}>
          {rings.map((cat, i) => {
            const r = 58 + i * 15;
            const mid = -90 + (i - 3) * 14;
            const known = cat.score !== null;
            const gap = known ? (1 - (cat.score as number) / 100) * SPAN : SPAN;
            const a = mid - (seen ? gap : SPAN) / 2;
            const b = mid + (seen ? gap : SPAN) / 2;
            const clash = cat.conflict !== "none";
            const dim = selected !== null && selected !== cat.id;
            const [mx, my] = polar(r, mid);
            return (
              <g key={cat.id} opacity={dim ? 0.3 : 1} style={{ transition: "opacity 200ms ease" }}>
                <circle
                  cx={C}
                  cy={C}
                  r={r}
                  fill="none"
                  stroke={selected === cat.id ? "var(--color-ink)" : "var(--color-line)"}
                  strokeWidth={selected === cat.id ? 1.5 : 1}
                  strokeDasharray={known ? undefined : "2 5"}
                />
                {known && (
                  <>
                    <path
                      d={arcPath(r, mid - gap / 2, mid + gap / 2)}
                      fill="none"
                      stroke={clash ? "var(--color-terracotta)" : "var(--color-olive)"}
                      strokeWidth={clash ? 5 : 3}
                      strokeLinecap="round"
                      opacity={seen ? (clash ? 1 : 0.55) : 0}
                      style={{ transition: "opacity 400ms ease 700ms" }}
                    />
                    <g style={{ transform: `rotate(${a}deg)`, transformOrigin: `${C}px ${C}px`, transformBox: "view-box", transition: `transform 900ms cubic-bezier(0.22,0.8,0.26,1) ${i * 50}ms` }}>
                      <circle cx={C + r} cy={C} r={5} fill="var(--color-ink)" />
                    </g>
                    <g style={{ transform: `rotate(${b}deg)`, transformOrigin: `${C}px ${C}px`, transformBox: "view-box", transition: `transform 900ms cubic-bezier(0.22,0.8,0.26,1) ${i * 50}ms` }}>
                      <circle cx={C + r} cy={C} r={6.5} fill="none" stroke="var(--color-ink)" strokeWidth={1.75} />
                    </g>
                    {clash && (
                      <g opacity={seen ? 1 : 0} style={{ transition: "opacity 300ms ease 1000ms" }}>
                        <circle cx={mx} cy={my} r={7} fill="var(--color-ivory)" stroke="var(--color-clay)" strokeWidth={1.25} />
                        <path d={`M${mx} ${my - 3.5}v4M${mx} ${my + 3}v.5`} stroke="var(--color-clay)" strokeWidth={1.5} strokeLinecap="round" />
                      </g>
                    )}
                  </>
                )}
                {/* generous invisible hit area */}
                <circle cx={C} cy={C} r={r} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} onClick={() => setSelected(selected === cat.id ? null : cat.id)} />
              </g>
            );
          })}
          <text x={C} y={C + 6} textAnchor="middle" fontFamily="var(--font-display)" fontSize="46" fill="var(--color-ink)">
            {result.score === null ? "–" : score}
          </text>
          {result.score !== null && (
            <text x={C} y={C + 24} textAnchor="middle" fontSize="9" letterSpacing="1.6" fontWeight="600" fill="var(--color-ink-soft)">
              OUT OF 100
            </text>
          )}
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" /> {you}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-[1.75px] border-ink" /> {them}
          </span>
          <span>Closer together means more alike</span>
        </div>
      </div>

      <div>
        <ul className="divide-y divide-line border-y border-line">
          {result.categories.map((cat) => {
            const open = selected === cat.id;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setSelected(open ? null : cat.id)}
                  className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left"
                >
                  <span className="flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      {cat.label}
                      {cat.conflict !== "none" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-clay">
                          <Icon name="alert" size={13} />
                          {cat.conflict === "dealbreaker" ? "Non-negotiable" : "Discuss"}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-sand" aria-hidden="true">
                      <span
                        className={cx("block h-full rounded-full transition-[width] duration-700 ease-out", cat.conflict !== "none" ? "bg-terracotta" : "bg-olive")}
                        style={{ width: seen && cat.score !== null ? `${cat.score}%` : "0%" }}
                      />
                    </span>
                  </span>
                  <span className="w-14 text-right text-sm tabular-nums text-ink-soft">{cat.score === null ? "Skipped" : `${Math.round(cat.score)}%`}</span>
                  <Icon name="chevronDown" size={16} className={cx("text-ink-soft transition-transform duration-200", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="pb-4 [animation:fade-in_200ms_ease-out]">
                    <p className="mb-2 text-xs text-ink-soft">Counts for {cat.weight}% of the overall score.</p>
                    <ul className="space-y-2">
                      {cat.questions.map((q) => {
                        const def = QUESTION_BY_ID[q.id];
                        const status = questionStatus(q);
                        return (
                          <li key={q.id} className="rounded-xl bg-sand/70 px-3 py-2.5 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{def.short}</span>
                              <span
                                className={cx(
                                  "inline-flex items-center gap-1 text-xs font-semibold",
                                  status.tone === "clash" ? "text-clay" : status.tone === "muted" ? "text-ink-soft" : "text-olive-deep",
                                )}
                              >
                                {status.tone === "clash" && <Icon name="alert" size={12} />}
                                {status.tone === "same" && <Icon name="check" size={12} />}
                                {status.text}
                              </span>
                            </div>
                            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-ink-soft">
                              <dt>{you}:</dt>
                              <dd className="text-ink">{q.a === null ? "Skipped" : def.options[q.a].label}</dd>
                              <dt>{them}:</dt>
                              <dd className="text-ink">{q.b === null ? "Skipped" : def.options[q.b].label}</dd>
                            </dl>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {result.coverage < 1 && result.score !== null && (
          <p className="mt-3 text-xs text-ink-soft">
            Based on {Math.round(result.coverage * 100)}% of the categories. Skipped questions are left out, not counted against anyone.
          </p>
        )}
      </div>
    </div>
  );
}

/** The sentence-level explanation that sits next to an Orbit. */
export function MatchStory({ result, them }: { result: MatchResult; them: string }) {
  if (result.score === null) {
    return <p className="text-ink-soft">There aren&apos;t enough answers in common to compare you and {them} yet.</p>;
  }
  const talk = [...result.dealbreakers, ...result.discuss];
  return (
    <div className="space-y-4">
      <p className="display text-3xl sm:text-4xl">
        {result.score}% <span className="text-ink-soft">·</span> {result.label}
      </p>
      {result.capped && (
        <p className="text-sm text-clay">
          Your answers alone would score {result.rawScore}%. We hold the number down because a non-negotiable isn&apos;t met.
        </p>
      )}
      {result.aligned.map((line) => (
        <p key={line} className="flex gap-2.5">
          <Icon name="check" size={18} className="mt-1 shrink-0 text-olive-deep" />
          <span>{line}</span>
        </p>
      ))}
      {talk.length > 0 && (
        <div className="rounded-2xl border border-clay/40 bg-terracotta/10 p-4">
          <p className="micro mb-2 text-clay">{result.dealbreakers.length ? "Talk about this first" : "Something to discuss"}</p>
          <ul className="space-y-1.5 text-sm">
            {talk.map((line) => (
              <li key={line} className="flex gap-2">
                <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-clay" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-ink-soft">A preference estimate from both sets of lifestyle answers. It isn&apos;t a guarantee that living together will work.</p>
    </div>
  );
}

/** Compact score for cards. Always carries words, never colour alone. */
export function MatchChip({ result, className }: { result: MatchResult | undefined; className?: string }) {
  if (!result || result.score === null) return null;
  const flags = result.dealbreakers.length + result.discuss.length;
  const tone =
    result.band === "strong" || result.band === "good" ? "bg-sage text-ink" : result.band === "mixed" ? "bg-sand text-ink" : "bg-terracotta/15 text-clay";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap", tone, className)}>
      <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
        <circle cx="4.5" cy="5" r="3.5" fill="currentColor" />
        <circle cx="9.5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
      {result.score}% match
      {flags > 0 && (
        <span className="inline-flex items-center gap-0.5 border-l border-current/30 pl-1.5 font-medium">
          <Icon name="alert" size={11} />
          {flags}
          <span className="sr-only"> to discuss</span>
        </span>
      )}
    </span>
  );
}
