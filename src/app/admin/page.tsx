"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { EmptyState, ErrorNote, LISTING_VERIFICATION_COPY, Note, PageHeading, PersonLine, Photo, Pill, SignInGate, useToast } from "@/components/ui";
import { ROOM_TYPE_LABEL } from "@/lib/constants";
import { errorMessage, getApi, type DataApi } from "@/lib/data/api";
import { useLive, useMe } from "@/lib/data/hooks";
import { ago, rupees } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  approve: "Approved a listing",
  mark_reviewed: "Marked a listing as reviewed",
  remove: "Removed a listing",
  report_actioned: "Actioned a report",
  report_dismissed: "Dismissed a report",
};

function ListingReview({ item, onAct, busy }: { item: ReviewItem; onAct: (done: string, fn: (api: DataApi, note: string) => Promise<void>, note: string) => void; busy: boolean }) {
  const [note, setNote] = useState("");
  const { listing: l, lister } = item;
  const held = l.status === "under_review";
  return (
    <li className="rounded-[24px] border border-line bg-paper p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Photo src={l.photos[0]?.url} alt={l.photos[0]?.alt ?? ""} sizes="180px" className="aspect-[4/3] rounded-2xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={held ? "clay" : "sage"}>{held ? "Held from search" : "Live"}</Pill>
            <Pill tone="line">{LISTING_VERIFICATION_COPY[l.verification].label}</Pill>
            <span className="text-sm text-ink-soft">
              {l.locality} · {ROOM_TYPE_LABEL[l.roomType]} · {rupees(l.rent)} / mo
            </span>
          </div>
          <h3 className="display mt-2 text-3xl leading-tight">
            <Link href={`/homes/${l.id}`} className="hover:underline hover:underline-offset-4">
              {l.title}
            </Link>
          </h3>
          {lister && (
            <Link href={`/flatmates/${lister.id}`} className="mt-3 inline-flex rounded-xl pr-2 hover:bg-sand">
              <PersonLine profile={lister} size={32} sub={lister.occupation} />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-sand p-4">
        <h4 className="micro text-ink-soft">Why it&apos;s here</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {item.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {item.openReports.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
            {item.openReports.map((r) => (
              <li key={r.id}>
                <span className="font-semibold">{r.reason}</span>
                <span className="text-ink-soft"> · {ago(r.createdAt)}</span>
                {r.details && <p className="mt-0.5 whitespace-pre-line text-ink-soft">&ldquo;{r.details}&rdquo;</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Note for the log (optional)</span>
        <input className="field" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked and why you decided this" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {held || item.openReports.length > 0 ? (
          <button type="button" className="btn btn-ink btn-sm !min-h-[44px]" disabled={busy} onClick={() => onAct(held ? "Released to search" : "Reports dismissed", (api, n) => api.adminResolveListing(l.id, "approve", n), note)}>
            <Icon name="check" size={15} /> {held ? "Looks fine. Release it" : "Looks fine. Dismiss reports"}
          </button>
        ) : (
          <p className="flex min-h-[44px] items-center text-sm text-ink-soft">Shown for information. It clears when the lister reconfirms or edits it.</p>
        )}
        {l.verification === "none" && (
          <button type="button" className="btn btn-quiet btn-sm !min-h-[44px]" disabled={busy} onClick={() => onAct("Marked as reviewed", (api, n) => api.adminResolveListing(l.id, "mark_reviewed", n), note)}>
            <Icon name="shield" size={15} /> Approve and mark reviewed
          </button>
        )}
        <button type="button" className="btn btn-danger btn-sm ml-auto !min-h-[44px]" disabled={busy} onClick={() => onAct("Listing removed", (api, n) => api.adminResolveListing(l.id, "remove", n), note)}>
          <Icon name="trash" size={15} /> Remove listing
        </button>
      </div>
    </li>
  );
}

export default function AdminPage() {
  const { session, profile } = useMe();
  const toast = useToast();
  const isAdmin = Boolean(profile?.isAdmin);
  const live = useLive(async (api) => (isAdmin ? api.adminQueue() : null), [isAdmin, session?.userId]);
  const [busy, setBusy] = useState(false);

  if (session === undefined) return <div className="shell py-12"><div className="skeleton h-72 rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/admin" />;
  if (!isAdmin) {
    return (
      <EmptyState title="Moderators only" action={<Link href="/dashboard" className="btn btn-ink">Back to your dashboard</Link>}>
        This page is for the people who review reports. If you&apos;ve seen something wrong, use Report on the listing, profile or conversation.
      </EmptyState>
    );
  }

  const act = async (done: string, fn: (api: DataApi, note: string) => Promise<void>, note: string) => {
    setBusy(true);
    try {
      await fn(await getApi(), note.trim());
      toast(done);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const queue = live.data;

  return (
    <div className="shell py-10 md:py-14">
      <PageHeading kicker={<SectionMark n="—">Moderation</SectionMark>} title="Review queue">
        Held listings, reported listings, and reports about people and conversations. Every decision is logged with your account.
      </PageHeading>
      <Note icon="shield" className="mb-8">
        &ldquo;Reviewed&rdquo; means you read the listing and its photos for obvious problems. It is not a claim that the lister owns the property. Only use it when you&apos;ve actually looked.
      </Note>

      {live.error && <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>}

      {live.loading && !queue ? (
        <div className="space-y-4">
          <div className="skeleton h-56 rounded-3xl" />
          <div className="skeleton h-56 rounded-3xl" />
        </div>
      ) : queue ? (
        <div className="grid gap-x-12 gap-y-12 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-12">
            <section aria-labelledby="q-listings">
              <h2 id="q-listings" className="display mb-5 text-4xl">
                Listings <span className="text-ink-soft">· {queue.listings.length}</span>
              </h2>
              {queue.listings.length === 0 ? (
                <Note icon="check">Nothing waiting. No held, reported, stale or oddly priced listings.</Note>
              ) : (
                <ul className="space-y-4">
                  {queue.listings.map((item) => (
                    <ListingReview key={item.listing.id} item={item} onAct={act} busy={busy} />
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="q-reports">
              <h2 id="q-reports" className="display mb-5 text-4xl">
                People and conversations <span className="text-ink-soft">· {queue.otherReports.length}</span>
              </h2>
              {queue.otherReports.length === 0 ? (
                <Note icon="check">No open reports about people or conversations.</Note>
              ) : (
                <ul className="space-y-3">
                  {queue.otherReports.map((r) => (
                    <li key={r.id} className="rounded-[22px] border border-line bg-paper p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="clay">{r.targetType === "user" ? "Person" : "Conversation"}</Pill>
                        {r.targetType === "user" ? (
                          <Link href={`/flatmates/${r.targetId}`} className="link font-semibold">
                            {r.subject}
                          </Link>
                        ) : (
                          <span className="font-semibold">{r.subject}</span>
                        )}
                        <span className="text-sm text-ink-soft">· {ago(r.createdAt)}</span>
                      </div>
                      <p className="mt-2 font-semibold">{r.reason}</p>
                      {r.details && <p className="mt-1 whitespace-pre-line text-ink-soft">&ldquo;{r.details}&rdquo;</p>}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-ink btn-sm !min-h-[44px]" disabled={busy} onClick={() => act("Marked as actioned", (api, n) => api.adminResolveReport(r.id, "actioned", n), "")}>
                          Action taken
                        </button>
                        <button type="button" className="btn btn-quiet btn-sm !min-h-[44px]" disabled={busy} onClick={() => act("Report dismissed", (api, n) => api.adminResolveReport(r.id, "dismissed", n), "")}>
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside aria-labelledby="q-log">
            <div className="sticky top-28 rounded-[24px] border border-line p-5">
              <h2 id="q-log" className="micro text-ink-soft">
                Recent decisions
              </h2>
              {queue.actions.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">Nothing logged yet.</p>
              ) : (
                <ol className="mt-3 divide-y divide-line">
                  {queue.actions.map((a) => (
                    <li key={a.id} className="py-3 text-sm">
                      <p className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</p>
                      {a.note && <p className="text-ink-soft">{a.note}</p>}
                      <p className="text-xs text-ink-soft">{ago(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
