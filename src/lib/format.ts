const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const rupees = (n: number) => `₹${inr.format(n)}`;

/** ₹18,500 → "₹18.5k" for tight spaces such as map pins. */
export const rupeesShort = (n: number) => {
  if (n >= 100000) return `₹${+(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${+(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long" });

export const DAY = 86_400_000;

export const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const daysBetween = (from: Date | string, to: Date | string) =>
  Math.round((startOfDay(new Date(to)) - startOfDay(new Date(from))) / DAY);

export const shortDate = (iso: string) => dayMonth.format(new Date(iso));
export const fullDate = (iso: string) => dayMonthYear.format(new Date(iso));
export const clock = (iso: string) => time.format(new Date(iso));

export function availability(iso: string, now = new Date()) {
  return daysBetween(now, iso) <= 0 ? "Available now" : `From ${shortDate(iso)}`;
}

/** Heading for a day separator in a chat thread. */
export function dayLabel(iso: string, now = new Date()) {
  const diff = daysBetween(iso, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return weekday.format(new Date(iso));
  return fullDate(iso);
}

export function ago(iso: string, now = new Date()) {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return fullDate(iso);
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const uid = (prefix = "") =>
  prefix +
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
