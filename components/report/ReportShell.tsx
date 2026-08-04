import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PeriodForm({
  from,
  to,
  showFrom = true,
  extra,
}: {
  from: string;
  to: string;
  showFrom?: boolean;
  extra?: React.ReactNode;
}) {
  const input =
    "rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {showFrom ? (
        <div>
          <label htmlFor="from" className="eyebrow">From</label>
          <input id="from" name="from" type="date" defaultValue={from} className={`${input} mt-1 block`} />
        </div>
      ) : null}
      <div>
        <label htmlFor="to" className="eyebrow">{showFrom ? "To" : "As at"}</label>
        <input id="to" name="to" type="date" defaultValue={to} className={`${input} mt-1 block`} />
      </div>
      {extra}
      <button
        type="submit"
        className="rounded-lg border border-rule bg-surface px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/60"
      >
        Update
      </button>
    </form>
  );
}

export function ReportHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Reports
      </Link>
      <p className="eyebrow mt-3">{eyebrow}</p>
      <h1 className="page-title mt-1.5">{title}</h1>
      {subtitle ? <p className="mt-2 text-[14px] text-muted">{subtitle}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export function TiesBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium " +
        (ok ? "bg-tint-green text-icon-green" : "bg-tint-amber text-icon-amber")
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-icon-green" : "bg-icon-amber"}`} />
      {label ?? (ok ? "Balanced" : "Out of balance")}
    </span>
  );
}
