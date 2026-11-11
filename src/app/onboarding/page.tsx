"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/icons";
import { AboutFields, IntentField, SearchFields, useProfileForm } from "@/components/profile-form";
import { ErrorNote, SignInGate } from "@/components/ui";
import { errorMessage, getApi } from "@/lib/data/api";
import { useMe } from "@/lib/data/hooks";
import type { ProfileInput } from "@/lib/validation";

const STEPS: { title: string; lead: string; fields: (keyof ProfileInput)[] }[] = [
  { title: "What brings you here?", lead: "You can change this any time.", fields: ["intent"] },
  { title: "Where, when, how much?", lead: "This shapes what we show you first. It isn't a hard filter.", fields: ["budgetMin", "budgetMax", "moveInBy", "preferredLocalities"] },
  { title: "And who are you?", lead: "A short, honest introduction gets more replies than a long polished one.", fields: ["displayName", "stage", "occupation", "bio"] },
];

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, profile } = useMe();
  const form = useProfileForm(profile);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session === undefined) return <div className="shell py-16"><div className="skeleton mx-auto h-96 max-w-2xl rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/onboarding" />;

  const intent = form.watch("intent");
  // Someone who is only listing a room doesn't need to give a budget.
  const order = intent === "listing" ? [0, 2] : [0, 1, 2];
  const position = order.indexOf(step);
  const last = position === order.length - 1;

  const go = async (delta: 1 | -1) => {
    setError(null);
    if (delta === 1 && !(await form.trigger(STEPS[step].fields))) return;
    if (delta === 1 && last) return finish();
    setDir(delta);
    setStep(order[position + delta]);
    window.scrollTo({ top: 0 });
  };

  const finish = async () => {
    setPending(true);
    try {
      const values = form.getValues();
      const api = await getApi();
      await api.saveMyProfile({ ...values, city: "Bengaluru", onboarded: true });
      const next = params.get("next");
      router.push(`/quiz?first=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="shell flex flex-1 flex-col py-8 md:py-14">
        <div className="mx-auto w-full max-w-3xl flex-1">
          <div className="mb-10 flex items-center gap-4">
            <p className="micro tabular-nums text-ink-soft">
              Step {position + 1} of {order.length}
            </p>
            <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={order.length} aria-valuenow={position + 1} aria-label="Setup progress">
              {order.map((s, i) => (
                <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= position ? "bg-ink" : "bg-line"}`} />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -32 }}
              transition={{ duration: 0.28, ease: [0.22, 0.8, 0.26, 1] }}
            >
              <h1 className="display text-5xl sm:text-6xl">{STEPS[step].title}</h1>
              <p className="mb-8 mt-3 text-ink-soft">{STEPS[step].lead}</p>
              {step === 0 && <IntentField form={form} />}
              {step === 1 && <SearchFields form={form} />}
              {step === 2 && <AboutFields form={form} />}
            </motion.div>
          </AnimatePresence>

          {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
        </div>

        <div className="sticky bottom-0 -mx-[1.125rem] mt-10 border-t border-line bg-ivory/95 px-[1.125rem] py-3 backdrop-blur-sm md:static md:mx-auto md:w-full md:max-w-3xl md:border-0 md:bg-transparent md:px-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => go(-1)} disabled={position === 0 || pending}>
              <Icon name="back" size={16} /> Back
            </button>
            <button type="button" className="btn btn-ink min-w-[9rem]" onClick={() => go(1)} disabled={pending}>
              {pending ? "Saving…" : last ? "Save and continue" : "Continue"} <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
