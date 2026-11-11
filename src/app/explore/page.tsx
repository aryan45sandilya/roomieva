"use client";

import { LayoutGroup, MotionConfig, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FiltersPanel, resetFilters } from "@/components/filters-panel";
import { Icon } from "@/components/icons";
import { ListingCard, ListingCardSkeleton, SaveButton } from "@/components/listing";
import { MatchChip } from "@/components/orbit";
import { EmptyState, ErrorNote, Modal, Photo, Pill } from "@/components/ui";
import { ROOM_TYPE_LABEL } from "@/lib/constants";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { DEFAULT_FILTERS, RENT_CEIL, RENT_FLOOR, applyFilters, countActive, type ListingFilters, type SortKey } from "@/lib/filters";
import { availability, cx, rupees } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import type { Listing, RoomType } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full !rounded-none" />,
});

const SORTS: [SortKey, string][] = [
  ["relevance", "Best fit"],
  ["rent_low", "Rent: low to high"],
  ["rent_high", "Rent: high to low"],
  ["newest", "Newest"],
  ["available", "Available soonest"],
];

const STORE_KEY = "saha.explore";

function initialFilters(params: URLSearchParams): { filters: ListingFilters; view: "grid" | "map" } {
  const fromUrl = params.has("locality") || params.has("max") || params.has("by") || params.has("type");
  if (!fromUrl) {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { filters: ListingFilters; view: "grid" | "map" };
        return { filters: { ...DEFAULT_FILTERS, ...parsed.filters }, view: params.get("view") === "map" ? "map" : parsed.view };
      }
    } catch {
      /* fall through to defaults */
    }
  }
  const filters = { ...DEFAULT_FILTERS };
  const locality = params.get("locality");
  if (locality) filters.localities = [locality];
  const max = Number(params.get("max"));
  if (max >= RENT_FLOOR) filters.rentMax = Math.min(RENT_CEIL, max);
  const by = params.get("by");
  if (by && /^\d{4}-\d{2}-\d{2}$/.test(by)) filters.moveInBy = by;
  const type = params.get("type");
  if (type === "private" || type === "entire" || type === "shared") filters.roomTypes = type === "private" ? ["private", "shared"] : [type as RoomType];
  return { filters, view: params.get("view") === "map" ? "map" : "grid" };
}

/** Compact horizontal card for the list beside the map. */
function ListingRow({ listing, match, active, onHover }: { listing: Listing; match?: MatchResult; active: boolean; onHover: (id: string | null) => void }) {
  return (
    <article
      id={`row-${listing.id}`}
      onMouseEnter={() => onHover(listing.id)}
      onFocus={() => onHover(listing.id)}
      className={cx("group relative flex gap-3 rounded-2xl border bg-paper p-2.5 transition-[border-color,box-shadow] duration-200", active ? "border-ink shadow-lift" : "border-line")}
    >
      <Photo src={listing.photos[0]?.url} alt={listing.photos[0]?.alt ?? ""} sizes="140px" className="h-[104px] w-[104px] shrink-0 rounded-xl xs:w-[124px]" imgClassName="transition-transform duration-500 group-hover:scale-105" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <p className="micro truncate text-ink-soft">
          {listing.locality} · {availability(listing.availableFrom)}
        </p>
        <h3 className="display mt-1 line-clamp-2 text-xl leading-[1.1]">
          <Link href={`/homes/${listing.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {listing.title}
          </Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{rupees(listing.rent)}</span>
            <span className="text-ink-soft"> / mo · {ROOM_TYPE_LABEL[listing.roomType]}</span>
          </p>
          {match && <MatchChip result={match} />}
        </div>
      </div>
      <SaveButton listingId={listing.id} className="absolute right-1 top-1 scale-90 bg-transparent shadow-none" />
    </article>
  );
}

function Explore() {
  const params = useSearchParams();
  const { session, lifestyle } = useMe();
  const [{ filters, view }, setState] = useState(() => ({ filters: DEFAULT_FILTERS, view: "grid" as "grid" | "map" }));
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Filters come from the URL (hero search, neighbourhood links) or, failing that, from this tab's last visit.
  useEffect(() => {
    setState(initialFilters(new URLSearchParams(params.toString())));
    setReady(true);
  }, [params]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ filters, view }));
    } catch {
      /* private mode: filters simply won't survive a reload */
    }
  }, [filters, view, ready]);

  const setFilters = useCallback((next: ListingFilters) => setState((s) => ({ ...s, filters: next })), []);
  const setView = (next: "grid" | "map") => {
    setState((s) => ({ ...s, view: next }));
    setActiveId(null);
  };

  const live = useLive((api) => api.listListings(), []);
  const listerIds = useMemo(() => [...new Set((live.data ?? []).filter((l) => l.listerLivesHere).map((l) => l.listerId))], [live.data]);
  const { matches } = useMatches(listerIds);

  const matchFor = useCallback((l: Listing) => (l.listerLivesHere ? matches[l.listerId] : undefined), [matches]);
  const scores = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const l of live.data ?? []) out[l.id] = matchFor(l)?.score ?? null;
    return out;
  }, [live.data, matchFor]);

  const results = useMemo(() => applyFilters(live.data ?? [], filters, scores), [live.data, filters, scores]);
  const active = countActive(filters);
  const selected = results.find((l) => l.id === activeId) ?? null;

  // When a pin is chosen, bring its card into view in the side list.
  const selectFromMap = useCallback((id: string | null) => {
    setActiveId(id);
    if (id) document.getElementById(`row-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const panel = <FiltersPanel filters={filters} onChange={setFilters} canMatch={Boolean(lifestyle)} signedIn={Boolean(session)} />;
  const loading = live.loading || !ready;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cx("shell flex flex-1 flex-col", view === "map" ? "lg:max-w-none lg:pr-0" : "")}>
        {/* toolbar */}
        <div className="sticky top-16 z-30 -mx-[1.125rem] border-b border-line bg-ivory/95 px-[1.125rem] py-3 backdrop-blur-sm md:top-[72px] md:mx-0 md:px-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="display mr-auto text-3xl sm:text-4xl" aria-live="polite">
              {loading ? "Finding homes…" : `${results.length} ${results.length === 1 ? "home" : "homes"}`}
              <span className="ml-2 align-middle font-sans text-sm font-normal text-ink-soft max-sm:hidden">in Bengaluru</span>
            </h1>

            <button type="button" onClick={() => setPanelOpen(true)} className={cx("btn btn-quiet btn-sm !min-h-[44px]", view === "grid" && "lg:hidden")}>
              <Icon name="sliders" size={16} />
              Filters
              {active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-ivory">{active}</span>}
            </button>

            <label className="relative">
              <span className="sr-only">Sort by</span>
              <select className="field !min-h-[44px] !w-auto !rounded-full !py-2 pr-9 text-sm font-semibold" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}>
                {SORTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div role="group" aria-label="View" className="flex rounded-full border border-line bg-paper p-1">
              {(["grid", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cx("relative flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors", view === v ? "text-ivory" : "text-ink-soft hover:text-ink")}
                >
                  {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <span className="relative flex items-center gap-1.5">
                    <Icon name={v} size={16} />
                    {v === "grid" ? "Grid" : "Map"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {active > 0 && (
            <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1">
              {filters.localities.map((l) => (
                <Pill key={l} tone="sand">
                  {l}
                </Pill>
              ))}
              {(filters.rentMin > RENT_FLOOR || filters.rentMax < RENT_CEIL) && (
                <Pill tone="sand">
                  {rupees(filters.rentMin)} to {rupees(filters.rentMax)}
                </Pill>
              )}
              {filters.roomTypes.map((r) => (
                <Pill key={r} tone="sand">
                  {ROOM_TYPE_LABEL[r]}
                </Pill>
              ))}
              {filters.moveInBy && <Pill tone="sand">{availability(filters.moveInBy).replace("From", "By")}</Pill>}
              {filters.brokerFree && <Pill tone="sand">No brokerage</Pill>}
              {filters.minMatch > 0 && <Pill tone="sage">{filters.minMatch}%+ match</Pill>}
              <button type="button" className="link ml-1 min-h-[32px] shrink-0 text-sm" onClick={() => setFilters(resetFilters(filters))}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {live.error && <ErrorNote className="mt-6" onRetry={live.reload}>{live.error}</ErrorNote>}

        <LayoutGroup>
          <div className={cx("flex flex-1 gap-8", view === "grid" ? "py-8" : "lg:gap-0")}>
            {view === "grid" && (
              <aside aria-label="Filters" className="hidden w-[300px] shrink-0 lg:block">
                <div className="no-scrollbar sticky top-[150px] max-h-[calc(100dvh-170px)] overflow-y-auto pb-8 pr-2">
                  <div className="mb-5 flex items-baseline justify-between">
                    <h2 className="micro text-ink-soft">Filters</h2>
                    {active > 0 && (
                      <button type="button" className="link text-sm" onClick={() => setFilters(resetFilters(filters))}>
                        Clear {active}
                      </button>
                    )}
                  </div>
                  {panel}
                </div>
              </aside>
            )}

            {/* results */}
            <div className={cx("min-w-0", view === "grid" ? "flex-1" : "hidden w-[420px] shrink-0 overflow-y-auto py-5 pr-5 lg:block lg:h-[calc(100dvh-150px)] xl:w-[460px]")}>
              {loading ? (
                <div className={view === "grid" ? "grid gap-x-6 gap-y-10 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3"}>
                  {Array.from({ length: 6 }, (_, i) => (view === "grid" ? <ListingCardSkeleton key={i} /> : <div key={i} className="skeleton h-[126px] rounded-2xl" />))}
                </div>
              ) : results.length === 0 ? (
                <EmptyState
                  title="No homes in this corner of the city. Yet."
                  action={
                    active > 0 ? (
                      <button type="button" className="btn btn-ink" onClick={() => setFilters(resetFilters(filters))}>
                        Clear filters
                      </button>
                    ) : (
                      <Link href="/list" className="btn btn-ink">
                        List the first one
                      </Link>
                    )
                  }
                >
                  Try widening your budget or exploring a nearby neighbourhood.
                </EmptyState>
              ) : (
                <ul className={view === "grid" ? "grid gap-x-6 gap-y-10 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3"}>
                  {results.map((l, i) => (
                    <motion.li key={l.id} layout="position" layoutId={`home-${l.id}`} transition={{ type: "tween", duration: 0.35, ease: [0.22, 0.8, 0.26, 1] }}>
                      {view === "grid" ? (
                        <ListingCard listing={l} match={matchFor(l)} index={i} priority={i < 3} />
                      ) : (
                        <ListingRow listing={l} match={matchFor(l)} active={activeId === l.id} onHover={setActiveId} />
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {view === "map" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="relative -mx-[1.125rem] h-[calc(100dvh-190px)] min-h-[380px] flex-1 md:mx-0 md:h-[calc(100dvh-170px)] lg:sticky lg:top-[142px] lg:h-[calc(100dvh-142px)]"
              >
                <MapView listings={results} activeId={activeId} onSelect={selectFromMap} className="h-full w-full md:rounded-2xl lg:rounded-none" />
                {/* phones and tablets: the chosen pin's card rides over the map */}
                <div className="absolute inset-x-3 bottom-3 lg:hidden">
                  {selected ? (
                    <div className="[animation:fade-in_200ms_ease-out]">
                      <ListingRow listing={selected} match={matchFor(selected)} active onHover={() => {}} />
                    </div>
                  ) : (
                    !loading && (
                      <p className="mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-ivory shadow-lift">
                        {results.length === 0 ? "No homes match these filters" : "Tap a price to see the home"}
                      </p>
                    )
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </LayoutGroup>
      </div>

      <Modal
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Filters"
        variant="full"
        footer={
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => setFilters(resetFilters(filters))} disabled={active === 0}>
              Clear
            </button>
            <button type="button" className="btn btn-ink flex-1" onClick={() => setPanelOpen(false)}>
              Show {results.length} {results.length === 1 ? "home" : "homes"}
            </button>
          </div>
        }
      >
        {panel}
      </Modal>
    </MotionConfig>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="shell py-10"><div className="skeleton h-12 w-64" /></div>}>
      <Explore />
    </Suspense>
  );
}
