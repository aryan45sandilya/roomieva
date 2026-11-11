"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { ListingCard, MessageRequestDialog, ReportDialog } from "@/components/listing";
import { CompatibilityOrbit, MatchStory } from "@/components/orbit";
import { Avatar, EmptyState, ErrorNote, Modal, Note, Pill, SamplePill, VERIFICATION_COPY, useToast } from "@/components/ui";
import { errorMessage, getApi } from "@/lib/data/api";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { firstName, rupees, shortDate } from "@/lib/format";
import { CATEGORIES, IMPORTANCE_LABEL, QUESTIONS } from "@/lib/lifestyle";
import type { Verification } from "@/lib/types";

export default function FlatmateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { session, profile: me, lifestyle: mine } = useMe();
  const live = useLive(
    async (api) => {
      const person = await api.getProfile(id);
      if (!person) return null;
      const [answers, listings, conversations, blocked] = await Promise.all([
        api.getLifestyle(id),
        api.listListings(),
        session ? api.listConversations() : Promise.resolve([]),
        api.listBlocked(),
      ]);
      return {
        person,
        answers,
        listings: listings.filter((l) => l.listerId === id),
        thread: conversations.find((c) => c.other.id === id && c.conversation.listingId === null) ?? null,
        blocked: blocked.includes(id),
      };
    },
    [id, session?.userId],
  );
  const { matches } = useMatches(useMemo(() => [id], [id]));
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  if (live.loading && live.data === undefined) {
    return (
      <div className="shell py-12" aria-busy="true">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="skeleton h-28 w-28 !rounded-full" />
          <div className="skeleton h-20 w-2/3" />
          <div className="skeleton h-40" />
        </div>
      </div>
    );
  }
  if (live.error && !live.data) return <div className="shell py-16"><ErrorNote onRetry={live.reload}>{live.error}</ErrorNote></div>;
  if (!live.data) {
    return (
      <EmptyState title="We can't find that person" action={<Link href="/flatmates" className="btn btn-ink">Back to people</Link>}>
        They may have left Roomieva, or the link might be wrong.
      </EmptyState>
    );
  }

  const { person, answers, listings, thread, blocked } = live.data;
  const self = session?.userId === person.id;
  const name = firstName(person.displayName) || "This member";
  const match = matches[person.id];
  const seeking = person.intent !== "listing";
  const here = `/flatmates/${person.id}`;
  const checks = (Object.keys(VERIFICATION_COPY) as (keyof Verification)[]).map((k) => ({ ...VERIFICATION_COPY[k], on: person.verification[k] }));

  const toggleBlock = async () => {
    try {
      const api = await getApi();
      if (blocked) {
        await api.unblockUser(person.id);
        toast(`${name} is unblocked`);
      } else {
        await api.blockUser(person.id);
        toast(`${name} is blocked`);
      }
      setBlockOpen(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const contact = () => {
    if (!session) return router.push(`/auth?next=${encodeURIComponent(here)}`);
    if (me && !me.onboarded) return router.push(`/onboarding?next=${encodeURIComponent(here)}`);
    setMessageOpen(true);
  };

  return (
    <article className="shell py-8 md:py-14">
      <Link href="/flatmates" className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium hover:underline hover:underline-offset-4">
        <Icon name="back" size={16} /> Everyone
      </Link>

      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <Avatar profile={person} size={132} />
            <div>
              <p className="micro flex flex-wrap items-center gap-2 text-ink-soft">
                {person.occupation || "Member"} · {person.city}
                {person.isDemo && <SamplePill />}
              </p>
              <h1 className="display mt-2 text-7xl leading-[0.95] sm:text-8xl">{name}</h1>
            </div>
          </header>

          {self && (
            <Note className="mt-8">
              This is how other members see you.{" "}
              <Link href="/profile" className="link font-semibold">
                Edit your profile
              </Link>
            </Note>
          )}
          {blocked && (
            <Note icon="block" className="mt-8">
              You&apos;ve blocked {name}. They can&apos;t message you and you won&apos;t see each other in search.
            </Note>
          )}

          <section className="mt-10" aria-labelledby="about-me">
            <SectionMark n="01">About</SectionMark>
            <h2 id="about-me" className="sr-only">
              About {name}
            </h2>
            <p className="display mt-4 max-w-3xl text-3xl leading-snug sm:text-[2.5rem]">{person.bio ? <>&ldquo;{person.bio}&rdquo;</> : <span className="text-ink-soft">{name} hasn&apos;t written an introduction yet.</span>}</p>
          </section>

          {seeking && (
            <section className="mt-14" aria-labelledby="looking">
              <SectionMark n="02">Looking for</SectionMark>
              <h2 id="looking" className="sr-only">
                What {name} is looking for
              </h2>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-3">
                {[
                  ["Budget", `${rupees(person.budgetMin)} to ${rupees(person.budgetMax)}`],
                  ["Moving", person.moveInBy ? `By ${shortDate(person.moveInBy)}` : "Flexible"],
                  ["Neighbourhoods", person.preferredLocalities.join(", ") || "Open to anywhere"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-paper p-5">
                    <dt className="micro text-ink-soft">{k}</dt>
                    <dd className="mt-1.5 text-lg font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="mt-14" aria-labelledby="living">
            <SectionMark n={seeking ? "03" : "02"}>At home</SectionMark>
            <h2 id="living" className="display mt-4 text-4xl sm:text-5xl">
              How {name} lives
            </h2>
            {!session ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sand p-5">
                <p className="flex max-w-md items-start gap-2">
                  <Icon name="lock" size={18} className="mt-1 shrink-0" />
                  Lifestyle answers are only shown to signed-in members, because some of them are personal.
                </p>
                <Link href={`/auth?next=${encodeURIComponent(here)}`} className="btn btn-ink">
                  Log in to see
                </Link>
              </div>
            ) : !answers ? (
              <p className="mt-4 text-ink-soft">{name} hasn&apos;t answered the lifestyle questions yet.</p>
            ) : (
              <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {CATEGORIES.map((cat) => {
                  const rows = QUESTIONS.filter((q) => q.category === cat.id && answers[q.id] && answers[q.id]!.value !== null);
                  if (rows.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="micro border-b border-ink pb-2 text-ink-soft">{cat.label}</h3>
                      <ul>
                        {rows.map((q) => {
                          const a = answers[q.id]!;
                          return (
                            <li key={q.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
                              <span>
                                <span className="block text-xs text-ink-soft">{q.short}</span>
                                <span className="font-semibold">{q.options[a.value as number].label}</span>
                              </span>
                              {a.importance !== "flexible" && (
                                <Pill tone={a.importance === "dealbreaker" ? "clay" : "sage"} icon={a.importance === "dealbreaker" ? "lock" : undefined}>
                                  {IMPORTANCE_LABEL[a.importance]}
                                </Pill>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {!self && session && (
            <section className="mt-14 rounded-[28px] bg-sage p-5 sm:p-8" aria-labelledby="fit">
              <h2 id="fit" className="micro mb-5">
                You and {name}
              </h2>
              {!mine ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-md">Answer the lifestyle questions and this becomes a side-by-side comparison.</p>
                  <Link href={`/quiz?next=${encodeURIComponent(here)}`} className="btn btn-ink">
                    Answer the questions
                  </Link>
                </div>
              ) : !match ? (
                <p>There&apos;s nothing to compare until {name} answers the lifestyle questions.</p>
              ) : (
                <div className="space-y-8 rounded-3xl bg-ivory p-5 sm:p-8">
                  <MatchStory result={match} them={name} />
                  <CompatibilityOrbit result={match} them={name} />
                </div>
              )}
            </section>
          )}

          {listings.length > 0 && (
            <section className="mt-14" aria-labelledby="their-homes">
              <h2 id="their-homes" className="display text-4xl">
                {name}&apos;s listings
              </h2>
              <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2">
                {listings.map((l, i) => (
                  <li key={l.id}>
                    <ListingCard listing={l} match={l.listerLivesHere ? match : undefined} index={i} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-label="Contact and checks">
          <div className="sticky top-24 space-y-5">
            {!self && (
              <div className="rounded-[26px] border border-ink bg-paper p-5 shadow-lift">
                {thread ? (
                  <Link href={`/messages?c=${thread.conversation.id}`} className="btn btn-ink w-full">
                    <Icon name="chat" size={16} /> {thread.conversation.status === "pending" ? "Request sent. Open it" : "Open your conversation"}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-accent w-full" onClick={contact} disabled={blocked}>
                    <Icon name="chat" size={16} /> Send {name} a request
                  </button>
                )}
                <p className="mt-3 text-sm text-ink-soft">They&apos;ll see your first message and your profile. You can chat once they accept.</p>
                {session && (
                  <div className="mt-4 flex gap-2 border-t border-line pt-4">
                    <button type="button" className="btn btn-quiet btn-sm !min-h-[44px] flex-1" onClick={() => (blocked ? toggleBlock() : setBlockOpen(true))}>
                      <Icon name="block" size={15} /> {blocked ? "Unblock" : "Block"}
                    </button>
                    <button type="button" className="btn btn-quiet btn-sm !min-h-[44px] flex-1" onClick={() => setReportOpen(true)}>
                      <Icon name="flag" size={15} /> Report
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-[26px] border border-line p-5">
              <h2 className="micro text-ink-soft">What&apos;s been confirmed</h2>
              <ul className="mt-4 space-y-3.5">
                {checks.map((c) => (
                  <li key={c.label} className="flex gap-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.on ? "bg-olive text-ivory" : "border border-line text-ink-soft"}`}>
                      <Icon name={c.on ? "check" : "minus"} size={12} strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {c.label}
                        {!c.on && <span className="font-normal text-ink-soft"> · not yet</span>}
                      </span>
                      {c.on && <span className="block text-xs text-ink-soft">{c.means}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
                None of these prove who someone is.{person.isDemo ? " This is a sample profile: an invented person, not a real member." : ""} Surnames, emails and phone numbers are never shown on profiles.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <MessageRequestDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        toUserId={person.id}
        toName={name}
        listingId={null}
        suggestion={`Hi ${name}, I'm ${firstName(me?.displayName ?? "") || "new here"}. ${seeking ? "I'm also looking for a place, and it sounds like we might live in a similar way. Would you be open to a chat?" : "I saw your profile and wanted to say hello."}`}
      />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={person.id} subject={name} />
      <Modal open={blockOpen} onOpenChange={setBlockOpen} title={`Block ${name}?`}>
        <ul className="mb-6 list-disc space-y-1.5 pl-5">
          <li>They won&apos;t be able to message you, and you won&apos;t be able to message them.</li>
          <li>You won&apos;t see each other in search.</li>
          <li>Any contact details you agreed to share with them are withdrawn.</li>
          <li>They aren&apos;t told. You can unblock them from this page.</li>
        </ul>
        <div className="flex gap-3">
          <button type="button" className="btn btn-quiet flex-1" onClick={() => setBlockOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger flex-1" onClick={toggleBlock}>
            Block {name}
          </button>
        </div>
      </Modal>
    </article>
  );
}
