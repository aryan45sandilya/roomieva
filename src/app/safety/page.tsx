import type { Metadata } from "next";
import Link from "next/link";
import { SectionMark } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "Staying safe",
  description: "What Roomieva checks, what it doesn't, and how to protect yourself when looking for a flat or flatmate.",
};

const RULES: { icon: IconName; title: string; body: string }[] = [
  { icon: "home", title: "See it before you pay for it", body: "Never send a deposit, token amount or “booking fee” for a home you haven't stood in. A real lister will wait for a visit. Pressure to pay today is the most common sign of a scam." },
  { icon: "people", title: "Meet the people, not just the room", body: "Ask to meet whoever you'd actually live with. If the lister can't arrange that, ask why." },
  { icon: "chat", title: "Keep the first conversations here", body: "Chat on Roomieva until you're comfortable. Swap contact details when you both choose to, and block anyone who pushes you to move elsewhere fast." },
  { icon: "pin", title: "Visit in daylight, and tell someone", body: "Share the address and time with a friend. Take someone along if you can." },
  { icon: "key", title: "Check who you're paying", body: "Ask who owns the flat and see the rental agreement before any money moves. Pay by a traceable method, to the name on the agreement, and get a receipt." },
  { icon: "alert", title: "Trust the price", body: "A room far below what the neighbourhood usually costs is rarely a bargain. We flag these for moderators, but look twice yourself." },
];

const BADGES = [
  { label: "Email confirmed", means: "The person opened a link or entered a code sent to their sign-in address.", not: "It doesn't tell you their name or who they are." },
  { label: "Phone confirmed", means: "The person entered a one-time code sent to a number they hold.", not: "It doesn't tell you whose name the SIM is registered in." },
  { label: "Work or college email", means: "Their confirmed sign-in address is on an employer or university domain we recognise.", not: "It doesn't confirm their role, or that they still work or study there." },
  { label: "Listing reviewed", means: "A moderator read the listing and looked at its photos for obvious problems.", not: "It doesn't prove the lister owns or rents the property. Editing the listing clears the badge." },
  { label: "Property verified", means: "The lister completed a supporting check that ties them to this address.", not: "It doesn't replace visiting, meeting people and reading the agreement." },
];

export default function SafetyPage() {
  return (
    <div className="shell py-10 md:py-16">
      <header className="max-w-3xl">
        <SectionMark n="—">Trust and safety</SectionMark>
        <h1 className="display mt-4 text-6xl sm:text-7xl">
          Staying <em className="text-clay">safe</em>
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          Roomieva introduces people. It doesn&apos;t own homes, hold money or vouch for anyone. Here is what we check, what we can&apos;t, and what to do yourself.
        </p>
      </header>

      <section className="mt-14" aria-labelledby="rules">
        <h2 id="rules" className="display text-4xl sm:text-5xl">
          Six habits that stop most scams
        </h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-[26px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((r, i) => (
            <li key={r.title} className="bg-paper p-6">
              <span className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sand">
                  <Icon name={r.icon} />
                </span>
                <span className="micro tabular-nums text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
              </span>
              <h3 className="display mt-5 text-2xl">{r.title}</h3>
              <p className="mt-2 text-ink-soft">{r.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-ink px-5 py-4 text-ivory">
          <Icon name="shield" className="mt-0.5 shrink-0 text-terracotta" />
          Roomieva never asks for payment and never collects deposits, rent or fees. Anyone saying they&apos;re taking money &ldquo;through Roomieva&rdquo; is lying. Report them.
        </p>
      </section>

      <section id="verification" className="mt-20 scroll-mt-28 grid gap-10 lg:grid-cols-12" aria-labelledby="verification-title">
        <div className="lg:col-span-4">
          <h2 id="verification-title" className="display text-4xl sm:text-5xl">
            What each badge means
          </h2>
          <p className="mt-4 text-ink-soft">Every badge is one specific check. None of them is proof of identity, and none of them implies another.</p>
        </div>
        <dl className="border-t border-ink lg:col-span-8">
          {BADGES.map((b) => (
            <div key={b.label} className="grid gap-x-6 gap-y-1 border-b border-line py-5 sm:grid-cols-[12rem_1fr]">
              <dt className="flex items-center gap-2 font-semibold">
                <Icon name="shield" size={17} className="text-olive-deep" /> {b.label}
              </dt>
              <dd>
                <p>{b.means}</p>
                <p className="mt-1 text-sm text-ink-soft">{b.not}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="report" className="mt-20 scroll-mt-28 grid gap-10 lg:grid-cols-12" aria-labelledby="report-title">
        <div className="lg:col-span-4">
          <h2 id="report-title" className="display text-4xl sm:text-5xl">
            Reporting and blocking
          </h2>
        </div>
        <div className="space-y-6 lg:col-span-8">
          <div>
            <h3 className="font-semibold">Report</h3>
            <p className="mt-1 text-ink-soft">
              Every listing, profile and conversation has a Report option. Reports go to a moderator and the person isn&apos;t told who reported them. A listing reported by three different people is taken out of search automatically until someone has looked at it.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Block</h3>
            <p className="mt-1 text-ink-soft">
              Blocking stops messages in both directions, hides you from each other in search, and withdraws any contact details you&apos;d agreed to share. The other person isn&apos;t notified. You can undo it from your profile page.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Stale and duplicate listings</h3>
            <p className="mt-1 text-ink-soft">
              Listers are asked to confirm their room is still free. After 21 days without a confirmation the listing drops out of search. A new listing that shares a photo or matches the details of one already live is held for a moderator instead of being published.
            </p>
          </div>
          <div className="rounded-2xl border border-clay/40 bg-terracotta/10 p-5">
            <h3 className="font-semibold">If you&apos;re in danger or have lost money</h3>
            <p className="mt-1">
              Roomieva isn&apos;t an emergency service. In India, call <strong>112</strong> for emergencies. Report online financial fraud on <strong>1930</strong> or at cybercrime.gov.in as soon as you can, and tell your bank. Then report the account here so we can remove it.
            </p>
          </div>
        </div>
      </section>

      <section id="demo" className="mt-20 scroll-mt-28 rounded-[26px] bg-sand p-6 sm:p-10" aria-labelledby="demo-title">
        <h2 id="demo-title" className="display text-4xl">
          About demo mode
        </h2>
        <div className="mt-4 max-w-3xl space-y-3">
          <p>
            When Roomieva runs without a database connected, it runs in demo mode and says so in a strip at the top of every page. In demo mode the homes and people are invented samples, the photos are stock images, and everything you do is stored only in this browser.
          </p>
          <p>
            No email is sent in demo mode, so the sign-in code is shown on screen and accounts made that way don&apos;t receive the &ldquo;Email confirmed&rdquo; badge. Sample profiles and listings are always labelled &ldquo;Sample&rdquo;.
          </p>
        </div>
        <Link href="/privacy" className="link mt-5 inline-flex min-h-[44px] items-center font-semibold">
          How your data is handled
        </Link>
      </section>
    </div>
  );
}
