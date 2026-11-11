"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { EmptyState, ErrorNote, Modal, PageHeading, Photo, Pill, SignInGate, useToast } from "@/components/ui";
import { ROOM_TYPE_LABEL } from "@/lib/constants";
import { errorMessage, getApi, type DataApi } from "@/lib/data/api";
import { useLive, useMe } from "@/lib/data/hooks";
import { ago, rupees } from "@/lib/format";
import { daysUntilStale, freshness } from "@/lib/listing-quality";
import type { Listing } from "@/lib/types";

function statusLine(l: Listing): { tone: "sage" | "sand" | "clay" | "line" | "ink"; label: string; detail: string } {
  if (l.status === "draft") return { tone: "line", label: "Draft", detail: "Not public. Finish it and publish when you're ready." };
  if (l.status === "paused") return { tone: "sand", label: "Paused", detail: "Hidden from search. Existing conversations stay open." };
  if (l.status === "occupied") return { tone: "ink", label: "Filled", detail: "Marked as taken. Relist it if the room opens up again." };
  if (l.status === "under_review") return { tone: "clay", label: "With a moderator", detail: `${l.reviewReason ?? "Held for a check"}. It'll go live once someone has looked.` };
  if (l.status === "removed") return { tone: "clay", label: "Removed", detail: "A moderator took this down. Write to hello@roomieva.example if you think that's a mistake." };
  const f = freshness(l);
  if (f === "stale") return { tone: "clay", label: "Hidden: needs confirming", detail: "It's been over 21 days since you confirmed this room is free, so it's out of search." };
  if (f === "renew_soon") return { tone: "sand", label: "Live: confirm soon", detail: `Drops out of search in ${daysUntilStale(l)} day${daysUntilStale(l) === 1 ? "" : "s"} unless you confirm it's still free.` };
  return { tone: "sage", label: "Live", detail: l.lastConfirmedAt ? `Confirmed available ${ago(l.lastConfirmedAt)}.` : "Showing in search." };
}

export default function MyListingsPage() {
  const { session } = useMe();
  const toast = useToast();
  const live = useLive(async (api) => (session ? api.myListings() : []), [session?.userId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Listing | null>(null);

  if (session === undefined) return <div className="shell py-12"><div className="skeleton h-64 rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/my-listings" />;

  const act = async (l: Listing, done: string, fn: (api: DataApi) => Promise<unknown>) => {
    setBusy(l.id);
    try {
      await fn(await getApi());
      toast(done);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const listings = live.data ?? [];

  return (
    <div className="shell py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading kicker={<SectionMark n="—">Listers</SectionMark>} title="My listings">
          Keep them current. People trust listings that were confirmed recently.
        </PageHeading>
        <Link href="/list" className="btn btn-accent mb-8">
          <Icon name="plus" size={16} /> New listing
        </Link>
      </div>

      {live.error && <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>}

      {live.loading && listings.length === 0 ? (
        <div className="space-y-4">
          <div className="skeleton h-40 rounded-3xl" />
          <div className="skeleton h-40 rounded-3xl" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="Nothing listed yet"
          action={
            <Link href="/list" className="btn btn-ink">
              List your space
            </Link>
          }
        >
          Have a room coming free, or moving out and need someone to take over? It takes about ten minutes.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {listings.map((l) => {
            const s = statusLine(l);
            const locked = l.status === "under_review" || l.status === "removed";
            const isLive = l.status === "active";
            const disabled = busy === l.id;
            return (
              <li key={l.id} className="grid gap-4 rounded-[24px] border border-line bg-paper p-4 sm:grid-cols-[180px_1fr] sm:p-5">
                <Photo src={l.photos[0]?.url} alt={l.photos[0]?.alt ?? ""} sizes="200px" className="aspect-[16/10] rounded-2xl sm:aspect-[4/3]" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={s.tone}>{s.label}</Pill>
                    <span className="text-sm text-ink-soft">
                      {l.locality || "No neighbourhood"} · {ROOM_TYPE_LABEL[l.roomType]} · {l.rent ? `${rupees(l.rent)} / mo` : "No rent set"}
                    </span>
                  </div>
                  <h2 className="display mt-2 text-3xl leading-tight">
                    {l.status === "draft" ? (
                      l.title || "Untitled draft"
                    ) : (
                      <Link href={`/homes/${l.id}`} className="hover:underline hover:underline-offset-4">
                        {l.title}
                      </Link>
                    )}
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-soft">{s.detail}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isLive && (
                      <button type="button" className="btn btn-ink btn-sm !min-h-[44px]" disabled={disabled} onClick={() => act(l, "Confirmed. It stays in search for another 21 days", (api) => api.confirmAvailable(l.id))}>
                        <Icon name="refresh" size={15} /> Still available
                      </button>
                    )}
                    {!locked && (
                      <Link href={`/list?edit=${l.id}`} className="btn btn-quiet btn-sm !min-h-[44px]">
                        <Icon name="edit" size={15} /> {l.status === "draft" ? "Finish and publish" : "Edit"}
                      </Link>
                    )}
                    {isLive && (
                      <>
                        <button type="button" className="btn btn-quiet btn-sm !min-h-[44px]" disabled={disabled} onClick={() => act(l, "Paused. It's hidden from search", (api) => api.setListingStatus(l.id, "paused"))}>
                          <Icon name="pause" size={15} /> Pause
                        </button>
                        <button type="button" className="btn btn-quiet btn-sm !min-h-[44px]" disabled={disabled} onClick={() => act(l, "Marked as filled", (api) => api.setListingStatus(l.id, "occupied"))}>
                          <Icon name="key" size={15} /> Mark as filled
                        </button>
                      </>
                    )}
                    {(l.status === "paused" || l.status === "occupied") && (
                      <button type="button" className="btn btn-ink btn-sm !min-h-[44px]" disabled={disabled} onClick={() => act(l, "Back in search", (api) => api.setListingStatus(l.id, "active"))}>
                        <Icon name="play" size={15} /> {l.status === "occupied" ? "Relist" : "Resume"}
                      </button>
                    )}
                    {l.status !== "under_review" && (
                      <button type="button" className="btn btn-sm ml-auto !min-h-[44px] text-clay hover:bg-sand" disabled={disabled} onClick={() => setDeleting(l)}>
                        <Icon name="trash" size={15} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this listing?" description="This can't be undone.">
        <p className="mb-6">
          &ldquo;{deleting?.title || "Untitled draft"}&rdquo;, its photos and its private address will be deleted. Conversations about it stay in Messages. If the room is just taken, mark it as filled instead.
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn btn-quiet flex-1" onClick={() => setDeleting(null)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger flex-1"
            onClick={() => {
              const l = deleting;
              setDeleting(null);
              if (l) void act(l, "Listing deleted", (api) => api.deleteListing(l.id));
            }}
          >
            Delete for good
          </button>
        </div>
      </Modal>
    </div>
  );
}
