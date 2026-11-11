"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SectionMark } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { ListingCard, ListingCardSkeleton } from "@/components/listing";
import { MatchChip } from "@/components/orbit";
import { Avatar, ErrorNote, Note, SignInGate, VerificationList } from "@/components/ui";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { DEFAULT_FILTERS, applyFilters } from "@/lib/filters";
import { firstName } from "@/lib/format";
import { freshness } from "@/lib/listing-quality";
import { QUESTIONS } from "@/lib/lifestyle";
import { answeredCount } from "@/lib/matching";

function Tile({ href, icon, value, label, urgent }: { href: string; icon: IconName; value: number | string; label: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`group flex flex-col rounded-[22px] border p-5 transition-colors hover:border-ink ${urgent ? "border-ink bg-ink text-ivory" : "border-line bg-paper"}`}>
      <span className="flex items-center justify-between">
        <Icon name={icon} size={20} />
        <Icon name="arrowUpRight" size={16} className="opacity-50 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="display mt-6 text-5xl tabular-nums">{value}</span>
      <span className={`mt-1 text-sm ${urgent ? "text-ivory/75" : "text-ink-soft"}`}>{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { session, profile, lifestyle, savedIds } = useMe();
  const live = useLive(
    async (api) => {
      if (!session) return null;
      const [conversations, mine, listings, people] = await Promise.all([api.listConversations(), api.myListings(), api.listListings(), api.listPeople()]);
      return { conversations, mine, listings, people };
    },
    [session?.userId],
  );

  const data = live.data;
  const listerIds = useMemo(() => [...new Set((data?.listings ?? []).filter((l) => l.listerLivesHere).map((l) => l.listerId))], [data?.listings]);
  const peopleIds = useMemo(() => (data?.people ?? []).map((p) => p.id), [data?.people]);
  const { matches } = useMatches(useMemo(() => [...listerIds, ...peopleIds], [listerIds, peopleIds]));

  const homes = useMemo(() => {
    const all = (data?.listings ?? []).filter((l) => l.listerId !== session?.userId);
    const scores = Object.fromEntries(all.map((l) => [l.id, l.listerLivesHere ? (matches[l.listerId]?.score ?? null) : null]));
    const inBudget = profile ? all.filter((l) => l.rent <= profile.budgetMax * 1.1) : all;
    return applyFilters(inBudget.length >= 3 ? inBudget : all, DEFAULT_FILTERS, scores).slice(0, 3);
  }, [data?.listings, matches, profile, session?.userId]);

  const people = useMemo(
    () =>
      (data?.people ?? [])
        .filter((p) => matches[p.id]?.score != null)
        .sort((a, b) => (matches[b.id].score ?? 0) - (matches[a.id].score ?? 0))
        .slice(0, 4),
    [data?.people, matches],
  );

  if (session === undefined) return <div className="shell py-12"><div className="skeleton h-72 rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/dashboard" />;

  const requests = (data?.conversations ?? []).filter((c) => c.conversation.status === "pending" && c.conversation.recipientId === session.userId).length;
  const unread = (data?.conversations ?? []).reduce((n, c) => n + c.unread, 0);
  const needConfirm = (data?.mine ?? []).filter((l) => l.status === "active" && freshness(l) !== "fresh").length;
  const answered = lifestyle ? answeredCount(lifestyle) : 0;
  const seeking = profile?.intent !== "listing";

  // What's left before the account is fully useful, most important first.
  const todo: { href: string; text: string }[] = [];
  if (profile && !profile.onboarded) todo.push({ href: "/onboarding", text: "Finish setting up your profile" });
  if (answered < 5) todo.push({ href: "/quiz", text: answered === 0 ? "Answer the lifestyle questions to see match scores" : `Answer a few more lifestyle questions (${answered} of ${QUESTIONS.length} so far)` });
  if (profile?.onboarded && !profile.bio) todo.push({ href: "/profile", text: "Add a few lines about yourself. Profiles with an introduction get more replies" });

  return (
    <div className="shell py-10 md:py-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <SectionMark n="—">Your Roomieva</SectionMark>
          <h1 className="display mt-4 text-5xl sm:text-7xl">
            Hello{profile?.displayName ? `, ${firstName(profile.displayName)}` : ""}.
          </h1>
        </div>
        {profile && (
          <Link href={`/flatmates/${profile.id}`} className="flex items-center gap-3 rounded-full border border-line bg-paper py-2 pl-2 pr-5 transition-colors hover:border-ink">
            <Avatar profile={profile} size={44} />
            <span className="text-sm">
              <span className="block font-semibold">See your public profile</span>
              <VerificationList verification={profile.verification} compact />
            </span>
          </Link>
        )}
      </header>

      {live.error && <ErrorNote className="mt-8" onRetry={live.reload}>{live.error}</ErrorNote>}

      {todo.length > 0 && (
        <ul className="mt-8 space-y-2">
          {todo.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-sage px-5 py-3 font-medium transition-transform hover:translate-x-1">
                {t.text} <Icon name="arrow" size={16} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="At a glance" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile href="/messages" icon="chat" value={live.loading ? "–" : requests} label={requests === 1 ? "request waiting for you" : "requests waiting for you"} urgent={requests > 0} />
        <Tile href="/messages" icon="send" value={live.loading ? "–" : unread} label={unread === 1 ? "unread message" : "unread messages"} />
        <Tile href="/saved" icon="key" value={savedIds.length} label={savedIds.length === 1 ? "saved home" : "saved homes"} />
        <Tile href="/my-listings" icon="sofa" value={live.loading ? "–" : (data?.mine.length ?? 0)} label={needConfirm > 0 ? `of your listings · ${needConfirm} to confirm` : "of your listings"} urgent={needConfirm > 0 && requests === 0} />
      </section>

      {seeking && (
        <section className="mt-14" aria-labelledby="for-you">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="for-you" className="display text-4xl sm:text-5xl">
              Homes that fit
            </h2>
            <Link href="/explore" className="link min-h-[44px] shrink-0 font-semibold">
              See all
            </Link>
          </div>
          {live.loading && !data ? (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </div>
          ) : homes.length === 0 ? (
            <Note>Nothing listed right now. New homes show up here as soon as they&apos;re published.</Note>
          ) : (
            <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {homes.map((l, i) => (
                <li key={l.id}>
                  <ListingCard listing={l} match={l.listerLivesHere ? matches[l.listerId] : undefined} index={i} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-14" aria-labelledby="your-people">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="your-people" className="display text-4xl sm:text-5xl">
            {seeking ? "People who live like you" : "People looking right now"}
          </h2>
          <Link href="/flatmates" className="link min-h-[44px] shrink-0 font-semibold">
            See all
          </Link>
        </div>
        {!lifestyle ? (
          <Note>
            <Link href="/quiz" className="link font-semibold">
              Answer the lifestyle questions
            </Link>{" "}
            and the people closest to how you live appear here.
          </Note>
        ) : people.length === 0 ? (
          <Note>No scored matches yet. They&apos;ll appear as more people answer the lifestyle questions.</Note>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/flatmates/${p.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-ink">
                  <Avatar profile={p} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{firstName(p.displayName)}</span>
                    <span className="block truncate text-sm text-ink-soft">
                      {p.occupation}
                      {p.preferredLocalities.length ? ` · ${p.preferredLocalities.slice(0, 2).join(", ")}` : ""}
                    </span>
                  </span>
                  <MatchChip result={matches[p.id]} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
