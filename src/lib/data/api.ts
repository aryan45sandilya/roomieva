import type {
  Conversation,
  ConversationView,
  ID,
  LifestyleAnswers,
  Listing,
  ListingDraft,
  Message,
  ModerationAction,
  Profile,
  Report,
  ReportTarget,
  ReviewItem,
  Session,
} from "../types";

export type ErrorCode = "auth" | "forbidden" | "not_found" | "invalid" | "conflict" | "offline" | "unavailable";

/** Every failure the UI needs to explain carries a code and a sentence a person can act on. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const zodIssue = (e: unknown): string | null => {
  const issues = (e as { issues?: { message?: string }[] } | null)?.issues;
  return Array.isArray(issues) && issues[0]?.message ? issues[0].message : null;
};

export const errorMessage = (e: unknown): string =>
  e instanceof AppError
    ? e.message
    : zodIssue(e)
      ? (zodIssue(e) as string)
      : typeof navigator !== "undefined" && !navigator.onLine
      ? "You're offline. Check your connection and try again."
      : e instanceof Error && e.message
        ? e.message
        : "Something went wrong. Please try again.";

export interface OtpRequest {
  /** `demo` means no email left this device; the code is handed back for display. */
  delivery: "email" | "demo";
  demoCode?: string;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "displayName"
    | "avatarUrl"
    | "city"
    | "occupation"
    | "stage"
    | "bio"
    | "intent"
    | "budgetMin"
    | "budgetMax"
    | "moveInBy"
    | "preferredLocalities"
    | "onboarded"
  >
>;

export interface AdminQueue {
  listings: ReviewItem[];
  otherReports: (Report & { subject: string })[];
  actions: ModerationAction[];
}

export interface DataApi {
  readonly mode: "demo" | "supabase";
  /** Called whenever data this client can see may have changed. */
  subscribe(listener: () => void): () => void;

  /* auth */
  getSession(): Promise<Session | null>;
  requestOtp(email: string): Promise<OtpRequest>;
  verifyOtp(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Demo mode only: sample accounts that can be tried without signing up. */
  listPersonas(): Promise<Profile[]>;
  actAs(userId: ID): Promise<void>;

  /* people */
  getMyProfile(): Promise<Profile | null>;
  getProfile(id: ID): Promise<Profile | null>;
  saveMyProfile(patch: ProfilePatch): Promise<Profile>;
  listPeople(): Promise<Profile[]>;
  getLifestyle(userId: ID): Promise<LifestyleAnswers | null>;
  getLifestyles(userIds: ID[]): Promise<Record<ID, LifestyleAnswers>>;
  saveMyLifestyle(answers: LifestyleAnswers): Promise<void>;

  /* homes */
  listListings(): Promise<Listing[]>;
  getListing(id: ID): Promise<Listing | null>;
  myListings(): Promise<Listing[]>;
  /** The private address. Only the lister can read it. */
  getListingAddress(id: ID): Promise<string | null>;
  saveListing(draft: ListingDraft, publish: boolean): Promise<{ listing: Listing; heldReason: string | null }>;
  setListingStatus(id: ID, status: "active" | "paused" | "occupied"): Promise<Listing>;
  confirmAvailable(id: ID): Promise<Listing>;
  deleteListing(id: ID): Promise<void>;
  uploadPhoto(file: File): Promise<string>;

  /* saved */
  getSavedIds(): Promise<ID[]>;
  toggleSaved(listingId: ID): Promise<boolean>;

  /* conversations */
  listConversations(): Promise<ConversationView[]>;
  getMessages(conversationId: ID): Promise<Message[]>;
  startConversation(input: { toUserId: ID; listingId: ID | null; body: string }): Promise<Conversation>;
  respondToRequest(conversationId: ID, accept: boolean): Promise<void>;
  sendMessage(conversationId: ID, body: string): Promise<Message>;
  markRead(conversationId: ID): Promise<void>;
  sendTyping(conversationId: ID): void;
  onTyping(conversationId: ID, listener: (userId: ID) => void): () => void;
  setContactConsent(conversationId: ID, consent: boolean): Promise<void>;

  /* safety */
  blockUser(userId: ID): Promise<void>;
  unblockUser(userId: ID): Promise<void>;
  listBlocked(): Promise<ID[]>;
  report(input: { targetType: ReportTarget; targetId: ID; reason: string; details: string }): Promise<void>;

  /* moderation */
  adminQueue(): Promise<AdminQueue>;
  adminResolveListing(listingId: ID, decision: "approve" | "mark_reviewed" | "remove", note: string): Promise<void>;
  adminResolveReport(reportId: ID, status: "actioned" | "dismissed", note: string): Promise<void>;
}

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let instance: Promise<DataApi> | null = null;

/** Browser-only. Picks Supabase when it is configured, otherwise the on-device demo store. */
export function getApi(): Promise<DataApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new AppError("unavailable", "Data is only available in the browser."));
  }
  if (!instance) {
    instance = supabaseConfigured()
      ? import("./supabase").then((m) => m.createSupabaseApi())
      : import("./local").then((m) => m.createLocalApi());
  }
  return instance;
}
