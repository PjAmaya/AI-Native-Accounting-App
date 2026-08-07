import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, CheckCircle2, TriangleAlert, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, longDate, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { approveBillAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      contact: true,
      lines: {
        include: { expenseAccount: true, project: true, taxRate: true },
        orderBy: { lineNumber: "asc" },
      },
      journalEntry: { include: { lines: { include: { account: true } } } },
      applications: { include: { payment: true }, orderBy: { appliedAt: "asc" } },
    },
  });
  if (!bill) notFound();

  const applied = bill.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const outstanding = new Decimal(bill.total.toString()).minus(applied);
  const approve = approveBillAction.bind(null, bill.id);

  return (
    <div>
      <Link href="/bills" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Bills
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title font-mono">Bill #{bill.billNumber}</h1>
            <StatusPill status={bill.status} />
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {bill.contact.name} · their invoice{" "}
            <span className="font-mono">{bill.supplierInvoiceNumber}</span> · dated{" "}
            {longDate(bill.billDate)} · due {longDate(bill.dueDate)}
          </p>
        </div>

        {bill.status === "APPROVED" && outstanding.greaterThan(0) ? (
          <Link
            href={`/payments/new?bill=${bill.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
          >
            <Wallet size={14} strokeWidth={2} aria-hidden />
            Record payment
          </Link>
        ) : null}
        {bill.status === "DRAFT" ? (
          <form action={approve} className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
              Approve for payment
            </button>
          </form>
        ) : null}
      </div>

      {bill.status === "DRAFT" ? (
        <div className="card mt-5 border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px]">
            Not yet approved. It does not appear in any report or in payables until you approve it.
          </p>
        </div>
      ) : null}

      {bill.warnings.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow flex items-center gap-1.5 !text-icon-amber">
            <TriangleAlert size={13} strokeWidth={2.2} aria-hidden />
            Flagged at entry
          </p>
          <ul className="mt-2 grid gap-1.5">
            {bill.warnings.map((w, i) => (
              <li key={i} className="text-[13px] leading-snug text-muted">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-wash/40">
              <th className="px-5 py-2.5 text-left"><span className="eyebrow">Description</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Account</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Project</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Tax</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {bill.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-3 text-[13px]">{line.description}</td>
                <td className="px-3 py-3 text-[12px] text-muted">
                  <span className="font-mono">{line.expenseAccount.code}</span>{" "}
                  {line.expenseAccount.name}
                </td>
                <td className="px-3 py-3 text-[12px] text-muted">{line.project?.code ?? "—"}</td>
                <td className="px-3 py-3 text-[12px] text-muted">{line.taxRate?.code ?? "—"}</td>
                <td className="figure px-5 py-3">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-rule bg-wash/30">
            <tr>
              <td colSpan={4} className="px-5 py-2 text-right text-[13px] text-muted">Subtotal</td>
              <td className="figure px-5 py-2">{money(bill.subtotal)}</td>
            </tr>
            {new Decimal(bill.taxTotal.toString()).greaterThan(0) ? (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-[13px] text-muted">Tax</td>
                <td className="figure px-5 py-2">{money(bill.taxTotal)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={4} className="px-5 py-2.5 text-right text-[13px] font-semibold">Total</td>
              <td className="figure px-5 py-2.5 !text-[15px] font-semibold">{money(bill.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {bill.applications.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Payments</p>
          <ul className="mt-3 divide-y divide-rule">
            {bill.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-muted">
                  Payment #{a.payment.paymentNumber} · {shortDate(a.payment.paymentDate)}
                </span>
                <span className="figure">{money(a.amountApplied)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-rule pt-3 text-[13px] font-medium">
            <span>Outstanding</span>
            <span className="figure !text-[15px]">{money(outstanding)}</span>
          </div>
        </div>
      ) : null}

      {bill.journalEntry ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">
            Journal entry #{bill.journalEntry.entryNumber} · {bill.journalEntry.status}
          </p>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-rule">
              {bill.journalEntry.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 text-[13px]">
                    <span className="font-mono text-[12px] text-muted">{line.account.code}</span>{" "}
                    {line.account.name}
                  </td>
                  <td className="figure w-32 py-2">
                    {new Decimal(line.debit.toString()).isZero() ? "" : money(line.debit)}
                  </td>
                  <td className="figure w-32 py-2">
                    {new Decimal(line.credit.toString()).isZero() ? "" : money(line.credit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
