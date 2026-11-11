/**
 * Supabase implementation of the DataApi.
 *
 * Authorisation lives in the database (see supabase/migrations): row level
 * security for reads and simple writes, security-definer functions for
 * anything privileged. This file only maps rows to app types; it never
 * decides who may do what.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { LOCALITIES, STALE_AFTER_DAYS } from "../constants";
import { DAY } from "../format";
import { QUESTIONS } from "../lifestyle";
import { freshness } from "../listing-quality";
import type {
  Conversation,
  ConversationView,
  ID,
  Importance,
  LifestyleAnswers,
  Listing,
  ListingDraft,
  Message,
  ModerationAction,
  Profile,
  Report,
  ReviewItem,
  Session,
} from "../types";
import { emailSchema, listingSchema, messageSchema, reportSchema } from "../validation";
import { AppError, type AdminQueue, type DataApi, type ProfilePatch } from "./api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toProfile = (r: Row): Profile => ({
  id: r.id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  city: r.city,
  occupation: r.occupation,
  stage: r.stage,
  bio: r.bio,
  intent: r.intent,
  budgetMin: r.budget_min,
  budgetMax: r.budget_max,
  moveInBy: r.move_in_by,
  preferredLocalities: r.preferred_localities ?? [],
  verification: { email: r.email_verified, phone: r.phone_verified, institution: r.institution_verified },
  isAdmin: r.is_admin,
  isDemo: r.is_demo,
  onboarded: r.onboarded,
  createdAt: r.created_at,
});

const LISTING_SELECT = "*, property:properties(*), photos:listing_photos(url, alt, position)";

const toListing = (r: Row): Listing => ({
  id: r.id,
  listerId: r.lister_id,
  title: r.title,
  city: r.property.city,
  locality: r.property.locality,
  approxLat: r.property.approx_lat,
  approxLng: r.property.approx_lng,
  propertyType: r.property.property_type,
  bedrooms: r.property.bedrooms,
  bathrooms: r.property.bathrooms,
  furnishing: r.property.furnishing,
  amenities: r.property.amenities ?? [],
  description: r.property.description,
  houseRules: r.property.house_rules ?? [],
  roomType: r.room_type,
  rent: r.rent,
  deposit: r.deposit,
  brokerage: r.brokerage,
  availableFrom: r.available_from ?? "",
  occupantCount: r.occupant_count,
  occupantSummary: r.occupant_summary,
  listerLivesHere: r.lister_lives_here,
  photos: [...(r.photos ?? [])].sort((a: Row, b: Row) => a.position - b.position).map((p: Row) => ({ url: p.url, alt: p.alt })),
  status: r.status,
  reviewReason: r.review_reason,
  verification: r.verification,
  publishedAt: r.published_at,
  lastConfirmedAt: r.last_confirmed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  isDemo: r.is_demo,
});

const toConversation = (r: Row): Conversation => ({
  id: r.id,
  listingId: r.listing_id,
  requesterId: r.requester_id,
  recipientId: r.recipient_id,
  status: r.status,
  createdAt: r.created_at,
  lastMessageAt: r.last_message_at,
});

const toMessage = (r: Row): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
});

const toReport = (r: Row): Report => ({
  id: r.id,
  reporterId: r.reporter_id,
  targetType: r.target_type,
  targetId: r.target_id,
  reason: r.reason,
  details: r.details,
  status: r.status,
  createdAt: r.created_at,
});

function toLifestyle(r: Row): LifestyleAnswers {
  const out: LifestyleAnswers = {};
  const skipped: string[] = r.skipped ?? [];
  for (const q of QUESTIONS) {
    const value = r[q.id] as number | null;
    if (value === null && !skipped.includes(q.id)) continue;
    out[q.id] = { value, importance: (r.importance?.[q.id] as Importance) ?? "flexible" };
  }
  return out;
}

/** Turn a PostgREST / Postgres error into something a person can act on. */
function fail(error: { message: string; code?: string } | null): asserts error is null {
  if (!error) return;
  const code = error.code ?? "";
  if (code === "42501" || code === "PGRST301") throw new AppError("forbidden", error.message);
  if (code === "23505") throw new AppError("conflict", error.message);
  if (code === "22023" || code.startsWith("23")) throw new AppError("invalid", error.message);
  if (/fetch|network/i.test(error.message)) throw new AppError("offline", "Couldn't reach Roomieva. Check your connection and try again.");
  throw new AppError("unavailable", error.message);
}

async function sha256(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSupabaseApi(): Promise<DataApi> {
  const sb: SupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const typingChannels = new Map<ID, RealtimeChannel>();
  const typingListeners = new Map<ID, Set<(userId: ID) => void>>();

  let session: Session | null = null;
  const first = await sb.auth.getSession();
  if (first.data.session?.user) session = { userId: first.data.session.user.id, email: first.data.session.user.email ?? "" };
  sb.auth.onAuthStateChange((_event, s) => {
    session = s?.user ? { userId: s.user.id, email: s.user.email ?? "" } : null;
    notify();
  });

  // One realtime subscription keeps threads and inbox counts live. RLS limits
  // what arrives to conversations the signed-in person belongs to.
  sb.channel("saha-inbox")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, notify)
    .subscribe();

  const me = (): Session => {
    if (!session) throw new AppError("auth", "Please log in to continue.");
    return session;
  };

  const typingChannel = (conversationId: ID) => {
    let ch = typingChannels.get(conversationId);
    if (!ch) {
      ch = sb.channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        typingListeners.get(conversationId)?.forEach((l) => l(payload.userId as ID));
      }).subscribe();
      typingChannels.set(conversationId, ch);
    }
    return ch;
  };

  const fetchListing = async (id: ID) => {
    const { data, error } = await sb.from("listings").select(LISTING_SELECT).eq("id", id).maybeSingle();
    fail(error);
    return data ? toListing(data) : null;
  };

  const api: DataApi = {
    mode: "supabase",

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /* ── auth ── */
    async getSession() {
      return session;
    },

    async requestOtp(rawEmail) {
      const email = emailSchema.parse(rawEmail);
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw new AppError(error.status === 429 ? "unavailable" : "invalid", error.status === 429 ? "Too many requests. Wait a minute and try again." : error.message);
      return { delivery: "email" };
    },

    async verifyOtp(rawEmail, code) {
      const email = emailSchema.parse(rawEmail);
      const { data, error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error || !data.user) throw new AppError("invalid", "That code doesn't match or has expired. Request a new one.");
      session = { userId: data.user.id, email: data.user.email ?? email };
      notify();
      return session;
    },

    async signOut() {
      await sb.auth.signOut();
      session = null;
      notify();
    },

    async listPersonas() {
      return [];
    },

    async actAs() {
      throw new AppError("forbidden", "Sample accounts are only available in demo mode.");
    },

    /* ── people ── */
    async getMyProfile() {
      return session ? api.getProfile(session.userId) : null;
    },

    async getProfile(id) {
      const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
      fail(error);
      return data ? toProfile(data) : null;
    },

    async saveMyProfile(patch: ProfilePatch) {
      const s = me();
      const row: Row = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
      if (patch.city !== undefined) row.city = patch.city;
      if (patch.occupation !== undefined) row.occupation = patch.occupation;
      if (patch.stage !== undefined) row.stage = patch.stage;
      if (patch.bio !== undefined) row.bio = patch.bio;
      if (patch.intent !== undefined) row.intent = patch.intent;
      if (patch.budgetMin !== undefined) row.budget_min = patch.budgetMin;
      if (patch.budgetMax !== undefined) row.budget_max = patch.budgetMax;
      if (patch.moveInBy !== undefined) row.move_in_by = patch.moveInBy;
      if (patch.preferredLocalities !== undefined) row.preferred_localities = patch.preferredLocalities;
      if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
      const { data, error } = await sb.from("profiles").update(row).eq("id", s.userId).select("*").single();
      fail(error);
      notify();
      return toProfile(data);
    },

    async listPeople() {
      let query = sb.from("profiles").select("*").eq("onboarded", true).eq("is_admin", false).in("intent", ["seeking", "both"]).limit(200);
      if (session) query = query.neq("id", session.userId);
      const { data, error } = await query;
      fail(error);
      const blocked = new Set(await api.listBlocked());
      return (data ?? []).map(toProfile).filter((p) => !blocked.has(p.id));
    },

    async getLifestyle(userId) {
      if (!session) return null;
      const { data, error } = await sb.from("lifestyle_preferences").select("*").eq("user_id", userId).maybeSingle();
      fail(error);
      return data ? toLifestyle(data) : null;
    },

    async getLifestyles(userIds) {
      if (!session || userIds.length === 0) return {};
      const { data, error } = await sb.from("lifestyle_preferences").select("*").in("user_id", userIds);
      fail(error);
      return Object.fromEntries((data ?? []).map((r) => [r.user_id as ID, toLifestyle(r)]));
    },

    async saveMyLifestyle(answers) {
      const s = me();
      const row: Row = { user_id: s.userId, importance: {}, skipped: [] };
      for (const q of QUESTIONS) {
        const a = answers[q.id];
        row[q.id] = a?.value ?? null;
        if (a) {
          row.importance[q.id] = a.importance;
          if (a.value === null) row.skipped.push(q.id);
        }
      }
      const { error } = await sb.from("lifestyle_preferences").upsert(row);
      fail(error);
      notify();
    },

    /* ── homes ── */
    async listListings() {
      const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * DAY).toISOString();
      const { data, error } = await sb
        .from("listings")
        .select(LISTING_SELECT)
        .eq("status", "active")
        .gt("last_confirmed_at", cutoff)
        .order("last_confirmed_at", { ascending: false })
        .limit(300);
      fail(error);
      const blocked = new Set(await api.listBlocked());
      return (data ?? []).map(toListing).filter((l) => !blocked.has(l.listerId));
    },

    getListing: fetchListing,

    async myListings() {
      const s = me();
      const { data, error } = await sb.from("listings").select(LISTING_SELECT).eq("lister_id", s.userId).order("updated_at", { ascending: false });
      fail(error);
      return (data ?? []).map(toListing);
    },

    async getListingAddress(id) {
      me();
      const { data, error } = await sb.from("listings").select("property_id").eq("id", id).maybeSingle();
      fail(error);
      if (!data) return null;
      const res = await sb.from("property_addresses").select("address").eq("property_id", data.property_id).maybeSingle();
      fail(res.error);
      return res.data?.address ?? null;
    },

    async saveListing(draft: ListingDraft, publish: boolean) {
      const s = me();
      if (publish) {
        const parsed = listingSchema.safeParse(draft);
        if (!parsed.success) throw new AppError("invalid", parsed.error.issues[0]?.message ?? "Some details are missing.");
      }
      const loc = LOCALITIES.find((l) => l.name === draft.locality);
      const propertyRow: Row = {
        owner_id: s.userId,
        city: draft.city,
        locality: draft.locality,
        property_type: draft.propertyType,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        furnishing: draft.furnishing,
        amenities: draft.amenities,
        house_rules: draft.houseRules,
        description: draft.description,
      };
      const listingRow: Row = {
        lister_id: s.userId,
        title: draft.title,
        room_type: draft.roomType,
        rent: draft.rent,
        deposit: draft.deposit,
        brokerage: draft.brokerage,
        available_from: draft.availableFrom || null,
        occupant_count: draft.occupantCount,
        occupant_summary: draft.occupantSummary,
        lister_lives_here: draft.listerLivesHere,
      };

      let listingId = draft.id;
      let propertyId: string;
      if (listingId) {
        const current = await sb.from("listings").select("property_id, property:properties(locality)").eq("id", listingId).single();
        fail(current.error);
        propertyId = current.data.property_id;
        const previousLocality = (current.data.property as unknown as Row | null)?.locality;
        if (loc && previousLocality !== draft.locality) {
          propertyRow.approx_lat = loc.lat + (Math.random() - 0.5) * 0.012;
          propertyRow.approx_lng = loc.lng + (Math.random() - 0.5) * 0.012;
        }
        fail((await sb.from("properties").update(propertyRow).eq("id", propertyId)).error);
        fail((await sb.from("listings").update(listingRow).eq("id", listingId)).error);
      } else {
        if (loc) {
          // The public pin is the neighbourhood centre plus a random offset, never the address.
          propertyRow.approx_lat = loc.lat + (Math.random() - 0.5) * 0.012;
          propertyRow.approx_lng = loc.lng + (Math.random() - 0.5) * 0.012;
        }
        const property = await sb.from("properties").insert(propertyRow).select("id").single();
        fail(property.error);
        propertyId = property.data.id;
        const created = await sb.from("listings").insert({ ...listingRow, property_id: propertyId }).select("id").single();
        fail(created.error);
        listingId = created.data.id as string;
      }

      fail((await sb.from("property_addresses").upsert({ property_id: propertyId, address: draft.address })).error);

      fail((await sb.from("listing_photos").delete().eq("listing_id", listingId)).error);
      if (draft.photos.length) {
        const rows = draft.photos.map((p, position) => ({
          listing_id: listingId,
          url: p.url,
          alt: p.alt,
          position,
          // Uploaded files are named by their SHA-256, so the hash can be read back from the URL.
          content_hash: p.url.match(/\/([0-9a-f]{64})\.[a-z0-9]+$/)?.[1] ?? "",
        }));
        fail((await sb.from("listing_photos").insert(rows)).error);
      }

      let heldReason: string | null = null;
      if (publish) {
        const { data, error } = await sb.rpc("publish_listing", { p_listing: listingId });
        fail(error);
        heldReason = (data as Row | null)?.status === "under_review" ? ((data as Row).review_reason as string) : null;
      }
      const listing = await fetchListing(listingId!);
      if (!listing) throw new AppError("not_found", "The listing was saved but couldn't be read back.");
      notify();
      return { listing, heldReason };
    },

    async setListingStatus(id, status) {
      me();
      if (status === "active") {
        // Going live again re-runs the completeness and duplicate checks.
        const { error } = await sb.rpc("publish_listing", { p_listing: id });
        fail(error);
      } else {
        const { error } = await sb.from("listings").update({ status }).eq("id", id);
        fail(error);
      }
      const listing = await fetchListing(id);
      if (!listing) throw new AppError("not_found", "That listing doesn't exist.");
      notify();
      return listing;
    },

    async confirmAvailable(id) {
      me();
      const { error } = await sb.rpc("confirm_listing_available", { p_listing: id });
      fail(error);
      const listing = await fetchListing(id);
      if (!listing) throw new AppError("not_found", "That listing doesn't exist.");
      notify();
      return listing;
    },

    async deleteListing(id) {
      me();
      const { data, error } = await sb.from("listings").select("property_id").eq("id", id).single();
      fail(error);
      // Deleting the property cascades to the listing, its photos rows and the private address.
      fail((await sb.from("properties").delete().eq("id", data.property_id)).error);
      notify();
    },

    async uploadPhoto(file) {
      const s = me();
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new AppError("invalid", `${file.name} needs to be a JPEG, PNG or WebP image.`);
      if (file.size > 10 * 1024 * 1024) throw new AppError("invalid", `${file.name} is over 10 MB. Try a smaller photo.`);
      const hash = await sha256(file);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${s.userId}/${hash}.${ext}`;
      const { error } = await sb.storage.from("listing-photos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new AppError("unavailable", `Couldn't upload ${file.name}: ${error.message}`);
      return sb.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
    },

    /* ── saved ── */
    async getSavedIds() {
      if (!session) return [];
      const { data, error } = await sb.from("saved_listings").select("listing_id").eq("user_id", session.userId).order("created_at", { ascending: false });
      fail(error);
      return (data ?? []).map((r) => r.listing_id as ID);
    },

    async toggleSaved(listingId) {
      const s = me();
      const existing = await sb.from("saved_listings").select("listing_id").eq("user_id", s.userId).eq("listing_id", listingId).maybeSingle();
      fail(existing.error);
      if (existing.data) {
        fail((await sb.from("saved_listings").delete().eq("user_id", s.userId).eq("listing_id", listingId)).error);
      } else {
        fail((await sb.from("saved_listings").insert({ user_id: s.userId, listing_id: listingId })).error);
      }
      notify();
      return !existing.data;
    },

    /* ── conversations ── */
    async listConversations() {
      const s = me();
      const { data, error } = await sb
        .from("conversations")
        .select("*, listing:listings(id, title, status, property:properties(locality)), members:conversation_members(user_id, last_read_at), consents:contact_sharing_consents(user_id)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      fail(error);
      const rows = (data ?? []).filter((c) => !(c.status === "declined" && c.recipient_id === s.userId));
      if (rows.length === 0) return [];

      const otherIds = rows.map((c) => (c.requester_id === s.userId ? c.recipient_id : c.requester_id) as ID);
      const [people, myBlocks, recent] = await Promise.all([
        sb.from("profiles").select("*").in("id", otherIds),
        sb.from("user_blocks").select("blocked_id").eq("blocker_id", s.userId),
        sb.from("messages").select("*").in("conversation_id", rows.map((c) => c.id)).order("created_at", { ascending: false }).limit(500),
      ]);
      fail(people.error);
      fail(myBlocks.error);
      fail(recent.error);
      const profileById = new Map((people.data ?? []).map((p) => [p.id as ID, toProfile(p)]));
      const blockedByMe = new Set((myBlocks.data ?? []).map((b) => b.blocked_id as ID));
      const messages = (recent.data ?? []).map(toMessage);

      const views: ConversationView[] = [];
      for (const c of rows) {
        const otherId = (c.requester_id === s.userId ? c.recipient_id : c.requester_id) as ID;
        const other = profileById.get(otherId);
        if (!other) continue;
        const thread = messages.filter((m) => m.conversationId === c.id);
        const lastRead = (c.members as Row[]).find((m) => m.user_id === s.userId)?.last_read_at ?? "";
        const consents = (c.consents as Row[]).map((x) => x.user_id as ID);
        const iConsented = consents.includes(s.userId);
        const theyConsented = consents.includes(otherId);
        let shared = null;
        if (iConsented && theyConsented) {
          // The database only returns this when both consents exist and nobody is blocked.
          const res = await sb.rpc("shared_contact", { p_conversation: c.id });
          shared = res.error || !res.data?.[0] ? null : { email: res.data[0].email as string, phone: (res.data[0].phone as string | null) ?? null };
        }
        const listing = c.listing as Row | null;
        views.push({
          conversation: toConversation(c),
          other,
          listing: listing ? { id: listing.id, title: listing.title, locality: listing.property?.locality ?? "", status: listing.status } : null,
          lastMessage: thread[0] ?? null,
          unread: blockedByMe.has(otherId) ? 0 : thread.filter((m) => m.senderId !== s.userId && new Date(m.createdAt) > new Date(lastRead)).length,
          // We can only see blocks we made. If the other person blocked us, sending fails with a clear message.
          blocked: blockedByMe.has(otherId),
          blockedByMe: blockedByMe.has(otherId),
          contact: { iConsented, theyConsented, shared },
        });
      }
      return views;
    },

    async getMessages(conversationId) {
      me();
      const { data, error } = await sb.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(1000);
      fail(error);
      return (data ?? []).map(toMessage);
    },

    async startConversation({ toUserId, listingId, body }) {
      me();
      const text = messageSchema.parse(body);
      const { data, error } = await sb.rpc("start_conversation", { p_to: toUserId, p_listing: listingId, p_body: text });
      fail(error);
      notify();
      return toConversation(data as Row);
    },

    async respondToRequest(conversationId, accept) {
      me();
      const { error } = await sb.rpc("respond_to_request", { p_conversation: conversationId, p_accept: accept });
      fail(error);
      notify();
    },

    async sendMessage(conversationId, body) {
      const s = me();
      const text = messageSchema.parse(body);
      const { data, error } = await sb.from("messages").insert({ conversation_id: conversationId, sender_id: s.userId, body: text }).select("*").single();
      if (error?.code === "42501") throw new AppError("forbidden", "You can't send messages in this conversation.");
      fail(error);
      notify();
      return toMessage(data);
    },

    async markRead(conversationId) {
      if (!session) return;
      const { error } = await sb.rpc("mark_read", { p_conversation: conversationId });
      fail(error);
      notify();
    },

    sendTyping(conversationId) {
      if (!session) return;
      void typingChannel(conversationId).send({ type: "broadcast", event: "typing", payload: { userId: session.userId } });
    },

    onTyping(conversationId, listener) {
      typingChannel(conversationId);
      if (!typingListeners.has(conversationId)) typingListeners.set(conversationId, new Set());
      typingListeners.get(conversationId)!.add(listener);
      return () => typingListeners.get(conversationId)?.delete(listener);
    },

    async setContactConsent(conversationId, consent) {
      const s = me();
      const { error } = consent
        ? await sb.from("contact_sharing_consents").upsert({ conversation_id: conversationId, user_id: s.userId })
        : await sb.from("contact_sharing_consents").delete().eq("conversation_id", conversationId).eq("user_id", s.userId);
      fail(error);
      notify();
    },

    /* ── safety ── */
    async blockUser(userId) {
      me();
      const { error } = await sb.rpc("block_user", { p_user: userId });
      fail(error);
      notify();
    },

    async unblockUser(userId) {
      const s = me();
      fail((await sb.from("user_blocks").delete().eq("blocker_id", s.userId).eq("blocked_id", userId)).error);
      notify();
    },

    async listBlocked() {
      if (!session) return [];
      const { data, error } = await sb.from("user_blocks").select("blocked_id").eq("blocker_id", session.userId);
      fail(error);
      return (data ?? []).map((r) => r.blocked_id as ID);
    },

    async report({ targetType, targetId, reason, details }) {
      const s = me();
      const parsed = reportSchema.parse({ reason, details });
      const { error } = await sb.from("reports").insert({ reporter_id: s.userId, target_type: targetType, target_id: targetId, reason: parsed.reason, details: parsed.details });
      if (error?.code === "23505") throw new AppError("conflict", "You've already reported this. A moderator will look at it.");
      fail(error);
      notify();
    },

    /* ── moderation ── */
    async adminQueue(): Promise<AdminQueue> {
      me();
      const [reportsRes, heldRes, activeRes, actionsRes] = await Promise.all([
        sb.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }),
        sb.from("listings").select(LISTING_SELECT).eq("status", "under_review"),
        sb.from("listings").select(LISTING_SELECT).eq("status", "active").limit(500),
        sb.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      fail(reportsRes.error);
      fail(heldRes.error);
      fail(activeRes.error);
      fail(actionsRes.error);
      const open = (reportsRes.data ?? []).map(toReport);
      const candidates = [...(heldRes.data ?? []), ...(activeRes.data ?? [])].map(toListing);
      const listers = await sb.from("profiles").select("*").in("id", [...new Set(candidates.map((l) => l.listerId))]);
      fail(listers.error);
      const listerById = new Map((listers.data ?? []).map((p) => [p.id as ID, toProfile(p)]));

      const listings: ReviewItem[] = [];
      for (const l of candidates) {
        const reasons: string[] = [];
        const openReports = open.filter((r) => r.targetType === "listing" && r.targetId === l.id);
        if (l.status === "under_review" && l.reviewReason) reasons.push(l.reviewReason);
        if (openReports.length) reasons.push(`${openReports.length} open report${openReports.length === 1 ? "" : "s"}`);
        if (l.status === "active" && freshness(l) === "stale") reasons.push("Not reconfirmed by the lister. Hidden from search");
        const floor = LOCALITIES.find((x) => x.name === l.locality)?.typicalRoom[0] ?? 0;
        if (l.status === "active" && l.roomType !== "shared" && l.rent < floor * 0.6) reasons.push("Rent is far below the usual range for this area");
        if (reasons.length) listings.push({ listing: l, lister: listerById.get(l.listerId) ?? null, reasons, openReports });
      }
      const weight = (i: ReviewItem) => (i.listing.status === "under_review" ? 100 : 0) + i.openReports.length * 10;
      listings.sort((a, b) => weight(b) - weight(a));

      const others = open.filter((r) => r.targetType !== "listing");
      const userIds = others.filter((r) => r.targetType === "user").map((r) => r.targetId);
      const names = userIds.length ? await sb.from("profiles").select("id, display_name").in("id", userIds) : { data: [], error: null };
      fail(names.error);
      const nameById = new Map((names.data ?? []).map((p) => [p.id as ID, p.display_name as string]));

      return {
        listings,
        otherReports: others.map((r) => ({ ...r, subject: r.targetType === "user" ? (nameById.get(r.targetId) ?? "Unknown person") : "A conversation" })),
        actions: (actionsRes.data ?? []).map(
          (a): ModerationAction => ({ id: a.id, adminId: a.admin_id, targetType: a.target_type, targetId: a.target_id, action: a.action, note: a.note, createdAt: a.created_at }),
        ),
      };
    },

    async adminResolveListing(listingId, decision, note) {
      me();
      const { error } = await sb.rpc("admin_resolve_listing", { p_listing: listingId, p_decision: decision, p_note: note });
      fail(error);
      notify();
    },

    async adminResolveReport(reportId, status, note) {
      me();
      const { error } = await sb.rpc("admin_resolve_report", { p_report: reportId, p_status: status, p_note: note });
      fail(error);
      notify();
    },
  };

  return api;
}
