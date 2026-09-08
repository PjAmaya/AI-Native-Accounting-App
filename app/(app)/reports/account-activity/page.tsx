import Link from "next/link";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function utcDate(v: string | undefined) {
  if (!v) return undefined;
  const d = new Date(v + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function AccountActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const code = sp.account?.trim();
  const from = utcDate(sp.from);
  const to = utcDate(sp.to);

  if (!code) {
    return (
      <div>
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          Reports
        </Link>
        <h1 className="page-title mt-3">Account activity</h1>
        <p className="mt-2 text-[14px] text-muted">Select an account from a report to see its transactions.</p>
      </div>
    );
  }

  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) {
    return (
      <div>
        <h1 className="page-title">Account {code} not found</h1>
      </div>
    );
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      account: { code },
      entry: {
        status: { in: ["POSTED", "REVERSED"] },
        ...(from || to
          ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
    },
    include: {
      entry: true,
      contact: true,
      project: true,
    },
    orderBy: [{ entry: { entryDate: "asc" } }, { entry: { entryNumber: "asc" } }, { lineNumber: "asc" }],
  });

  let running = new Decimal(0);
  const rows = lines.map((line) => {
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());
    const movement = account.normalBalance === "DEBIT"
      ? debit.minus(credit)
      : credit.minus(debit);
    running = running.plus(movement);
    return { line, debit, credit, running: new Decimal(running) };
  });

  const totalDebit = rows.reduce((sum, r) => sum.plus(r.debit), new Decimal(0));
  const totalCredit = rows.reduce((sum, r) => sum.plus(r.credit), new Decimal(0));

  const dateRange = from || to
    ? `${from ? shortDate(from) : "start"} to ${to ? shortDate(to) : "now"}`
    : "All time";

  return (
    <div>
      <Link
        href={`/reports/profit-and-loss${sp.from || sp.to ? `?from=${sp.from ?? ""}&to=${sp.to ?? ""}` : ""}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to report
      </Link>

      <h1 className="page-title mt-3">
        <span className="font-mono text-muted">{account.code}</span> {account.name}
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        {dateRange} · {rows.length} transaction{rows.length === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <div className="card mt-7 px-6 py-14 text-center">
          <p className="text-[14px] text-muted">No transactions in this period.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Date</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">#</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Description</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Contact</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Project</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Debit</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Credit</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Balance</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ line, debit, credit, running: bal }) => (
                <tr
                  key={line.id}
                  className={`hover:bg-wash/20 ${line.entry.status === "REVERSED" ? "opacity-40 line-through" : ""}`}
                >
                  <td className="px-5 py-2.5 text-[12px] text-muted">{shortDate(line.entry.entryDate)}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{line.entry.entryNumber}</td>
                  <td className="max-w-64 truncate px-3 py-2.5 text-[13px]">{line.description}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted">{line.contact?.name ?? ""}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{line.project?.code ?? ""}</td>
                  <td className="figure px-3 py-2.5">{debit.isZero() ? "" : money(debit)}</td>
                  <td className="figure px-3 py-2.5">{credit.isZero() ? "" : money(credit)}</td>
                  <td className="figure px-5 py-2.5 font-medium">{money(bal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-rule bg-wash/30">
              <tr>
                <td colSpan={5} className="px-5 py-2.5 text-[13px] font-semibold">Total</td>
                <td className="figure px-3 py-2.5 font-semibold">{money(totalDebit)}</td>
                <td className="figure px-3 py-2.5 font-semibold">{money(totalCredit)}</td>
                <td className="figure px-5 py-2.5 font-semibold">{money(running)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
