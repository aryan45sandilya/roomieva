import type { Metadata } from "next";
import Link from "next/link";
import { SectionMark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Roomieva stores about you, who can see it, and how to have it removed.",
};

const VISIBILITY: [string, string, string][] = [
  ["First name, occupation, bio, budget, move-in date, preferred neighbourhoods", "Anyone", "This is your public card. You write it and can change it any time."],
  ["Lifestyle answers", "Signed-in members only", "Needed to work out match scores. Never shown to people who aren't logged in. You can skip any question."],
  ["Sign-in email, phone number", "Only you", "Shared with one other person only if you both agree inside a conversation. Either of you can withdraw. Blocking withdraws it too."],
  ["Exact address of a home you list", "Only you and moderators", "The public page shows the neighbourhood and a rough circle on the map. The map pin is deliberately offset."],
  ["Messages", "The two people in the conversation", "A moderator can see a conversation only if one of you reports it."],
  ["Saved homes, people you've blocked, reports you've filed", "Only you (reports: also moderators)", "Listers aren't told you saved their home. People aren't told you blocked or reported them."],
];

export default function PrivacyPage() {
  return (
    <div className="shell py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionMark n="—">Privacy</SectionMark>
        <h1 className="display mt-4 text-6xl sm:text-7xl">Your information</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">
          A plain account of what Roomieva keeps, who can see each piece, and how to have it removed. This page describes how the product works; it isn&apos;t a legal contract and should be reviewed by a lawyer before a public launch.
        </p>

        <section className="mt-14" aria-labelledby="who-sees">
          <h2 id="who-sees" className="display text-4xl">
            Who can see what
          </h2>
          <div className="mt-6 overflow-x-auto rounded-[22px] border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left text-[0.95rem]">
              <thead className="bg-sand">
                <tr className="[&_th]:px-5 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-ink-soft">
                  <th scope="col">What</th>
                  <th scope="col">Visible to</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-paper">
                {VISIBILITY.map(([what, who, note]) => (
                  <tr key={what} className="border-t border-line align-top [&_td]:px-5 [&_td]:py-4">
                    <th scope="row" className="px-5 py-4 font-semibold">
                      {what}
                    </th>
                    <td className="whitespace-nowrap font-medium">{who}</td>
                    <td className="text-ink-soft">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14 space-y-8" aria-label="Details">
          <div>
            <h2 className="display text-3xl">What we don&apos;t collect</h2>
            <p className="mt-2 text-ink-soft">
              No passwords: you sign in with a one-time code. No identity documents. No payment details, because Roomieva never handles money. No precise location from your device. We ask for a first name, not a full name.
            </p>
          </div>
          <div>
            <h2 className="display text-3xl">Where it&apos;s stored</h2>
            <p className="mt-2 text-ink-soft">
              In a live deployment, data is held in a hosted Postgres database (Supabase) with row-level security, so the rules in the table above are enforced by the database itself and not just by the app. Photos you upload to a listing are stored in a public bucket, since listing photos are public by nature.
            </p>
            <p className="mt-2 text-ink-soft">
              In{" "}
              <Link href="/safety#demo" className="link">
                demo mode
              </Link>{" "}
              nothing leaves your device: everything is kept in this browser&apos;s local storage and disappears if you clear site data.
            </p>
          </div>
          <div>
            <h2 className="display text-3xl">Third parties</h2>
            <p className="mt-2 text-ink-soft">
              Map tiles are loaded from OpenFreeMap and sample photos from Unsplash, so those services see your IP address when a map or sample photo loads. Fonts are bundled with the site. There are no advertising or analytics trackers.
            </p>
          </div>
          <div id="delete" className="scroll-mt-28 rounded-[22px] bg-sage p-6">
            <h2 className="display text-3xl">Deleting your data</h2>
            <p className="mt-2">
              You can delete any listing from My listings, edit or blank out your profile, and change or clear your lifestyle answers at any time. A self-serve &ldquo;delete my account&rdquo; button isn&apos;t built yet. Until it is, write to{" "}
              <a className="link" href="mailto:hello@roomieva.example">
                hello@roomieva.example
              </a>{" "}
              from your sign-in address and the account, its listings, messages and answers will be removed.
            </p>
            <p className="mt-2 text-sm">In demo mode, clearing this site&apos;s data in your browser removes everything.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
