import { z } from "zod";
import { INSTITUTION_DOMAINS, LOCALITIES } from "./constants";

const localityNames = LOCALITIES.map((l) => l.name);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "That doesn't look like an email address");

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const profileSchema = z
  .object({
    displayName: z.string().trim().min(2, "Tell us what to call you").max(40, "Keep it under 40 characters"),
    occupation: z.string().trim().min(2, "What do you do?").max(60, "Keep it under 60 characters"),
    stage: z.enum(["professional", "student", "intern"]),
    bio: z.string().trim().max(400, "Keep it under 400 characters"),
    intent: z.enum(["seeking", "listing", "both"]),
    budgetMin: z.number().int().min(3000, "Minimum budget is ₹3,000").max(200000),
    budgetMax: z.number().int().min(3000).max(200000, "That's above what we list"),
    moveInBy: z.string().nullable(),
    preferredLocalities: z.array(z.string()).max(5, "Pick up to 5 neighbourhoods"),
  })
  .refine((v) => v.budgetMax >= v.budgetMin, {
    path: ["budgetMax"],
    message: "Maximum should be at least the minimum",
  });

export type ProfileInput = z.infer<typeof profileSchema>;

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const listingSchema = z
  .object({
    title: z.string().trim().min(12, "Give it a title of at least 12 characters").max(80, "Keep the title under 80 characters"),
    city: z.string().min(1),
    locality: z.string().refine((v) => localityNames.includes(v), "Choose a locality"),
    address: z.string().trim().min(8, "Add the full address. Only you and moderators see it").max(240),
    propertyType: z.enum(["apartment", "gated_society", "independent_house", "builder_floor"]),
    bedrooms: z.number().int().min(1, "At least 1 bedroom").max(8),
    bathrooms: z.number().int().min(1, "At least 1 bathroom").max(8),
    furnishing: z.enum(["furnished", "semi", "unfurnished"]),
    amenities: z.array(z.string()),
    description: z.string().trim().min(60, "Describe the home in at least 60 characters").max(1500, "Keep it under 1,500 characters"),
    roomType: z.enum(["private", "shared", "entire"]),
    rent: z.number().int().min(3000, "Rent should be at least ₹3,000").max(300000, "That's above what we list"),
    deposit: z.number().int().min(0, "Deposit can't be negative").max(3000000),
    brokerage: z.number().int().min(0).max(300000),
    availableFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
      .refine((v) => new Date(`${v}T00:00:00`) >= new Date(today().getTime() - 86_400_000), "Pick today or a later date"),
    houseRules: z.array(z.string()),
    occupantCount: z.number().int().min(0).max(12),
    occupantSummary: z.string().trim().max(300),
    listerLivesHere: z.boolean(),
    photos: z
      .array(z.object({ url: z.string().min(1), alt: z.string() }))
      .min(3, "Add at least 3 photos of the actual home")
      .max(8, "Up to 8 photos"),
  })
  .refine((v) => v.deposit <= v.rent * 12, {
    path: ["deposit"],
    message: "A deposit over 12 months' rent looks like a mistake",
  })
  .refine((v) => v.roomType === "entire" || v.occupantSummary.trim().length >= 10, {
    path: ["occupantSummary"],
    message: "Say a little about who lives there now",
  });

export type ListingInput = z.infer<typeof listingSchema>;

/** Fields validated at each wizard step, in order. */
export const LISTING_STEP_FIELDS: (keyof ListingInput)[][] = [
  ["locality", "address"],
  ["propertyType", "roomType", "bedrooms", "bathrooms", "furnishing", "title", "description"],
  ["rent", "deposit", "brokerage"],
  ["availableFrom"],
  ["amenities", "houseRules"],
  ["photos"],
  ["occupantCount", "occupantSummary", "listerLivesHere"],
  [],
];

export const messageSchema = z
  .string()
  .trim()
  .min(1, "Write a message first")
  .max(2000, "Keep messages under 2,000 characters");

export const reportSchema = z.object({
  reason: z.string().min(1, "Choose a reason"),
  details: z.string().trim().max(1000, "Keep it under 1,000 characters"),
});

/** First error message per field path, for forms that don't use react-hook-form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const isInstitutionEmail = (email: string) => {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return INSTITUTION_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
};

/** Phone numbers, emails and payment handles people paste to move a chat off-platform. */
export function containsContactDetails(text: string) {
  return /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/.test(text) || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text);
}
