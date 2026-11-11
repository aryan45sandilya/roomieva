import Link from "next/link";
import { cx } from "@/lib/format";

/**
 * The mark: two rooms drawn as floor plans, sharing a wall with a doorway
 * between them.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="2.5" y="8.5" width="16" height="16" rx="1.5" fill="var(--color-terracotta)" />
      <path d="M13.5 2.5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14" stroke="var(--color-ink)" strokeWidth="1.8" />
      <path d="M13.5 2.5v5.5M13.5 14.5v6" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.5 8a6.5 6.5 0 0 1 6.5 6.5" stroke="var(--color-ink)" strokeWidth="1" strokeDasharray="1.5 2" />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Mark className="h-7 w-7 shrink-0" />
      <span className={cx("display text-[1.7rem] leading-none tracking-tight", compact && "max-xs:sr-only")}>
        roomieva<span className="text-clay">.</span>
      </span>
    </span>
  );
}

export function LogoLink({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Roomieva home" className="rounded-md">
      <Wordmark compact={compact} />
    </Link>
  );
}

/** Editorial section marker, e.g. "01 / Discover". */
export function SectionMark({ n, children, className }: { n: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("micro flex items-center gap-3 text-ink-soft", className)}>
      <span className="tabular-nums text-ink">{n}</span>
      <span aria-hidden="true" className="h-px w-8 bg-ink/40" />
      <span>{children}</span>
    </p>
  );
}
