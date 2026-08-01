export type Granularity = "WEEK" | "MONTH" | "QUARTER" | "YEAR";

export type Period = { label: string; from: Date; to: Date };

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d));
}

function startOfWeek(date: Date) {
  const d = utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function isoWeekLabel(start: Date) {
  const thursday = utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 3);
  const yearStart = utc(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodsBetween(from: Date, to: Date, granularity: Granularity): Period[] {
  if (to < from) throw new Error("Period end cannot be before period start.");
  const out: Period[] = [];
  let cursor: Date;

  if (granularity === "WEEK") cursor = startOfWeek(from);
  else if (granularity === "MONTH") cursor = utc(from.getUTCFullYear(), from.getUTCMonth(), 1);
  else if (granularity === "QUARTER")
    cursor = utc(from.getUTCFullYear(), Math.floor(from.getUTCMonth() / 3) * 3, 1);
  else cursor = utc(from.getUTCFullYear(), 0, 1);

  while (cursor <= to) {
    let next: Date;
    let label: string;

    if (granularity === "WEEK") {
      next = utc(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7);
      label = isoWeekLabel(cursor);
    } else if (granularity === "MONTH") {
      next = utc(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
      label = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    } else if (granularity === "QUARTER") {
      next = utc(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1);
      label = `${cursor.getUTCFullYear()}-Q${Math.floor(cursor.getUTCMonth() / 3) + 1}`;
    } else {
      next = utc(cursor.getUTCFullYear() + 1, 0, 1);
      label = String(cursor.getUTCFullYear());
    }

    const end = utc(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate() - 1);
    out.push({
      label,
      from: new Date(cursor.getTime()),
      to: end < to ? end : new Date(to.getTime()),
    });
    cursor = next;
  }

  return out;
}
