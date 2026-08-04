import Link from "next/link";
import { arAging, apAging, AGING_BUCKETS, AGING_LABELS, type AgingReport } from "@/lib/reporting/aging";
import { money, longDate, shortDate } from "@/lib/format";
import { ReportHeader, PeriodForm, TiesBadge } from "@/components/report/ReportShell";

export const dynamic = "force-dynamic";

function utc(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function AgingTable({ report }: { report: AgingReport }) {
  const isAr = report.direction === "AR";

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3">
        <div>
          <p className="eyebrow">{isAr ? "Owed to us" : "Owed by us"}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {report.rows.length} open · {money(report.subledgerTotal)}
          </p>
        </div>
        <TiesBadge ok={report.ties} label={report.ties ? "Ties to ledger" : "Does not tie"} />
      </div>

      {!report.ties ? (
        <div className="border-b border-rule bg-tint-amber/40 px-5 py-3">
          <p className="text-[13px]">
            Open documents total {money(report.subledgerTotal)} but account {report.accountCode}{" "}
            holds {money(report.glBalance)} — a difference of{" "}
            <span className="figure !text-[13px] font-semibold">{money(report.difference)}</span>.
            Usually a manual journal entry with no document behind it.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-5 divide-x divide-rule border-b border-rule">
        {AGING_BUCKETS.map((bucket) => (
          <div key={bucket} className="px-4 py-3">
            <p className="eyebrow">{AGING_LABELS[bucket]}</p>
            <p className="figure mt-1 !text-left !text-[14px] font-medium">
              {money(report.byBucket[bucket])}
            </p>
          </div>
        ))}
      </div>

      {report.rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">Nothing outstanding.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-wash/40">
              <th className="px-5 py-2.5 text-left"><span className="eyebrow">Document</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Contact</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Due</span></th>
              <th className="px-3 py-2.5 text-right"><span className="eyebrow">Days</span></th>
              <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {report.rows.map((row) => (
              <tr key={row.documentNumber} className="hover:bg-wash/20">
                <td className="px-5 py-2.5 font-mono text-[12px]">{row.documentNumber}</td>
                <td className="px-3 py-2.5 text-[13px]">{row.contactName}</td>
                <td className="px-3 py-2.5 text-[13px] text-muted">{shortDate(row.dueDate)}</td>
                <td
                  className={`figure px-3 py-2.5 ${row.daysPastDue > 60 ? "text-negative" : row.daysPastDue > 0 ? "text-warn" : "text-faint"}`}
                >
                  {row.daysPastDue > 0 ? row.daysPastDue : "—"}
                </td>
                <td className="figure px-3 py-2.5">{money(row.total)}</td>
                <td className="figure px-5 py-2.5 font-medium">{money(row.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {report.byContact.length > 1 ? (
        <div className="border-t border-rule px-5 py-3">
          <p className="eyebrow">By contact</p>
          <ul className="mt-2 divide-y divide-rule">
            {report.byContact.map((c) => (
              <li key={c.name} className="flex justify-between py-1.5 text-[13px]">
                <span className="text-muted">{c.name}</span>
                <span className="figure">{money(c.outstanding)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default async function AgingPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const sp = await searchParams;
  const asOf = utc(sp.to, new Date());

  const [ar, ap] = await Promise.all([arAging(asOf), apAging(asOf)]);

  return (
    <div>
      <ReportHeader
        eyebrow="Subledger"
        title="Aging"
        subtitle={`As at ${longDate(asOf)}`}
      >
        <PeriodForm from="" to={asOf.toISOString().slice(0, 10)} showFrom={false} />
      </ReportHeader>

      <div className="mt-6 grid gap-4">
        <AgingTable report={ar} />
        <AgingTable report={ap} />
      </div>

      <p className="mt-4 text-[12px] text-faint">
        Documents are aged from their due date. Payments are counted only if posted on or before{" "}
        {shortDate(asOf)}, so a past date shows what was outstanding then.
      </p>
    </div>
  );
}
