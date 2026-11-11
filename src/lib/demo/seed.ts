/**
 * Demo data for Bengaluru.
 *
 * Everything here is SAMPLE data: invented people, invented homes, and stock
 * interior photography from Unsplash. It exists so the product can be explored
 * without an account, and it is labelled as sample wherever it is shown.
 * No seeded profile is a real, verified person and no photo is evidence that a
 * property exists.
 */
import { LOCALITIES } from "../constants";
import { DAY, isoDate } from "../format";
import { QUESTIONS } from "../lifestyle";
import type {
  Conversation,
  Importance,
  LifestyleAnswers,
  Listing,
  ListingVerification,
  Message,
  PrivateContact,
  Profile,
  Report,
} from "../types";

export const DEMO_ADMIN_ID = "demo-u-00";

const PHOTO_IDS = [
  "1522708323590-d24dbb6b0267",
  "1502672260266-1c1ef2d93688",
  "1560448204-e02f11c3d0e2",
  "1493809842364-78817add7ffb",
  "1505691938895-1758d7feb511",
  "1484154218962-a197022b5858",
  "1536376072261-38c75010e6c9",
  "1560185893-a55cbc8c57e8",
  "1554995207-c18c203602cb",
  "1540518614846-7eded433c457",
  "1505693416388-ac5ce068fe85",
  "1522771739844-6a9f6d5f14af",
  "1556909114-f6e7ad7d3136",
  "1513694203232-719a280e022f",
  "1598928506311-c55ded91a20c",
  "1616594039964-ae9021a400a0",
  "1560448075-bb485b067938",
  "1600585154340-be6161a56a0c",
  "1600596542815-ffad4c1539a9",
  "1600607687939-ce8a6c25118c",
  "1600566753190-17f0baa2a6c3",
  "1583847268964-b28dc8f51f92",
  "1618221195710-dd6b41faaea6",
  "1615874959474-d609969a20ed",
  "1567767292278-a4f21aa2d36e",
  "1630699144867-37acec97df5a",
  "1560185127-6ed189bf02f4",
  "1502005229762-cf1b2da7c5d6",
  "1556912173-3bb406ef7e77",
  "1595526114035-0d45ed16cfbf",
  "1617806118233-18e1de247200",
  "1600210492486-724fe5c67fb0",
  "1600121848594-d8644e57abab",
  "1564078516393-cf04bd966897",
  "1524758631624-e2822e304c36",
];

/** Unsplash source URL without sizing; the Photo component adds width/quality. */
export const photoUrl = (index: number) => `https://images.unsplash.com/photo-${PHOTO_IDS[index % PHOTO_IDS.length]}`;

/**
 * Answers are written as 12 characters in question order
 * (sleep, cleanliness, food, cooking, smoking, drinking, guests, social, wfh, noise, expenses, ac):
 * a digit is the option index, "-" is a skip. Importance uses f / i / d.
 */
function answers(values: string, importance: string): LifestyleAnswers {
  const map: Record<string, Importance> = { f: "flexible", i: "important", d: "dealbreaker" };
  const out: LifestyleAnswers = {};
  QUESTIONS.forEach((q, i) => {
    const v = values[i];
    out[q.id] = { value: v === "-" ? null : Number(v), importance: map[importance[i]] ?? "flexible" };
  });
  return out;
}

interface PersonSeed {
  n: number;
  name: string;
  occupation: string;
  stage: Profile["stage"];
  intent: Profile["intent"];
  bio: string;
  budget: [number, number];
  moveIn: number | null;
  areas: string[];
  verify: [boolean, boolean, boolean];
  values: string;
  importance: string;
}

const PEOPLE: PersonSeed[] = [
  { n: 1, name: "Ananya R.", occupation: "Product designer at a fintech", stage: "professional", intent: "both", bio: "Moved from Pune two years ago. I cook on Sundays, run on weekdays, and keep the living room the way I'd want to find it. Looking for someone easy to share a home with.", budget: [18000, 26000], moveIn: 20, areas: ["Koramangala", "HSR Layout"], verify: [true, true, true], values: "121100111111", importance: "iiifdiifiiff" },
  { n: 2, name: "Karthik S.", occupation: "Backend engineer", stage: "professional", intent: "seeking", bio: "From Coimbatore. Hybrid work, so I'm home three days a week and need decent Wi-Fi and a door that closes. I make very good filter coffee.", budget: [15000, 22000], moveIn: 14, areas: ["HSR Layout", "Bellandur", "Koramangala"], verify: [true, true, false], values: "111100111011", importance: "iifffiififif" },
  { n: 3, name: "Meera N.", occupation: "Data analyst", stage: "professional", intent: "both", bio: "Early riser, yoga at six, in bed by half ten. Vegetarian household, quiet evenings. Happy to share groceries and a weekly cleaning rota.", budget: [14000, 20000], moveIn: 30, areas: ["JP Nagar", "HSR Layout"], verify: [true, false, true], values: "020200010010", importance: "iidfddifiiif" },
  { n: 4, name: "Rohan D.", occupation: "Growth marketer at a D2C startup", stage: "professional", intent: "seeking", bio: "Delhi boy, three years in Bengaluru. I host board-game nights, I'm out most Saturdays, and I am not the tidiest person you'll meet. I will always split the bill fairly.", budget: [20000, 30000], moveIn: 10, areas: ["Indiranagar", "Koramangala"], verify: [true, true, false], values: "202012220222", importance: "ffffffiffiff" },
  { n: 5, name: "Ishita G.", occupation: "UX research intern", stage: "intern", intent: "seeking", bio: "Six-month internship starting next month, first time living outside Kolkata. Looking for a safe, friendly flat close to the office. I read a lot and bake when stressed.", budget: [10000, 16000], moveIn: 25, areas: ["Bellandur", "Marathahalli", "HSR Layout"], verify: [true, false, true], values: "112200121111", importance: "iiffdiififff" },
  { n: 6, name: "Arjun M.", occupation: "ML engineer", stage: "professional", intent: "seeking", bio: "Fully remote, so the flat is also my office. I keep odd hours near deadlines and wear headphones. Looking for flatmates who are relaxed about that.", budget: [16000, 24000], moveIn: 45, areas: ["Whitefield", "Marathahalli"], verify: [true, true, true], values: "211001002012", importance: "ffffififiiff" },
  { n: 7, name: "Sneha P.", occupation: "MBA student", stage: "student", intent: "seeking", bio: "Second-year MBA. Classes till six, group work till late. I'm organised, I like a full fridge, and I'd love flatmates who eat dinner together now and then.", budget: [9000, 14000], moveIn: 18, areas: ["JP Nagar", "Electronic City"], verify: [true, false, true], values: "121201121120", importance: "fiffiififfif" },
  { n: 8, name: "Vikram T.", occupation: "Consultant", stage: "professional", intent: "seeking", bio: "On the road Monday to Thursday, home on weekends. I mostly need a calm, clean place to land. Low-maintenance, pay on time, water the plants.", budget: [22000, 32000], moveIn: 7, areas: ["Indiranagar", "Koramangala"], verify: [true, true, false], values: "022011000011", importance: "idffifffifif" },
  { n: 9, name: "Tanvi K.", occupation: "Content strategist", stage: "professional", intent: "seeking", bio: "Writer, night owl, plant person. I work late and sleep late, and I'd rather not live with someone who vacuums at 7 am. Two cats' worth of love to give, zero cats currently.", budget: [15000, 21000], moveIn: 21, areas: ["Indiranagar", "HSR Layout"], verify: [true, false, false], values: "21211-112101", importance: "ifffffffifff" },
  { n: 10, name: "Aditya B.", occupation: "Software engineer, new grad", stage: "professional", intent: "seeking", bio: "Just graduated, joining my first job at a tech park in Whitefield. Easygoing, into football and cooking experiments that mostly work.", budget: [11000, 17000], moveIn: 35, areas: ["Whitefield", "Marathahalli", "Bellandur"], verify: [true, false, true], values: "112211111112", importance: "ffffffffffff" },
  { n: 11, name: "Nikhil J.", occupation: "Finance associate", stage: "professional", intent: "seeking", bio: "Markets open early and so do I. Gym at six, office by eight. I keep my things in order and track shared expenses on a spreadsheet, which people either love or hate.", budget: [17000, 25000], moveIn: 12, areas: ["Koramangala", "HSR Layout", "JP Nagar"], verify: [true, true, true], values: "022101010000", importance: "idffdiifiidi" },
  { n: 12, name: "Pooja V.", occupation: "Architect", stage: "professional", intent: "both", bio: "I notice light, ceilings and bad tile. My flat is calm and a little too full of books. Looking for a flatmate who treats a home like a home.", budget: [20000, 28000], moveIn: 28, areas: ["Indiranagar", "JP Nagar"], verify: [true, true, false], values: "121100111111", importance: "iifffiififff" },
  { n: 13, name: "Rahul C.", occupation: "Engineering manager", stage: "professional", intent: "listing", bio: "I've rented in Bengaluru for nine years and I know what a bad flat-hunt feels like. One room in our Bellandur flat is opening up.", budget: [0, 0], moveIn: null, areas: ["Bellandur"], verify: [true, true, true], values: "111101111111", importance: "fiffiififfff" },
  { n: 14, name: "Divya S.", occupation: "Doctor, junior resident", stage: "professional", intent: "listing", bio: "Hospital shifts mean my hours are unpredictable. I need the flat quiet when I'm sleeping, whenever that is. Otherwise I'm barely home.", budget: [0, 0], moveIn: null, areas: ["Koramangala"], verify: [true, true, false], values: "-22000000011", importance: "fdifdiifidff" },
  { n: 15, name: "Farhan A.", occupation: "Music producer", stage: "professional", intent: "listing", bio: "I work from a treated room at home and friends drop by most weekends. Looking for a flatmate who likes a lively house.", budget: [0, 0], moveIn: null, areas: ["Indiranagar"], verify: [true, false, false], values: "202112222222", importance: "ffffffiffiff" },
  { n: 16, name: "Lakshmi I.", occupation: "Owner, lets out two flats", stage: "professional", intent: "listing", bio: "I own two flats near Electronic City and Marathahalli and let them out directly, without brokers. I don't live in either.", budget: [0, 0], moveIn: null, areas: ["Electronic City", "Marathahalli"], verify: [true, true, false], values: "------------", importance: "ffffffffffff" },
  { n: 17, name: "S. Kumar", occupation: "Not provided", stage: "professional", intent: "listing", bio: "", budget: [0, 0], moveIn: null, areas: [], verify: [false, false, false], values: "------------", importance: "ffffffffffff" },
];

interface HomeSeed {
  n: number;
  lister: number;
  title: string;
  locality: string;
  type: Listing["propertyType"];
  room: Listing["roomType"];
  bed: number;
  bath: number;
  furnishing: Listing["furnishing"];
  rent: number;
  deposit: number;
  brokerage?: number;
  from: number;
  amenities: string[];
  rules: string[];
  occupants: [number, string];
  livesHere: boolean;
  description: string;
  photos: number[];
  status?: Listing["status"];
  verification?: ListingVerification;
  published: number;
  confirmed: number;
  reviewReason?: string;
}

const HOMES: HomeSeed[] = [
  { n: 1, lister: 1, title: "Sunlit room in a 3BHK off 80 Feet Road", locality: "Koramangala", type: "apartment", room: "private", bed: 3, bath: 3, furnishing: "furnished", rent: 24000, deposit: 72000, from: 12, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Balcony", "Attached bathroom", "Wardrobe", "Work desk", "House help", "Power backup"], rules: ["No smoking indoors", "Guests welcome with a heads-up", "Shared cleaning rota"], occupants: [2, "Two of us: a product designer and a lawyer, both late twenties. We cook on weekends and keep weekday evenings quiet."], livesHere: true, description: "East-facing room on the third floor with its own bathroom and a small balcony that gets the morning light. The flat is a five-minute walk from Sony Signal and the 4th Block cafés. Maid comes daily; cook can be arranged if you'd like to split one. We're replacing a flatmate who is moving to Hyderabad.", photos: [0, 9, 5, 3], verification: "reviewed", published: 6, confirmed: 2 },
  { n: 2, lister: 14, title: "Quiet room for an early riser, 5th Block", locality: "Koramangala", type: "builder_floor", room: "private", bed: 2, bath: 2, furnishing: "semi", rent: 19500, deposit: 60000, from: 3, amenities: ["Wi-Fi", "Fridge", "Geyser", "Wardrobe", "Two-wheeler parking", "Water purifier"], rules: ["No smoking indoors", "Vegetarian kitchen", "Quiet after 11 pm", "No overnight guests"], occupants: [1, "Just me. I'm a junior resident at a hospital nearby, so I'm on shifts and often asleep at odd hours."], livesHere: true, description: "First-floor builder flat on a residential lane, away from the main road noise. The room has a wardrobe and a large window; you bring the bed and desk. The kitchen is vegetarian and I'd like to keep it that way. Best for someone who is out during the day and likes a calm house.", photos: [10, 12, 21], published: 9, confirmed: 4 },
  { n: 3, lister: 3, title: "Room in a calm vegetarian 2BHK, Sector 2", locality: "HSR Layout", type: "apartment", room: "private", bed: 2, bath: 2, furnishing: "furnished", rent: 17000, deposit: 51000, from: 20, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Wardrobe", "Work desk", "Water purifier", "Lift", "Security"], rules: ["Vegetarian kitchen", "No smoking indoors", "Quiet after 11 pm", "Shared cleaning rota"], occupants: [1, "I'm a data analyst, up at 5:30 for yoga and usually asleep by 10:30. Looking for someone on a similar rhythm."], livesHere: true, description: "Second-floor flat facing the Sector 2 park. Your room is fully furnished with a bed, desk and wardrobe. We share the kitchen, a washing machine and a weekly cleaning rota. The 27th Main restaurants are ten minutes away on foot, and Agara Lake is close enough for a morning walk.", photos: [11, 28, 13], verification: "reviewed", published: 4, confirmed: 1 },
  { n: 4, lister: 13, title: "Big room in a gated society on the ORR", locality: "Bellandur", type: "gated_society", room: "private", bed: 3, bath: 3, furnishing: "furnished", rent: 21000, deposit: 63000, from: 8, amenities: ["Wi-Fi", "Washing machine", "Fridge", "AC", "Geyser", "Power backup", "Attached bathroom", "Wardrobe", "Car parking", "Lift", "Gym", "Security"], rules: ["No smoking indoors", "Guests welcome with a heads-up"], occupants: [2, "Two working professionals in our early thirties, both in tech. Friendly, not in each other's pockets."], livesHere: true, description: "Tenth-floor flat in a large society with a gym, pool and round-the-clock security. The room has AC, an attached bathroom and a view over the lake side. Ecospace and Embassy TechVillage are both under twenty minutes on a normal day. Maintenance is included in the rent.", photos: [1, 15, 26, 19], verification: "property_verified", published: 11, confirmed: 3 },
  { n: 5, lister: 15, title: "Room in a lively house near 12th Main", locality: "Indiranagar", type: "independent_house", room: "private", bed: 3, bath: 2, furnishing: "furnished", rent: 28000, deposit: 100000, from: 15, amenities: ["Wi-Fi", "Washing machine", "Fridge", "AC", "Geyser", "Balcony", "Wardrobe", "Cook", "Two-wheeler parking"], rules: ["Guests welcome with a heads-up", "Pets welcome"], occupants: [2, "A music producer and a chef. People come over most weekends, there is usually something playing, and dinner is often for six."], livesHere: true, description: "First floor of an old Indiranagar house with a terrace and a mango tree. Walking distance to the metro and 12th Main. This is a social house: we cook together, friends visit, and there's a home studio (soundproofed, mostly). If you want silence by ten, this isn't it. If you want a home that feels alive, come and see it.", photos: [3, 22, 20, 8], published: 3, confirmed: 1 },
  { n: 6, lister: 12, title: "Architect's flat, one room free, Defence Colony", locality: "Indiranagar", type: "apartment", room: "private", bed: 2, bath: 2, furnishing: "furnished", rent: 26000, deposit: 78000, from: 26, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Balcony", "Attached bathroom", "Wardrobe", "Work desk", "House help", "Lift"], rules: ["No smoking indoors", "Guests welcome with a heads-up", "No pets"], occupants: [1, "I'm an architect in my thirties. I work long days at the studio and like coming home to somewhere calm."], livesHere: true, description: "Top-floor flat with high ceilings, cross-ventilation and a lot of books. The free room has an attached bathroom and a desk under the window. Quiet lane, three minutes from the Indiranagar metro. I'd like a flatmate who enjoys a shared dinner now and then and otherwise does their own thing.", photos: [4, 23, 7], verification: "reviewed", published: 8, confirmed: 2 },
  { n: 7, lister: 13, title: "Shared room for two, close to Ecospace", locality: "Bellandur", type: "gated_society", room: "shared", bed: 3, bath: 2, furnishing: "furnished", rent: 9500, deposit: 20000, from: 5, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Power backup", "Wardrobe", "Lift", "Security", "Cook"], rules: ["No smoking indoors", "Quiet after 11 pm"], occupants: [4, "Four people across three rooms, all in their first or second jobs. You'd share a twin room with a QA engineer."], livesHere: false, description: "One bed in a twin-sharing room. The flat has a cook for two meals a day (cost split, roughly ₹3,000 a head) and a shared washing machine. Good for someone starting a first job near the Outer Ring Road who wants to keep rent low.", photos: [6, 16, 30], published: 12, confirmed: 5 },
  { n: 8, lister: 16, title: "Entire 1BHK near the Phase 1 campuses", locality: "Electronic City", type: "apartment", room: "entire", bed: 1, bath: 1, furnishing: "semi", rent: 15000, deposit: 60000, from: 1, amenities: ["Geyser", "Wardrobe", "Two-wheeler parking", "Lift", "Security", "Power backup", "Water purifier"], rules: ["No smoking indoors", "No pets"], occupants: [0, ""], livesHere: false, description: "A compact one-bedroom flat on the second floor, ten minutes by two-wheeler from the Phase 1 tech campuses. Comes with wardrobes, a geyser and kitchen cabinets; you bring appliances. Let directly by the owner, no brokerage. Water and maintenance are billed separately, about ₹1,500 a month.", photos: [2, 14, 27], verification: "reviewed", published: 10, confirmed: 6 },
  { n: 9, lister: 16, title: "2BHK for two friends, off the Marathahalli bridge", locality: "Marathahalli", type: "apartment", room: "entire", bed: 2, bath: 2, furnishing: "semi", rent: 27000, deposit: 108000, from: 18, amenities: ["Geyser", "Wardrobe", "Balcony", "Car parking", "Lift", "Security", "Power backup"], rules: ["No smoking indoors"], occupants: [0, ""], livesHere: false, description: "Two-bedroom flat on the fourth floor of a small apartment block. Both bedrooms are the same size, which makes splitting rent simple. Ten minutes to the Kadubeesanahalli stretch of the ORR. Owner-let, no brokerage. Recently repainted.", photos: [8, 29, 18], published: 5, confirmed: 5 },
  { n: 10, lister: 1, title: "Second room in our Koramangala 3BHK", locality: "Koramangala", type: "apartment", room: "private", bed: 3, bath: 3, furnishing: "furnished", rent: 21000, deposit: 63000, from: 40, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Wardrobe", "Work desk", "House help", "Power backup"], rules: ["No smoking indoors", "Guests welcome with a heads-up", "Shared cleaning rota"], occupants: [2, "Same flat as our other listing: a product designer and a lawyer. This room frees up next month."], livesHere: true, description: "The smaller of the two rooms opening up in our flat. No balcony, but it's the quietest room in the house and has built-in shelves along one wall. Shares a bathroom with nobody: all three rooms have their own.", photos: [24, 31, 5], verification: "reviewed", published: 6, confirmed: 2 },
  { n: 11, lister: 12, title: "Garden-facing room, 6th Phase", locality: "JP Nagar", type: "independent_house", room: "private", bed: 3, bath: 2, furnishing: "semi", rent: 14500, deposit: 45000, from: 9, amenities: ["Wi-Fi", "Fridge", "Geyser", "Wardrobe", "Two-wheeler parking", "Water purifier", "Washing machine"], rules: ["No smoking indoors", "Quiet after 11 pm", "Guests welcome with a heads-up"], occupants: [2, "Two women in their late twenties, a teacher and a physiotherapist. The owner's family lives downstairs."], livesHere: false, description: "First-floor portion of an independent house on a tree-lined street. The room looks onto the back garden and gets no traffic noise at all. Ten minutes' walk to the JP Nagar metro station on the Green Line. I'm listing this for close friends who live there.", photos: [13, 32, 12], published: 7, confirmed: 3 },
  { n: 12, lister: 3, title: "Affordable room near the Green Line metro", locality: "JP Nagar", type: "apartment", room: "private", bed: 2, bath: 1, furnishing: "unfurnished", rent: 11500, deposit: 35000, from: 14, amenities: ["Geyser", "Two-wheeler parking", "Water purifier", "Lift"], rules: ["Vegetarian kitchen", "No smoking indoors", "No overnight guests"], occupants: [1, "My cousin, a chartered accountancy student. Studies most evenings, vegetarian."], livesHere: false, description: "An unfurnished room in a simple, well-kept two-bedroom flat. One shared bathroom. The building is plain but the lane is safe and quiet, and the metro is a short walk. Listing on behalf of my cousin, who'll be the one living with you.", photos: [16, 25, 33], published: 13, confirmed: 8 },
  { n: 13, lister: 13, title: "Room with a desk setup near ITPL", locality: "Whitefield", type: "gated_society", room: "private", bed: 3, bath: 3, furnishing: "furnished", rent: 17500, deposit: 52500, from: 22, amenities: ["Wi-Fi", "Washing machine", "Fridge", "AC", "Geyser", "Power backup", "Attached bathroom", "Wardrobe", "Work desk", "Lift", "Gym", "Security", "Car parking"], rules: ["No smoking indoors", "Guests welcome with a heads-up"], occupants: [2, "Two remote-first engineers. Daytime is quiet because everyone's on calls; evenings we sometimes play badminton downstairs."], livesHere: false, description: "Furnished room with a proper desk, an ergonomic chair the last flatmate left behind, and 300 Mbps fibre. The society has a co-working room, gym and badminton court. Fifteen minutes' walk to the Pattandur Agrahara metro. Good if you work from home.", photos: [7, 34, 19, 1], verification: "reviewed", published: 2, confirmed: 0 },
  { n: 14, lister: 15, title: "Compact studio above a quiet street", locality: "Indiranagar", type: "builder_floor", room: "entire", bed: 1, bath: 1, furnishing: "furnished", rent: 32000, deposit: 150000, brokerage: 16000, from: 6, amenities: ["Wi-Fi", "AC", "Geyser", "Fridge", "Washing machine", "Wardrobe", "Balcony"], rules: ["No smoking indoors", "No pets"], occupants: [0, ""], livesHere: false, description: "A furnished studio with a kitchenette and a small balcony, on the second floor (no lift). Close to CMH Road. This one is let through the building's agent, so half a month's brokerage applies. I'm listing it because a friend is moving out and asked me to help find someone.", photos: [21, 17, 4], published: 9, confirmed: 7 },
  { n: 15, lister: 14, title: "Twin-share room for students, Phase 2", locality: "Electronic City", type: "apartment", room: "shared", bed: 2, bath: 2, furnishing: "furnished", rent: 7500, deposit: 15000, from: 2, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Wardrobe", "Cook", "Security"], rules: ["No smoking indoors", "Quiet after 11 pm", "Vegetarian kitchen"], occupants: [3, "Three students and interns. Exams and deadlines mean it's usually quiet on weeknights."], livesHere: false, description: "One bed in a shared room in a furnished two-bedroom flat. A cook makes vegetarian dinner on weekdays. Walking distance to the Phase 2 bus stops and a short ride to the colleges on Hosur Road. Listing for my younger sister's flat.", photos: [14, 6, 28], published: 15, confirmed: 9 },
  { n: 16, lister: 12, title: "Corner room with two windows, Sector 7", locality: "HSR Layout", type: "apartment", room: "private", bed: 3, bath: 2, furnishing: "semi", rent: 18500, deposit: 55500, from: 30, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Balcony", "Wardrobe", "Lift", "Two-wheeler parking", "Power backup"], rules: ["Guests welcome with a heads-up", "Shared cleaning rota", "No smoking indoors"], occupants: [2, "A UX designer and a product manager, both hybrid. We order in more than we should and argue about films."], livesHere: false, description: "Corner room with windows on two sides and a shared balcony. Bed and wardrobe are in place; the desk is yours to bring. Close to the Sector 7 BDA complex and a long list of dosa places. I used to live here and I'm helping my old flatmates find the right person.", photos: [19, 2, 23], published: 5, confirmed: 2 },
  { n: 17, lister: 1, title: "Room with a view of the tech park skyline", locality: "Whitefield", type: "gated_society", room: "private", bed: 2, bath: 2, furnishing: "furnished", rent: 16000, deposit: 48000, from: 16, amenities: ["Wi-Fi", "Washing machine", "Fridge", "AC", "Geyser", "Attached bathroom", "Wardrobe", "Lift", "Gym", "Security", "Power backup"], rules: ["No smoking indoors", "Pets welcome"], occupants: [1, "A senior QA engineer with a very polite indie dog named Biscuit."], livesHere: false, description: "Fourteenth-floor room with an attached bathroom and a wide window. The society is pet-friendly and there is already one dog in the flat, so please only write if that sounds like a plus. Listing for a former colleague.", photos: [26, 10, 20], published: 4, confirmed: 1 },
  { n: 18, lister: 16, title: "Budget 1RK for one, near Kundalahalli gate", locality: "Marathahalli", type: "builder_floor", room: "entire", bed: 1, bath: 1, furnishing: "unfurnished", rent: 10500, deposit: 40000, from: 4, amenities: ["Geyser", "Two-wheeler parking", "Water purifier"], rules: ["No smoking indoors"], occupants: [0, ""], livesHere: false, description: "A single room with a kitchen counter and an attached bathroom on the ground floor of a three-storey building. Nothing fancy: clean, freshly painted, and yours alone. Owner-let with no brokerage. Electricity is on a separate meter.", photos: [27, 33, 11], published: 6, confirmed: 6 },
  /* Not discoverable: shows how filled, stale and held listings behave. */
  { n: 19, lister: 1, title: "Balcony room in our old HSR flat", locality: "HSR Layout", type: "apartment", room: "private", bed: 2, bath: 2, furnishing: "furnished", rent: 18000, deposit: 54000, from: -20, amenities: ["Wi-Fi", "Washing machine", "Fridge", "Geyser", "Balcony"], rules: ["No smoking indoors"], occupants: [1, "A product designer. This room has since been filled."], livesHere: true, description: "The room has been taken. Kept here as an example of a filled listing: it no longer appears in search and can't receive new messages.", photos: [31, 9, 0], status: "occupied", published: 40, confirmed: 22 },
  { n: 20, lister: 13, title: "Room near Sarjapur junction", locality: "Bellandur", type: "apartment", room: "private", bed: 3, bath: 2, furnishing: "semi", rent: 15500, deposit: 46500, from: -5, amenities: ["Wi-Fi", "Fridge", "Geyser", "Wardrobe"], rules: ["No smoking indoors"], occupants: [2, "Two engineers who are rarely home before nine."], livesHere: false, description: "A semi-furnished room in a three-bedroom flat near the Sarjapur Road junction. This listing has not been reconfirmed recently, so it is hidden from search until the lister renews it.", photos: [30, 15, 22], published: 48, confirmed: 30 },
  { n: 21, lister: 16, title: "Entire 1BHK near the Phase 1 campuses", locality: "Electronic City", type: "apartment", room: "entire", bed: 1, bath: 1, furnishing: "semi", rent: 15000, deposit: 60000, from: 1, amenities: ["Geyser", "Wardrobe", "Lift"], rules: ["No smoking indoors"], occupants: [0, ""], livesHere: false, description: "A compact one-bedroom flat near the Phase 1 campuses. This is a repeat of an existing listing, held for a moderator to look at before it can go live.", photos: [2, 14, 27], status: "under_review", published: 1, confirmed: 1, reviewReason: "Shares a photo with another live listing" },
  { n: 22, lister: 17, title: "Sea-facing penthouse room, unbelievable price", locality: "Koramangala", type: "apartment", room: "private", bed: 4, bath: 4, furnishing: "furnished", rent: 6000, deposit: 6000, from: 0, amenities: ["Wi-Fi", "AC", "Gym"], rules: [], occupants: [1, "Owner is travelling abroad and will courier the keys."], livesHere: false, description: "Sample of the kind of listing people report: a price far below the area, an owner who can't meet, and a request to pay a token amount before any visit. Bengaluru does not have a sea.", photos: [18, 17, 32], published: 2, confirmed: 2 },
];

const id = (prefix: string, n: number) => `demo-${prefix}-${String(n).padStart(2, "0")}`;

export interface SeedData {
  profiles: Profile[];
  contacts: Record<string, PrivateContact>;
  lifestyle: Record<string, LifestyleAnswers>;
  listings: Listing[];
  addresses: Record<string, string>;
  conversations: Conversation[];
  messages: Message[];
  reports: Report[];
}

/** Small deterministic offset so the public pin never sits on the real building. */
function jitter(n: number, axis: 0 | 1) {
  const x = Math.sin(n * (axis ? 12.9898 : 78.233)) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.012;
}

export function buildSeed(now = Date.now()): SeedData {
  const at = (daysAgo: number, hour = 10, minute = 0) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const dateIn = (days: number) => isoDate(new Date(now + days * DAY));

  const profiles: Profile[] = [
    {
      id: DEMO_ADMIN_ID,
      displayName: "Moderator (sample)",
      avatarUrl: null,
      city: "Bengaluru",
      occupation: "Trust & safety",
      stage: "professional",
      bio: "Sample moderator account for trying the review queue.",
      intent: "listing",
      budgetMin: 0,
      budgetMax: 0,
      moveInBy: null,
      preferredLocalities: [],
      verification: { email: true, phone: false, institution: false },
      isAdmin: true,
      isDemo: true,
      onboarded: true,
      createdAt: at(90),
    },
    ...PEOPLE.map<Profile>((p) => ({
      id: id("u", p.n),
      displayName: p.name,
      avatarUrl: null,
      city: "Bengaluru",
      occupation: p.occupation,
      stage: p.stage,
      bio: p.bio,
      intent: p.intent,
      budgetMin: p.budget[0],
      budgetMax: p.budget[1],
      moveInBy: p.moveIn === null ? null : dateIn(p.moveIn),
      preferredLocalities: p.areas,
      verification: { email: p.verify[0], phone: p.verify[1], institution: p.verify[2] },
      isAdmin: false,
      isDemo: true,
      onboarded: true,
      createdAt: at(20 + p.n * 3),
    })),
  ];

  const contacts: Record<string, PrivateContact> = { [DEMO_ADMIN_ID]: { email: "moderator@sample.saha.invalid", phone: null } };
  const lifestyle: Record<string, LifestyleAnswers> = {};
  for (const p of PEOPLE) {
    const first = p.name.split(" ")[0].toLowerCase();
    contacts[id("u", p.n)] = { email: `${first}@sample.saha.invalid`, phone: p.verify[1] ? `+91 90000 000${String(p.n).padStart(2, "0")}` : null };
    if (!/^-+$/.test(p.values)) lifestyle[id("u", p.n)] = answers(p.values, p.importance);
  }

  const addresses: Record<string, string> = {};
  const listings: Listing[] = HOMES.map((h) => {
    const loc = LOCALITIES.find((l) => l.name === h.locality)!;
    const listingId = id("l", h.n);
    addresses[listingId] = `Sample address ${h.n}, ${h.locality}, Bengaluru`;
    return {
      id: listingId,
      listerId: id("u", h.lister),
      title: h.title,
      city: "Bengaluru",
      locality: h.locality,
      approxLat: loc.lat + jitter(h.n, 0),
      approxLng: loc.lng + jitter(h.n, 1),
      propertyType: h.type,
      bedrooms: h.bed,
      bathrooms: h.bath,
      furnishing: h.furnishing,
      amenities: h.amenities,
      description: h.description,
      roomType: h.room,
      rent: h.rent,
      deposit: h.deposit,
      brokerage: h.brokerage ?? 0,
      availableFrom: dateIn(h.from),
      houseRules: h.rules,
      occupantCount: h.occupants[0],
      occupantSummary: h.occupants[1],
      listerLivesHere: h.livesHere,
      photos: h.photos.map((p, i) => ({ url: photoUrl(p), alt: `Sample interior photo ${i + 1} for “${h.title}”` })),
      status: h.status ?? "active",
      reviewReason: h.reviewReason ?? null,
      verification: h.verification ?? "none",
      publishedAt: at(h.published, 9),
      lastConfirmedAt: at(h.confirmed, 9),
      createdAt: at(h.published, 9),
      updatedAt: at(h.confirmed, 9),
      isDemo: true,
    };
  });

  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  let m = 0;
  const thread = (
    n: number,
    from: number,
    to: number,
    listing: number | null,
    status: Conversation["status"],
    lines: [who: "a" | "b", daysAgo: number, hour: number, minute: number, body: string][],
  ) => {
    const cid = id("c", n);
    const stamps = lines.map(([who, d, h, min, body]) => ({
      id: id("m", ++m),
      conversationId: cid,
      senderId: id("u", who === "a" ? from : to),
      body,
      createdAt: at(d, h, min),
    }));
    messages.push(...stamps);
    conversations.push({
      id: cid,
      listingId: listing === null ? null : id("l", listing),
      requesterId: id("u", from),
      recipientId: id("u", to),
      status,
      createdAt: stamps[0].createdAt,
      lastMessageAt: stamps[stamps.length - 1].createdAt,
    });
  };

  thread(1, 2, 1, 1, "accepted", [
    ["a", 2, 19, 12, "Hi Ananya, I'm Karthik. I work hybrid in HSR and your Koramangala room looks like a great fit. Is it still available from the 1st?"],
    ["b", 2, 19, 40, "Hi Karthik! Yes, it is. Our flatmate moves out on the 28th. Are you home a lot during the week?"],
    ["a", 2, 19, 46, "Three days a week, mostly on calls with headphones. I'm fairly quiet otherwise."],
    ["b", 2, 20, 5, "That works. We're both out during the day. Want to come by on Saturday morning to see the place?"],
    ["a", 1, 9, 18, "Saturday at 11 works for me. Should I bring anything?"],
    ["b", 1, 9, 31, "Just yourself. Please don't transfer anything to anyone before you've seen the flat and met us. That goes for any listing, not just ours."],
    ["a", 0, 8, 5, "Understood, and thanks for saying it. See you Saturday."],
  ]);
  thread(2, 4, 1, 1, "pending", [
    ["a", 0, 11, 22, "Hey! Rohan here, growth marketer, three years in Bengaluru. I host game nights about twice a month. Would that be okay in your flat? Happy to chat."],
  ]);
  thread(3, 5, 13, 7, "accepted", [
    ["a", 3, 14, 2, "Hello, I'm starting an internship near Ecospace next month. Is the twin-share bed still open?"],
    ["b", 3, 16, 30, "Hi Ishita, yes it is. The other person in the room is a QA engineer who's been there a year."],
    ["a", 3, 16, 41, "Great. Could I do a video call with her before visiting? I'm still in Kolkata."],
    ["b", 2, 10, 15, "Of course, I'll ask her and share a time here."],
  ]);
  thread(4, 1, 12, null, "accepted", [
    ["a", 5, 18, 0, "Hi Pooja, we matched quite high and I liked your profile. Would you be open to looking for a two-bedroom together in Indiranagar?"],
    ["b", 5, 21, 14, "Hi Ananya! Possibly. I have a room free in my own flat too. What's your timeline?"],
    ["a", 4, 8, 50, "Flexible, sometime in the next two months."],
  ]);
  thread(5, 9, 3, 3, "declined", [
    ["a", 6, 23, 40, "Hi! I'm a writer and I work late most nights. Is the room still free?"],
  ]);

  const reports: Report[] = [
    {
      id: id("r", 1),
      reporterId: id("u", 5),
      targetType: "listing",
      targetId: id("l", 22),
      reason: "Asked for money before a visit",
      details: "The lister said the owner is abroad and asked for a ₹2,000 token to 'hold' the room before I could see it.",
      status: "open",
      createdAt: at(1, 15, 20),
    },
    {
      id: id("r", 2),
      reporterId: id("u", 10),
      targetType: "listing",
      targetId: id("l", 22),
      reason: "Photos or details look fake",
      details: "Rent is a quarter of anything nearby and the photos look like a hotel.",
      status: "open",
      createdAt: at(0, 9, 5),
    },
  ];

  return { profiles, contacts, lifestyle, listings, addresses, conversations, messages, reports };
}
