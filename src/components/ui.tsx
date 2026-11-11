"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx, firstName } from "@/lib/format";
import type { ListingVerification, Profile, Verification } from "@/lib/types";
import { Icon, type IconName } from "./icons";
import { EmptyRoom, PlanTile } from "./illustrations";

/* ── Photo ─────────────────────────────────────────────── */

const WIDTHS = [400, 800, 1200, 1600];

/**
 * Responsive image with a drawn floor-plan fallback when a photo can't load.
 * Unsplash URLs get a width-based srcset; uploads (data/blob URLs) are used as-is.
 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw",
  priority = false,
  seed = 0,
}: {
  src: string | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  seed?: number;
}) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  useEffect(() => setFailed(!src), [src]);

  const remote = src?.startsWith("https://images.unsplash.com/");
  const url = (w: number) => `${src}?auto=format&fit=crop&w=${w}&q=70`;

  return (
    <div className={cx("relative overflow-hidden bg-sand", className)}>
      {failed || !src ? (
        <PlanTile className="absolute inset-0" seed={seed} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={remote ? url(800) : src}
          srcSet={remote ? WIDTHS.map((w) => `${url(w)} ${w}w`).join(", ") : undefined}
          sizes={remote ? sizes : undefined}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onError={() => setFailed(true)}
          className={cx("absolute inset-0 h-full w-full object-cover", imgClassName)}
        />
      )}
    </div>
  );
}

/* ── Avatar ────────────────────────────────────────────── */

const AVATAR_TONES = [
  ["var(--color-terracotta)", "var(--color-ink)"],
  ["var(--color-sage)", "var(--color-ink)"],
  ["var(--color-ink)", "var(--color-ivory)"],
  ["var(--color-olive)", "var(--color-ivory)"],
  ["var(--color-sand)", "var(--color-ink)"],
];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * Sample profiles deliberately have no face photos: a drawn monogram can't be
 * mistaken for a real person.
 */
export function Avatar({ profile, size = 48, className }: { profile: Pick<Profile, "id" | "displayName" | "avatarUrl">; size?: number; className?: string }) {
  const h = hash(profile.id);
  const [bg, fg] = AVATAR_TONES[h % AVATAR_TONES.length];
  const initial = (profile.displayName.trim()[0] ?? "?").toUpperCase();
  const corner = ["30% 70% 70% 30% / 30% 30% 70% 70%", "50%", "38% 62% 55% 45% / 55% 40% 60% 45%", "22%"][h % 4];
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatarUrl} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cx("display inline-flex shrink-0 select-none items-center justify-center", className)}
      style={{ width: size, height: size, background: bg, color: fg, borderRadius: corner, fontSize: size * 0.5 }}
    >
      {initial}
    </span>
  );
}

/* ── Pills & badges ────────────────────────────────────── */

export function Pill({
  children,
  tone = "sand",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: "sand" | "sage" | "ink" | "line" | "clay" | "paper";
  icon?: IconName;
  className?: string;
}) {
  const tones = {
    sand: "bg-sand text-ink",
    sage: "bg-sage text-ink",
    ink: "bg-ink text-ivory",
    line: "border border-line text-ink-soft",
    clay: "border border-clay/50 text-clay bg-terracotta/10",
    paper: "bg-paper text-ink",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap", tones[tone], className)}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export const SamplePill = ({ className }: { className?: string }) => (
  <Pill tone="line" className={className}>
    Sample
  </Pill>
);

export const VERIFICATION_COPY: Record<keyof Verification, { label: string; means: string }> = {
  email: { label: "Email confirmed", means: "They can read mail at the address they signed up with. It says nothing about who they are." },
  phone: { label: "Phone confirmed", means: "They entered a code sent to a phone number they hold." },
  institution: { label: "Work or college email", means: "Their sign-in address is on a recognised employer or university domain." },
};

export const LISTING_VERIFICATION_COPY: Record<ListingVerification, { label: string; means: string }> = {
  none: { label: "Not reviewed", means: "Nobody at Roomieva has checked this listing. Treat it like any ad from a stranger." },
  reviewed: { label: "Listing reviewed", means: "A moderator read the details and photos for obvious problems. It is not proof of ownership." },
  property_verified: { label: "Property verified", means: "The lister completed a supporting check that ties them to this property." },
};

export function VerificationList({ verification, compact = false }: { verification: Verification; compact?: boolean }) {
  const levels = (Object.keys(VERIFICATION_COPY) as (keyof Verification)[]).filter((k) => verification[k]);
  if (levels.length === 0) {
    return (
      <Pill tone="line" icon="info">
        Nothing confirmed yet
      </Pill>
    );
  }
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-olive-deep" title={levels.map((l) => VERIFICATION_COPY[l].label).join(", ")}>
        <Icon name="shield" size={14} />
        {levels.length} of 3 checks
        <span className="sr-only">: {levels.map((l) => VERIFICATION_COPY[l].label).join(", ")}</span>
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {levels.map((l) => (
        <li key={l}>
          <Pill tone="sage" icon="check">
            {VERIFICATION_COPY[l].label}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

export function ListingVerificationPill({ level }: { level: ListingVerification }) {
  if (level === "none") return null;
  return (
    <Pill tone="paper" icon="shield" className="text-olive-deep">
      {LISTING_VERIFICATION_COPY[level].label}
    </Pill>
  );
}

/* ── Dialog / sheet ────────────────────────────────────── */

/**
 * `sheet`  bottom sheet on phones, centred dialog from md up
 * `full`   full-screen on phones (filters), right-hand panel from md up
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "sheet",
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "sheet" | "full";
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 [animation:fade-in_200ms_ease-out]" />
        <Dialog.Content
          className={cx(
            "fixed z-50 flex flex-col bg-paper text-ink shadow-sheet focus:outline-none",
            variant === "sheet" &&
              "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl [animation:sheet-up_280ms_var(--ease-out-soft)] md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(92vw,520px)] md:max-h-[86dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:[animation:pop-in_220ms_var(--ease-out-soft)]",
            variant === "full" &&
              "inset-0 [animation:sheet-up_280ms_var(--ease-out-soft)] md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:[animation:side-in_280ms_var(--ease-out-soft)]",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="display text-2xl">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-soft">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sand" aria-label="Close">
              <Icon name="close" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <div className="border-t border-line bg-paper px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── Toasts ────────────────────────────────────────────── */

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

/** Toasts only ever report something that has already happened. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lift [animation:fade-in_200ms_ease-out]",
              t.tone === "ok" ? "bg-ink text-ivory" : "bg-clay text-ivory",
            )}
          >
            <Icon name={t.tone === "ok" ? "check" : "alert"} size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ── States ────────────────────────────────────────────── */

export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center", className)}>
      <EmptyRoom className="mb-6 w-52" />
      <h2 className="display text-3xl">{title}</h2>
      {children && <p className="mt-3 text-ink-soft">{children}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, onRetry, className }: { children: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx("flex items-start gap-3 rounded-xl border border-clay/40 bg-terracotta/10 px-4 py-3 text-sm text-ink", className)}>
      <Icon name="alert" className="mt-0.5 shrink-0 text-clay" size={18} />
      <div className="flex-1">{children}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="link shrink-0 font-semibold">
          Try again
        </button>
      )}
    </div>
  );
}

export function Note({ children, icon = "info", className }: { children: ReactNode; icon?: IconName; className?: string }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-xl bg-sand px-4 py-3 text-sm text-ink", className)}>
      <Icon name={icon} className="mt-0.5 shrink-0 text-ink-soft" size={18} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Shown in place of a page that needs an account. Also covers an expired session. */
export function SignInGate({ next, title = "Log in to continue", children }: { next: string; title?: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      action={
        <>
          <Link href={`/auth?next=${encodeURIComponent(next)}`} className="btn btn-ink">
            Log in
          </Link>
          <Link href={`/auth?mode=signup&next=${encodeURIComponent(next)}`} className="btn btn-line">
            Create an account
          </Link>
        </>
      }
    >
      {children ?? "You're signed out, or your session has ended. Log in and we'll bring you straight back here."}
    </EmptyState>
  );
}

/* ── Form bits ─────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1 text-sm text-clay">
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Multi-select chips rendered as real checkboxes. */
export function ChipGroup<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  label = (o) => String(o),
  single = false,
  hideLegend = false,
}: {
  legend: string;
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  label?: (option: T) => string;
  single?: boolean;
  hideLegend?: boolean;
}) {
  const name = useId();
  const toggle = (o: T) => {
    if (single) onChange(value.includes(o) ? [] : [o]);
    else onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  };
  return (
    <fieldset>
      <legend className={cx("mb-2 text-sm font-semibold", hideLegend && "sr-only")}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label
              key={String(o)}
              className={cx(
                "inline-flex min-h-[40px] cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue",
                on ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink hover:border-ink",
              )}
            >
              <input type="checkbox" name={name} className="sr-only" checked={on} onChange={() => toggle(o)} />
              {on && <Icon name="check" size={14} />}
              {label(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 10 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-sand disabled:opacity-40" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer: ${label}`}>
          <Icon name="minus" size={16} />
        </button>
        <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-sand disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More: ${label}`}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}

export function PersonLine({ profile, sub, size = 40 }: { profile: Profile; sub?: ReactNode; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar profile={profile} size={size} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{firstName(profile.displayName) || "New member"}</span>
          {profile.isDemo && <SamplePill />}
        </span>
        {sub && <span className="block truncate text-sm text-ink-soft">{sub}</span>}
      </span>
    </span>
  );
}

export function PageHeading({ kicker, title, children }: { kicker?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {kicker && <div className="mb-3">{kicker}</div>}
      <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      {children && <p className="mt-3 max-w-xl text-ink-soft">{children}</p>}
    </header>
  );
}
