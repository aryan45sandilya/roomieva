"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/filters-panel";
import { Icon } from "@/components/icons";
import { ChipGroup, EmptyState, ErrorNote, Field, Note, Photo, SignInGate, Stepper, useToast } from "@/components/ui";
import { AMENITIES, CITY, FURNISHING_LABEL, HOUSE_RULES, LOCALITIES, PROPERTY_TYPE_LABEL, ROOM_TYPE_LABEL, localityByName } from "@/lib/constants";
import { errorMessage, getApi } from "@/lib/data/api";
import { useMe } from "@/lib/data/hooks";
import { availability, cx, isoDate, rupees } from "@/lib/format";
import { missingForPublish } from "@/lib/listing-quality";
import type { Furnishing, ListingDraft, PropertyType, RoomType } from "@/lib/types";
import { LISTING_STEP_FIELDS, fieldErrors, listingSchema } from "@/lib/validation";

const EMPTY: ListingDraft = {
  title: "",
  city: CITY,
  locality: "",
  address: "",
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnishing: "semi",
  amenities: [],
  description: "",
  roomType: "private",
  rent: 0,
  deposit: 0,
  brokerage: 0,
  availableFrom: "",
  houseRules: [],
  occupantCount: 1,
  occupantSummary: "",
  listerLivesHere: true,
  photos: [],
};

const STEPS = [
  { title: "Where is it?", lead: "People see the neighbourhood and a rough area on the map. Never the address." },
  { title: "What's the home like?", lead: "Plain facts first, then a few honest lines. Mention the things you'd want to know." },
  { title: "What does it cost?", lead: "Put every cost up front. Surprises at the visit lose you the good applicants." },
  { title: "When is it free?", lead: "The date someone could actually move in." },
  { title: "What comes with it?", lead: "Tick what's really there, and the rules the house actually keeps." },
  { title: "Show the place", lead: "At least three photos of the actual home, taken in daylight. No stock images, no watermarks." },
  { title: "Who lives there?", lead: "This is what people care about most. First names and a sentence each is plenty." },
  { title: "Check it over", lead: "This is what people will see." },
];

type Errors = Record<string, string>;

/** Validate just the fields that belong to one step. */
function stepErrors(draft: ListingDraft, step: number): Errors {
  const parsed = listingSchema.safeParse(draft);
  const all = parsed.success ? {} : fieldErrors(parsed.error);
  // Cross-field rules are checked by hand so they show even while other steps are unfinished.
  if (draft.deposit > Math.max(draft.rent, 1) * 12) all.deposit ??= "A deposit over 12 months' rent looks like a mistake";
  if (draft.roomType !== "entire" && draft.occupantSummary.trim().length < 10) all.occupantSummary ??= "Say a little about who lives there now";
  const out: Errors = {};
  for (const field of LISTING_STEP_FIELDS[step]) {
    const key = Object.keys(all).find((k) => k === field || k.startsWith(`${field}.`));
    if (key) out[field] = all[key];
  }
  return out;
}

const money = (v: string) => Math.max(0, Math.round(Number(v) || 0));

function ListFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { session, profile } = useMe();
  const editId = params.get("edit");

  const [draft, setDraft] = useState<ListingDraft>(EMPTY);
  const [loaded, setLoaded] = useState(!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "publish" | "upload" | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Editing: load the listing and its private address once.
  useEffect(() => {
    if (!editId || !session) return;
    let alive = true;
    void (async () => {
      try {
        const api = await getApi();
        const [l, address] = await Promise.all([api.getListing(editId), api.getListingAddress(editId)]);
        if (!alive) return;
        if (!l || l.listerId !== session.userId) {
          setLoadError("That listing isn't yours to edit, or it no longer exists.");
          return;
        }
        setDraft({
          id: l.id,
          title: l.title,
          city: l.city,
          locality: l.locality,
          address: address ?? "",
          propertyType: l.propertyType,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          furnishing: l.furnishing,
          amenities: l.amenities,
          description: l.description,
          roomType: l.roomType,
          rent: l.rent,
          deposit: l.deposit,
          brokerage: l.brokerage,
          availableFrom: l.availableFrom,
          houseRules: l.houseRules,
          occupantCount: l.occupantCount,
          occupantSummary: l.occupantSummary,
          listerLivesHere: l.listerLivesHere,
          photos: l.photos,
        });
        setLoaded(true);
      } catch (e) {
        if (alive) setLoadError(errorMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId, session]);

  if (session === undefined) return <div className="shell py-16"><div className="skeleton mx-auto h-96 max-w-3xl rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/list" title="Log in to list your space">Listing is free. You&apos;ll need an account so people can message you.</SignInGate>;
  if (profile && !profile.onboarded) {
    return (
      <EmptyState title="First, a little about you" action={<Link href="/onboarding?next=/list" className="btn btn-ink">Set up my profile</Link>}>
        People choose a home partly by who&apos;s listing it, so a profile comes before a listing.
      </EmptyState>
    );
  }
  if (loadError) return <div className="shell py-16"><ErrorNote>{loadError}</ErrorNote></div>;
  if (!loaded) return <div className="shell py-16"><div className="skeleton mx-auto h-96 max-w-3xl rounded-3xl" /></div>;

  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };
  const last = step === STEPS.length - 1;
  const missing = missingForPublish(draft);
  const locality = localityByName(draft.locality);

  const go = (delta: 1 | -1) => {
    setError(null);
    if (delta === 1) {
      const found = stepErrors(draft, step);
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
    window.scrollTo({ top: 0 });
  };

  const save = async (publish: boolean) => {
    setPending(publish ? "publish" : "draft");
    setError(null);
    try {
      const api = await getApi();
      const { listing, heldReason } = await api.saveListing(draft, publish);
      setDraft((d) => ({ ...d, id: listing.id }));
      if (!publish) {
        toast("Draft saved. Find it under My listings");
      } else if (heldReason) {
        setHeld(heldReason);
      } else {
        toast("Your listing is live");
        router.push(`/homes/${listing.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPending("upload");
    setError(null);
    try {
      const api = await getApi();
      const room = 8 - draft.photos.length;
      const added = [];
      for (const file of [...files].slice(0, room)) {
        added.push({ url: await api.uploadPhoto(file), alt: "" });
      }
      set("photos", [...draft.photos, ...added]);
      if (files.length > room) toast("Only 8 photos fit. The rest were left out", "error");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const movePhoto = (i: number, delta: number) => {
    const next = [...draft.photos];
    const [p] = next.splice(i, 1);
    next.splice(i + delta, 0, p);
    set("photos", next);
  };

  if (held) {
    return (
      <EmptyState
        title="Saved, and waiting for a quick check"
        action={
          <Link href="/my-listings" className="btn btn-ink">
            Go to my listings
          </Link>
        }
      >
        This listing looks a lot like one that&apos;s already live ({held.toLowerCase()}), so a moderator will look before it appears in search. You don&apos;t need to do anything.
      </EmptyState>
    );
  }

  return (
    <div className="shell flex flex-1 flex-col py-8 md:py-14">
      <div className="mx-auto w-full max-w-3xl flex-1">
        <div className="mb-10 flex items-center gap-4">
          <p className="micro tabular-nums text-ink-soft">
            {editId ? "Editing" : "New listing"} · {step + 1} of {STEPS.length}
          </p>
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Listing progress">
            {STEPS.map((s, i) => (
              <span key={s.title} className={cx("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-ink" : "bg-line")} />
            ))}
          </div>
        </div>

        <h1 className="display text-5xl sm:text-6xl">{STEPS[step].title}</h1>
        <p className="mb-8 mt-3 max-w-xl text-ink-soft">{STEPS[step].lead}</p>

        <div className="space-y-7 [animation:fade-in_240ms_ease-out]" key={step}>
          {step === 0 && (
            <>
              <Field label="Neighbourhood" error={errors.locality || undefined}>
                {(p) => (
                  <select {...p} className="field" value={draft.locality} onChange={(e) => set("locality", e.target.value)}>
                    <option value="">Choose one</option>
                    {LOCALITIES.map((l) => (
                      <option key={l.name}>{l.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Full address" hint="Flat number, building, street, landmark." error={errors.address || undefined}>
                {(p) => <textarea {...p} className="field min-h-[96px]" maxLength={240} autoComplete="street-address" value={draft.address} onChange={(e) => set("address", e.target.value)} />}
              </Field>
              <Note icon="lock">The address is visible only to you and Roomieva moderators. Share it yourself, in chat, when you&apos;ve agreed a visit.</Note>
            </>
          )}

          {step === 1 && (
            <>
              <ChipGroup<RoomType> single legend="What are you offering?" options={["private", "shared", "entire"]} label={(o) => ROOM_TYPE_LABEL[o]} value={[draft.roomType]} onChange={(v) => v[0] && set("roomType", v[0])} />
              <ChipGroup<PropertyType> single legend="Kind of building" options={["apartment", "gated_society", "independent_house", "builder_floor"]} label={(o) => PROPERTY_TYPE_LABEL[o]} value={[draft.propertyType]} onChange={(v) => v[0] && set("propertyType", v[0])} />
              <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
                <Stepper label="Bedrooms in the flat" value={draft.bedrooms} onChange={(n) => set("bedrooms", n)} min={1} max={8} />
                <Stepper label="Bathrooms" value={draft.bathrooms} onChange={(n) => set("bathrooms", n)} min={1} max={8} />
              </div>
              <ChipGroup<Furnishing> single legend="Furnishing" options={["furnished", "semi", "unfurnished"]} label={(o) => FURNISHING_LABEL[o]} value={[draft.furnishing]} onChange={(v) => v[0] && set("furnishing", v[0])} />
              <Field label="Title" hint={`What you'd say in one line. ${draft.title.length}/80`} error={errors.title || undefined}>
                {(p) => <input {...p} className="field" maxLength={80} placeholder="Sunny room in a 3BHK near the metro" value={draft.title} onChange={(e) => set("title", e.target.value)} />}
              </Field>
              <Field label="Description" hint={`Light, noise, the kitchen, the commute, what the building is like. ${draft.description.length}/1,500`} error={errors.description || undefined}>
                {(p) => <textarea {...p} className="field min-h-[180px]" maxLength={1500} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="Monthly rent (₹)"
                hint={locality ? `Rooms in ${locality.name} usually go for ${rupees(locality.typicalRoom[0])} to ${rupees(locality.typicalRoom[1])}.` : undefined}
                error={errors.rent || undefined}
              >
                {(p) => <input {...p} type="number" inputMode="numeric" min={0} step={500} className="field" value={draft.rent || ""} onChange={(e) => set("rent", money(e.target.value))} />}
              </Field>
              <Field label="Security deposit (₹)" hint={draft.rent > 0 && draft.deposit > 0 ? `That's ${+(draft.deposit / draft.rent).toFixed(1)} months' rent.` : "Enter 0 if there isn't one."} error={errors.deposit || undefined}>
                {(p) => <input {...p} type="number" inputMode="numeric" min={0} step={1000} className="field" value={draft.deposit || ""} onChange={(e) => set("deposit", money(e.target.value))} />}
              </Field>
              <Field label="Brokerage (₹)" hint="Leave at 0 if you're the owner or a flatmate and nobody takes a fee." error={errors.brokerage || undefined}>
                {(p) => <input {...p} type="number" inputMode="numeric" min={0} step={500} className="field" value={draft.brokerage || ""} onChange={(e) => set("brokerage", money(e.target.value))} />}
              </Field>
              <Note icon="shield">Roomieva never handles money. Don&apos;t ask anyone for a token amount before they&apos;ve visited. Listings that do get reported and removed.</Note>
            </>
          )}

          {step === 3 && (
            <Field label="Available from" hint="If it's free already, pick today." error={errors.availableFrom || undefined}>
              {(p) => <input {...p} type="date" className="field" min={isoDate(new Date())} value={draft.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} />}
            </Field>
          )}

          {step === 4 && (
            <>
              <ChipGroup legend="Amenities" options={AMENITIES} value={draft.amenities} onChange={(v) => set("amenities", v)} />
              <ChipGroup legend="House rules" options={HOUSE_RULES} value={draft.houseRules} onChange={(v) => set("houseRules", v)} />
            </>
          )}

          {step === 5 && (
            <>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="photo-input" onChange={(e) => void addPhotos(e.target.files)} />
              <label
                htmlFor="photo-input"
                className={cx(
                  "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/30 bg-paper p-6 text-center transition-colors hover:border-ink",
                  "has-[:focus-visible]:outline",
                  (pending === "upload" || draft.photos.length >= 8) && "pointer-events-none opacity-50",
                )}
              >
                <Icon name="camera" size={28} />
                <span className="font-semibold">{pending === "upload" ? "Adding photos…" : draft.photos.length >= 8 ? "That's the maximum of 8" : "Add photos"}</span>
                <span className="text-sm text-ink-soft">JPEG, PNG or WebP, up to 10 MB each. {draft.photos.length} of 8 added.</span>
              </label>
              {errors.photos && <ErrorNote>{errors.photos}</ErrorNote>}
              {draft.photos.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {draft.photos.map((p, i) => (
                    <li key={p.url} className="rounded-2xl border border-line bg-paper p-3">
                      <div className="relative">
                        <Photo src={p.url} alt={p.alt || `Photo ${i + 1}`} sizes="360px" className="aspect-[4/3] rounded-xl" />
                        {i === 0 && <span className="micro absolute left-2 top-2 rounded-full bg-ink px-2.5 py-1 text-ivory">Cover</span>}
                      </div>
                      <label className="mt-3 block">
                        <span className="sr-only">Describe photo {i + 1}</span>
                        <input
                          className="field !min-h-[40px] text-sm"
                          placeholder="What's in this photo? (e.g. bedroom, west window)"
                          maxLength={120}
                          value={p.alt}
                          onChange={(e) => set("photos", draft.photos.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                        />
                      </label>
                      <div className="mt-2 flex items-center gap-1">
                        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30" onClick={() => movePhoto(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>
                          <Icon name="chevronLeft" size={18} />
                        </button>
                        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30" onClick={() => movePhoto(i, 1)} disabled={i === draft.photos.length - 1} aria-label={`Move photo ${i + 1} later`}>
                          <Icon name="chevronRight" size={18} />
                        </button>
                        <button type="button" className="ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-clay hover:bg-sand" onClick={() => set("photos", draft.photos.filter((_, j) => j !== i))}>
                          <Icon name="trash" size={16} /> Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Note>The same photo on two listings is flagged automatically and held for a moderator.</Note>
            </>
          )}

          {step === 6 && (
            <>
              <div className="rounded-2xl border border-line bg-paper p-4">
                <Toggle label="I live in this home" hint="Turn on if you'd be sharing it with whoever moves in. They'll see how your lifestyle answers match theirs." checked={draft.listerLivesHere} onChange={(v) => set("listerLivesHere", v)} />
              </div>
              <div className="rounded-2xl border border-line bg-paper p-4">
                <Stepper label="People living there now" value={draft.occupantCount} onChange={(n) => set("occupantCount", n)} min={0} max={12} />
              </div>
              <Field
                label={draft.roomType === "entire" ? "Anything about the neighbours or building? (optional)" : "Who are they?"}
                hint={`What they do, rough ages, how the house runs day to day. ${draft.occupantSummary.length}/300`}
                error={errors.occupantSummary || undefined}
              >
                {(p) => <textarea {...p} className="field min-h-[120px]" maxLength={300} placeholder="Two of us, both in our late twenties. One works in design, one is finishing a PhD. Quiet on weeknights." value={draft.occupantSummary} onChange={(e) => set("occupantSummary", e.target.value)} />}
              </Field>
            </>
          )}

          {step === 7 && (
            <>
              <div className="overflow-hidden rounded-[24px] border border-line bg-paper">
                <Photo src={draft.photos[0]?.url} alt={draft.photos[0]?.alt ?? ""} sizes="720px" className="aspect-[16/9]" />
                <div className="p-5 sm:p-6">
                  <p className="micro text-ink-soft">
                    {draft.locality || "No neighbourhood yet"} · {ROOM_TYPE_LABEL[draft.roomType]} · {draft.bedrooms} BHK · {FURNISHING_LABEL[draft.furnishing]}
                  </p>
                  <h2 className="display mt-2 text-4xl">{draft.title || "Untitled listing"}</h2>
                  <p className="mt-3 line-clamp-4 whitespace-pre-line text-ink-soft">{draft.description || "No description yet."}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4 [&_dt]:text-ink-soft [&_dd]:font-semibold">
                    <div>
                      <dt>Rent</dt>
                      <dd>{draft.rent ? rupees(draft.rent) : "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Deposit</dt>
                      <dd>{rupees(draft.deposit)}</dd>
                    </div>
                    <div>
                      <dt>Brokerage</dt>
                      <dd>{draft.brokerage ? rupees(draft.brokerage) : "None"}</dd>
                    </div>
                    <div>
                      <dt>Move in</dt>
                      <dd>{draft.availableFrom ? availability(draft.availableFrom) : "Not set"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              {missing.length > 0 ? (
                <div className="rounded-2xl border border-clay/40 bg-terracotta/10 p-5">
                  <h2 className="font-semibold">Before this can go live</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-ink-soft">You can save it as a draft and come back.</p>
                </div>
              ) : (
                <Note icon="refresh">
                  Once live, we&apos;ll ask you every couple of weeks whether the room is still free. Listings that aren&apos;t reconfirmed within 21 days drop out of search until you say so.
                </Note>
              )}
            </>
          )}
        </div>

        {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      </div>

      <div className="sticky bottom-0 -mx-[1.125rem] mt-10 border-t border-line bg-ivory/95 px-[1.125rem] py-3 backdrop-blur-sm md:static md:mx-auto md:w-full md:max-w-3xl md:border-0 md:bg-transparent md:px-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => go(-1)} disabled={step === 0 || pending !== null} aria-label="Previous step">
            <Icon name="back" size={16} /> <span className="max-xs:sr-only">Back</span>
          </button>
          <button type="button" className="btn ml-auto text-ink-soft hover:bg-sand hover:text-ink" onClick={() => save(false)} disabled={pending !== null}>
            {pending === "draft" ? "Saving…" : "Save draft"}
          </button>
          {last ? (
            <button type="button" className="btn btn-accent min-w-[8rem]" onClick={() => save(true)} disabled={pending !== null || missing.length > 0}>
              {pending === "publish" ? "Publishing…" : editId ? "Save and publish" : "Publish"}
            </button>
          ) : (
            <button type="button" className="btn btn-ink min-w-[8rem]" onClick={() => go(1)} disabled={pending !== null}>
              Continue <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={null}>
      <ListFlow />
    </Suspense>
  );
}
