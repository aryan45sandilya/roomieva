"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { LOCALITIES } from "@/lib/constants";
import { cx, isoDate } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { profileSchema, type ProfileInput } from "@/lib/validation";
import { Icon, type IconName } from "./icons";
import { ChipGroup, Field } from "./ui";

export type ProfileFormApi = UseFormReturn<ProfileInput>;

export function useProfileForm(profile: Profile | null) {
  return useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    values: profile
      ? {
          displayName: profile.displayName,
          occupation: profile.occupation,
          stage: profile.stage,
          bio: profile.bio,
          intent: profile.intent,
          budgetMin: profile.budgetMin || 12000,
          budgetMax: profile.budgetMax || 25000,
          moveInBy: profile.moveInBy,
          preferredLocalities: profile.preferredLocalities,
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  });
}

const INTENTS: { id: ProfileInput["intent"]; title: string; body: string; icon: IconName }[] = [
  { id: "seeking", title: "I need a home", body: "A room, a flat, or people to find one with.", icon: "search" },
  { id: "listing", title: "I have a room", body: "A room or flat that needs the right person.", icon: "key" },
  { id: "both", title: "A bit of both", body: "Looking, and I might have a room to offer.", icon: "people" },
];

export function IntentField({ form }: { form: ProfileFormApi }) {
  const value = form.watch("intent");
  return (
    <fieldset>
      <legend className="sr-only">What brings you to Roomieva?</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {INTENTS.map((i) => {
          const on = value === i.id;
          return (
            <label
              key={i.id}
              className={cx(
                "relative flex cursor-pointer flex-col rounded-2xl border p-5 transition-colors duration-150",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
                on ? "border-ink bg-ink text-ivory" : "border-line bg-paper hover:border-ink",
              )}
            >
              <input type="radio" value={i.id} className="sr-only" {...form.register("intent")} />
              <span className={cx("mb-6 flex h-10 w-10 items-center justify-center rounded-full", on ? "bg-terracotta text-ink" : "bg-sand")}>
                <Icon name={on ? "check" : i.icon} />
              </span>
              <span className="display text-2xl">{i.title}</span>
              <span className={cx("mt-1 text-sm", on ? "text-ivory/75" : "text-ink-soft")}>{i.body}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SearchFields({ form }: { form: ProfileFormApi }) {
  const e = form.formState.errors;
  return (
    <div className="space-y-6">
      <Field label="City" hint="Roomieva is in Bengaluru for now. More cities are on the way.">
        {(p) => (
          <select {...p} className="field" disabled value="Bengaluru" onChange={() => {}}>
            <option>Bengaluru</option>
          </select>
        )}
      </Field>
      <div className="grid gap-4 xs:grid-cols-2">
        <Field label="Budget from (₹ / month)" error={e.budgetMin?.message}>
          {(p) => <input {...p} type="number" inputMode="numeric" step={500} className="field" {...form.register("budgetMin", { valueAsNumber: true })} />}
        </Field>
        <Field label="Budget up to (₹ / month)" error={e.budgetMax?.message}>
          {(p) => <input {...p} type="number" inputMode="numeric" step={500} className="field" {...form.register("budgetMax", { valueAsNumber: true })} />}
        </Field>
      </div>
      <Field label="Move in by" hint="Optional. A rough date is fine.">
        {(p) => (
          <input
            {...p}
            type="date"
            min={isoDate(new Date())}
            className="field"
            {...form.register("moveInBy", { setValueAs: (v) => (v ? String(v) : null) })}
          />
        )}
      </Field>
      <Controller
        control={form.control}
        name="preferredLocalities"
        render={({ field }) => (
          <div>
            <ChipGroup legend="Neighbourhoods you'd consider" options={LOCALITIES.map((l) => l.name)} value={field.value ?? []} onChange={field.onChange} />
            {e.preferredLocalities?.message && <p className="mt-2 text-sm text-clay">{e.preferredLocalities.message}</p>}
          </div>
        )}
      />
    </div>
  );
}

const STAGES: { id: ProfileInput["stage"]; label: string }[] = [
  { id: "professional", label: "Working" },
  { id: "intern", label: "Interning" },
  { id: "student", label: "Studying" },
];

export function AboutFields({ form }: { form: ProfileFormApi }) {
  const e = form.formState.errors;
  const stage = form.watch("stage");
  const bio = form.watch("bio") ?? "";
  return (
    <div className="space-y-6">
      <Field label="First name" hint="This is what people see. Your surname, email and phone stay private." error={e.displayName?.message}>
        {(p) => <input {...p} className="field" autoComplete="given-name" {...form.register("displayName")} />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Right now I&apos;m</legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <label
              key={s.id}
              className={cx(
                "inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
                stage === s.id ? "border-ink bg-ink text-ivory" : "border-line bg-paper hover:border-ink",
              )}
            >
              <input type="radio" value={s.id} className="sr-only" {...form.register("stage")} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={stage === "student" ? "What are you studying?" : "What do you do?"} hint="A role or course is enough. No need to name your employer." error={e.occupation?.message}>
        {(p) => <input {...p} className="field" placeholder={stage === "student" ? "MBA, second year" : "Product designer"} {...form.register("occupation")} />}
      </Field>
      <Field label="A few lines about you" hint={`What's a normal week like? What matters to you in a home? ${bio.length}/400`} error={e.bio?.message}>
        {(p) => <textarea {...p} className="field min-h-[120px]" maxLength={400} {...form.register("bio")} />}
      </Field>
    </div>
  );
}
