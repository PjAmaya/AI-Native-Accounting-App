import Link from "next/link";
import { TrendingUp, Scale, Waves, Clock } from "lucide-react";

const REPORTS = [
  {
    href: "/reports/profit-and-loss",
    title: "Profit & Loss",
    detail: "Revenue, cost of services, margins, and EBITDA for a period.",
    icon: TrendingUp,
    tint: "bg-tint-green text-icon-green",
  },
  {
    href: "/reports/balance-sheet",
    title: "Balance Sheet",
    detail: "What she owns and owes as at a date, with working capital.",
    icon: Scale,
    tint: "bg-tint-blue text-icon-blue",
  },
  {
    href: "/reports/cash-flow",
    title: "Cash Flow",
    detail: "How profit became cash, and where the difference sits.",
    icon: Waves,
    tint: "bg-tint-violet text-icon-violet",
  },
  {
    href: "/reports/aging",
    title: "Aging",
    detail: "Who owes what, how overdue, and whether it ties to the ledger.",
    icon: Clock,
    tint: "bg-tint-amber text-icon-amber",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <p className="eyebrow">Financial statements</p>
      <h1 className="page-title mt-1.5">Reports</h1>
      <p className="mt-2 text-[14px] text-muted">
        Every figure is computed from posted journal entries. Drafts are excluded.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="card px-5 py-4.5 transition-colors hover:bg-wash/30">
            <span className={`tile ${r.tint}`}>
              <r.icon size={17} strokeWidth={1.9} aria-hidden />
            </span>
            <p className="mt-3.5 text-[15px] font-semibold tracking-tight">{r.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">{r.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
