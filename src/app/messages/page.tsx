"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ReportDialog } from "@/components/listing";
import { Avatar, EmptyState, ErrorNote, Modal, Note, Pill, SamplePill, SignInGate, useToast } from "@/components/ui";
import { errorMessage, getApi } from "@/lib/data/api";
import { useLive, useMe } from "@/lib/data/hooks";
import { ago, clock, cx, dayLabel, daysBetween, firstName } from "@/lib/format";
import type { ConversationView, Message } from "@/lib/types";
import { containsContactDetails, messageSchema } from "@/lib/validation";

/* ── list ──────────────────────────────────────────────── */

function ConversationRow({ view, active, meId }: { view: ConversationView; active: boolean; meId: string }) {
  const { conversation: c, other, lastMessage } = view;
  const incomingRequest = c.status === "pending" && c.recipientId === meId;
  const preview =
    c.status === "declined"
      ? "Request not accepted"
      : lastMessage
        ? `${lastMessage.senderId === meId ? "You: " : ""}${lastMessage.body}`
        : "No messages yet";
  return (
    <Link
      href={`/messages?c=${c.id}`}
      aria-current={active ? "page" : undefined}
      className={cx("flex min-h-[76px] items-center gap-3 rounded-2xl px-3 py-3 transition-colors", active ? "bg-ink text-ivory" : "hover:bg-sand")}
    >
      <Avatar profile={other} size={46} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cx("truncate", view.unread > 0 ? "font-bold" : "font-semibold")}>{firstName(other.displayName)}</span>
          <span className={cx("shrink-0 text-xs", active ? "text-ivory/60" : "text-ink-soft")}>{ago(c.lastMessageAt)}</span>
        </span>
        {view.listing && <span className={cx("block truncate text-xs", active ? "text-ivory/70" : "text-ink-soft")}>{view.listing.title}</span>}
        <span className={cx("mt-0.5 block truncate text-sm", active ? "text-ivory/80" : view.unread > 0 ? "font-medium text-ink" : "text-ink-soft")}>{preview}</span>
      </span>
      {incomingRequest ? (
        <Pill tone={active ? "paper" : "ink"}>Request</Pill>
      ) : view.unread > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-ink">
          {view.unread}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </Link>
  );
}

/* ── thread ────────────────────────────────────────────── */

function TypingDots({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-soft" role="status">
      <span className="flex gap-1 rounded-full bg-sand px-3 py-2.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-soft" style={{ animation: `typing-dot 1.1s ${i * 0.15}s infinite` }} />
        ))}
      </span>
      {name} is typing
    </div>
  );
}

function ContactSharing({ view }: { view: ConversationView }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const name = firstName(view.other.displayName);
  const { iConsented, theyConsented, shared } = view.contact;

  const set = async (consent: boolean) => {
    setPending(true);
    try {
      const api = await getApi();
      await api.setContactConsent(view.conversation.id, consent);
      toast(consent ? (theyConsented ? "Contact details shared both ways" : `Offered. Nothing is shown until ${name} agrees too`) : "You've stopped sharing your contact details");
      if (!consent) setOpen(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-sand">
        <Icon name="key" size={18} className="text-ink-soft" />
        {shared ? "Contact details" : iConsented ? "Waiting to swap contacts" : theyConsented ? `${name} offered to swap contacts` : "Swap contact details"}
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Swap contact details" description="It only happens when you both say yes. Either of you can take it back.">
        {shared ? (
          <div className="space-y-4">
            <dl className="rounded-2xl bg-sage p-4">
              <dt className="micro text-ink-soft">{name}&apos;s email</dt>
              <dd className="break-all text-lg font-semibold">{shared.email}</dd>
              <dt className="micro mt-3 text-ink-soft">{name}&apos;s phone</dt>
              <dd className="text-lg font-semibold">{shared.phone ?? "Not provided"}</dd>
            </dl>
            <p className="text-sm text-ink-soft">{name} can see your sign-in email{" "}in the same way.</p>
            <button type="button" className="btn btn-quiet w-full" onClick={() => set(false)} disabled={pending}>
              Stop sharing mine
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-3">
              {[
                [iConsented, "You agree to share your sign-in email (and phone, if you've confirmed one)."],
                [theyConsented, `${name} agrees to share theirs.`],
                [false, "Only then do you each see the other's details, here in this conversation."],
              ].map(([done, text], i) => (
                <li key={i} className="flex gap-3">
                  <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-olive text-ivory" : "border border-line")}>{done ? <Icon name="check" size={13} strokeWidth={2} /> : i + 1}</span>
                  <span>{text as string}</span>
                </li>
              ))}
            </ol>
            <Note icon="shield">Share only once you&apos;ve chatted enough to be comfortable. A call or a visit should come before any payment.</Note>
            {iConsented ? (
              <button type="button" className="btn btn-quiet w-full" onClick={() => set(false)} disabled={pending}>
                Withdraw my offer
              </button>
            ) : (
              <button type="button" className="btn btn-ink w-full" onClick={() => set(true)} disabled={pending}>
                {theyConsented ? "Yes, swap details" : "Offer to swap"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Thread({ view, meId }: { view: ConversationView; meId: string }) {
  const { conversation: c, other } = view;
  const name = firstName(other.displayName);
  const toast = useToast();
  const live = useLive((api) => api.getMessages(c.id), [c.id]);
  const messages = useMemo(() => live.data ?? [], [live.data]);

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const seen = useRef(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [newBelow, setNewBelow] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lastTypingSent = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);

  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(false);
  }, []);

  // Stay pinned to the bottom only if the reader is already there. Otherwise
  // leave their place alone and offer a way down.
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const added = seen.current > 0 ? messages.slice(seen.current) : [];
    const firstLoad = seen.current === 0;
    seen.current = messages.length;
    if (added.length) setFresh(new Set(added.map((m) => m.id)));
    if (firstLoad || pinned.current || added.some((m) => m.senderId === meId)) toBottom(!firstLoad);
    else if (added.length) setNewBelow(true);
  }, [messages, meId, toBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (pinned.current) setNewBelow(false);
  };

  // Mark read while the thread is actually on screen.
  useEffect(() => {
    if (messages.length === 0 || document.visibilityState !== "visible") return;
    void getApi().then((api) => api.markRead(c.id)).catch(() => {});
  }, [messages.length, c.id]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let off: (() => void) | undefined;
    void getApi().then((api) => {
      off = api.onTyping(c.id, (userId) => {
        if (userId === meId) return;
        setTyping(true);
        clearTimeout(timer);
        timer = setTimeout(() => setTyping(false), 2600);
      });
    });
    return () => {
      off?.();
      clearTimeout(timer);
    };
  }, [c.id, meId]);

  useEffect(() => setTyping(false), [messages.length]);

  const onDraft = (value: string) => {
    setDraft(value);
    setError(null);
    const el = input.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
    if (value && Date.now() - lastTypingSent.current > 1500) {
      lastTypingSent.current = Date.now();
      void getApi().then((api) => api.sendTyping(c.id));
    }
  };

  const send = async () => {
    const parsed = messageSchema.safeParse(draft);
    if (!parsed.success) return;
    setSending(true);
    setError(null);
    try {
      const api = await getApi();
      await api.sendMessage(c.id, parsed.data);
      setDraft("");
      if (input.current) input.current.style.height = "auto";
      input.current?.focus();
    } catch (e) {
      // The text stays in the box so nothing typed is lost.
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const respond = async (accept: boolean) => {
    try {
      const api = await getApi();
      await api.respondToRequest(c.id, accept);
      toast(accept ? `You can now chat with ${name}` : "Request declined");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const toggleBlock = async () => {
    setMenuOpen(false);
    try {
      const api = await getApi();
      if (view.blockedByMe) await api.unblockUser(other.id);
      else await api.blockUser(other.id);
      toast(view.blockedByMe ? `${name} is unblocked` : `${name} is blocked`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const incoming = c.status === "pending" && c.recipientId === meId;
  const outgoing = c.status === "pending" && c.requesterId === meId;
  const canWrite = c.status === "accepted" && !view.blocked;

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Conversation with ${name}`}>
      <header className="flex items-center gap-2 border-b border-line bg-ivory px-2 py-2.5 sm:px-5">
        <Link href="/messages" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sand lg:hidden" aria-label="Back to all conversations">
          <Icon name="back" />
        </Link>
        <Link href={`/flatmates/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-2 hover:bg-sand/60">
          <Avatar profile={other} size={42} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold">{name}</span>
              {other.isDemo && <SamplePill />}
            </span>
            <span className="block truncate text-xs text-ink-soft">{view.listing ? `About: ${view.listing.title}` : other.occupation}</span>
          </span>
        </Link>
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sand" aria-label="Conversation options">
            <Icon name="dots" strokeWidth={3} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-2xl border border-line bg-paper p-2 shadow-lift [animation:fade-in_160ms_ease-out]">
              {c.status === "accepted" && !view.blocked && <ContactSharing view={view} />}
              {view.listing && (
                <Link href={`/homes/${view.listing.id}`} className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-sand">
                  <Icon name="home" size={18} className="text-ink-soft" /> View the listing
                </Link>
              )}
              <button type="button" onClick={toggleBlock} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-sand">
                <Icon name="block" size={18} className="text-ink-soft" /> {view.blockedByMe ? `Unblock ${name}` : `Block ${name}`}
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-clay hover:bg-sand">
                <Icon name="flag" size={18} /> Report this conversation
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </header>

      {view.contact.shared && (
        <p className="flex items-center gap-2 border-b border-line bg-sage px-5 py-2 text-sm">
          <Icon name="key" size={15} /> You&apos;ve swapped contact details. {name}: <span className="font-semibold">{view.contact.shared.email}</span>
        </p>
      )}
      {!view.contact.shared && view.contact.theyConsented && !view.contact.iConsented && canWrite && (
        <p className="flex items-center gap-2 border-b border-line bg-sand px-5 py-2 text-sm">
          <Icon name="key" size={15} /> {name} has offered to swap contact details. Open the menu to accept.
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6" tabIndex={0} aria-label="Messages" role="log" aria-live="polite">
          {live.loading && messages.length === 0 ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="skeleton h-12 w-3/5 !rounded-2xl" />
              <div className="skeleton ml-auto h-16 w-2/3 !rounded-2xl" />
              <div className="skeleton h-10 w-2/5 !rounded-2xl" />
            </div>
          ) : live.error ? (
            <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>
          ) : (
            <ol className="mx-auto flex max-w-2xl flex-col gap-1.5">
              {messages.map((m: Message, i) => {
                const prev = messages[i - 1];
                const mine = m.senderId === meId;
                const newDay = !prev || daysBetween(prev.createdAt, m.createdAt) !== 0;
                const joined = prev && !newDay && prev.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
                return (
                  <Fragment key={m.id}>
                    {newDay && (
                      <li className="my-4 flex items-center gap-3" aria-label={dayLabel(m.createdAt)}>
                        <span className="h-px flex-1 bg-line" />
                        <span className="micro text-ink-soft">{dayLabel(m.createdAt)}</span>
                        <span className="h-px flex-1 bg-line" />
                      </li>
                    )}
                    <li className={cx("flex max-w-[82%] flex-col", mine ? "items-end self-end" : "items-start self-start", !joined && !newDay && "mt-2", fresh.has(m.id) && "[animation:fade-in_260ms_ease-out]")}>
                      <p className={cx("whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5", mine ? "rounded-br-md bg-ink text-ivory" : "rounded-bl-md bg-sand text-ink")}>
                        <span className="sr-only">{mine ? "You" : name}: </span>
                        {m.body}
                      </p>
                      <time dateTime={m.createdAt} className="mt-0.5 px-1.5 text-[11px] text-ink-soft">
                        {clock(m.createdAt)}
                      </time>
                    </li>
                  </Fragment>
                );
              })}
              {typing && canWrite && (
                <li className="mt-2 self-start">
                  <TypingDots name={name} />
                </li>
              )}
            </ol>
          )}
        </div>
        {newBelow && (
          <button type="button" onClick={() => toBottom(true)} className="btn btn-ink btn-sm absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lift">
            New message <Icon name="chevronDown" size={14} />
          </button>
        )}
      </div>

      {/* footer changes with the state of the request */}
      <footer className="border-t border-line bg-ivory px-3 pt-3 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-2xl">
          {view.blocked ? (
            <Note icon="block">{view.blockedByMe ? `You've blocked ${name}. Unblock them from the menu to write again.` : "You can't send messages in this conversation."}</Note>
          ) : incoming ? (
            <div className="rounded-2xl border border-ink bg-paper p-4">
              <p className="font-semibold">{name} would like to talk{view.listing ? " about your listing" : ""}.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Have a look at{" "}
                <Link className="link" href={`/flatmates/${other.id}`}>
                  their profile
                </Link>{" "}
                first. If you decline, they aren&apos;t notified and can&apos;t message you again about this.
              </p>
              <div className="mt-4 flex gap-3">
                <button type="button" className="btn btn-quiet flex-1" onClick={() => respond(false)}>
                  Decline
                </button>
                <button type="button" className="btn btn-ink flex-1" onClick={() => respond(true)}>
                  Accept and reply
                </button>
              </div>
            </div>
          ) : outgoing ? (
            <Note icon="info">Request sent. You can write again once {name} accepts. Most people answer within a day or two.</Note>
          ) : c.status === "declined" ? (
            <Note icon="info">This request wasn&apos;t accepted, so the conversation is closed.</Note>
          ) : (
            <>
              {error && <ErrorNote className="mb-2">{error}</ErrorNote>}
              {containsContactDetails(draft) && !view.contact.shared && (
                <p className="mb-2 flex items-start gap-2 text-xs text-ink-soft">
                  <Icon name="key" size={14} className="mt-0.5 shrink-0" />
                  That looks like a phone number or email. &ldquo;Swap contact details&rdquo; in the menu makes sure it goes both ways.
                </p>
              )}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <label className="sr-only" htmlFor="composer">
                  Message {name}
                </label>
                <textarea
                  id="composer"
                  ref={input}
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => onDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={`Message ${name}`}
                  enterKeyHint="send"
                  className="field max-h-[140px] min-h-[48px] flex-1 resize-none !rounded-3xl"
                />
                <button type="submit" className="btn btn-ink h-12 w-12 shrink-0 !p-0" disabled={sending || !draft.trim()} aria-label="Send message">
                  <Icon name="send" size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </footer>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="conversation" targetId={c.id} subject={`your conversation with ${name}`} />
    </section>
  );
}

/* ── page ──────────────────────────────────────────────── */

function Messages() {
  const params = useSearchParams();
  const router = useRouter();
  const { session } = useMe();
  const selectedId = params.get("c");
  const live = useLive(async (api) => (session ? api.listConversations() : []), [session?.userId]);
  const all = useMemo(() => live.data ?? [], [live.data]);
  const selected = all.find((v) => v.conversation.id === selectedId) ?? null;

  // On wide screens there's room to open the most recent conversation straight away.
  useEffect(() => {
    if (!selectedId && all.length > 0 && window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(`/messages?c=${all[0].conversation.id}`);
    }
  }, [selectedId, all, router]);

  if (session === undefined) return <div className="shell py-10"><div className="skeleton h-[60vh] rounded-3xl" /></div>;
  if (!session) return <SignInGate next="/messages" title="Log in to see your messages" />;

  const requests = all.filter((v) => v.conversation.status === "pending" && v.conversation.recipientId === session.userId);
  const rest = all.filter((v) => !requests.includes(v));

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px-var(--strip,0px))] w-full max-w-[1440px] min-h-0 flex-1 md:h-[calc(100dvh-72px-var(--strip,0px))] lg:px-6 lg:py-5">
      <div className="flex min-h-0 w-full overflow-hidden lg:rounded-[26px] lg:border lg:border-line lg:bg-paper">
        <aside className={cx("min-h-0 w-full flex-col overflow-y-auto lg:flex lg:w-[380px] lg:shrink-0 lg:border-r lg:border-line", selectedId ? "hidden" : "flex")} aria-label="Conversations">
          <div className="px-5 pb-3 pt-6">
            <h1 className="display text-4xl">Messages</h1>
          </div>
          {live.loading && all.length === 0 ? (
            <div className="space-y-2 px-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[76px] !rounded-2xl" />
              ))}
            </div>
          ) : live.error ? (
            <div className="px-4">
              <ErrorNote onRetry={live.reload}>{live.error}</ErrorNote>
            </div>
          ) : all.length === 0 ? (
            <EmptyState
              title="It's quiet in here"
              action={
                <Link href="/explore" className="btn btn-ink">
                  Find a home to ask about
                </Link>
              }
            >
              When you message a lister or someone writes to you, the conversation shows up here.
            </EmptyState>
          ) : (
            <nav className="px-2 pb-6">
              {requests.length > 0 && (
                <>
                  <h2 className="micro px-3 pb-1 pt-3 text-clay">Requests · {requests.length}</h2>
                  <ul>
                    {requests.map((v) => (
                      <li key={v.conversation.id}>
                        <ConversationRow view={v} active={v.conversation.id === selectedId} meId={session.userId} />
                      </li>
                    ))}
                  </ul>
                  <h2 className="micro px-3 pb-1 pt-5 text-ink-soft">Conversations</h2>
                </>
              )}
              <ul>
                {rest.map((v) => (
                  <li key={v.conversation.id}>
                    <ConversationRow view={v} active={v.conversation.id === selectedId} meId={session.userId} />
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        <div className={cx("min-h-0 min-w-0 flex-1 flex-col lg:flex", selectedId ? "flex" : "hidden")}>
          {selected ? (
            <Thread key={selected.conversation.id} view={selected} meId={session.userId} />
          ) : selectedId && !live.loading ? (
            <EmptyState title="That conversation isn't here" action={<Link href="/messages" className="btn btn-ink">All conversations</Link>}>
              It may have been declined, or it belongs to a different account.
            </EmptyState>
          ) : (
            <div className="hidden flex-1 items-center justify-center lg:flex">
              <p className="text-ink-soft">Choose a conversation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Messages />
    </Suspense>
  );
}
