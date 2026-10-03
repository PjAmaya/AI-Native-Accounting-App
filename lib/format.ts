import Decimal from "decimal.js";

export function money(value: unknown, options?: { currency?: string; sign?: boolean }) {
  const amount = new Decimal(String(value));
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount.abs().toNumber());

  const prefix = amount.isNegative() ? "-" : options?.sign ? "+" : "";
  const currency = options?.currency;
  return currency && currency !== "CAD"
    ? `${prefix}${formatted} ${currency}`
    : `${prefix}$${formatted}`;
}

export function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function longDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Dates are stored as UTC midnight, but "today" is the business's calendar day.
// Taking the UTC date instead rolled forms over to tomorrow on Toronto evenings.
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE ?? "America/Toronto";

export function todayIso(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
