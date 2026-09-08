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
        <div className="card mt-7 overflow-x-auto">
          <table className="w-full text-[12px]" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "45%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-2 py-2 text-left"><span className="eyebrow">Date</span></th>
                <th className="px-2 py-2 text-left"><span className="eyebrow">#</span></th>
                <th className="px-2 py-2 text-left"><span className="eyebrow">Description</span></th>
                <th className="px-2 py-2 text-right"><span className="eyebrow">Debit</span></th>
                <th className="px-2 py-2 text-right"><span className="eyebrow">Credit</span></th>
                <th className="px-2 py-2 text-right"><span className="eyebrow">Balance</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ line, debit, credit, running: bal }) => (
                <tr
                  key={line.id}
                  className={`hover:bg-wash/20 ${line.entry.status === "REVERSED" ? "opacity-40 line-through" : ""}`}
                >
                  <td className="whitespace-nowrap px-2 py-2 text-muted">{shortDate(line.entry.entryDate)}</td>
                  <td className="px-2 py-2 font-mono text-muted">{line.entry.entryNumber}</td>
                  <td className="overflow-hidden px-2 py-2">
                    <p className="truncate">{line.description}</p>
                    {line.contact || line.project ? (
                      <p className="truncate text-[11px] text-faint">
                        {line.contact?.name ?? ""}{line.contact && line.project ? " · " : ""}{line.project?.code ?? ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">{debit.isZero() ? "" : money(debit)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">{credit.isZero() ? "" : money(credit)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums font-medium">{money(bal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-rule bg-wash/30">
              <tr>
                <td colSpan={3} className="px-2 py-2 font-semibold">Total</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums font-semibold">{money(totalDebit)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums font-semibold">{money(totalCredit)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums font-semibold">{money(running)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
