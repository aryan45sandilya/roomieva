"use client";

import * as Slider from "@radix-ui/react-slider";
import Link from "next/link";
import { AMENITIES, FURNISHING_LABEL, LOCALITIES, ROOM_TYPE_LABEL } from "@/lib/constants";
import { DEFAULT_FILTERS, RENT_CEIL, RENT_FLOOR, type ListingFilters } from "@/lib/filters";
import { cx, isoDate, rupees } from "@/lib/format";
import type { Furnishing, RoomType } from "@/lib/types";
import { Icon } from "./icons";
import { ChipGroup, Field } from "./ui";

const thumb =
  "block h-6 w-6 rounded-full border-2 border-ink bg-paper shadow-[0_1px_0_rgb(26_26_23/0.15)] transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";

export function RangeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  disabled,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number[]) => string;
  disabled?: boolean;
}) {
  return (
    <div className={cx(disabled && "opacity-50")}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm tabular-nums text-ink-soft" aria-live="polite">
          {format(value)}
        </span>
      </div>
      <Slider.Root className="relative flex h-11 touch-none select-none items-center" value={value} onValueChange={onChange} min={min} max={max} step={step} minStepsBetweenThumbs={1} disabled={disabled}>
        <Slider.Track className="relative h-1 grow rounded-full bg-line">
          <Slider.Range className="absolute h-full rounded-full bg-ink" />
        </Slider.Track>
        {value.map((_, i) => (
          <Slider.Thumb key={i} className={thumb} aria-label={value.length > 1 ? `${label}, ${i === 0 ? "minimum" : "maximum"}` : label} />
        ))}
      </Slider.Root>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-line transition-colors duration-200 peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-paper shadow transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const DEPOSITS = [50000, 100000, 150000, 200000];

export function FiltersPanel({
  filters,
  onChange,
  canMatch,
  signedIn,
}: {
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
  /** The viewer has lifestyle answers, so a match threshold means something. */
  canMatch: boolean;
  signedIn: boolean;
}) {
  const set = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-7">
      <Field label="Search">
        {(p) => (
          <div className="relative">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input {...p} type="search" className="field pl-10" placeholder="Balcony, metro, pet-friendly…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
          </div>
        )}
      </Field>

      <ChipGroup legend="Neighbourhood" options={LOCALITIES.map((l) => l.name)} value={filters.localities} onChange={(v) => set("localities", v)} />

      <RangeSlider
        label="Monthly rent"
        value={[filters.rentMin, filters.rentMax]}
        onChange={([a, b]) => onChange({ ...filters, rentMin: a, rentMax: b })}
        min={RENT_FLOOR}
        max={RENT_CEIL}
        step={1000}
        format={([a, b]) => `${rupees(a)} to ${b >= RENT_CEIL ? `${rupees(b)}+` : rupees(b)}`}
      />

      <Field label="Security deposit">
        {(p) => (
          <select {...p} className="field" value={filters.depositMax ?? ""} onChange={(e) => set("depositMax", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Any amount</option>
            {DEPOSITS.map((d) => (
              <option key={d} value={d}>
                Up to {rupees(d)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <ChipGroup<RoomType> legend="Room" options={["private", "shared", "entire"]} label={(o) => ROOM_TYPE_LABEL[o]} value={filters.roomTypes} onChange={(v) => set("roomTypes", v)} />
      <ChipGroup<number> legend="Bedrooms in the flat" options={[1, 2, 3, 4]} label={(o) => (o === 4 ? "4+" : String(o))} value={filters.bedrooms} onChange={(v) => set("bedrooms", v)} />
      <ChipGroup<Furnishing> legend="Furnishing" options={["furnished", "semi", "unfurnished"]} label={(o) => FURNISHING_LABEL[o]} value={filters.furnishing} onChange={(v) => set("furnishing", v)} />

      <Field label="Available by" hint="Shows homes you could move into on or before this date.">
        {(p) => <input {...p} type="date" className="field" min={isoDate(new Date())} value={filters.moveInBy ?? ""} onChange={(e) => set("moveInBy", e.target.value || null)} />}
      </Field>

      <ChipGroup legend="Must have" options={AMENITIES} value={filters.amenities} onChange={(v) => set("amenities", v)} />

      <div className="space-y-2 border-t border-line pt-5">
        <Toggle label="No brokerage only" hint="Hide homes let through an agent." checked={filters.brokerFree} onChange={(v) => set("brokerFree", v)} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Listing checks</legend>
        <div className="space-y-1">
          {(
            [
              ["any", "Show everything"],
              ["reviewed", "Reviewed by a moderator, or better"],
              ["property_verified", "Property verified only"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
              <input type="radio" name="verification" className="h-4 w-4 accent-[var(--color-ink)]" checked={filters.verification === value} onChange={() => set("verification", value)} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl bg-sage p-4">
        <RangeSlider
          label="Lifestyle match"
          value={[filters.minMatch]}
          onChange={([v]) => set("minMatch", v)}
          min={0}
          max={90}
          step={10}
          disabled={!canMatch}
          format={([v]) => (v === 0 ? "Any" : `${v}% or higher`)}
        />
        <p className="mt-1 text-xs text-ink">
          {canMatch ? (
            "Compares your answers with the lister's, where they live in the home. Homes without a score are hidden while this is on."
          ) : (
            <>
              <Link className="link" href={signedIn ? "/quiz" : "/auth?mode=signup&next=/quiz"}>
                Answer the lifestyle questions
              </Link>{" "}
              to filter by how well you&apos;d fit.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export const resetFilters = (current: ListingFilters): ListingFilters => ({ ...DEFAULT_FILTERS, sort: current.sort });
