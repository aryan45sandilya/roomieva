"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SectionMark } from "@/components/brand";
import { RangeSlider } from "@/components/filters-panel";
import { Icon } from "@/components/icons";
import { TwoRooms } from "@/components/illustrations";
import { MatchChip } from "@/components/orbit";
import { Avatar, ChipGroup, EmptyState, ErrorNote, Field, Modal, Pill, SamplePill, VerificationList } from "@/components/ui";
import { LOCALITIES } from "@/lib/constants";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { DEFAULT_PEOPLE_FILTERS, RENT_CEIL, applyPeopleFilters, type PeopleFilters } from "@/lib/filters";
import { cx, firstName, isoDate, rupees, shortDate } from "@/lib/format";
import { QUESTION_BY_ID } from "@/lib/lifestyle";
import type { MatchResult } from "@/lib/matching";
import type { LifestyleAnswers, Profile, QuestionId } from "@/lib/types";

const STAGE_LABEL: Record<Profile["stage"], string> = { professional: "Working", intern: "Interning", student: "Studying" };
const HEADLINE_TRAITS: QuestionId[] = ["sleep", "cleanliness", "food", "social"];
const TINTS = ["bg-paper", "bg-sand/70", "bg-paper", "bg-sage/70", "bg-paper", "bg-sand/70"];

function PersonCard({ person, match, lifestyle, tint }: { person: Profile; match?: MatchResult; lifestyle?: LifestyleAnswers; tint: string }) {
  const traits = HEADLINE_TRAITS.flatMap((id) => {
    const a = lifestyle?.[id];
    return a && a.value !== null ? [QUESTION_BY_ID[id].options[a.value].label] : [];
  }).slice(0, 3);
  return (
    <article className={cx("group relative flex h-full flex-col rounded-[26px] border border-line p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-ink sm:p-6", tint)}>
      <div className="flex items-start justify-between gap-3">
        <Avatar profile={person} size={64} className="transition-transform duration-300 group-hover:-rotate-6" />
        <div className="flex flex-col items-end gap-1.5">
          {match ? <MatchChip result={match} /> : null}
          {person.isDemo && <SamplePill />}
        </div>
      </div>
      <h2 className="display mt-5 text-4xl leading-none">
        <Link href={`/flatmates/${person.id}`} className="after:absolute after:inset-0 after:rounded-[26px]">
          {firstName(person.displayName)}
        </Link>
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        {person.occupation} · {STAGE_LABEL[person.stage]}
      </p>
      {person.bio && <p className="mt-4 line-clamp-3 text-[0.95rem] leading-relaxed">&ldquo;{person.bio}&rdquo;</p>}
      {traits.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {traits.map((t) => (
            <li key={t}>
              <Pill tone="line" className="!text-ink">
                {t}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink/15 pt-4 text-sm [&_dt]:text-[0.6875rem] [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-[0.12em] [&_dt]:text-ink-soft">
        <div>
          <dt>Budget</dt>
          <dd className="font-semibold tabular-nums">Up to {rupees(person.budgetMax)}</dd>
        </div>
        <div>
          <dt>Moving</dt>
          <dd className="font-semibold">{person.moveInBy ? `By ${shortDate(person.moveInBy)}` : "Flexible"}</dd>
        </div>
        <div className="col-span-2">
          <dt>Looking in</dt>
          <dd className="truncate font-semibold">{person.preferredLocalities.join(", ") || "Anywhere in Bengaluru"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between">
        <VerificationList verification={person.verification} compact />
        <span aria-hidden="true" className="flex items-center gap-1.5 text-sm font-semibold">
          View profile <Icon name="arrow" size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

function Flatmates() {
  const params = useSearchParams();
  const { session, lifestyle } = useMe();
  const [filters, setFilters] = useState<PeopleFilters>(DEFAULT_PEOPLE_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULT_PEOPLE_FILTERS };
    const locality = params.get("locality");
    if (locality) next.localities = [locality];
    const max = Number(params.get("max"));
    if (max > 0) next.budgetMax = Math.min(RENT_CEIL, max);
    const by = params.get("by");
    if (by && /^\d{4}-\d{2}-\d{2}$/.test(by)) next.moveInBy = by;
    setFilters(next);
  }, [params]);

  const people = useLive((api) => api.listPeople(), [session?.userId]);
  const ids = useMemo(() => (people.data ?? []).map((p) => p.id), [people.data]);
  const lifestyles = useLive((api) => api.getLifestyles(ids), [ids.join(",")]);
  const { matches } = useMatches(ids);
  const scores = useMemo(() => Object.fromEntries(ids.map((id) => [id, matches[id]?.score ?? null])), [ids, matches]);
  const results = useMemo(() => applyPeopleFilters(people.data ?? [], filters, scores), [people.data, filters, scores]);

  const active =
    Number(filters.localities.length > 0) + Number(filters.budgetMax < RENT_CEIL) + Number(Boolean(filters.moveInBy)) + Number(filters.minMatch > 0) + Number(filters.stage.length > 0);
  const set = <K extends keyof PeopleFilters>(key: K, value: PeopleFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const controls = (
    <div className="space-y-7">
      <ChipGroup legend="Looking in" options={LOCALITIES.map((l) => l.name)} value={filters.localities} onChange={(v) => set("localities", v)} />
      <RangeSlider
        label="Their budget reaches at least"
        value={[filters.budgetMax]}
        onChange={([v]) => set("budgetMax", v)}
        min={8000}
        max={RENT_CEIL}
        step={1000}
        format={([v]) => (v >= RENT_CEIL ? "Any budget" : `Rooms at ${rupees(v)}`)}
      />
      <Field label="Moving by" hint="People who want to be in by this date.">
        {(p) => <input {...p} type="date" className="field" min={isoDate(new Date())} value={filters.moveInBy ?? ""} onChange={(e) => set("moveInBy", e.target.value || null)} />}
      </Field>
      <ChipGroup<Profile["stage"]> legend="Stage of life" options={["professional", "intern", "student"]} label={(o) => STAGE_LABEL[o]} value={filters.stage} onChange={(v) => set("stage", v)} />
      <div className="rounded-2xl bg-sage p-4">
        <RangeSlider label="Lifestyle match" value={[filters.minMatch]} onChange={([v]) => set("minMatch", v)} min={0} max={90} step={10} disabled={!lifestyle} format={([v]) => (v === 0 ? "Any" : `${v}% or higher`)} />
        {!lifestyle && (
          <p className="mt-1 text-xs">
            <Link className="link" href={session ? "/quiz" : "/auth?mode=signup&next=/quiz"}>
              Answer the lifestyle questions
            </Link>{" "}
            to use this.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[linear-gradient(var(--color-sand)_0,var(--color-sand)_360px,transparent_360px)]">
      <div className="shell py-10 md:py-14">
        <header className="grid items-end gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionMark n="02">People</SectionMark>
            <h1 className="display mt-4 text-6xl sm:text-7xl lg:text-8xl">
              Find your <em className="text-clay">people</em>
            </h1>
          </div>
          <div className="flex items-end gap-5">
            <TwoRooms className="hidden w-36 shrink-0 sm:block" />
            <p className="max-w-sm text-ink">People looking for a room, or for someone to go flat-hunting with. First names only. Phone numbers and emails stay private until two people both choose to share.</p>
          </div>
        </header>

        {session && !lifestyle && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 text-ivory">
            <p className="max-w-lg">Answer twelve questions about how you live and everyone here gets a match score you can open up and read.</p>
            <Link href="/quiz" className="btn btn-accent">
              Answer the questions
            </Link>
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-28 rounded-[26px] border border-line bg-paper p-5">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="micro text-ink-soft">Narrow it down</h2>
                {active > 0 && (
                  <button type="button" className="link text-sm" onClick={() => setFilters(DEFAULT_PEOPLE_FILTERS)}>
                    Clear {active}
                  </button>
                )}
              </div>
              {controls}
            </div>
          </aside>

          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink-soft" aria-live="polite">
                {people.loading ? "Looking…" : `${results.length} ${results.length === 1 ? "person" : "people"}${lifestyle ? ", best matches first" : ""}`}
              </p>
              <button type="button" className="btn btn-quiet btn-sm !min-h-[44px] bg-paper lg:hidden" onClick={() => setPanelOpen(true)}>
                <Icon name="sliders" size={16} /> Filters
                {active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-ivory">{active}</span>}
              </button>
            </div>

            {people.error ? (
              <ErrorNote onRetry={people.reload}>{people.error}</ErrorNote>
            ) : people.loading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="rounded-[26px] border border-line bg-paper p-6" aria-hidden="true">
                    <div className="skeleton h-16 w-16 !rounded-full" />
                    <div className="skeleton mt-5 h-9 w-2/3" />
                    <div className="skeleton mt-3 h-3 w-4/5" />
                    <div className="skeleton mt-6 h-16" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                title="Nobody quite like that. Yet."
                action={
                  <button type="button" className="btn btn-ink" onClick={() => setFilters(DEFAULT_PEOPLE_FILTERS)}>
                    Clear filters
                  </button>
                }
              >
                Try a wider budget, another neighbourhood, or a lower match threshold.
              </EmptyState>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p, i) => (
                  <li key={p.id} className={cx(i % 3 === 1 && "xl:translate-y-6")}>
                    <PersonCard person={p} match={matches[p.id]} lifestyle={lifestyles.data?.[p.id]} tint={TINTS[i % TINTS.length]} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Narrow it down"
        variant="full"
        footer={
          <div className="flex gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => setFilters(DEFAULT_PEOPLE_FILTERS)} disabled={active === 0}>
              Clear
            </button>
            <button type="button" className="btn btn-ink flex-1" onClick={() => setPanelOpen(false)}>
              Show {results.length} {results.length === 1 ? "person" : "people"}
            </button>
          </div>
        }
      >
        {controls}
      </Modal>
    </div>
  );
}

export default function FlatmatesPage() {
  return (
    <Suspense fallback={null}>
      <Flatmates />
    </Suspense>
  );
}
