"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { AboutFields, IntentField, SearchFields, useProfileForm } from "@/components/profile-form";
import { Avatar, ErrorNote, PageHeading, PersonLine, SignInGate, VERIFICATION_COPY, useToast } from "@/components/ui";
import { errorMessage, getApi } from "@/lib/data/api";
import { useLive, useMe } from "@/lib/data/hooks";
import { QUESTIONS } from "@/lib/lifestyle";
import { answeredCount } from "@/lib/matching";
import type { Profile, Verification } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { session, profile, lifestyle, mode } = useMe();
  const form = useProfileForm(profile);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const blocked = useLive(
    async (api) => {
      if (!session) return [];
      const ids = await api.listBlocked();
      const people = await Promise.all(ids.map((id) => api.getProfile(id)));
      return people.filter((p): p is Profile => p !== null);
    },
    [session?.userId],
  );

  const needsSetup = Boolean(session && profile && !profile.onboarded);
  useEffect(() => {
    if (needsSetup) router.replace("/onboarding?next=/profile");
  }, [needsSetup, router]);

  if (session === undefined) return <div className="shell py-12"><div className="skeleton mx-auto h-96 max-w-3xl rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/profile" />;
  if (needsSetup) return null;

  const intent = form.watch("intent");
  const answered = lifestyle ? answeredCount(lifestyle) : 0;
  const checks = (Object.keys(VERIFICATION_COPY) as (keyof Verification)[]).map((k) => ({ key: k, ...VERIFICATION_COPY[k], on: Boolean(profile?.verification[k]) }));

  const save = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      await api.saveMyProfile(values);
      form.reset(values);
      toast("Profile saved");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  });

  const unblock = async (p: Profile) => {
    try {
      const api = await getApi();
      await api.unblockUser(p.id);
      toast(`${p.displayName || "They"} can message you again`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const signOut = async () => {
    const api = await getApi();
    await api.signOut();
    router.push("/");
  };

  return (
    <div className="shell py-10 md:py-14">
      <div className="mx-auto grid max-w-5xl gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={save} noValidate>
          <PageHeading kicker={<SectionMark n="—">Account</SectionMark>} title="Your profile">
            This is what listers and flatmates see before they reply.
          </PageHeading>

          <section aria-labelledby="p-about" className="border-t border-ink pt-6">
            <h2 id="p-about" className="display mb-6 text-3xl">
              About you
            </h2>
            <AboutFields form={form} />
          </section>

          <section aria-labelledby="p-intent" className="mt-12 border-t border-ink pt-6">
            <h2 id="p-intent" className="display mb-6 text-3xl">
              What you&apos;re here for
            </h2>
            <IntentField form={form} />
          </section>

          {intent !== "listing" && (
            <section aria-labelledby="p-search" className="mt-12 border-t border-ink pt-6">
              <h2 id="p-search" className="display mb-6 text-3xl">
                Your search
              </h2>
              <SearchFields form={form} />
            </section>
          )}

          {error && <ErrorNote className="mt-6">{error}</ErrorNote>}

          <div className="sticky bottom-0 -mx-[1.125rem] mt-10 flex items-center justify-between gap-3 border-t border-line bg-ivory/95 px-[1.125rem] py-3 backdrop-blur-sm md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
            <p className="text-sm text-ink-soft" aria-live="polite">
              {form.formState.isDirty ? "Unsaved changes" : "Everything is saved"}
            </p>
            <button type="submit" className="btn btn-ink min-w-[9rem]" disabled={pending || !form.formState.isDirty}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="space-y-5" aria-label="Account details">
          {profile && (
            <div className="flex items-center gap-4 rounded-[24px] border border-line bg-paper p-5">
              <Avatar profile={profile} size={64} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{session.email}</p>
                <p className="text-sm text-ink-soft">Your sign-in email. Never shown on your profile.</p>
              </div>
            </div>
          )}

          <div className="rounded-[24px] bg-sage p-5">
            <h2 className="micro">Lifestyle answers</h2>
            <p className="display mt-3 text-4xl tabular-nums">
              {answered} <span className="text-xl text-ink-soft">of {QUESTIONS.length}</span>
            </p>
            <p className="mt-1 text-sm">{answered < 5 ? "Match scores need at least five answers." : "These drive every match score you see."}</p>
            <Link href="/quiz" className="btn btn-ink btn-sm mt-4 !min-h-[44px]">
              {answered === 0 ? "Start" : "Review answers"}
            </Link>
          </div>

          <div className="rounded-[24px] border border-line p-5">
            <h2 className="micro text-ink-soft">What&apos;s been confirmed</h2>
            <ul className="mt-4 space-y-3.5">
              {checks.map((c) => (
                <li key={c.key} className="flex gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.on ? "bg-olive text-ivory" : "border border-line text-ink-soft"}`}>
                    <Icon name={c.on ? "check" : "minus"} size={12} strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-ink-soft">
                      {c.on
                        ? c.means
                        : c.key === "email"
                          ? mode === "demo"
                            ? "Demo mode sends no email, so nothing was confirmed."
                            : "Sign in with the link or code we email you."
                          : c.key === "phone"
                            ? "Phone confirmation isn't switched on yet."
                            : "Given automatically when a confirmed sign-in email is on a recognised work or university domain."}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/safety#verification" className="link mt-4 inline-flex min-h-[44px] items-center text-sm">
              What these do and don&apos;t mean
            </Link>
          </div>

          <div className="rounded-[24px] border border-line p-5">
            <h2 className="micro text-ink-soft">Blocked people</h2>
            {blocked.loading ? (
              <div className="skeleton mt-4 h-10" />
            ) : (blocked.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nobody. You can block someone from their profile or from a conversation.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(blocked.data ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <PersonLine profile={p} size={36} />
                    <button type="button" className="link min-h-[44px] shrink-0 text-sm" onClick={() => unblock(p)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="btn btn-quiet w-full" onClick={signOut}>
            <Icon name="logout" size={16} /> Log out
          </button>
          <p className="text-xs text-ink-soft">
            Want your account and data deleted? See{" "}
            <Link href="/privacy#delete" className="link">
              Privacy
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
