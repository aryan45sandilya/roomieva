"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SectionMark } from "@/components/brand";
import { PersonaPicker } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { FloorPlan } from "@/components/illustrations";
import { Field, Note } from "@/components/ui";
import { errorMessage, getApi, type OtpRequest } from "@/lib/data/api";
import { useMe } from "@/lib/data/hooks";
import { emailSchema, otpSchema } from "@/lib/validation";

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

function AuthFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const { session, profile, mode } = useMe();
  const signup = params.get("mode") === "signup";
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<OtpRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Already signed in (or just verified): move on.
  useEffect(() => {
    if (!session || !profile || personaOpen) return;
    if (!profile.onboarded) router.replace(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    else router.replace(next ?? "/dashboard");
  }, [session, profile, next, router, personaOpen]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      setSent(await api.requestOtp(parsed.data));
      setEmail(parsed.data);
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      await api.verifyOtp(email, parsed.data);
      // The effect above redirects once the session lands.
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <div className="shell grid flex-1 items-stretch gap-10 py-10 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-20 lg:py-16">
      <aside className="draft-grid relative hidden flex-col justify-between overflow-hidden rounded-[28px] bg-sand p-12 lg:flex">
        <SectionMark n="00">{signup ? "Start here" : "Welcome back"}</SectionMark>
        <FloorPlan highlight="both" className="mx-auto w-full max-w-md" />
        <p className="display max-w-sm text-4xl">
          Somewhere in this city is a room with <em className="text-clay">your name on the door.</em>
        </p>
      </aside>

      <div className="flex flex-col justify-center">
        <h1 className="display text-5xl sm:text-6xl">{sent ? "Check your code" : signup ? "Make yourself at home" : "Good to see you"}</h1>
        <p className="mt-3 text-ink-soft">
          {sent
            ? sent.delivery === "email"
              ? `We've emailed a 6-digit code and a sign-in link to ${email}. Either one works.`
              : `Enter the code for ${email}.`
            : "No passwords. Enter your email and we'll send a one-time code. New here? The same step creates your account."}
        </p>

        {!sent ? (
          <form onSubmit={request} className="mt-8 space-y-5" noValidate>
            <Field label="Email address" error={error ?? undefined}>
              {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" autoFocus className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <button type="submit" className="btn btn-ink w-full" disabled={pending}>
              {pending ? "Sending…" : "Send me a code"} <Icon name="arrow" size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-8 space-y-5" noValidate>
            {sent.delivery === "demo" && (
              <Note icon="info">
                <p className="font-semibold">Demo mode: no email was sent.</p>
                <p className="mt-1">
                  This build isn&apos;t connected to a mail service, so here is the code that would have been emailed:{" "}
                  <button type="button" className="font-mono text-base font-bold tracking-[0.2em] underline underline-offset-4" onClick={() => setCode(sent.demoCode ?? "")} data-testid="demo-code">
                    {sent.demoCode}
                  </button>
                </p>
                <p className="mt-1 text-ink-soft">Because nothing was really delivered, accounts made this way don&apos;t get the &ldquo;Email confirmed&rdquo; badge.</p>
              </Note>
            )}
            <Field label="6-digit code" error={error ?? undefined}>
              {(p) => (
                <input
                  {...p}
                  ref={codeRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="field text-center font-mono text-2xl tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              )}
            </Field>
            <button type="submit" className="btn btn-ink w-full" disabled={pending}>
              {pending ? "Checking…" : "Verify and continue"}
            </button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button type="button" className="link min-h-[44px]" onClick={() => { setSent(null); setError(null); }}>
                Use a different email
              </button>
              <button type="button" className="link min-h-[44px]" onClick={() => request()} disabled={pending}>
                Send a new code
              </button>
            </div>
          </form>
        )}

        {mode === "demo" && !sent && (
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm text-ink-soft">Just looking around?</p>
            <button type="button" className="btn btn-line mt-3 w-full" onClick={() => setPersonaOpen(true)}>
              <Icon name="people" size={18} /> Try a sample account
            </button>
          </div>
        )}

        <p className="mt-8 text-sm text-ink-soft">
          {signup ? "Already have an account? " : "New to Roomieva? "}
          <Link className="link" href={`/auth${signup ? "" : "?mode=signup"}${next ? `${signup ? "?" : "&"}next=${encodeURIComponent(next)}` : ""}`}>
            {signup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
      <PersonaPicker open={personaOpen} onOpenChange={setPersonaOpen} />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="shell py-16"><div className="skeleton h-96 rounded-[28px]" /></div>}>
      <AuthFlow />
    </Suspense>
  );
}
