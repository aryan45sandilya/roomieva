import { daysBetween } from "./format";
import type { Furnishing, Listing, ListingVerification, Profile, RoomType } from "./types";

export type SortKey = "relevance" | "rent_low" | "rent_high" | "newest" | "available";

export interface ListingFilters {
  q: string;
  localities: string[];
  rentMin: number;
  rentMax: number;
  depositMax: number | null;
  furnishing: Furnishing[];
  roomTypes: RoomType[];
  bedrooms: number[];
  /** ISO date. Keep homes available on or before this date. */
  moveInBy: string | null;
  amenities: string[];
  brokerFree: boolean;
  verification: "any" | "reviewed" | "property_verified";
  /** 0 disables the threshold. Needs the viewer's own quiz answers. */
  minMatch: number;
  sort: SortKey;
}

export const RENT_FLOOR = 5000;
export const RENT_CEIL = 80000;

export const DEFAULT_FILTERS: ListingFilters = {
  q: "",
  localities: [],
  rentMin: RENT_FLOOR,
  rentMax: RENT_CEIL,
  depositMax: null,
  furnishing: [],
  roomTypes: [],
  bedrooms: [],
  moveInBy: null,
  amenities: [],
  brokerFree: false,
  verification: "any",
  minMatch: 0,
  sort: "relevance",
};

const VERIFY_RANK: Record<ListingVerification, number> = { none: 0, reviewed: 1, property_verified: 2 };

export function countActive(f: ListingFilters) {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.localities.length) n++;
  if (f.rentMin > RENT_FLOOR || f.rentMax < RENT_CEIL) n++;
  if (f.depositMax !== null) n++;
  if (f.furnishing.length) n++;
  if (f.roomTypes.length) n++;
  if (f.bedrooms.length) n++;
  if (f.moveInBy) n++;
  if (f.amenities.length) n++;
  if (f.brokerFree) n++;
  if (f.verification !== "any") n++;
  if (f.minMatch > 0) n++;
  return n;
}

/**
 * Pure filter + sort. `scores` maps listing id → compatibility (or null when
 * unknown). Listings with an unknown score are dropped only when a threshold
 * is set, because we can't claim they meet it.
 */
export function applyFilters(
  listings: Listing[],
  f: ListingFilters,
  scores: Record<string, number | null> = {},
  now = new Date(),
): Listing[] {
  const q = f.q.trim().toLowerCase();
  const out = listings.filter((l) => {
    if (q && !`${l.title} ${l.locality} ${l.city} ${l.description}`.toLowerCase().includes(q)) return false;
    if (f.localities.length && !f.localities.includes(l.locality)) return false;
    if (l.rent < f.rentMin) return false;
    if (f.rentMax < RENT_CEIL && l.rent > f.rentMax) return false;
    if (f.depositMax !== null && l.deposit > f.depositMax) return false;
    if (f.furnishing.length && !f.furnishing.includes(l.furnishing)) return false;
    if (f.roomTypes.length && !f.roomTypes.includes(l.roomType)) return false;
    if (f.bedrooms.length && !f.bedrooms.includes(Math.min(l.bedrooms, 4))) return false;
    if (f.moveInBy && l.availableFrom > f.moveInBy) return false;
    if (f.amenities.length && !f.amenities.every((a) => l.amenities.includes(a))) return false;
    if (f.brokerFree && l.brokerage > 0) return false;
    if (f.verification !== "any" && VERIFY_RANK[l.verification] < VERIFY_RANK[f.verification]) return false;
    if (f.minMatch > 0) {
      const s = scores[l.id];
      if (s === null || s === undefined || s < f.minMatch) return false;
    }
    return true;
  });

  const published = (l: Listing) => new Date(l.publishedAt ?? l.createdAt).getTime();
  const relevance = (l: Listing) => {
    const match = scores[l.id] ?? 50;
    const trust = VERIFY_RANK[l.verification] * 4 + (l.brokerage === 0 ? 3 : 0);
    const recency = Math.max(0, 10 - daysBetween(l.lastConfirmedAt ?? l.createdAt, now));
    return match + trust + recency;
  };

  const sorted = [...out];
  switch (f.sort) {
    case "rent_low":
      sorted.sort((a, b) => a.rent - b.rent || a.id.localeCompare(b.id));
      break;
    case "rent_high":
      sorted.sort((a, b) => b.rent - a.rent || a.id.localeCompare(b.id));
      break;
    case "newest":
      sorted.sort((a, b) => published(b) - published(a) || a.id.localeCompare(b.id));
      break;
    case "available":
      sorted.sort((a, b) => a.availableFrom.localeCompare(b.availableFrom) || a.id.localeCompare(b.id));
      break;
    default:
      sorted.sort((a, b) => relevance(b) - relevance(a) || a.id.localeCompare(b.id));
  }
  return sorted;
}

/* ── Flatmate filters ──────────────────────────────────── */

export interface PeopleFilters {
  localities: string[];
  budgetMax: number;
  moveInBy: string | null;
  minMatch: number;
  stage: Profile["stage"][];
}

export const DEFAULT_PEOPLE_FILTERS: PeopleFilters = {
  localities: [],
  budgetMax: RENT_CEIL,
  moveInBy: null,
  minMatch: 0,
  stage: [],
};

export function applyPeopleFilters(people: Profile[], f: PeopleFilters, scores: Record<string, number | null> = {}) {
  return people
    .filter((p) => {
      if (f.localities.length && !p.preferredLocalities.some((l) => f.localities.includes(l))) return false;
      if (f.budgetMax < RENT_CEIL && p.budgetMin > f.budgetMax) return false;
      if (f.moveInBy && p.moveInBy && p.moveInBy > f.moveInBy) return false;
      if (f.stage.length && !f.stage.includes(p.stage)) return false;
      if (f.minMatch > 0) {
        const s = scores[p.id];
        if (s === null || s === undefined || s < f.minMatch) return false;
      }
      return true;
    })
    .sort((a, b) => (scores[b.id] ?? -1) - (scores[a.id] ?? -1) || a.displayName.localeCompare(b.displayName));
}
