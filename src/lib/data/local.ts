/**
 * On-device demo store.
 *
 * Implements the full DataApi against IndexedDB so the whole product works
 * without a backend. Nothing leaves the browser. It enforces the same rules
 * the Supabase policies do (ownership, membership, blocks, request gating) so
 * behaviour matches, but it is a demo: it is not a security boundary.
 *
 * Tabs talk over BroadcastChannel, which gives real-time messages and typing
 * indicators between two tabs signed in as different people.
 */
import { LOCALITIES } from "../constants";
import { buildSeed } from "../demo/seed";
import { uid } from "../format";
import { findDuplicates, freshness, isDiscoverable } from "../listing-quality";
import type {
  Conversation,
  ConversationView,
  ID,
  LifestyleAnswers,
  Listing,
  ListingDraft,
  Message,
  ModerationAction,
  PrivateContact,
  Profile,
  Report,
  ReviewItem,
  Session,
} from "../types";
import { emailSchema, listingSchema, messageSchema, reportSchema } from "../validation";
import { AppError, type AdminQueue, type DataApi, type ProfilePatch } from "./api";

const DB_VERSION = 3;
const SESSION_KEY = "saha.session";
const TAB_SESSION_KEY = "saha.session.tab";

interface DB {
  version: number;
  profiles: Profile[];
  contacts: Record<ID, PrivateContact>;
  lifestyle: Record<ID, LifestyleAnswers>;
  listings: Listing[];
  addresses: Record<ID, string>;
  saved: { userId: ID; listingId: ID; at: string }[];
  conversations: Conversation[];
  messages: Message[];
  reads: Record<string, string>;
  consents: { conversationId: ID; userId: ID; at: string }[];
  blocks: { blockerId: ID; blockedId: ID; at: string }[];
  reports: Report[];
  actions: ModerationAction[];
  refreshHistory: { listingId: ID; by: ID; at: string }[];
  otps: Record<string, { code: string; expires: number; attempts: number }>;
}

/* ── tiny IndexedDB key-value ──────────────────────────── */

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("saha-demo", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("kv").objectStore("kv").get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function freshDb(): DB {
  const seed = buildSeed();
  return {
    version: DB_VERSION,
    ...seed,
    saved: [],
    reads: {
      "demo-c-01:demo-u-01": seed.messages.filter((m) => m.conversationId === "demo-c-01").slice(-2)[0].createdAt,
      "demo-c-01:demo-u-02": new Date().toISOString(),
      "demo-c-03:demo-u-05": new Date().toISOString(),
      "demo-c-04:demo-u-01": new Date().toISOString(),
    },
    consents: [],
    blocks: [],
    actions: [],
    refreshHistory: [],
    otps: {},
  };
}

const nowIso = () => new Date().toISOString();

export async function createLocalApi(): Promise<DataApi> {
  let db: DB;
  let persistent = true;
  try {
    const stored = await idbGet<DB>("db");
    db = stored && stored.version === DB_VERSION ? stored : freshDb();
    if (db !== stored) await idbSet("db", db);
  } catch {
    persistent = false;
    db = freshDb();
  }

  const listeners = new Set<() => void>();
  const typingListeners = new Map<ID, Set<(userId: ID) => void>>();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("saha-demo") : null;
  const notify = () => listeners.forEach((l) => l());

  channel?.addEventListener("message", async (event: MessageEvent) => {
    const data = event.data as { type: string; conversationId?: ID; userId?: ID };
    if (data.type === "changed") {
      try {
        const stored = await idbGet<DB>("db");
        if (stored) db = stored;
      } catch {
        /* keep what we have */
      }
      notify();
    } else if (data.type === "typing" && data.conversationId && data.userId) {
      typingListeners.get(data.conversationId)?.forEach((l) => l(data.userId as ID));
    }
  });
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === SESSION_KEY) notify();
    });
  }

  async function commit() {
    if (persistent) {
      try {
        await idbSet("db", db);
      } catch {
        throw new AppError("unavailable", "Couldn't save on this device. Your browser storage may be full.");
      }
    }
    notify();
    channel?.postMessage({ type: "changed" });
  }

  /* ── session ── */
  const readSession = (): Session | null => {
    try {
      const raw = sessionStorage.getItem(TAB_SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return db.profiles.some((p) => p.id === s.userId) ? s : null;
    } catch {
      return null;
    }
  };
  const me = (): Session => {
    const s = readSession();
    if (!s) throw new AppError("auth", "Please log in to continue.");
    return s;
  };
  const profileOf = (id: ID) => db.profiles.find((p) => p.id === id) ?? null;
  const requireAdmin = () => {
    const s = me();
    if (!profileOf(s.userId)?.isAdmin) throw new AppError("forbidden", "Only moderators can do that.");
    return s;
  };
  const isBlockedPair = (a: ID, b: ID) =>
    db.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
  const memberOf = (c: Conversation, userId: ID) => c.requesterId === userId || c.recipientId === userId;
  const conversation = (id: ID, userId: ID) => {
    const c = db.conversations.find((x) => x.id === id);
    if (!c || !memberOf(c, userId)) throw new AppError("not_found", "That conversation doesn't exist.");
    return c;
  };
  const ownListing = (id: ID, userId: ID) => {
    const l = db.listings.find((x) => x.id === id);
    if (!l) throw new AppError("not_found", "That listing doesn't exist.");
    if (l.listerId !== userId) throw new AppError("forbidden", "You can only manage your own listings.");
    return l;
  };
  const canSee = (l: Listing, viewer: Session | null) => {
    if (l.status === "active" || l.status === "occupied" || l.status === "paused") return true;
    if (!viewer) return false;
    return l.listerId === viewer.userId || Boolean(profileOf(viewer.userId)?.isAdmin);
  };

  const api: DataApi = {
    mode: "demo",

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /* ── auth ── */
    async getSession() {
      return readSession();
    },

    async requestOtp(rawEmail) {
      const email = emailSchema.parse(rawEmail);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.otps[email] = { code, expires: Date.now() + 10 * 60_000, attempts: 0 };
      await commit();
      // No mail service in demo mode. The caller must show this code and say so.
      return { delivery: "demo", demoCode: code };
    },

    async verifyOtp(rawEmail, code) {
      const email = emailSchema.parse(rawEmail);
      const entry = db.otps[email];
      if (!entry) throw new AppError("invalid", "Request a new code first.");
      if (Date.now() > entry.expires) {
        delete db.otps[email];
        await commit();
        throw new AppError("invalid", "That code has expired. Request a new one.");
      }
      if (entry.attempts >= 5) throw new AppError("invalid", "Too many wrong attempts. Request a new code.");
      if (entry.code !== code.trim()) {
        entry.attempts += 1;
        await commit();
        throw new AppError("invalid", "That code doesn't match. Check it and try again.");
      }
      delete db.otps[email];

      let userId = Object.keys(db.contacts).find((id) => db.contacts[id].email === email);
      if (!userId) {
        userId = uid("u-");
        db.contacts[userId] = { email, phone: null };
        db.profiles.push({
          id: userId,
          displayName: "",
          avatarUrl: null,
          city: "Bengaluru",
          occupation: "",
          stage: "professional",
          bio: "",
          intent: "seeking",
          budgetMin: 12000,
          budgetMax: 25000,
          moveInBy: null,
          preferredLocalities: [],
          // Demo sign-in shows the code on screen, so it proves nothing about
          // who owns the mailbox. No verification level is granted.
          verification: { email: false, phone: false, institution: false },
          isAdmin: false,
          isDemo: false,
          onboarded: false,
          createdAt: nowIso(),
        });
      }
      const session: Session = { userId, email };
      sessionStorage.removeItem(TAB_SESSION_KEY);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      await commit();
      return session;
    },

    async signOut() {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      notify();
    },

    async listPersonas() {
      return db.profiles.filter((p) => p.isDemo && (p.isAdmin || db.lifestyle[p.id]));
    },

    async actAs(userId) {
      const p = profileOf(userId);
      if (!p || !p.isDemo) throw new AppError("forbidden", "Only sample accounts can be opened this way.");
      const session: Session = { userId, email: db.contacts[userId]?.email ?? "" };
      // Per-tab, so two tabs can be two different people talking to each other.
      sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(session));
      notify();
    },

    /* ── people ── */
    async getMyProfile() {
      const s = readSession();
      return s ? profileOf(s.userId) : null;
    },

    async getProfile(id) {
      return profileOf(id);
    },

    async saveMyProfile(patch: ProfilePatch) {
      const s = me();
      const p = profileOf(s.userId)!;
      Object.assign(p, patch);
      await commit();
      return p;
    },

    async listPeople() {
      const s = readSession();
      return db.profiles.filter(
        (p) =>
          p.onboarded &&
          !p.isAdmin &&
          (p.intent === "seeking" || p.intent === "both") &&
          p.id !== s?.userId &&
          !(s && isBlockedPair(s.userId, p.id)),
      );
    },

    async getLifestyle(userId) {
      return db.lifestyle[userId] ?? null;
    },

    async getLifestyles(userIds) {
      const out: Record<ID, LifestyleAnswers> = {};
      for (const id of userIds) if (db.lifestyle[id]) out[id] = db.lifestyle[id];
      return out;
    },

    async saveMyLifestyle(answers) {
      const s = me();
      db.lifestyle[s.userId] = answers;
      await commit();
    },

    /* ── homes ── */
    async listListings() {
      const s = readSession();
      return db.listings.filter((l) => isDiscoverable(l) && !(s && isBlockedPair(s.userId, l.listerId)));
    },

    async getListing(id) {
      const l = db.listings.find((x) => x.id === id);
      return l && canSee(l, readSession()) ? l : null;
    },

    async myListings() {
      const s = me();
      return db.listings
        .filter((l) => l.listerId === s.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getListingAddress(id) {
      const s = me();
      const l = db.listings.find((x) => x.id === id);
      if (!l || (l.listerId !== s.userId && !profileOf(s.userId)?.isAdmin)) return null;
      return db.addresses[id] ?? "";
    },

    async saveListing(draft: ListingDraft, publish: boolean) {
      const s = me();
      const existing = draft.id ? ownListing(draft.id, s.userId) : null;
      if (existing && (existing.status === "removed" || existing.status === "under_review")) {
        throw new AppError("forbidden", "This listing is with a moderator and can't be edited right now.");
      }
      if (publish) {
        const parsed = listingSchema.safeParse(draft);
        if (!parsed.success) throw new AppError("invalid", parsed.error.issues[0]?.message ?? "Some details are missing.");
        if (!profileOf(s.userId)?.onboarded) throw new AppError("forbidden", "Finish setting up your profile before publishing.");
      }

      const { address, id: _ignored, ...fields } = draft;
      void _ignored;
      const loc = LOCALITIES.find((l) => l.name === draft.locality);
      const now = nowIso();
      const contentChanged =
        !existing ||
        existing.title !== fields.title ||
        existing.description !== fields.description ||
        existing.rent !== fields.rent ||
        existing.locality !== fields.locality ||
        JSON.stringify(existing.photos) !== JSON.stringify(fields.photos);

      const listing: Listing = {
        ...(existing ?? {
          id: uid("l-"),
          listerId: s.userId,
          approxLat: 0,
          approxLng: 0,
          status: "draft" as const,
          reviewReason: null,
          verification: "none" as const,
          publishedAt: null,
          lastConfirmedAt: null,
          createdAt: now,
          isDemo: false,
        }),
        ...fields,
        updatedAt: now,
      } as Listing;

      if (loc && (!existing || existing.locality !== draft.locality)) {
        // The public pin is the neighbourhood centre plus a random offset, never the address.
        listing.approxLat = loc.lat + (Math.random() - 0.5) * 0.012;
        listing.approxLng = loc.lng + (Math.random() - 0.5) * 0.012;
      }
      // A moderator's review applies to the content they read. Edits clear it.
      if (existing && contentChanged && listing.verification !== "none") listing.verification = "none";

      let heldReason: string | null = null;
      if (publish) {
        const wasLive = existing?.status === "active";
        const hits = findDuplicates(listing, db.listings);
        if (hits.length > 0) {
          listing.status = "under_review";
          listing.reviewReason = hits[0].reason;
          heldReason = hits[0].reason;
        } else {
          listing.status = "active";
          listing.reviewReason = null;
        }
        listing.publishedAt = existing?.publishedAt ?? now;
        if (!wasLive || !listing.lastConfirmedAt) listing.lastConfirmedAt = now;
      } else if (!existing) {
        listing.status = "draft";
      }

      db.addresses[listing.id] = address;
      const index = db.listings.findIndex((l) => l.id === listing.id);
      if (index >= 0) db.listings[index] = listing;
      else db.listings.push(listing);
      await commit();
      return { listing, heldReason };
    },

    async setListingStatus(id, status) {
      const s = me();
      const l = ownListing(id, s.userId);
      if (l.status === "removed" || l.status === "under_review") {
        throw new AppError("forbidden", "This listing is with a moderator and can't be changed right now.");
      }
      if (l.status === "draft") throw new AppError("invalid", "Publish the listing first.");
      if (status === "active") {
        const hits = findDuplicates(l, db.listings);
        if (hits.length > 0) {
          l.status = "under_review";
          l.reviewReason = hits[0].reason;
        } else {
          l.status = "active";
        }
        l.lastConfirmedAt = nowIso();
        db.refreshHistory.push({ listingId: id, by: s.userId, at: nowIso() });
      } else {
        l.status = status;
      }
      l.updatedAt = nowIso();
      await commit();
      return l;
    },

    async confirmAvailable(id) {
      const s = me();
      const l = ownListing(id, s.userId);
      if (l.status !== "active") throw new AppError("invalid", "Only live listings can be reconfirmed.");
      l.lastConfirmedAt = nowIso();
      l.updatedAt = nowIso();
      db.refreshHistory.push({ listingId: id, by: s.userId, at: nowIso() });
      await commit();
      return l;
    },

    async deleteListing(id) {
      const s = me();
      ownListing(id, s.userId);
      db.listings = db.listings.filter((l) => l.id !== id);
      delete db.addresses[id];
      db.saved = db.saved.filter((x) => x.listingId !== id);
      await commit();
    },

    async uploadPhoto(file) {
      me();
      if (!file.type.startsWith("image/")) throw new AppError("invalid", `${file.name} isn't an image.`);
      if (file.size > 10 * 1024 * 1024) throw new AppError("invalid", `${file.name} is over 10 MB. Try a smaller photo.`);
      return downscale(file);
    },

    /* ── saved ── */
    async getSavedIds() {
      const s = readSession();
      if (!s) return [];
      return db.saved
        .filter((x) => x.userId === s.userId)
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((x) => x.listingId);
    },

    async toggleSaved(listingId) {
      const s = me();
      const index = db.saved.findIndex((x) => x.userId === s.userId && x.listingId === listingId);
      if (index >= 0) db.saved.splice(index, 1);
      else {
        if (!db.listings.some((l) => l.id === listingId)) throw new AppError("not_found", "That listing doesn't exist.");
        db.saved.push({ userId: s.userId, listingId, at: nowIso() });
      }
      await commit();
      return index < 0;
    },

    /* ── conversations ── */
    async listConversations() {
      const s = me();
      const views: ConversationView[] = [];
      for (const c of db.conversations) {
        if (!memberOf(c, s.userId)) continue;
        // A declined request disappears for the person who declined it.
        if (c.status === "declined" && c.recipientId === s.userId) continue;
        const otherId = c.requesterId === s.userId ? c.recipientId : c.requesterId;
        const other = profileOf(otherId);
        if (!other) continue;
        const thread = db.messages.filter((m) => m.conversationId === c.id);
        const lastRead = db.reads[`${c.id}:${s.userId}`] ?? "";
        const listing = c.listingId ? db.listings.find((l) => l.id === c.listingId) : null;
        const iConsented = db.consents.some((x) => x.conversationId === c.id && x.userId === s.userId);
        const theyConsented = db.consents.some((x) => x.conversationId === c.id && x.userId === otherId);
        const blockedByMe = db.blocks.some((x) => x.blockerId === s.userId && x.blockedId === otherId);
        const blocked = isBlockedPair(s.userId, otherId);
        views.push({
          conversation: c,
          other,
          listing: listing ? { id: listing.id, title: listing.title, locality: listing.locality, status: listing.status } : null,
          lastMessage: thread[thread.length - 1] ?? null,
          unread: blocked ? 0 : thread.filter((m) => m.senderId !== s.userId && m.createdAt > lastRead).length,
          blocked,
          blockedByMe,
          contact: {
            iConsented,
            theyConsented,
            shared: iConsented && theyConsented && !blocked ? (db.contacts[otherId] ?? null) : null,
          },
        });
      }
      return views.sort((a, b) => b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt));
    },

    async getMessages(conversationId) {
      const s = me();
      conversation(conversationId, s.userId);
      return db.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async startConversation({ toUserId, listingId, body }) {
      const s = me();
      const text = messageSchema.parse(body);
      if (toUserId === s.userId) throw new AppError("invalid", "You can't message yourself.");
      if (!profileOf(s.userId)?.onboarded) throw new AppError("forbidden", "Finish setting up your profile before messaging.");
      if (!profileOf(toUserId)) throw new AppError("not_found", "That person isn't on Roomieva any more.");
      if (isBlockedPair(s.userId, toUserId)) throw new AppError("forbidden", "You can't message this person.");
      if (listingId) {
        const l = db.listings.find((x) => x.id === listingId);
        if (!l || !isDiscoverable(l)) throw new AppError("unavailable", "This home isn't taking messages right now.");
      }
      const existing = db.conversations.find(
        (c) =>
          ((c.requesterId === s.userId && c.recipientId === toUserId) ||
            (c.requesterId === toUserId && c.recipientId === s.userId)) &&
          c.listingId === listingId,
      );
      if (existing) {
        if (existing.status === "declined") throw new AppError("conflict", "An earlier request here wasn't accepted, so a new one can't be sent.");
        throw new AppError("conflict", "You already have a conversation about this. Find it in Messages.");
      }
      const now = nowIso();
      const c: Conversation = {
        id: uid("c-"),
        listingId,
        requesterId: s.userId,
        recipientId: toUserId,
        status: "pending",
        createdAt: now,
        lastMessageAt: now,
      };
      db.conversations.push(c);
      db.messages.push({ id: uid("m-"), conversationId: c.id, senderId: s.userId, body: text, createdAt: now });
      db.reads[`${c.id}:${s.userId}`] = now;
      await commit();
      return c;
    },

    async respondToRequest(conversationId, accept) {
      const s = me();
      const c = conversation(conversationId, s.userId);
      if (c.recipientId !== s.userId) throw new AppError("forbidden", "Only the person who received the request can answer it.");
      if (c.status !== "pending") throw new AppError("conflict", "This request has already been answered.");
      c.status = accept ? "accepted" : "declined";
      await commit();
    },

    async sendMessage(conversationId, body) {
      const s = me();
      const text = messageSchema.parse(body);
      const c = conversation(conversationId, s.userId);
      const otherId = c.requesterId === s.userId ? c.recipientId : c.requesterId;
      if (isBlockedPair(s.userId, otherId)) throw new AppError("forbidden", "You can't send messages in this conversation.");
      if (c.status === "declined") throw new AppError("forbidden", "This request wasn't accepted.");
      if (c.status === "pending") {
        throw new AppError(
          "forbidden",
          c.requesterId === s.userId ? "You can write again once your request is accepted." : "Accept the request to reply.",
        );
      }
      const message: Message = { id: uid("m-"), conversationId, senderId: s.userId, body: text, createdAt: nowIso() };
      db.messages.push(message);
      c.lastMessageAt = message.createdAt;
      db.reads[`${conversationId}:${s.userId}`] = message.createdAt;
      await commit();
      return message;
    },

    async markRead(conversationId) {
      const s = readSession();
      if (!s) return;
      const key = `${conversationId}:${s.userId}`;
      const last = db.messages.filter((m) => m.conversationId === conversationId).pop();
      if (!last || db.reads[key] >= last.createdAt) return;
      db.reads[key] = last.createdAt;
      await commit();
    },

    sendTyping(conversationId) {
      const s = readSession();
      if (s) channel?.postMessage({ type: "typing", conversationId, userId: s.userId });
    },

    onTyping(conversationId, listener) {
      if (!typingListeners.has(conversationId)) typingListeners.set(conversationId, new Set());
      typingListeners.get(conversationId)!.add(listener);
      return () => typingListeners.get(conversationId)?.delete(listener);
    },

    async setContactConsent(conversationId, consent) {
      const s = me();
      const c = conversation(conversationId, s.userId);
      if (c.status !== "accepted") throw new AppError("forbidden", "Contact details can only be shared in an accepted conversation.");
      db.consents = db.consents.filter((x) => !(x.conversationId === conversationId && x.userId === s.userId));
      if (consent) db.consents.push({ conversationId, userId: s.userId, at: nowIso() });
      await commit();
    },

    /* ── safety ── */
    async blockUser(userId) {
      const s = me();
      if (userId === s.userId) throw new AppError("invalid", "You can't block yourself.");
      if (!db.blocks.some((x) => x.blockerId === s.userId && x.blockedId === userId)) {
        db.blocks.push({ blockerId: s.userId, blockedId: userId, at: nowIso() });
        // Blocking withdraws any contact details you agreed to share with them.
        const shared = db.conversations.filter((c) => memberOf(c, s.userId) && memberOf(c, userId)).map((c) => c.id);
        db.consents = db.consents.filter((x) => !(shared.includes(x.conversationId) && x.userId === s.userId));
      }
      await commit();
    },

    async unblockUser(userId) {
      const s = me();
      db.blocks = db.blocks.filter((x) => !(x.blockerId === s.userId && x.blockedId === userId));
      await commit();
    },

    async listBlocked() {
      const s = readSession();
      return s ? db.blocks.filter((x) => x.blockerId === s.userId).map((x) => x.blockedId) : [];
    },

    async report({ targetType, targetId, reason, details }) {
      const s = me();
      const parsed = reportSchema.parse({ reason, details });
      if (targetType === "conversation") conversation(targetId, s.userId);
      if (db.reports.some((r) => r.reporterId === s.userId && r.targetId === targetId && r.status === "open")) {
        throw new AppError("conflict", "You've already reported this. A moderator will look at it.");
      }
      db.reports.push({
        id: uid("r-"),
        reporterId: s.userId,
        targetType,
        targetId,
        reason: parsed.reason,
        details: parsed.details,
        status: "open",
        createdAt: nowIso(),
      });
      // Three independent open reports take a listing out of search until a moderator looks.
      if (targetType === "listing") {
        const l = db.listings.find((x) => x.id === targetId);
        const reporters = new Set(db.reports.filter((r) => r.targetId === targetId && r.status === "open").map((r) => r.reporterId));
        if (l && l.status === "active" && reporters.size >= 3) {
          l.status = "under_review";
          l.reviewReason = "Reported by several people";
        }
      }
      await commit();
    },

    /* ── moderation ── */
    async adminQueue(): Promise<AdminQueue> {
      requireAdmin();
      const open = db.reports.filter((r) => r.status === "open");
      const items: ReviewItem[] = [];
      for (const l of db.listings) {
        if (l.status === "removed" || l.status === "draft") continue;
        const reasons: string[] = [];
        const openReports = open.filter((r) => r.targetType === "listing" && r.targetId === l.id);
        if (l.status === "under_review" && l.reviewReason) reasons.push(l.reviewReason);
        if (openReports.length) reasons.push(`${openReports.length} open report${openReports.length === 1 ? "" : "s"}`);
        if (l.status === "active" && freshness(l) === "stale") reasons.push("Not reconfirmed by the lister. Hidden from search");
        if (l.status === "active" && l.rent < (LOCALITIES.find((x) => x.name === l.locality)?.typicalRoom[0] ?? 0) * 0.6 && l.roomType !== "shared")
          reasons.push("Rent is far below the usual range for this area");
        if (reasons.length) items.push({ listing: l, lister: profileOf(l.listerId), reasons, openReports });
      }
      const weight = (i: ReviewItem) => (i.listing.status === "under_review" ? 100 : 0) + i.openReports.length * 10;
      items.sort((a, b) => weight(b) - weight(a));
      const subject = (r: Report) => {
        if (r.targetType === "user") return profileOf(r.targetId)?.displayName ?? "Unknown person";
        const c = db.conversations.find((x) => x.id === r.targetId);
        if (!c) return "Conversation";
        const other = c.requesterId === r.reporterId ? c.recipientId : c.requesterId;
        return `Conversation with ${profileOf(other)?.displayName ?? "someone"}`;
      };
      return {
        listings: items,
        otherReports: open.filter((r) => r.targetType !== "listing").map((r) => ({ ...r, subject: subject(r) })),
        actions: [...db.actions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
      };
    },

    async adminResolveListing(listingId, decision, note) {
      const s = requireAdmin();
      const l = db.listings.find((x) => x.id === listingId);
      if (!l) throw new AppError("not_found", "That listing doesn't exist.");
      const related = db.reports.filter((r) => r.targetType === "listing" && r.targetId === listingId && r.status === "open");
      if (decision === "remove") {
        l.status = "removed";
        related.forEach((r) => (r.status = "actioned"));
      } else {
        if (l.status === "under_review") {
          l.status = "active";
          l.lastConfirmedAt = l.lastConfirmedAt ?? nowIso();
        }
        l.reviewReason = null;
        if (decision === "mark_reviewed" && l.verification === "none") l.verification = "reviewed";
        related.forEach((r) => (r.status = "dismissed"));
      }
      l.updatedAt = nowIso();
      db.actions.push({ id: uid("a-"), adminId: s.userId, targetType: "listing", targetId: listingId, action: decision, note, createdAt: nowIso() });
      await commit();
    },

    async adminResolveReport(reportId, status, note) {
      const s = requireAdmin();
      const r = db.reports.find((x) => x.id === reportId);
      if (!r) throw new AppError("not_found", "That report doesn't exist.");
      r.status = status;
      db.actions.push({ id: uid("a-"), adminId: s.userId, targetType: r.targetType, targetId: r.targetId, action: `report_${status}`, note, createdAt: nowIso() });
      await commit();
    },
  };

  return api;
}

/** Resize in the browser so photos stay small enough to keep on-device. */
async function downscale(file: File, maxSide = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new AppError("invalid", `${file.name} couldn't be read as an image.`);
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}
