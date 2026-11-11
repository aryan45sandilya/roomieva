import type { Furnishing, PropertyType, RoomType } from "./types";

export const CITY = "Bengaluru";
/** The schema supports any city; the MVP opens with one. */
export const CITIES = [CITY] as const;

export interface Locality {
  name: string;
  lat: number;
  lng: number;
  /** One honest line about what living here is like. */
  note: string;
  typicalRoom: [number, number];
}

export const LOCALITIES: Locality[] = [
  { name: "Koramangala", lat: 12.9352, lng: 77.6245, note: "Startups, cafés on every block, and traffic to match.", typicalRoom: [16000, 30000] },
  { name: "HSR Layout", lat: 12.9116, lng: 77.6474, note: "Planned sectors, parks, and a lot of first jobs.", typicalRoom: [14000, 26000] },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408, note: "Leafy lanes, the metro, and 100 Feet Road at night.", typicalRoom: [18000, 34000] },
  { name: "Bellandur", lat: 12.9304, lng: 77.6784, note: "Big gated societies along the Outer Ring Road.", typicalRoom: [13000, 24000] },
  { name: "Whitefield", lat: 12.9698, lng: 77.75, note: "Tech parks, the Purple Line, and space to breathe.", typicalRoom: [12000, 22000] },
  { name: "Marathahalli", lat: 12.9591, lng: 77.6974, note: "Practical, well connected, kinder on rent.", typicalRoom: [10000, 18000] },
  { name: "Electronic City", lat: 12.8452, lng: 77.6602, note: "Campus-side living, far from the centre, easy on the wallet.", typicalRoom: [8000, 15000] },
  { name: "JP Nagar", lat: 12.9063, lng: 77.5857, note: "Old Bengaluru calm with a new metro line.", typicalRoom: [11000, 20000] },
];

export const localityByName = (name: string) => LOCALITIES.find((l) => l.name === name);

export const AMENITIES = [
  "Wi-Fi",
  "Washing machine",
  "Fridge",
  "AC",
  "Geyser",
  "Power backup",
  "Balcony",
  "Attached bathroom",
  "Wardrobe",
  "Work desk",
  "Cook",
  "House help",
  "Two-wheeler parking",
  "Car parking",
  "Lift",
  "Gym",
  "Security",
  "Water purifier",
] as const;

export const HOUSE_RULES = [
  "No smoking indoors",
  "Vegetarian kitchen",
  "Guests welcome with a heads-up",
  "No overnight guests",
  "Quiet after 11 pm",
  "Pets welcome",
  "No pets",
  "Shared cleaning rota",
] as const;

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  private: "Private room",
  shared: "Shared room",
  entire: "Entire flat",
};

export const FURNISHING_LABEL: Record<Furnishing, string> = {
  furnished: "Furnished",
  semi: "Semi-furnished",
  unfurnished: "Unfurnished",
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: "Apartment",
  gated_society: "Gated society",
  independent_house: "Independent house",
  builder_floor: "Builder floor",
};

/** Listings not reconfirmed within this many days drop out of discovery until the lister renews. */
export const STALE_AFTER_DAYS = 21;
/** Listers get a nudge this many days before a listing goes stale. */
export const RENEW_NUDGE_DAYS = 14;

/** Work / university domains accepted for the "institution" level. Illustrative list. */
export const INSTITUTION_DOMAINS = [
  "iisc.ac.in",
  "iimb.ac.in",
  "iiitb.ac.in",
  "christuniversity.in",
  "pes.edu",
  "rvce.edu.in",
  "infosys.com",
  "wipro.com",
  "flipkart.com",
  "swiggy.in",
  "razorpay.com",
];

export const REPORT_REASONS = {
  listing: [
    "Asked for money before a visit",
    "Photos or details look fake",
    "A broker posing as an owner",
    "Already rented out",
    "Duplicate listing",
    "Something else",
  ],
  user: ["Harassment or abuse", "Asked for an advance payment", "Pretending to be someone else", "Spam", "Something else"],
  conversation: ["Harassment or abuse", "Asked for an advance payment", "Pushing me off-platform", "Spam", "Something else"],
} as const;
