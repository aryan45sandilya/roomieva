import type { Importance, QuestionId } from "./types";

export type CategoryId = "cleanliness" | "sleep" | "food" | "substances" | "social" | "work" | "shared";

export interface QuestionOption {
  label: string;
  hint: string;
}

export interface Question {
  id: QuestionId;
  category: CategoryId;
  /** Conversational prompt shown in the questionnaire. */
  prompt: string;
  /** Short neutral name, e.g. on profile chips. */
  short: string;
  /** Used in "your preferences around … differ". */
  topic: string;
  /** Options are ordered along one spectrum; distance between them is what gets scored. */
  options: QuestionOption[];
  /** "You both …" phrase for each option, used when two people give the same answer. */
  shared: string[];
  /** Sensitive questions get a more prominent skip. Every question can be skipped. */
  sensitive?: boolean;
}

export const QUESTIONS: Question[] = [
  {
    id: "sleep",
    category: "sleep",
    prompt: "Are you an early bird or a midnight thinker?",
    short: "Sleep",
    topic: "sleep schedules",
    options: [
      { label: "Early bird", hint: "Asleep by 11, up with the light" },
      { label: "Somewhere in between", hint: "Midnight-ish, most nights" },
      { label: "Midnight thinker", hint: "My best hours start after 12" },
    ],
    shared: ["are up early", "keep middle-of-the-road hours", "are night owls"],
  },
  {
    id: "cleanliness",
    category: "cleanliness",
    prompt: "What does a clean home look like to you?",
    short: "Cleanliness",
    topic: "how clean the home is kept",
    options: [
      { label: "Lived-in is fine", hint: "A little mess doesn't bother me" },
      { label: "Tidy most days", hint: "Common areas clear, dishes done by night" },
      { label: "Spotless, always", hint: "Everything has a place and goes back to it" },
    ],
    shared: ["are relaxed about mess", "like a tidy home", "want the place spotless"],
  },
  {
    id: "food",
    category: "food",
    prompt: "What's cooking in the shared kitchen?",
    short: "Kitchen",
    topic: "what gets cooked in the kitchen",
    sensitive: true,
    options: [
      { label: "Vegetarian only", hint: "No eggs, meat or fish in the kitchen" },
      { label: "Eggs are fine", hint: "Vegetarian plus eggs" },
      { label: "Anything goes", hint: "Non-veg cooking is welcome" },
    ],
    shared: ["prefer a vegetarian kitchen", "are fine with eggs in the kitchen", "are happy with a non-veg kitchen"],
  },
  {
    id: "cooking",
    category: "food",
    prompt: "How often do you actually cook?",
    short: "Cooking",
    topic: "how much the kitchen gets used",
    options: [
      { label: "Rarely", hint: "Swiggy knows me by name" },
      { label: "A few times a week", hint: "When there's time" },
      { label: "Almost daily", hint: "The kitchen is my room too" },
    ],
    shared: ["mostly order in", "cook a few times a week", "cook almost daily"],
  },
  {
    id: "smoking",
    category: "substances",
    prompt: "Where do you stand on smoking at home?",
    short: "Smoking",
    topic: "smoking at home",
    sensitive: true,
    options: [
      { label: "Smoke-free home", hint: "Not inside, not on the balcony" },
      { label: "Balcony only", hint: "Outside is fine, inside isn't" },
      { label: "Fine indoors", hint: "It doesn't bother me" },
    ],
    shared: ["want a smoke-free home", "are fine with smoking on the balcony", "are fine with smoking indoors"],
  },
  {
    id: "drinking",
    category: "substances",
    prompt: "And drinks at home?",
    short: "Drinking",
    topic: "drinking at home",
    sensitive: true,
    options: [
      { label: "Prefer none", hint: "I'd like an alcohol-free home" },
      { label: "Now and then", hint: "A drink on the weekend is fine" },
      { label: "Social and regular", hint: "Friends, drinks, most weekends" },
    ],
    shared: ["prefer an alcohol-free home", "are fine with the occasional drink at home", "enjoy regular social drinks at home"],
  },
  {
    id: "guests",
    category: "social",
    prompt: "How often do friends or family come over?",
    short: "Guests",
    topic: "overnight guests and visitors",
    options: [
      { label: "Hardly ever", hint: "Home is my quiet place" },
      { label: "Sometimes", hint: "A friend over now and then" },
      { label: "Often", hint: "Including people staying the night" },
    ],
    shared: ["rarely have guests over", "have guests over now and then", "love a full house"],
  },
  {
    id: "social",
    category: "social",
    prompt: "What are flatmates to you?",
    short: "Flatmate style",
    topic: "how much you want to hang out",
    options: [
      { label: "Friendly neighbours", hint: "A nod in the hallway, our own lives" },
      { label: "Good company", hint: "Chai and the occasional dinner together" },
      { label: "Basically family", hint: "Shared meals, shared plans" },
    ],
    shared: ["like your own space", "enjoy easy company at home", "want flatmates who feel like family"],
  },
  {
    id: "wfh",
    category: "work",
    prompt: "Where does your working day happen?",
    short: "Work",
    topic: "being home during the workday",
    options: [
      { label: "At the office", hint: "Out the door most days" },
      { label: "Hybrid", hint: "Two or three days at home" },
      { label: "At home", hint: "My desk is in my room" },
    ],
    shared: ["are out at work most days", "split the week between home and office", "work from home"],
  },
  {
    id: "noise",
    category: "work",
    prompt: "How much noise can you live with?",
    short: "Noise",
    topic: "noise at home",
    options: [
      { label: "I need quiet", hint: "Calls, sleep, or just peace" },
      { label: "Some is fine", hint: "Music at a reasonable volume" },
      { label: "Lively is good", hint: "A loud house is a happy house" },
    ],
    shared: ["need a quiet home", "are fine with a bit of noise", "like a lively home"],
  },
  {
    id: "expenses",
    category: "shared",
    prompt: "How should shared costs be split?",
    short: "Expenses",
    topic: "splitting shared expenses",
    options: [
      { label: "By the rupee", hint: "Track it all, settle every month" },
      { label: "Evenly", hint: "Split everything down the middle" },
      { label: "Loosely", hint: "It evens out in the end" },
    ],
    shared: ["like every expense tracked", "prefer splitting costs evenly", "keep expenses relaxed"],
  },
  {
    id: "ac",
    category: "shared",
    prompt: "AC, geyser, lights. How do you use them?",
    short: "Electricity",
    topic: "AC and electricity use",
    options: [
      { label: "Sparingly", hint: "Fan first, AC on the worst nights" },
      { label: "Sensibly", hint: "When it's needed, off when it isn't" },
      { label: "Freely", hint: "Comfort first, I'll pay my share" },
    ],
    shared: ["go easy on the AC", "use the AC sensibly", "run the AC freely"],
  },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q])) as Record<QuestionId, Question>;

export interface Category {
  id: CategoryId;
  label: string;
  /** Share of the overall score, before reweighting for skipped answers. */
  weight: number;
}

export const CATEGORIES: Category[] = [
  { id: "cleanliness", label: "Cleanliness", weight: 20 },
  { id: "sleep", label: "Sleep routine", weight: 15 },
  { id: "food", label: "Food & cooking", weight: 15 },
  { id: "substances", label: "Smoking & drinking", weight: 15 },
  { id: "social", label: "Guests & social life", weight: 15 },
  { id: "work", label: "Work & noise", weight: 10 },
  { id: "shared", label: "Shared living", weight: 10 },
];

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  flexible: "Flexible",
  important: "Important",
  dealbreaker: "Non-negotiable",
};

export const IMPORTANCE_HINT: Record<Importance, string> = {
  flexible: "I can adapt",
  important: "It matters to me",
  dealbreaker: "I won't compromise",
};
