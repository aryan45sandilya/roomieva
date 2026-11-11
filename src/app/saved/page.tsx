"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SectionMark } from "@/components/brand";
import { ListingCard, ListingCardSkeleton } from "@/components/listing";
import { EmptyState, ErrorNote, PageHeading, SignInGate } from "@/components/ui";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import type { Listing } from "@/lib/types";

export default function SavedPage() {
  const { session, savedIds } = useMe();
  const key = savedIds.join(",");
  // Saved homes are fetched one by one so that paused or filled ones still show, greyed out.
  const live = useLive(
    async (api) => {
      const found = await Promise.all(savedIds.map((id) => api.getListing(id).catch(() => null)));
      return found.filter((l): l is Listing => l !== null);
    },
    [key],
  );
  const listings = useMemo(() => live.data ?? [], [live.data]);
  const { matches } = useMatches(useMemo(() => listings.filter((l) => l.listerLivesHere).map((l) => l.listerId), [listings]));

  if (session === undefined) return <div className="shell py-12"><div className="skeleton h-64 rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/saved" title="Log in to see your saved homes" />;

  const gone = savedIds.length - listings.length;

  return (
    <div className="shell py-10 md:py-14">
      <PageHeading kicker={<SectionMark n="—">Shortlist</SectionMark>} title="Saved homes">
        Only you can see this list. Listers aren&apos;t told when you save their home.
      </PageHeading>

      {live.error && <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>}

      {live.loading && live.data === undefined ? (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          action={
            <Link href="/explore" className="btn btn-ink">
              Explore homes
            </Link>
          }
        >
          Tap the key on any home to keep it here while you decide.
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <li key={l.id}>
                <ListingCard listing={l} match={l.listerLivesHere ? matches[l.listerId] : undefined} index={i} priority={i < 3} />
              </li>
            ))}
          </ul>
          {gone > 0 && !live.loading && (
            <p className="mt-8 text-sm text-ink-soft">
              {gone} saved {gone === 1 ? "home has" : "homes have"} been removed by the lister or a moderator and can&apos;t be shown.
            </p>
          )}
        </>
      )}
    </div>
  );
}
