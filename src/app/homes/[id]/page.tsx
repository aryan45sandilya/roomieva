"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SectionMark } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { MessageRequestDialog, ReportDialog, SaveButton } from "@/components/listing";
import { CompatibilityOrbit, MatchStory } from "@/components/orbit";
import { Avatar, EmptyState, ErrorNote, LISTING_VERIFICATION_COPY, Modal, Note, Photo, Pill, SamplePill, VerificationList } from "@/components/ui";
import { FURNISHING_LABEL, PROPERTY_TYPE_LABEL, ROOM_TYPE_LABEL } from "@/lib/constants";
import { useLive, useMatches, useMe } from "@/lib/data/hooks";
import { ago, availability, cx, firstName, fullDate, rupees } from "@/lib/format";
import { freshness } from "@/lib/listing-quality";
import type { Listing } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <dt className="micro text-ink-soft">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function Gallery({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const photos = listing.photos;
  const onScroll = () => {
    const el = track.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <>
      {/* phones: swipe */}
      <div className="relative -mx-[1.125rem] md:hidden">
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto" tabIndex={0} aria-label="Photos">
          {photos.map((p, i) => (
            <Photo key={p.url + i} src={p.url} alt={p.alt} priority={i === 0} sizes="100vw" seed={i} className="aspect-[4/3] w-full shrink-0 snap-center" />
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-ivory">
          {Math.min(slide + 1, photos.length)} / {photos.length}
        </span>
      </div>

      {/* tablet and up: one large frame with two crops beside it */}
      <div className="relative hidden h-[min(62vh,560px)] grid-cols-12 grid-rows-2 gap-3 md:grid">
        <button type="button" onClick={() => setOpen(true)} className="group col-span-8 row-span-2 overflow-hidden rounded-[24px]" aria-label="Open all photos">
          <Photo src={photos[0]?.url} alt={photos[0]?.alt ?? ""} priority sizes="66vw" className="h-full w-full" imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        </button>
        {[1, 2].map((i) => (
          <button key={i} type="button" onClick={() => setOpen(true)} className="group col-span-4 overflow-hidden rounded-[24px]" aria-label="Open all photos">
            <Photo src={photos[i]?.url} alt={photos[i]?.alt ?? ""} sizes="33vw" seed={i} className="h-full w-full" imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
          </button>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="btn btn-sm absolute bottom-4 right-4 bg-paper text-ink shadow-lift hover:bg-ivory">
          <Icon name="grid" size={15} /> All {photos.length} photos
        </button>
      </div>

      <Modal open={open} onOpenChange={setOpen} title="Photos" description={listing.isDemo ? "Sample stock photography. Not pictures of a real home." : "Uploaded by the lister."}>
        <div className="space-y-3">
          {photos.map((p, i) => (
            <Photo key={p.url + i} src={p.url} alt={p.alt} sizes="520px" seed={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function HomePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, profile, lifestyle } = useMe();
  const live = useLive(
    async (api) => {
      const listing = await api.getListing(id);
      if (!listing) return null;
      const [lister, conversations] = await Promise.all([api.getProfile(listing.listerId), session ? api.listConversations() : Promise.resolve([])]);
      return { listing, lister, thread: conversations.find((c) => c.conversation.listingId === listing.id) ?? null };
    },
    [id, session?.userId],
  );
  const listerId = live.data?.listing.listerId;
  const { matches, ready } = useMatches(useMemo(() => (listerId ? [listerId] : []), [listerId]));
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (live.loading && live.data === undefined) {
    return (
      <div className="shell py-8" aria-busy="true" aria-label="Loading this home">
        <div className="skeleton h-[min(62vh,560px)] rounded-[24px]" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-16 w-4/5" />
            <div className="skeleton h-28" />
          </div>
          <div className="skeleton h-72 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (live.error && !live.data) {
    return (
      <div className="shell py-16">
        <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>
      </div>
    );
  }
  if (!live.data) {
    return (
      <EmptyState
        title="This home isn't here any more"
        action={
          <Link href="/explore" className="btn btn-ink">
            See homes that are
          </Link>
        }
      >
        It may have been removed by the lister, taken down by a moderator, or the link might be wrong.
      </EmptyState>
    );
  }

  const { listing, lister, thread } = live.data;
  const mine = session?.userId === listing.listerId;
  const stale = listing.status === "active" && freshness(listing) === "stale";
  const open = listing.status === "active" && !stale;
  const match = lister && listing.listerLivesHere ? matches[lister.id] : undefined;
  const listerName = lister ? firstName(lister.displayName) || "the lister" : "the lister";
  const months = listing.rent > 0 ? listing.deposit / listing.rent : 0;

  const startMessage = () => {
    if (!session) return router.push(`/auth?next=${encodeURIComponent(`/homes/${listing.id}`)}`);
    if (profile && !profile.onboarded) return router.push(`/onboarding?next=${encodeURIComponent(`/homes/${listing.id}`)}`);
    setMessageOpen(true);
  };

  const action = mine ? (
    <Link href="/my-listings" className="btn btn-ink w-full">
      <Icon name="edit" size={16} /> Manage this listing
    </Link>
  ) : thread ? (
    <Link href={`/messages?c=${thread.conversation.id}`} className="btn btn-ink w-full">
      <Icon name="chat" size={16} /> {thread.conversation.status === "pending" ? "Request sent. Open it" : "Open your conversation"}
    </Link>
  ) : (
    <button type="button" className="btn btn-accent w-full" onClick={startMessage} disabled={!open}>
      <Icon name="chat" size={16} /> {open ? `Message ${listerName}` : "Not taking messages"}
    </button>
  );

  return (
    <article className="shell pb-28 pt-4 md:pt-6 lg:pb-20">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/explore" className="inline-flex min-h-[44px] items-center gap-1.5 font-medium hover:underline hover:underline-offset-4">
          <Icon name="back" size={16} /> All homes
        </Link>
        <span className="text-ink-soft">/ {listing.locality}</span>
      </nav>

      {!open && (
        <Note icon={listing.status === "occupied" ? "key" : "info"} className="mb-5">
          <p className="font-semibold">
            {listing.status === "occupied"
              ? "This room has been filled."
              : listing.status === "paused"
                ? "The lister has paused this listing."
                : stale
                  ? "This listing hasn't been confirmed recently."
                  : listing.status === "under_review"
                    ? `Held for review: ${listing.reviewReason ?? "a moderator is taking a look"}.`
                    : listing.status === "removed"
                      ? "A moderator removed this listing."
                      : "This listing is a draft and isn't public yet."}
          </p>
          <p className="mt-0.5 text-ink-soft">
            {mine ? "Only you can see this page in full. Manage it from My listings." : "It's hidden from search and can't receive new messages. It's kept here so old links and saved homes still make sense."}
          </p>
        </Note>
      )}

      <Gallery listing={listing} />

      <div className="mt-8 grid gap-x-14 gap-y-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <header>
            <p className="micro flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
              <span className="flex items-center gap-1.5 text-ink">
                <Icon name="pin" size={14} /> {listing.locality}, {listing.city}
              </span>
              <span aria-hidden="true" className="h-px w-6 bg-ink/30" />
              <span>
                {ROOM_TYPE_LABEL[listing.roomType]} · {PROPERTY_TYPE_LABEL[listing.propertyType]}
              </span>
            </p>
            <h1 className="display mt-3 text-[2.6rem] leading-[1.02] sm:text-6xl xl:text-7xl">{listing.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Pill tone={listing.verification === "none" ? "line" : "sage"} icon="shield">
                {LISTING_VERIFICATION_COPY[listing.verification].label}
              </Pill>
              <Pill tone={listing.brokerage === 0 ? "sage" : "sand"}>{listing.brokerage === 0 ? "No brokerage" : `${rupees(listing.brokerage)} brokerage`}</Pill>
              {listing.isDemo && <SamplePill />}
              {listing.lastConfirmedAt && open && <span className="text-xs text-ink-soft">Confirmed available {ago(listing.lastConfirmedAt)}</span>}
            </div>
          </header>

          <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-line py-6 sm:grid-cols-4">
            <Fact icon="bed" label="Bedrooms" value={`${listing.bedrooms} BHK`} />
            <Fact icon="bath" label="Bathrooms" value={String(listing.bathrooms)} />
            <Fact icon="sofa" label="Furnishing" value={FURNISHING_LABEL[listing.furnishing]} />
            <Fact icon="calendar" label="Available" value={availability(listing.availableFrom).replace("From ", "")} />
          </dl>

          <section className="mt-10" aria-labelledby="about">
            <SectionMark n="01">The home</SectionMark>
            <h2 id="about" className="sr-only">
              About this home
            </h2>
            <p className="mt-4 max-w-2xl whitespace-pre-line text-lg leading-relaxed">{listing.description}</p>
          </section>

          <section className="mt-14" aria-labelledby="people">
            <SectionMark n="02">The people</SectionMark>
            <h2 id="people" className="display mt-4 text-4xl sm:text-5xl">
              {listing.roomType === "entire" ? "You'd have it to yourself" : "Who you'd live with"}
            </h2>
            {listing.occupantSummary && (
              <p className="mt-4 max-w-2xl text-lg">
                {listing.occupantCount > 0 && <span className="font-semibold">{listing.occupantCount} living here now. </span>}
                {listing.occupantSummary}
              </p>
            )}
            {lister && (
              <Link href={`/flatmates/${lister.id}`} className="group mt-6 flex max-w-xl items-center gap-4 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-ink">
                <Avatar profile={lister} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Listed by {listerName}</span>
                    {lister.isDemo && <SamplePill />}
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {lister.occupation} · {listing.listerLivesHere ? "lives here" : "doesn't live here"}
                  </span>
                  <span className="mt-1.5 block">
                    <VerificationList verification={lister.verification} compact />
                  </span>
                </span>
                <Icon name="arrow" size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            )}

            {/* compatibility */}
            <div className="mt-8 rounded-[28px] bg-sage p-5 sm:p-8">
              <h3 className="micro mb-5 text-ink">How you&apos;d fit</h3>
              {mine ? (
                <p>This is your own listing. People looking at it see their match with you here.</p>
              ) : !listing.listerLivesHere ? (
                <p>
                  {listerName} doesn&apos;t live in this home, so there&apos;s no one to compare your answers with yet. Ask about the {listing.roomType === "entire" ? "neighbours and building" : "people who do"} when you message.
                </p>
              ) : !session ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-md">See how your sleep, cleaning, food and guest habits line up with {listerName}&apos;s, before you message.</p>
                  <Link href={`/auth?mode=signup&next=${encodeURIComponent(`/homes/${listing.id}`)}`} className="btn btn-ink">
                    Create an account
                  </Link>
                </div>
              ) : !lifestyle ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-md">Answer twelve quick questions about how you live and this turns into a real comparison with {listerName}.</p>
                  <Link href={`/quiz?next=${encodeURIComponent(`/homes/${listing.id}`)}`} className="btn btn-ink">
                    Answer the questions
                  </Link>
                </div>
              ) : !ready ? (
                <div className="skeleton h-64 !bg-ivory/60" />
              ) : !match ? (
                <p>{listerName} hasn&apos;t answered the lifestyle questions yet, so there&apos;s nothing to compare.</p>
              ) : (
                <div className="space-y-8 rounded-3xl bg-ivory p-5 sm:p-8">
                  <MatchStory result={match} them={listerName} />
                  <CompatibilityOrbit result={match} them={listerName} />
                </div>
              )}
            </div>
          </section>

          <section className="mt-14 grid gap-10 sm:grid-cols-2" aria-label="Amenities and house rules">
            <div>
              <SectionMark n="03">What&apos;s included</SectionMark>
              <ul className="mt-5 grid grid-cols-1 gap-y-2.5 xs:grid-cols-2 sm:grid-cols-1 xl:grid-cols-2">
                {listing.amenities.length === 0 && <li className="text-ink-soft">Nothing listed. Ask the lister.</li>}
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2.5">
                    <Icon name="check" size={16} className="text-olive-deep" /> {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionMark n="04">House rules</SectionMark>
              <ul className="mt-5 space-y-2.5">
                {listing.houseRules.length === 0 && <li className="text-ink-soft">No rules stated. Worth asking about guests, smoking and food.</li>}
                {listing.houseRules.map((r) => (
                  <li key={r} className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-terracotta" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-14" aria-labelledby="where">
            <SectionMark n="05">Where</SectionMark>
            <h2 id="where" className="display mt-4 text-4xl sm:text-5xl">
              Around {listing.locality}
            </h2>
            <div className="mt-5 h-[320px] overflow-hidden rounded-[24px] border border-line">
              <MapView listings={[listing]} approximate className="h-full w-full" />
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
              <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
              The circle covers roughly a kilometre. The exact address stays private until {listerName} shares it with you to arrange a visit.
            </p>
          </section>

          <section className="mt-14 rounded-[24px] border border-line p-5 sm:p-7" aria-labelledby="checks">
            <h2 id="checks" className="display text-3xl">
              What&apos;s been checked
            </h2>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="flex items-center gap-2 font-semibold">
                  <Icon name="shield" size={16} className={listing.verification === "none" ? "text-ink-soft" : "text-olive-deep"} />
                  {LISTING_VERIFICATION_COPY[listing.verification].label}
                </dt>
                <dd className="mt-1 text-sm text-ink-soft">{LISTING_VERIFICATION_COPY[listing.verification].means}</dd>
              </div>
              {listing.isDemo && (
                <div>
                  <dt className="font-semibold">Sample listing</dt>
                  <dd className="mt-1 text-sm text-ink-soft">This home is invented and its photos are stock images. It&apos;s here so you can try Roomieva.</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm">
                Listed {listing.publishedAt ? fullDate(listing.publishedAt) : "recently"}. Something off?{" "}
                <Link href="/safety" className="link">
                  How to spot a scam
                </Link>
              </p>
              {!mine && (
                <button type="button" className="btn btn-quiet btn-sm !min-h-[44px]" onClick={() => (session ? setReportOpen(true) : router.push(`/auth?next=${encodeURIComponent(`/homes/${listing.id}`)}`))}>
                  <Icon name="flag" size={15} /> Report listing
                </button>
              )}
            </div>
          </section>
        </div>

        {/* sticky inquiry panel */}
        <aside className="hidden lg:block" aria-label="Rent and contact">
          <div className="sticky top-24 rounded-[28px] border border-ink bg-paper p-6 shadow-lift">
            <p>
              <span className="display text-5xl tabular-nums">{rupees(listing.rent)}</span>
              <span className="text-ink-soft"> / month</span>
            </p>
            <dl className="mt-5 space-y-2.5 border-y border-line py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Deposit</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {rupees(listing.deposit)}
                  {months > 0 && <span className="block text-xs font-normal text-ink-soft">{+months.toFixed(1)} months&apos; rent</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Brokerage</dt>
                <dd className="font-semibold tabular-nums">{listing.brokerage === 0 ? "None" : rupees(listing.brokerage)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Move in</dt>
                <dd className="font-semibold">{availability(listing.availableFrom)}</dd>
              </div>
            </dl>
            <div className="mt-5 space-y-2.5">
              {action}
              <SaveButton listingId={listing.id} withLabel className="w-full" />
            </div>
            <p className="mt-5 flex items-start gap-2 text-xs text-ink-soft">
              <Icon name="shield" size={15} className="mt-0.5 shrink-0" />
              Visit and meet people before paying anything. Roomieva never collects deposits or &ldquo;token amounts&rdquo;.
            </p>
          </div>
        </aside>
      </div>

      {/* phones and tablets: the same action, pinned to the thumb */}
      <div className={cx("fixed inset-x-0 z-30 border-t border-line bg-paper/95 px-[1.125rem] pt-3 backdrop-blur-sm lg:hidden", session ? "bottom-[calc(60px+env(safe-area-inset-bottom))] pb-3 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="mr-auto leading-tight">
            <span className="text-xl font-semibold tabular-nums">{rupees(listing.rent)}</span>
            <span className="text-sm text-ink-soft"> / mo</span>
            <span className="block text-xs text-ink-soft">{rupees(listing.deposit)} deposit</span>
          </p>
          <SaveButton listingId={listing.id} className="border border-line" />
          <div className="w-[46%] max-w-[220px]">{action}</div>
        </div>
      </div>

      {lister && (
        <MessageRequestDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          toUserId={lister.id}
          toName={listerName}
          listingId={listing.id}
          suggestion={`Hi ${listerName}, I'm ${firstName(profile?.displayName ?? "") || "interested"}${profile?.occupation ? `, ${profile.occupation.toLowerCase()}` : ""}. Is “${listing.title}” still available? I'd like to move in around ${availability(profile?.moveInBy ?? listing.availableFrom).replace("From ", "").replace("Available now", "now")}.`}
        />
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="listing" targetId={listing.id} subject="this listing" />
    </article>
  );
}
