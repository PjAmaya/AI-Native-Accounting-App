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
