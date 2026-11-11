"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FURNISHING_LABEL, REPORT_REASONS, ROOM_TYPE_LABEL } from "@/lib/constants";
import { errorMessage, getApi } from "@/lib/data/api";
import { useMe } from "@/lib/data/hooks";
import { availability, cx, rupees } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import type { Listing, ReportTarget } from "@/lib/types";
import { messageSchema } from "@/lib/validation";
import { Icon } from "./icons";
import { MatchChip } from "./orbit";
import { ErrorNote, Field, ListingVerificationPill, Modal, Note, Photo, Pill, SamplePill, useToast } from "./ui";

/* ── Save ──────────────────────────────────────────────── */

/**
 * Saving turns the outline of a house into a lit one: the walls fill, a
 * window appears, and the whole thing dips and settles. State is optimistic
 * and rolled back if the write fails.
 */
export function SaveButton({ listingId, className, withLabel = false }: { listingId: string; className?: string; withLabel?: boolean }) {
  const { session, savedIds } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [override, setOverride] = useState<boolean | null>(null);
  const [bump, setBump] = useState(0);
  const saved = override ?? savedIds.includes(listingId);

  useEffect(() => setOverride(null), [savedIds]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      router.push(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !saved;
    setOverride(next);
    setBump((b) => b + 1);
    if (next && "vibrate" in navigator) navigator.vibrate?.(12);
    try {
      const api = await getApi();
      await api.toggleSaved(listingId);
    } catch (err) {
      setOverride(!next);
      toast(errorMessage(err), "error");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved homes" : "Save this home"}
      className={cx(
        "group/save relative z-10 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-paper/95 text-ink shadow-[0_1px_0_rgb(26_26_23/0.08)] transition-colors hover:bg-paper",
        withLabel ? "border border-line px-4" : "w-11",
        className,
      )}
    >
      <svg key={bump} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style={bump ? { animation: "save-pop 380ms cubic-bezier(0.22,0.8,0.26,1)" } : undefined}>
        <path
          d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z"
          fill={saved ? "var(--color-terracotta)" : "transparent"}
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          style={{ transition: "fill 220ms ease" }}
        />
        <rect
          x="10"
          y="12.5"
          width="4"
          height="4"
          rx="0.5"
          fill="var(--color-ivory)"
          stroke="var(--color-ink)"
          strokeWidth="1.25"
          style={{ transformOrigin: "12px 14.5px", transform: saved ? "scale(1)" : "scale(0)", transition: "transform 260ms cubic-bezier(0.34,1.4,0.64,1) 80ms" }}
        />
        <path d="M9.5 20v-4.5h5V20" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" style={{ opacity: saved ? 0 : 1, transition: "opacity 160ms ease" }} />
      </svg>
      {withLabel && <span className="text-sm font-semibold">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

/* ── Card ──────────────────────────────────────────────── */

export function ListingCard({
  listing,
  match,
  crop = "standard",
  active = false,
  onHover,
  priority = false,
  index = 0,
}: {
  listing: Listing;
  match?: MatchResult;
  crop?: "standard" | "tall" | "wide";
  active?: boolean;
  onHover?: (id: string | null) => void;
  priority?: boolean;
  index?: number;
}) {
  const unavailable = listing.status !== "active";
  return (
    <article
      id={`listing-${listing.id}`}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(listing.id)}
      onBlur={() => onHover?.(null)}
      className={cx("group relative flex flex-col rounded-[20px] transition-shadow duration-200", active && "shadow-[0_0_0_2px_var(--color-ink)]")}
    >
      <div className="relative">
        <Photo
          src={listing.photos[0]?.url}
          alt={listing.photos[0]?.alt ?? ""}
          seed={index}
          priority={priority}
          className={cx("rounded-[18px]", crop === "tall" ? "aspect-[4/5]" : crop === "wide" ? "aspect-[16/10]" : "aspect-[4/3]")}
          imgClassName={cx("transition-transform duration-500 ease-out group-hover:scale-[1.04]", unavailable && "grayscale")}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-14">
          <Pill tone="paper">{ROOM_TYPE_LABEL[listing.roomType]}</Pill>
          <ListingVerificationPill level={listing.verification} />
          {unavailable && <Pill tone="ink">{listing.status === "occupied" ? "Filled" : "Not available"}</Pill>}
        </div>
        <SaveButton listingId={listing.id} className="absolute right-2.5 top-2.5" />
        {match && <MatchChip result={match} className="absolute bottom-3 left-3 shadow-[0_1px_0_rgb(26_26_23/0.1)]" />}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3.5 transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
        <p className="micro flex items-center gap-2 text-ink-soft">
          <span>{listing.locality}</span>
          <span aria-hidden="true" className="h-px w-4 bg-ink/30" />
          <span>{availability(listing.availableFrom)}</span>
        </p>
        <h3 className="display mt-1.5 text-[1.55rem] leading-[1.08]">
          <Link href={`/homes/${listing.id}`} className="rounded-sm after:absolute after:inset-0 after:rounded-[20px]">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-ink-soft">
          {listing.bedrooms} BHK · {FURNISHING_LABEL[listing.furnishing]}
          {listing.brokerage === 0 ? " · No brokerage" : ` · ${rupees(listing.brokerage)} brokerage`}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
          <p>
            <span className="text-xl font-semibold tabular-nums">{rupees(listing.rent)}</span>
            <span className="text-sm text-ink-soft"> / month</span>
            <span className="block text-xs text-ink-soft">{rupees(listing.deposit)} deposit</span>
          </p>
          <span className="flex items-center gap-2">
            {listing.isDemo && <SamplePill />}
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-line transition-all duration-300 group-hover:translate-x-1 group-hover:border-ink group-hover:bg-ink group-hover:text-ivory">
              <Icon name="arrow" size={16} />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton({ crop = "standard" }: { crop?: "standard" | "tall" | "wide" }) {
  return (
    <div aria-hidden="true">
      <div className={cx("skeleton rounded-[18px]", crop === "tall" ? "aspect-[4/5]" : crop === "wide" ? "aspect-[16/10]" : "aspect-[4/3]")}>
        {/* a faint plan outline, so loading still looks like a home */}
        <svg viewBox="0 0 120 90" className="absolute inset-0 m-auto h-1/2 w-1/2 opacity-30">
          <path d="M10 10h100v70H10zM55 10v30M55 52v28M10 45h20M42 45h13" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="mt-4 space-y-2.5 px-1">
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-7 w-4/5" />
        <div className="skeleton h-3.5 w-3/5" />
        <div className="skeleton mt-4 h-8 w-1/3" />
      </div>
    </div>
  );
}

/* ── Report ────────────────────────────────────────────── */

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  subject,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetType: ReportTarget;
  targetId: string;
  subject: string;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setError(null);
      setDone(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError("Choose what's wrong so a moderator knows where to look.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      await api.report({ targetType, targetId, reason, details });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={done ? "Report received" : `Report ${subject}`} description={done ? undefined : "Reports go to a moderator. The person you report isn't told who sent it."}>
      {done ? (
        <div className="space-y-4">
          <p>Thank you. Your report is in the moderation queue. If several people report the same listing it is taken out of search until someone has looked at it.</p>
          <Note icon="shield">If you&apos;ve already paid someone or feel unsafe, don&apos;t wait for us: call the national cybercrime helpline on 1930 or report at cybercrime.gov.in.</Note>
          <button type="button" className="btn btn-ink w-full" onClick={() => onOpenChange(false)}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What&apos;s wrong?</legend>
            <div className="space-y-2">
              {REPORT_REASONS[targetType].map((r) => (
                <label key={r} className={cx("flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm font-medium transition-colors", reason === r ? "border-ink bg-sand" : "border-line hover:border-ink")}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[var(--color-ink)]" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Anything else we should know?" hint="Optional. Dates, amounts and what was said all help.">
            {(p) => <textarea {...p} className="field min-h-[96px]" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />}
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="submit" className="btn btn-ink w-full" disabled={pending}>
            {pending ? "Sending…" : "Send report"}
          </button>
        </form>
      )}
    </Modal>
  );
}

/* ── First message ─────────────────────────────────────── */

export function MessageRequestDialog({
  open,
  onOpenChange,
  toUserId,
  toName,
  listingId,
  suggestion,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  toUserId: string;
  toName: string;
  listingId: string | null;
  suggestion: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setBody(suggestion);
      setError(null);
    }
  }, [open, suggestion]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      const c = await api.startConversation({ toUserId, listingId, body: parsed.data });
      onOpenChange(false);
      router.push(`/messages?c=${c.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Write to ${toName}`} description={`This goes as a request. ${toName} sees your message and profile, and you can chat once they accept.`}>
      <form onSubmit={send} className="space-y-4" noValidate>
        <Field label="Your message" hint="Say who you are and when you'd like to move. Your phone and email stay private.">
          {(p) => <textarea {...p} className="field min-h-[140px]" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} autoFocus />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Note icon="shield">Never pay a token, deposit or &ldquo;booking amount&rdquo; before you&apos;ve visited and met the people.</Note>
        <button type="submit" className="btn btn-ink w-full" disabled={pending}>
          <Icon name="send" size={16} />
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
    </Modal>
  );
}
