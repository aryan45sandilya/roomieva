"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LOCALITIES } from "@/lib/constants";
import { useLive, useMatches } from "@/lib/data/hooks";
import { buildSeed, photoUrl } from "@/lib/demo/seed";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { cx, isoDate, rupees } from "@/lib/format";
import { computeMatch } from "@/lib/matching";
import { Icon } from "./icons";
import { ListingCard, ListingCardSkeleton } from "./listing";
import { CompatibilityOrbit, MatchStory } from "./orbit";
import { Avatar, ErrorNote, Photo, Pill } from "./ui";

/* ── Hero search ───────────────────────────────────────── */

const BUDGETS = [12000, 18000, 25000, 35000, 50000];
const LOOKING = [
  { id: "private", label: "Room" },
  { id: "flatmate", label: "Flatmate" },
  { id: "entire", label: "Entire flat" },
] as const;

export function HeroSearch() {
  const router = useRouter();
  const [locality, setLocality] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [looking, setLooking] = useState<(typeof LOOKING)[number]["id"]>("private");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (locality) q.set("locality", locality);
    if (budget) q.set("max", budget);
    if (moveIn) q.set("by", moveIn);
    if (looking === "flatmate") {
      router.push(`/flatmates${q.size ? `?${q}` : ""}`);
    } else {
      q.set("type", looking);
      router.push(`/explore?${q}`);
    }
  };

  return (
    <form onSubmit={submit} role="search" aria-label="Search homes and flatmates" className="rounded-[26px] border border-ink bg-paper p-2 shadow-lift">
      <fieldset className="flex gap-1 p-1">
        <legend className="sr-only">Looking for</legend>
        {LOOKING.map((l) => (
          <label
            key={l.id}
            className={cx(
              "flex min-h-[40px] flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors duration-150 sm:flex-none sm:px-5",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
              looking === l.id ? "bg-ink text-ivory" : "text-ink-soft hover:bg-sand hover:text-ink",
            )}
          >
            <input type="radio" name="looking" className="sr-only" checked={looking === l.id} onChange={() => setLooking(l.id)} />
            {l.label}
          </label>
        ))}
      </fieldset>
      <div className="mt-1 grid gap-px overflow-hidden rounded-[18px] bg-line sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
        <label className="flex flex-col bg-paper px-4 py-2.5 focus-within:bg-sand/60">
          <span className="micro text-ink-soft">Where</span>
          <select value={locality} onChange={(e) => setLocality(e.target.value)} className="-ml-1 mt-0.5 min-h-[32px] cursor-pointer bg-transparent text-base font-medium focus:outline-none">
            <option value="">All of Bengaluru</option>
            {LOCALITIES.map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col bg-paper px-4 py-2.5 focus-within:bg-sand/60">
          <span className="micro text-ink-soft">Monthly budget</span>
          <select value={budget} onChange={(e) => setBudget(e.target.value)} className="-ml-1 mt-0.5 min-h-[32px] cursor-pointer bg-transparent text-base font-medium focus:outline-none">
            <option value="">Any budget</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                Up to {rupees(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col bg-paper px-4 py-2.5 focus-within:bg-sand/60">
          <span className="micro text-ink-soft">Move in by</span>
          <input type="date" value={moveIn} min={isoDate(new Date())} onChange={(e) => setMoveIn(e.target.value)} className="mt-0.5 min-h-[32px] bg-transparent text-base font-medium focus:outline-none" />
        </label>
        <div className="bg-paper p-1.5 sm:col-span-3 lg:col-span-1">
          <button type="submit" className="btn btn-accent h-full w-full lg:px-7">
            <Icon name="search" size={18} />
            Search
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Hero composition ──────────────────────────────────── */

const settle = { type: "tween", duration: 0.7, ease: [0.22, 0.8, 0.26, 1] } as const;

export function HeroVisual() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto aspect-[5/6] w-full max-w-[520px] lg:max-w-none">
        {/* drafting marks behind the photographs */}
        <svg viewBox="0 0 500 600" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M60 30v540M30 60h440" stroke="var(--color-line)" strokeWidth="1" />
          <path d="M56 300h8M56 180h8M56 420h8M250 56v8M130 56v8M370 56v8" stroke="var(--color-ink)" strokeWidth="1" opacity="0.5" />
          <text x="466" y="52" textAnchor="end" fontSize="9" letterSpacing="2" fill="var(--color-ink-soft)">
            12.97° N · 77.59° E
          </text>
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 36, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ ...settle, delay: 0.1 }}
          className="absolute right-[2%] top-[6%] w-[66%]"
        >
          <Photo src={photoUrl(0)} alt="Sample photo: a bright living room with a sofa and large windows" priority sizes="(min-width: 1024px) 28vw, 60vw" className="aspect-[4/5] rounded-[22px] shadow-lift" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 44, rotate: 7 }}
          animate={{ opacity: 1, y: 0, rotate: 3 }}
          transition={{ ...settle, delay: 0.28 }}
          className="absolute bottom-[9%] left-[4%] w-[46%]"
        >
          <Photo src={photoUrl(9)} alt="Sample photo: a bedroom with a made bed and soft daylight" priority sizes="(min-width: 1024px) 20vw, 42vw" className="aspect-square rounded-[18px] border-[5px] border-paper shadow-lift" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...settle, delay: 0.5 }}
          className="absolute bottom-[3%] right-0 w-[58%] rounded-2xl border border-line bg-paper p-3.5 shadow-lift xs:p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar profile={{ id: "demo-u-03", displayName: "Meera", avatarUrl: null }} size={42} />
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">Meera, data analyst</p>
              <p className="truncate text-xs text-ink-soft">Looking in JP Nagar · sample profile</p>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            <li>
              <Pill tone="sage">Early bird</Pill>
            </li>
            <li>
              <Pill tone="sand">Vegetarian kitchen</Pill>
            </li>
            <li className="max-xs:hidden">
              <Pill tone="sand">Spotless</Pill>
            </li>
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="micro absolute left-[6%] top-[14%] flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-ivory"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-terracotta" /> Koramangala
        </motion.p>
      </div>
    </MotionConfig>
  );
}

/* ── Featured homes ────────────────────────────────────── */

export function FeaturedHomes() {
  const live = useLive((api) => api.listListings(), []);
  const featured = useMemo(() => applyFilters(live.data ?? [], { ...DEFAULT_FILTERS, sort: "newest" }).slice(0, 4), [live.data]);
  const { matches } = useMatches(featured.map((l) => l.listerId));
  const crops = ["tall", "standard", "standard", "wide"] as const;

  if (live.error) return <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>;

  return (
    <div className="no-scrollbar -mx-[1.125rem] flex snap-x snap-mandatory gap-5 overflow-x-auto px-[1.125rem] pb-2 md:mx-0 md:grid md:grid-cols-12 md:gap-x-8 md:gap-y-12 md:overflow-visible md:px-0">
      {(live.loading ? [null, null, null, null] : featured).map((l, i) => (
        <div
          key={l?.id ?? i}
          className={cx(
            "w-[78vw] max-w-[340px] shrink-0 snap-start md:w-auto md:max-w-none",
            i === 0 && "md:col-span-5 md:row-span-2",
            i === 1 && "md:col-span-4 md:mt-16",
            i === 2 && "md:col-span-3",
            i === 3 && "md:col-span-7",
          )}
        >
          {l ? <ListingCard listing={l} match={l.listerLivesHere ? matches[l.listerId] : undefined} crop={crops[i]} index={i} /> : <ListingCardSkeleton crop={crops[i]} />}
        </div>
      ))}
    </div>
  );
}

/* ── Orbit demo ────────────────────────────────────────── */

const PAIRS = [
  { a: "demo-u-01", b: "demo-u-02", names: ["Ananya", "Karthik"], note: "Similar rhythms" },
  { a: "demo-u-03", b: "demo-u-04", names: ["Meera", "Rohan"], note: "Very different homes" },
  { a: "demo-u-11", b: "demo-u-09", names: ["Nikhil", "Tanvi"], note: "A non-negotiable in the way" },
];

export function OrbitDemo() {
  const lifestyle = useMemo(() => buildSeed(0).lifestyle, []);
  const [index, setIndex] = useState(0);
  const pair = PAIRS[index];
  const result = useMemo(() => computeMatch(lifestyle[pair.a], lifestyle[pair.b]), [lifestyle, pair]);

  return (
    <div>
      <div role="tablist" aria-label="Sample pairs" className="no-scrollbar -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
        {PAIRS.map((p, i) => (
          <button
            key={p.a + p.b}
            role="tab"
            type="button"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cx(
              "flex min-h-[52px] shrink-0 flex-col justify-center rounded-2xl border px-4 py-2 text-left transition-colors duration-150",
              i === index ? "border-ink bg-ink text-ivory" : "border-ink/25 hover:border-ink",
            )}
          >
            <span className="text-sm font-semibold">
              {p.names[0]} + {p.names[1]}
            </span>
            <span className={cx("text-xs", i === index ? "text-ivory/70" : "text-ink-soft")}>{p.note}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid gap-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <CompatibilityOrbit key={index} result={result} you={pair.names[0]} them={pair.names[1]} />
        <div className="xl:border-l xl:border-ink/15 xl:pl-10">
          <MatchStory key={index} result={result} them={pair.names[1]} />
          <p className="mt-4 text-xs text-ink-soft">Sample profiles, real maths. This is the same engine that scores you against every home and person on Roomieva.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Neighbourhood index ───────────────────────────────── */

export function NeighbourhoodIndex() {
  const live = useLive((api) => api.listListings(), []);
  const [hover, setHover] = useState<string | null>(null);
  const stats = useMemo(() => {
    const out: Record<string, { count: number; from: number }> = {};
    for (const l of live.data ?? []) {
      const s = (out[l.locality] ??= { count: 0, from: Infinity });
      s.count++;
      s.from = Math.min(s.from, l.rent);
    }
    return out;
  }, [live.data]);

  // Project lat/lng onto a small schematic. Not to survey accuracy, but true to relative position.
  const lats = LOCALITIES.map((l) => l.lat);
  const lngs = LOCALITIES.map((l) => l.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const project = (lat: number, lng: number) => [40 + ((lng - minLng) / (maxLng - minLng)) * 240, 40 + (1 - (lat - minLat) / (maxLat - minLat)) * 240] as const;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
      <ul className="border-t border-ink">
        {LOCALITIES.map((l, i) => {
          const s = stats[l.name];
          return (
            <li key={l.name} className="border-b border-line">
              <Link
                href={`/explore?locality=${encodeURIComponent(l.name)}`}
                onMouseEnter={() => setHover(l.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(l.name)}
                onBlur={() => setHover(null)}
                className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 py-4 transition-[padding] duration-300 ease-out hover:pl-2 sm:grid-cols-[2.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] sm:py-5"
              >
                <span className="micro tabular-nums text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                <span className="display text-3xl sm:text-[2.6rem]">{l.name}</span>
                <span className="col-start-2 text-sm text-ink-soft sm:col-start-auto">{l.note}</span>
                <span className="col-start-3 row-start-1 flex items-center gap-3 text-sm sm:col-start-auto">
                  <span className="hidden text-right tabular-nums text-ink-soft md:block">
                    {live.loading ? <span className="skeleton inline-block h-4 w-24 align-middle" /> : s ? `${s.count} home${s.count === 1 ? "" : "s"} from ${rupees(s.from)}` : "Nothing listed yet"}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line transition-colors duration-200 group-hover:border-ink group-hover:bg-ink group-hover:text-ivory">
                    <Icon name="arrowUpRight" size={16} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden lg:block">
        <div className="sticky top-28">
          <svg viewBox="0 0 320 320" className="draft-grid w-full rounded-3xl border border-line bg-paper" role="img" aria-label="Schematic map showing where each neighbourhood sits in Bengaluru">
            <path d="M24 160h272M160 24v272" stroke="var(--color-line)" strokeDasharray="3 5" />
            <circle cx="160" cy="160" r="118" fill="none" stroke="var(--color-line)" />
            <text x="296" y="34" textAnchor="end" fontSize="9" letterSpacing="2" fill="var(--color-ink-soft)">
              N ↑
            </text>
            {LOCALITIES.map((l) => {
              const [x, y] = project(l.lat, l.lng);
              const on = hover === l.name;
              return (
                <g key={l.name} style={{ transition: "opacity 200ms ease" }} opacity={hover && !on ? 0.35 : 1}>
                  <circle cx={x} cy={y} r={on ? 16 : 0} fill="var(--color-terracotta)" opacity="0.25" style={{ transition: "r 250ms ease" }} />
                  <circle cx={x} cy={y} r={on ? 6 : 4} fill={on ? "var(--color-terracotta)" : "var(--color-ink)"} style={{ transition: "r 200ms ease, fill 200ms ease" }} />
                  <text x={x + (x > 230 ? -10 : 10)} y={y + 3.5} textAnchor={x > 230 ? "end" : "start"} fontSize="10" fontWeight={on ? 700 : 500} fill="var(--color-ink)">
                    {l.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-3 text-xs text-ink-soft">Relative positions only. Counts come from homes listed on Roomieva right now, which in demo mode are samples.</p>
        </div>
      </div>
    </div>
  );
}
