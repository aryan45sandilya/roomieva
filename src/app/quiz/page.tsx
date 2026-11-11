"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { TwoRooms } from "@/components/illustrations";
import { MatchChip } from "@/components/orbit";
import { Avatar, ErrorNote, Pill, SignInGate } from "@/components/ui";
import { errorMessage, getApi } from "@/lib/data/api";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { cx, firstName } from "@/lib/format";
import { CATEGORIES, IMPORTANCE_HINT, IMPORTANCE_LABEL, QUESTIONS } from "@/lib/lifestyle";
import { answeredCount } from "@/lib/matching";
import type { Answer, Importance, LifestyleAnswers } from "@/lib/types";

const IMPORTANCES: Importance[] = ["flexible", "important", "dealbreaker"];

/** Where an option sits on its question's spectrum, drawn as a dot on a line. */
function SpectrumGlyph({ index, count, on }: { index: number; count: number; on: boolean }) {
  const x = 6 + (index / Math.max(1, count - 1)) * 36;
  return (
    <svg width="48" height="14" viewBox="0 0 48 14" aria-hidden="true" className="shrink-0">
      <path d="M6 7h36M6 4v6M24 5v4M42 4v6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <circle cx={x} cy="7" r={on ? 5 : 3.5} fill={on ? "var(--color-terracotta)" : "currentColor"} style={{ transition: "r 180ms ease, fill 180ms ease" }} />
    </svg>
  );
}

function Quiz() {
  const params = useSearchParams();
  const first = params.get("first") === "1";
  const { session, profile, lifestyle, loading } = useMe();

  const [answers, setAnswers] = useState<LifestyleAnswers | null>(null);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  const answersRef = useRef<LifestyleAnswers | null>(null);

  // Pick up where the person left off: saved answers load once, then local state leads.
  useEffect(() => {
    if (seeded.current || loading || !session) return;
    seeded.current = true;
    const saved = lifestyle ?? {};
    answersRef.current = saved;
    setAnswers(saved);
    const firstOpen = QUESTIONS.findIndex((q) => saved[q.id] === undefined);
    setIndex(firstOpen === -1 ? 0 : firstOpen);
  }, [lifestyle, loading, session]);

  const persist = useCallback(async (next: LifestyleAnswers) => {
    setSaveState("saving");
    try {
      const api = await getApi();
      await api.saveMyLifestyle(next);
      setSaveState("saved");
      setError(null);
    } catch (e) {
      setSaveState("error");
      setError(errorMessage(e));
    }
  }, []);

  const q = QUESTIONS[index];
  const current: Answer | undefined = answers?.[q.id];

  const update = useCallback(
    (patch: Partial<Answer>) => {
      const base = answersRef.current ?? {};
      const existing = base[q.id] ?? { value: null, importance: "important" as Importance };
      const next = { ...base, [q.id]: { ...existing, ...patch } };
      answersRef.current = next;
      setAnswers(next);
      void persist(next);
    },
    [q.id, persist],
  );

  const move = useCallback(
    (delta: 1 | -1) => {
      if (delta === 1 && index === QUESTIONS.length - 1) {
        setDone(true);
        window.scrollTo({ top: 0 });
        return;
      }
      setDir(delta);
      setIndex((i) => Math.min(QUESTIONS.length - 1, Math.max(0, i + delta)));
    },
    [index],
  );

  const skip = () => {
    update({ value: null });
    move(1);
  };

  // 1–3 pick an option, Enter moves on.
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "radio")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) update({ value: n - 1 });
      else if (e.key === "Enter" && current && current.value !== null && target.tagName !== "BUTTON" && target.tagName !== "A") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, current, update, move, done]);

  if (session === undefined || (session && answers === null)) {
    return (
      <div className="shell py-16">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-24 w-4/5" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      </div>
    );
  }
  if (!session) return <SignInGate next="/quiz" title="Log in to answer">Your lifestyle answers are saved to your account so you can pick up where you left off.</SignInGate>;

  if (done) return <Complete answers={answers ?? {}} first={first} name={firstName(profile?.displayName ?? "")} next={params.get("next")} onEdit={() => { setDone(false); setIndex(0); }} />;

  const answered = current !== undefined && current.value !== null;
  const category = CATEGORIES.find((c) => c.id === q.category)!;

  return (
    <MotionConfig reducedMotion="user">
      <div className="shell flex flex-1 flex-col py-6 md:py-12">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          {/* progress as a ruler: one tick per question */}
          <div className="mb-8 md:mb-12">
            <div className="mb-3 flex items-center justify-between">
              <p className="micro text-ink-soft">
                <span className="tabular-nums text-ink">{String(index + 1).padStart(2, "0")}</span> / {QUESTIONS.length} · {category.label}
              </p>
              <p className="text-xs text-ink-soft" aria-live="polite">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : ""}
              </p>
            </div>
            <ol className="flex items-end gap-1" aria-label="Questions">
              {QUESTIONS.map((item, i) => {
                const a = answers?.[item.id];
                const state = i === index ? "current" : a === undefined ? "todo" : a.value === null ? "skipped" : "done";
                return (
                  <li key={item.id} className="flex-1">
                    <button
                      type="button"
                      onClick={() => { setDir(i > index ? 1 : -1); setIndex(i); }}
                      aria-label={`Question ${i + 1}: ${item.short}${state === "done" ? ", answered" : state === "skipped" ? ", skipped" : ""}`}
                      aria-current={i === index ? "step" : undefined}
                      className="group flex h-8 w-full items-end"
                    >
                      <span
                        className={cx(
                          "w-full rounded-full transition-all duration-300",
                          state === "current" ? "h-3 bg-terracotta" : state === "done" ? "h-1.5 bg-ink" : state === "skipped" ? "h-1.5 bg-ink/30" : "h-1.5 bg-line group-hover:bg-ink/40",
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: dir * 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dir * -16 }}
              transition={{ duration: 0.26, ease: [0.22, 0.8, 0.26, 1] }}
              className="flex-1"
            >
              <fieldset>
                <legend className="display mb-8 text-[2.5rem] leading-[1.05] sm:text-6xl">{q.prompt}</legend>
                <div className="space-y-3">
                  {q.options.map((o, i) => {
                    const on = current?.value === i;
                    return (
                      <label
                        key={o.label}
                        className={cx(
                          "flex min-h-[72px] cursor-pointer items-center gap-4 rounded-2xl border px-5 py-4 transition-[background-color,border-color,color,transform] duration-200",
                          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
                          on ? "translate-x-1.5 border-ink bg-ink text-ivory" : "border-line bg-paper hover:border-ink",
                        )}
                      >
                        <input type="radio" name={q.id} className="sr-only" checked={on} onChange={() => update({ value: i })} />
                        <span className="flex-1">
                          <span className="block text-lg font-semibold">{o.label}</span>
                          <span className={cx("block text-sm", on ? "text-ivory/75" : "text-ink-soft")}>{o.hint}</span>
                        </span>
                        <SpectrumGlyph index={i} count={q.options.length} on={on} />
                        <kbd className={cx("hidden h-6 w-6 items-center justify-center rounded border text-xs md:flex", on ? "border-ivory/40" : "border-line text-ink-soft")}>{i + 1}</kbd>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className={cx("mt-8 transition-opacity duration-200", !answered && "opacity-40")} disabled={!answered}>
                <legend className="mb-2 text-sm font-semibold">How much does this matter to you?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {IMPORTANCES.map((level) => {
                    const on = answered && current?.importance === level;
                    return (
                      <label
                        key={level}
                        className={cx(
                          "flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors duration-150",
                          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
                          on ? (level === "dealbreaker" ? "border-clay bg-terracotta/15" : "border-ink bg-sand") : "border-line hover:border-ink",
                        )}
                      >
                        <input type="radio" name={`${q.id}-importance`} className="sr-only" checked={on} onChange={() => update({ importance: level })} />
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {on && <Icon name="check" size={13} />}
                          {IMPORTANCE_LABEL[level]}
                        </span>
                        <span className="hidden text-xs text-ink-soft xs:block">{IMPORTANCE_HINT[level]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </motion.div>
          </AnimatePresence>

          {error && <ErrorNote className="mt-6" onRetry={() => answers && persist(answers)}>{error}</ErrorNote>}
        </div>

        <div className="sticky bottom-0 -mx-[1.125rem] mt-8 border-t border-line bg-ivory/95 px-[1.125rem] pt-3 backdrop-blur-sm md:static md:mx-auto md:w-full md:max-w-2xl md:border-0 md:bg-transparent md:px-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous question">
              <Icon name="back" size={16} /> <span className="max-xs:sr-only">Back</span>
            </button>
            <button type="button" className="btn ml-auto text-ink-soft hover:bg-sand hover:text-ink" onClick={skip}>
              {q.sensitive ? "Prefer not to say" : "Skip"}
            </button>
            <button type="button" className="btn btn-ink min-w-[7.5rem]" onClick={() => move(1)} disabled={!answered}>
              {index === QUESTIONS.length - 1 ? "Finish" : "Next"} <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function Complete({ answers, first, name, next, onEdit }: { answers: LifestyleAnswers; first: boolean; name: string; next: string | null; onEdit: () => void }) {
  const { profile } = useMe();
  const people = useLive((api) => api.listPeople(), []);
  const ids = useMemo(() => (people.data ?? []).map((p) => p.id), [people.data]);
  const { matches } = useMatches(ids);
  const top = useMemo(
    () =>
      (people.data ?? [])
        .filter((p) => matches[p.id]?.score != null)
        .sort((a, b) => (matches[b.id].score ?? 0) - (matches[a.id].score ?? 0))
        .slice(0, 3),
    [people.data, matches],
  );
  const count = answeredCount(answers);
  const firm = QUESTIONS.filter((q) => answers[q.id]?.value != null && answers[q.id]?.importance === "dealbreaker");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <div className="shell py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="micro mb-4 flex items-center gap-2 text-olive-deep">
            <Icon name="check" size={14} /> {count} of {QUESTIONS.length} answered and saved
          </p>
          <h1 className="display text-5xl sm:text-7xl">{first ? <>You&apos;re in{name ? `, ${name}` : ""}.</> : "That's how you live."}</h1>
          <p className="mt-4 max-w-md text-ink-soft">
            {count < 5
              ? "You skipped most questions, which is fine, but we need a few more answers before we can show match scores. You can come back any time."
              : "Every home and person on Roomieva now shows how well they fit these answers, and where you'd need to talk."}
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
            {QUESTIONS.map((q) => {
              const a = answers[q.id];
              if (!a || a.value === null) return null;
              return (
                <li key={q.id}>
                  <Pill tone={a.importance === "dealbreaker" ? "clay" : a.importance === "important" ? "sage" : "sand"} icon={a.importance === "dealbreaker" ? "lock" : undefined}>
                    {q.options[a.value].label}
                  </Pill>
                </li>
              );
            })}
          </ul>
          {firm.length > 0 && <p className="mt-3 text-xs text-ink-soft">Outlined in clay: your non-negotiables. A mismatch on these is always shown and caps the score.</p>}

          <div className="mt-10 flex flex-wrap gap-3">
            {safeNext ? (
              <Link href={safeNext} className="btn btn-ink">
                Continue where you were <Icon name="arrow" size={16} />
              </Link>
            ) : profile?.intent === "listing" ? (
              <Link href="/list" className="btn btn-ink">
                List your room <Icon name="arrow" size={16} />
              </Link>
            ) : (
              <Link href="/explore" className="btn btn-ink">
                Explore homes <Icon name="arrow" size={16} />
              </Link>
            )}
            <Link href="/flatmates" className="btn btn-line">
              Meet people
            </Link>
            <button type="button" className="btn text-ink-soft hover:bg-sand" onClick={onEdit}>
              Review my answers
            </button>
          </div>
        </div>

        <aside className="rounded-[28px] bg-sage p-6 sm:p-8">
          <TwoRooms className="mb-6 w-40" />
          <h2 className="display text-3xl">People who live like you</h2>
          {people.loading ? (
            <div className="mt-5 space-y-3">
              <div className="skeleton h-16 !bg-ivory/60" />
              <div className="skeleton h-16 !bg-ivory/60" />
            </div>
          ) : top.length === 0 ? (
            <p className="mt-4 text-sm">No close matches to show yet. As more people join and answer, they&apos;ll appear here.</p>
          ) : (
            <ul className="mt-5 space-y-2">
              {top.map((p) => (
                <li key={p.id}>
                  <Link href={`/flatmates/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-ivory p-3 transition-transform duration-200 hover:translate-x-1">
                    <Avatar profile={p} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{firstName(p.displayName)}</span>
                      <span className="block truncate text-sm text-ink-soft">{p.occupation}</span>
                    </span>
                    <MatchChip result={matches[p.id]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-xs text-ink">Scores are a preference estimate, not a promise. Meet people before you decide.</p>
        </aside>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <Quiz />
    </Suspense>
  );
}
