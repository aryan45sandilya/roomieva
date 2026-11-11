export type ID = string;

/* ── Lifestyle ─────────────────────────────────────────── */

export type QuestionId =
  | "sleep"
  | "cleanliness"
  | "food"
  | "cooking"
  | "smoking"
  | "drinking"
  | "guests"
  | "noise"
  | "wfh"
  | "social"
  | "expenses"
  | "ac";

export type Importance = "flexible" | "important" | "dealbreaker";

/** `value` is the chosen option index; `null` means the question was skipped. */
export interface Answer {
  value: number | null;
  importance: Importance;
}

export type LifestyleAnswers = Partial<Record<QuestionId, Answer>>;

/* ── People ────────────────────────────────────────────── */

export type Intent = "seeking" | "listing" | "both";
export type Stage = "professional" | "student" | "intern";

/**
 * Verification levels are distinct facts. None of them implies another, and
 * none of them is proof of identity.
 */
export interface Verification {
  /** The person proved they can read mail at their sign-in address. */
  email: boolean;
  /** The person proved they hold a phone number via OTP. */
  phone: boolean;
  /** Sign-in email is on a recognised university / employer domain. */
  institution: boolean;
}

export interface Profile {
  id: ID;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  occupation: string;
  stage: Stage;
  bio: string;
  intent: Intent;
  budgetMin: number;
  budgetMax: number;
  moveInBy: string | null;
  preferredLocalities: string[];
  verification: Verification;
  isAdmin: boolean;
  /** Seeded sample profile. Never a real, verified person. */
  isDemo: boolean;
  onboarded: boolean;
  createdAt: string;
}

export interface PrivateContact {
  email: string;
  phone: string | null;
}

export interface Session {
  userId: ID;
  email: string;
}

/* ── Homes ─────────────────────────────────────────────── */

export type RoomType = "private" | "shared" | "entire";
export type Furnishing = "furnished" | "semi" | "unfurnished";
export type PropertyType = "apartment" | "gated_society" | "independent_house" | "builder_floor";

/**
 * draft        not yet published
 * active       discoverable
 * paused       hidden by the lister
 * occupied     room has been filled
 * under_review held for a moderator (duplicate / reports)
 * removed      taken down by a moderator
 */
export type ListingStatus = "draft" | "active" | "paused" | "occupied" | "under_review" | "removed";

/**
 * none              nothing checked
 * reviewed          a moderator read the listing details. Not proof of ownership.
 * property_verified a supporting verification process was completed.
 */
export type ListingVerification = "none" | "reviewed" | "property_verified";

export interface ListingPhoto {
  url: string;
  alt: string;
}

export interface Listing {
  id: ID;
  listerId: ID;
  title: string;
  city: string;
  locality: string;
  /** Deliberately imprecise. The exact address is stored separately and never served publicly. */
  approxLat: number;
  approxLng: number;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  amenities: string[];
  description: string;
  roomType: RoomType;
  rent: number;
  deposit: number;
  /** 0 means broker-free. */
  brokerage: number;
  availableFrom: string;
  houseRules: string[];
  occupantCount: number;
  occupantSummary: string;
  listerLivesHere: boolean;
  photos: ListingPhoto[];
  status: ListingStatus;
  reviewReason: string | null;
  verification: ListingVerification;
  publishedAt: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

/** Fields a lister edits. `address` is private. */
export interface ListingDraft {
  id?: ID;
  title: string;
  city: string;
  locality: string;
  address: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  amenities: string[];
  description: string;
  roomType: RoomType;
  rent: number;
  deposit: number;
  brokerage: number;
  availableFrom: string;
  houseRules: string[];
  occupantCount: number;
  occupantSummary: string;
  listerLivesHere: boolean;
  photos: ListingPhoto[];
}

/* ── Conversations ─────────────────────────────────────── */

export type ConversationStatus = "pending" | "accepted" | "declined";

export interface Conversation {
  id: ID;
  listingId: ID | null;
  requesterId: ID;
  recipientId: ID;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
}

export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  body: string;
  createdAt: string;
}

export interface ConversationView {
  conversation: Conversation;
  other: Profile;
  listing: Pick<Listing, "id" | "title" | "locality" | "status"> | null;
  lastMessage: Message | null;
  unread: number;
  /** Either side has blocked the other. */
  blocked: boolean;
  blockedByMe: boolean;
  contact: {
    iConsented: boolean;
    theyConsented: boolean;
    /** Present only when both people have consented. */
    shared: PrivateContact | null;
  };
}

/* ── Safety ────────────────────────────────────────────── */

export type ReportTarget = "listing" | "user" | "conversation";
export type ReportStatus = "open" | "actioned" | "dismissed";

export interface Report {
  id: ID;
  reporterId: ID;
  targetType: ReportTarget;
  targetId: ID;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ModerationAction {
  id: ID;
  adminId: ID;
  targetType: ReportTarget;
  targetId: ID;
  action: string;
  note: string;
  createdAt: string;
}

export interface ReviewItem {
  listing: Listing;
  lister: Profile | null;
  reasons: string[];
  openReports: Report[];
}
