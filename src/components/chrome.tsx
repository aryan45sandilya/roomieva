"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { getApi } from "@/lib/data/api";
import { MeProvider, useLive, useMe } from "@/lib/data/hooks";
import { cx, firstName } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { LogoLink, Wordmark } from "./brand";
import { Icon, type IconName } from "./icons";
import { Avatar, Modal, Pill, ToastProvider, useToast } from "./ui";

const NAV = [
  { href: "/explore", label: "Explore homes" },
  { href: "/flatmates", label: "Find flatmates" },
  { href: "/#how", label: "How it works" },
  { href: "/list", label: "List your space" },
];

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}

/** Unread messages plus requests waiting on me. */
function useInboxCount() {
  const { session } = useMe();
  const live = useLive(
    async (api) => {
      if (!session) return 0;
      const list = await api.listConversations();
      return list.reduce((n, c) => n + c.unread, 0);
    },
    [session?.userId],
  );
  return live.data ?? 0;
}

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terracotta px-1 text-[11px] font-bold leading-none text-ink">
      {n > 9 ? "9+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/* ── Sample accounts (demo mode) ───────────────────────── */

export function PersonaPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const personas = useLive((api) => api.listPersonas(), []);
  const toast = useToast();
  const router = useRouter();
  const pick = async (p: Profile) => {
    const api = await getApi();
    await api.actAs(p.id);
    onOpenChange(false);
    toast(`This tab is now ${firstName(p.displayName)} (sample account)`);
    router.push(p.isAdmin ? "/admin" : "/dashboard");
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Try a sample account"
      description="These are invented people with invented homes and chats. Open one in this tab to see Roomieva from the inside. Open a different one in a second tab and they can message each other live."
    >
      <ul className="-mx-2 divide-y divide-line">
        {(personas.data ?? []).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => pick(p)} className="flex min-h-[60px] w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sand">
              <Avatar profile={p} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.displayName}</span>
                <span className="block truncate text-sm text-ink-soft">{p.occupation}</span>
              </span>
              {p.isAdmin ? <Pill tone="ink">Moderator</Pill> : p.intent !== "seeking" ? <Pill tone="sage">Has listings</Pill> : null}
              <Icon name="chevronRight" size={16} className="text-ink-soft" />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ── Header ────────────────────────────────────────────── */

function AccountMenu({ profile, onPersona }: { profile: Profile; onPersona: () => void }) {
  const [open, setOpen] = useState(false);
  const { mode } = useMe();
  const router = useRouter();
  const toast = useToast();
  const items: { href: string; label: string; icon: IconName }[] = [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    { href: "/saved", label: "Saved homes", icon: "key" },
    { href: "/my-listings", label: "My listings", icon: "sofa" },
    { href: "/profile", label: "Profile", icon: "user" },
    { href: "/quiz", label: "Lifestyle answers", icon: "sliders" },
    ...(profile.isAdmin ? [{ href: "/admin", label: "Moderation", icon: "shield" as IconName }] : []),
  ];
  const signOut = async () => {
    const api = await getApi();
    await api.signOut();
    setOpen(false);
    toast("You're logged out");
    router.push("/");
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-11 items-center gap-2 rounded-full border border-line bg-paper pl-1 pr-3 hover:border-ink" aria-label="Account menu">
        <Avatar profile={profile} size={34} />
        <Icon name="chevronDown" size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-64 rounded-2xl border border-line bg-paper p-2 shadow-lift [animation:fade-in_160ms_ease-out]">
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="truncate font-semibold">{profile.displayName || "Your account"}</p>
            {profile.isDemo && <p className="text-xs text-ink-soft">Sample account, this tab only</p>}
          </div>
          <nav className="py-1" aria-label="Account">
            {items.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-sand">
                <Icon name={i.icon} size={18} className="text-ink-soft" />
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line pt-1">
            {mode === "demo" && (
              <button type="button" onClick={() => { setOpen(false); onPersona(); }} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-sand">
                <Icon name="people" size={18} className="text-ink-soft" />
                Switch sample account
              </button>
            )}
            <button type="button" onClick={signOut} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-sand">
              <Icon name="logout" size={18} className="text-ink-soft" />
              Log out
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Header() {
  const scrolled = useScrolled();
  const pathname = usePathname();
  const { session, profile, mode } = useMe();
  const inbox = useInboxCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const onLanding = pathname === "/";
  const solid = scrolled || !onLanding;

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header
        className={cx(
          "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300",
          solid ? "border-b border-line bg-ivory/95 backdrop-blur-sm" : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="shell flex h-16 items-center gap-4 md:h-[72px]">
          <LogoLink compact />
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group relative rounded-full px-3 py-2 text-sm font-medium transition-colors hover:text-ink",
                    active ? "text-ink" : "text-ink-soft",
                  )}
                >
                  {n.label}
                  <span className={cx("absolute inset-x-3 bottom-1 h-px origin-left bg-ink transition-transform duration-200", active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {session === undefined ? (
              <span className="skeleton h-10 w-28 rounded-full" aria-hidden="true" />
            ) : session && profile ? (
              <>
                <Link href="/messages" className="relative hidden h-11 w-11 items-center justify-center rounded-full hover:bg-sand md:flex" aria-label="Messages">
                  <Icon name="chat" />
                  <CountDot n={inbox} />
                </Link>
                <div className="hidden md:block">
                  <AccountMenu profile={profile} onPersona={() => setPersonaOpen(true)} />
                </div>
                <Link href="/list" className="btn btn-accent btn-sm md:hidden">
                  List a room
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth" className="btn btn-sm hidden text-ink hover:bg-sand sm:inline-flex">
                  Log in
                </Link>
                <Link href="/auth?mode=signup" className="btn btn-accent btn-sm sm:min-h-[44px] sm:px-5 sm:text-[0.9375rem]">
                  Get started
                </Link>
              </>
            )}
            <button type="button" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand lg:hidden" aria-label="Open menu">
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <Modal open={menuOpen} onOpenChange={setMenuOpen} title="Menu" variant="full">
        <nav aria-label="Main" className="flex flex-col">
          {NAV.map((n, i) => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="flex min-h-[64px] items-baseline gap-4 border-b border-line py-4">
              <span className="micro tabular-nums text-ink-soft">0{i + 1}</span>
              <span className="display text-3xl">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex flex-col gap-2">
          {session && profile ? (
            <>
              {[
                ["/dashboard", "Dashboard"],
                ["/my-listings", "My listings"],
                ["/profile", "Profile"],
                ["/quiz", "Lifestyle answers"],
                ...(profile.isAdmin ? [["/admin", "Moderation"]] : []),
                ["/safety", "Safety"],
              ].map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex min-h-[44px] items-center font-medium">
                  {label}
                </Link>
              ))}
              {mode === "demo" && (
                <button type="button" className="flex min-h-[44px] items-center text-left font-medium" onClick={() => { setMenuOpen(false); setPersonaOpen(true); }}>
                  Switch sample account
                </button>
              )}
              <button
                type="button"
                className="flex min-h-[44px] items-center text-left font-medium text-clay"
                onClick={async () => {
                  const api = await getApi();
                  await api.signOut();
                  setMenuOpen(false);
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth?mode=signup" onClick={() => setMenuOpen(false)} className="btn btn-ink">
                Create an account
              </Link>
              <Link href="/auth" onClick={() => setMenuOpen(false)} className="btn btn-line">
                Log in
              </Link>
              <Link href="/safety" onClick={() => setMenuOpen(false)} className="mt-2 flex min-h-[44px] items-center font-medium">
                Safety
              </Link>
            </>
          )}
        </div>
      </Modal>
      <PersonaPicker open={personaOpen} onOpenChange={setPersonaOpen} />
    </>
  );
}

/* ── Mobile tab bar ────────────────────────────────────── */

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/explore", label: "Explore", icon: "search" },
  { href: "/flatmates", label: "Matches", icon: "people" },
  { href: "/messages", label: "Messages", icon: "chat" },
  { href: "/saved", label: "Saved", icon: "key" },
  { href: "/dashboard", label: "Profile", icon: "user" },
];

function TabBar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { session } = useMe();
  const inbox = useInboxCount();
  // This boundary can hydrate after the session has loaded; render nothing until mounted so the
  // first client render matches the server (which never has a session).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !session) return null;
  // Inside a chat thread or a wizard the bottom edge belongs to the task.
  if ((pathname === "/messages" && params.get("c")) || pathname === "/list" || pathname === "/quiz" || pathname === "/onboarding") return null;
  return (
    <>
    <div aria-hidden="true" className="shrink-0 md:hidden" style={{ height: "calc(60px + env(safe-area-inset-bottom))" }} />
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`) || (t.href === "/dashboard" && ["/profile", "/my-listings"].includes(pathname));
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cx("relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-ink" : "text-ink-soft")}>
                <span className={cx("absolute top-0 h-0.5 w-8 rounded-full bg-terracotta transition-transform duration-200", active ? "scale-x-100" : "scale-x-0")} />
                <span className="relative">
                  <Icon name={t.icon} size={22} strokeWidth={active ? 1.9 : 1.5} />
                  {t.href === "/messages" && <CountDot n={inbox} />}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}

/* ── Strips ────────────────────────────────────────────── */

function DemoStrip() {
  const { mode } = useMe();
  const ref = useRef<HTMLDivElement>(null);
  // Full-height screens (chat) subtract this strip so they never scroll the page.
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) {
      root.style.setProperty("--strip", "0px");
      return;
    }
    const ro = new ResizeObserver(() => root.style.setProperty("--strip", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  if (mode !== "demo") return null;
  return (
    <div ref={ref} className="bg-ink text-ivory">
      <p className="shell py-1.5 text-center text-xs">
        <span className="font-semibold">Demo mode.</span> Homes and people here are samples, and what you do stays in this browser.{" "}
        <Link href="/safety#demo" className="underline underline-offset-2">
          What that means
        </Link>
      </p>
    </div>
  );
}

function OfflineStrip() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-16 z-30 bg-clay text-ivory md:top-[72px]">
      <p className="shell flex items-center justify-center gap-2 py-2 text-sm font-medium">
        <Icon name="offline" size={16} /> You&apos;re offline. Photos, maps and new messages will catch up when you&apos;re back.
      </p>
    </div>
  );
}

/* ── Footer ────────────────────────────────────────────── */

function Footer() {
  const groups: [string, [string, string][]][] = [
    ["Find", [["/explore", "Explore homes"], ["/flatmates", "Find flatmates"], ["/explore?view=map", "Browse the map"]]],
    ["List", [["/list", "List your space"], ["/my-listings", "Manage listings"]]],
    ["Trust", [["/safety", "Staying safe"], ["/safety#verification", "What verification means"], ["/safety#report", "Report a problem"], ["/privacy", "Privacy"]]],
  ];
  return (
    <footer className="mt-auto border-t border-line bg-sand/60">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm text-ink-soft">Find a place. Find your people. A flat and flatmate finder for people moving to Indian cities, starting with Bengaluru.</p>
          <p className="mt-4 text-sm">
            <a className="link" href="mailto:hello@roomieva.example">
              hello@roomieva.example
            </a>
          </p>
        </div>
        {groups.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="micro mb-3 text-ink-soft">{title}</h2>
            <ul className="space-y-1">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-[36px] items-center text-sm font-medium hover:underline hover:underline-offset-4">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="shell flex flex-col gap-2 border-t border-line py-5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>Roomieva never asks for a deposit, token or booking amount. Don&apos;t pay anyone before you&apos;ve seen the home.</p>
        <p>Made for Bengaluru first.</p>
      </div>
    </footer>
  );
}

/* ── Shell ─────────────────────────────────────────────── */

const WITH_FOOTER = ["/", "/safety", "/privacy"];

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <MeProvider>
      <ToastProvider>
        <a href="#main" className="btn btn-ink sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70]">
          Skip to content
        </a>
        <DemoStrip />
        <Header />
        <OfflineStrip />
        <Main>{children}</Main>
        {WITH_FOOTER.includes(pathname) && <Footer />}
        <Suspense fallback={null}>
          <TabBar />
        </Suspense>
      </ToastProvider>
    </MeProvider>
  );
}

function Main({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="flex min-h-0 flex-1 flex-col">
      {children}
    </main>
  );
}
