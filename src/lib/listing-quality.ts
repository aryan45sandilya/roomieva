import { RENEW_NUDGE_DAYS, STALE_AFTER_DAYS } from "./constants";
import { DAY } from "./format";
import type { Listing, ListingDraft } from "./types";

/* ── Staleness ─────────────────────────────────────────── */

export type Freshness = "fresh" | "renew_soon" | "stale";

/**
 * A listing's freshness comes from when its lister last confirmed the room is
 * still available. Stale listings are hidden from discovery, never deleted;
 * one tap from the lister brings them back.
 */
export function freshness(listing: Pick<Listing, "lastConfirmedAt" | "publishedAt">, now = Date.now()): Freshness {
  const confirmed = listing.lastConfirmedAt ?? listing.publishedAt;
  if (!confirmed) return "fresh";
  const age = (now - new Date(confirmed).getTime()) / DAY;
  if (age >= STALE_AFTER_DAYS) return "stale";
  if (age >= RENEW_NUDGE_DAYS) return "renew_soon";
  return "fresh";
}

/** Is this listing shown in search right now? */
export function isDiscoverable(listing: Listing, now = Date.now()) {
  return listing.status === "active" && freshness(listing, now) !== "stale";
}

export function daysUntilStale(listing: Pick<Listing, "lastConfirmedAt" | "publishedAt">, now = Date.now()) {
  const confirmed = listing.lastConfirmedAt ?? listing.publishedAt;
  if (!confirmed) return STALE_AFTER_DAYS;
  return Math.max(0, Math.ceil(STALE_AFTER_DAYS - (now - new Date(confirmed).getTime()) / DAY));
}

/* ── Duplicate detection ───────────────────────────────── */

const squash = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Normalised attributes that identify "the same room": where it is, what it
 * is, and roughly what it costs. Rent is bucketed to the nearest ₹1,000 so a
 * re-post at ₹18,500 vs ₹18,000 still collides.
 */
export function fingerprint(l: Pick<Listing, "city" | "locality" | "bedrooms" | "bathrooms" | "roomType" | "furnishing" | "rent">) {
  return [squash(l.city), squash(l.locality), l.bedrooms, l.bathrooms, l.roomType, l.furnishing, Math.round(l.rent / 1000)].join("|");
}

/** Small, fast, stable string hash (FNV-1a). Used to compare photo contents. */
export function hashString(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const photoHashes = (l: Pick<Listing, "photos">) => l.photos.map((p) => hashString(p.url));

export interface DuplicateHit {
  listingId: string;
  reason: string;
}

/**
 * Compare a listing about to be published against the ones already live.
 * Two signals: matching attribute fingerprint, or any shared photo.
 */
export function findDuplicates(candidate: Listing, existing: Listing[]): DuplicateHit[] {
  const fp = fingerprint(candidate);
  const hashes = new Set(photoHashes(candidate));
  const hits: DuplicateHit[] = [];
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    if (other.status !== "active" && other.status !== "under_review") continue;
    const sharedPhoto = photoHashes(other).some((h) => hashes.has(h));
    const sameAttributes = fingerprint(other) === fp;
    if (sharedPhoto) hits.push({ listingId: other.id, reason: "Shares a photo with another live listing" });
    else if (sameAttributes && other.listerId === candidate.listerId)
      hits.push({ listingId: other.id, reason: "Same details as another of this lister's live listings" });
    else if (sameAttributes && squash(other.title) === squash(candidate.title))
      hits.push({ listingId: other.id, reason: "Same title and details as another live listing" });
  }
  return hits;
}

/* ── Completeness ──────────────────────────────────────── */

/** Human-readable list of what still blocks publishing. Empty means ready. */
export function missingForPublish(d: ListingDraft): string[] {
  const missing: string[] = [];
  if (!d.locality) missing.push("Choose a locality");
  if (d.address.trim().length < 8) missing.push("Add the address (kept private)");
  if (d.title.trim().length < 12) missing.push("Write a title of at least 12 characters");
  if (d.description.trim().length < 60) missing.push("Describe the home in at least 60 characters");
  if (!(d.rent >= 3000)) missing.push("Set the monthly rent");
  if (!(d.deposit >= 0)) missing.push("Set the deposit");
  if (!d.availableFrom) missing.push("Pick the date it's available from");
  if (d.photos.length < 3) missing.push("Add at least 3 photos of the actual home");
  if (d.roomType !== "entire" && d.occupantSummary.trim().length < 10) missing.push("Say a little about who lives there now");
  return missing;
}
