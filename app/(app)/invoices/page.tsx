import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      contact: true,
      applications: true,
      creditApplications: { include: { creditNote: true } },
      creditNotes: true,
    },
    orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
  });

  const today = new Date();

  const rows = invoices.map((invoice) => {
    const applied = [...invoice.applications, ...invoice.creditApplications].reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding =
      invoice.status === "VOID"
        ? new Decimal(0)
        : new Decimal(invoice.total.toString()).minus(applied);
    const overdue =
      invoice.status === "ISSUED" && outstanding.greaterThan(0) && invoice.dueDate < today;
    const partial =
      invoice.status === "ISSUED" &&
      applied.greaterThan(0) &&
      outstanding.greaterThan(0);

    const statuses =
      invoice.status === "ISSUED"
        ? [...(partial ? ["PARTIAL"] : []), ...(overdue ? ["OVERDUE"] : [])]
        : [];

    return {
      invoice,
      outstanding,
      statuses: statuses.length > 0 ? statuses : [invoice.status],
    };
  });

  const openTotal = rows
    .filter((r) => r.invoice.status === "ISSUED")
    .reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts receivable</p>
          <h1 className="page-title mt-1.5">Invoices</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(openTotal)} outstanding across {rows.filter((r) => r.invoice.status === "ISSUED").length} open
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New invoice
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-blue text-icon-blue">
            <FileText size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No invoices yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Invoice</span></th>
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Client</span></th>
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Due</span></th>
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Status</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ invoice, outstanding, statuses }) => (
                <tr key={invoice.id} className="hover:bg-wash/30">
                  <td className="px-5 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-mono text-[12px] font-medium hover:text-brand"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="text-[11px] text-faint">
                      {shortDate(invoice.invoiceDate)}
                      {invoice.creditNotes.length > 0 || invoice.creditApplications.length > 0 ? (
                        <span className="ml-1.5 rounded-full bg-tint-amber px-1.5 py-0.5 text-[10px] font-medium text-icon-amber">
                          {[
                            ...invoice.creditNotes.map((c) => c.creditNumber),
                            ...invoice.creditApplications.map((a) => a.creditNote.creditNumber),
                          ]
                            .filter((v, i, arr) => arr.indexOf(v) === i)
                            .join(", ")}
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-[13px]">{invoice.contact.name}</td>
                  <td className="px-5 py-3 text-[13px] text-muted">{shortDate(invoice.dueDate)}</td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap gap-1">
                      {statuses.map((s) => (
                        <StatusPill key={s} status={s} />
                      ))}
                    </span>
                  </td>
                  <td className="figure px-5 py-3">{money(invoice.total)}</td>
                  <td className="figure px-5 py-3">
                    {outstanding.isZero() ? (
                      <span className="text-faint">—</span>
                    ) : (
                      money(outstanding)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
