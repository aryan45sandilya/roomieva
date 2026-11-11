import Link from "next/link";
import { SectionMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { FloorPlan, TwoRooms } from "@/components/illustrations";
import { FeaturedHomes, HeroSearch, HeroVisual, NeighbourhoodIndex, OrbitDemo } from "@/components/landing";

const STEPS = [
  {
    n: "01",
    title: "Say how you live",
    body: "Twelve short questions about sleep, mess, food, guests and noise. Mark what you can bend on and what you can't. Skip anything you'd rather not answer.",
  },
  {
    n: "02",
    title: "See what fits",
    body: "Every home shows rent, deposit, rules and who lives there, in the same structure. Every person and flat gets a score you can open up and read.",
  },
  {
    n: "03",
    title: "Talk first, then visit",
    body: "Send a request. Chat here once it's accepted. Phone numbers stay hidden until both of you choose to share them.",
  },
];

const TRUST = [
  {
    label: "Email confirmed",
    means: "They opened a link or code sent to their sign-in address.",
    not: "Doesn't tell you who they are.",
  },
  {
    label: "Phone confirmed",
    means: "They entered a one-time code sent to a number they hold.",
    not: "Doesn't tell you whose name the SIM is in.",
  },
  {
    label: "Work or college email",
    means: "Their address is on a recognised employer or university domain.",
    not: "Doesn't confirm their role, or that they still work or study there.",
  },
  {
    label: "Listing reviewed",
    means: "A moderator read the listing and photos for obvious problems.",
    not: "Doesn't prove the lister owns or rents the property.",
  },
  {
    label: "Property verified",
    means: "The lister completed a supporting check tying them to this address.",
    not: "Doesn't replace visiting, meeting people and reading the agreement.",
  },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="shell relative -mt-16 pb-16 pt-24 md:-mt-[72px] md:pb-24 md:pt-32">
        <div className="grid items-center gap-x-10 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="micro mb-6 flex items-center gap-3 text-ink-soft">
              <span className="h-px w-10 bg-ink/40" aria-hidden="true" />
              Flats and flatmates · Bengaluru
            </p>
            <h1 className="display text-[clamp(2.85rem,8.6vw,6.9rem)]">
              A good home is about more than <em className="text-clay">four walls.</em>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg text-ink-soft md:text-xl">Find real spaces, verified people, and flatmates who actually fit your life.</p>
          </div>
          <div className="lg:col-span-5 lg:row-span-2">
            <HeroVisual />
          </div>
          <div className="lg:col-span-7">
            <HeroSearch />
            <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
              No brokerage on owner listings. No payments through Roomieva, ever.
            </p>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="rule-ticks" aria-hidden="true" />
      </div>

      {/* ── 01 Discover ── */}
      <section className="shell py-20 md:py-28" aria-labelledby="discover">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 md:mb-14">
          <div>
            <SectionMark n="01">Discover</SectionMark>
            <h2 id="discover" className="display mt-4 text-5xl md:text-7xl">
              Find your kind <br className="hidden sm:block" />
              of space
            </h2>
          </div>
          <div className="max-w-sm">
            <p className="text-ink-soft">Rooms and whole flats with the rent, the deposit, the rules and the people stated up front. Listings that go quiet drop out of search until someone confirms they&apos;re still open.</p>
            <Link href="/explore" className="btn btn-line mt-5">
              See all homes <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
        <FeaturedHomes />
      </section>

      {/* ── 02 People ── */}
      <section className="bg-sage" aria-labelledby="people">
        <div className="shell py-20 md:py-28">
          <div className="mb-12 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionMark n="02">Compatibility</SectionMark>
              <h2 id="people" className="display mt-4 text-5xl md:text-7xl">
                People make <em>the place</em>
              </h2>
            </div>
            <p className="self-end text-ink lg:col-span-4 lg:col-start-9">
              A lovely room with the wrong flatmate is still the wrong home. Roomieva compares how two people actually live, shows where they line up, and puts the awkward bits on the table before anyone signs anything.
            </p>
          </div>
          <div className="rounded-[28px] bg-ivory p-5 sm:p-8 lg:p-12">
            <OrbitDemo />
          </div>
        </div>
      </section>

      {/* ── 03 How it works ── */}
      <section id="how" className="shell scroll-mt-24 py-20 md:py-28" aria-labelledby="how-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionMark n="03">How it works</SectionMark>
            <h2 id="how-title" className="display mt-4 text-5xl md:text-6xl">
              A better way to move
            </h2>
            <FloorPlan highlight="left" className="mt-10 hidden w-full max-w-xs lg:block" />
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-ink py-8 last:border-b sm:grid-cols-[6rem_1fr]">
                <span className="display text-5xl text-clay sm:text-6xl">{s.n}</span>
                <div>
                  <h3 className="display text-3xl sm:text-4xl">{s.title}</h3>
                  <p className="mt-3 max-w-lg text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 04 Trust ── */}
      <section className="bg-sand/70" aria-labelledby="trust">
        <div className="shell py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionMark n="04">Trust</SectionMark>
              <h2 id="trust" className="display mt-4 text-5xl md:text-6xl">
                A little more trust
              </h2>
              <p className="mt-5 max-w-md text-ink-soft">
                &ldquo;Verified&rdquo; is an easy word to abuse, so we don&apos;t use it loosely. Each badge on Roomieva means one specific thing was checked. Here is exactly what, and what it leaves out.
              </p>
              <Link href="/safety" className="link mt-5 inline-flex min-h-[44px] items-center font-semibold">
                Read the safety guide
              </Link>
            </div>
            <div className="lg:col-span-7">
              <dl className="border-t border-ink">
                {TRUST.map((t) => (
                  <div key={t.label} className="grid gap-x-6 gap-y-1 border-b border-line py-5 sm:grid-cols-[11rem_1fr]">
                    <dt className="flex items-center gap-2 font-semibold">
                      <Icon name="shield" size={17} className="text-olive-deep" />
                      {t.label}
                    </dt>
                    <dd>
                      <p>{t.means}</p>
                      <p className="mt-1 text-sm text-ink-soft">{t.not}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── 05 Neighbourhoods ── */}
      <section className="shell py-20 md:py-28" aria-labelledby="areas">
        <div className="mb-10 md:mb-14">
          <SectionMark n="05">Neighbourhoods</SectionMark>
          <h2 id="areas" className="display mt-4 text-5xl md:text-7xl">
            Where in Bengaluru?
          </h2>
        </div>
        <NeighbourhoodIndex />
      </section>

      {/* ── 06 List ── */}
      <section className="shell pb-20 md:pb-28" aria-labelledby="list-cta">
        <div className="grid overflow-hidden rounded-[28px] bg-ink text-ivory lg:grid-cols-[1.25fr_1fr]">
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="micro text-ivory/60">For listers</p>
            <h2 id="list-cta" className="display mt-4 text-5xl md:text-7xl">
              Have a room <em className="text-terracotta">to fill?</em>
            </h2>
            <p className="mt-5 max-w-md text-ivory/75">
              List it in about ten minutes. Say who you are and how the house runs, and see which applicants would actually suit it. Free, with no brokerage.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/list" className="btn btn-accent">
                List your space <Icon name="arrow" size={16} />
              </Link>
              <Link href="/flatmates" className="btn border-ivory/40 text-ivory hover:bg-ivory hover:text-ink">
                Browse people looking
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center bg-terracotta p-8 lg:p-12">
            <TwoRooms className="w-full max-w-sm" />
          </div>
        </div>
      </section>
    </>
  );
}
