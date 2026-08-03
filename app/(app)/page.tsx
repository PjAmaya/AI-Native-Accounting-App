import Link from "next/link";
import { Wallet, FileText, Receipt, TrendingUp, ArrowUpRight } from "lucide-react";
import { balanceSheet } from "@/lib/reporting/balanceSheet";
import { profitAndLoss } from "@/lib/reporting/profitAndLoss";
import { arAging, apAging } from "@/lib/reporting/aging";
import { money } from "@/lib/format";

const TINTS = {
  blue: "bg-tint-blue text-icon-blue",
  amber: "bg-tint-amber text-icon-amber",
  green: "bg-tint-green text-icon-green",
  violet: "bg-tint-violet text-icon-violet",
} as const;

export default async function DashboardPage() {
  const today = new Date();
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const [bs, pnl, ar, ap] = await Promise.all([
    balanceSheet(today, yearStart),
    profitAndLoss(yearStart, today),
    arAging(today),
    apAging(today),
  ]);

  const cash = bs.currentAssets.rows
    .filter((r) => ["1010", "1020", "1030"].includes(r.code))
    .reduce((sum, r) => sum.plus(r.balance), pnl.netIncome.minus(pnl.netIncome));

  const overdue = ar.rows.filter((r) => r.daysPastDue > 0).length;

  const cards = [
    {
      label: "Cash on hand",
      value: money(cash),
      note: `Across ${bs.currentAssets.rows.filter((r) => ["1010", "1020", "1030"].includes(r.code)).length} accounts`,
      icon: Wallet,
      tint: TINTS.blue,
    },
    {
      label: "Receivable",
      value: money(ar.glBalance),
      note: overdue > 0 ? `${overdue} overdue` : "All current",
      icon: FileText,
      tint: TINTS.amber,
    },
    {
      label: "Payable",
      value: money(ap.glBalance),
      note: `${ap.rows.length} open`,
      icon: Receipt,
      tint: TINTS.violet,
    },
    {
      label: "Net income",
      value: money(pnl.netIncome),
      note: pnl.ratios.netMargin ? `${pnl.ratios.netMargin.toFixed(1)}% margin` : "Year to date",
      icon: TrendingUp,
      tint: TINTS.green,
    },
  ];

  return (
    <div>
      <p className="eyebrow">Story Craft Studio</p>
      <h1 className="page-title mt-1.5">Dashboard</h1>
      <p className="mt-2 text-[14px] text-muted">
        Year to date, {today.getUTCFullYear()}
      </p>

      <div className="mt-7 grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card px-5 py-4.5">
            <span className={`tile ${c.tint}`}>
              <c.icon size={17} strokeWidth={1.9} aria-hidden />
            </span>
            <p className="eyebrow mt-3.5">{c.label}</p>
            <p className="kpi mt-1">{c.value}</p>
            <p className="mt-1 text-[12px] text-faint">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4 px-5 py-4.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Profit to cash</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
              You have earned <span className="font-medium">{money(pnl.netIncome)}</span> and
              collected <span className="font-medium">{money(cash)}</span>. The difference is
              sitting in unpaid invoices.
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
          >
            Reports
            <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
