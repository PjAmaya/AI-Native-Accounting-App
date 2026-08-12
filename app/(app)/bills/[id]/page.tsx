import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, CheckCircle2, TriangleAlert, Wallet, Pencil, Trash2, FileMinus } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, longDate, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { approveBillAction, deleteBillAction } from "../actions";
import { VoidBill } from "@/components/ui/VoidBill";

export const dynamic = "force-dynamic";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voidError?: string }>;
}) {
  const { id } = await params;
  const { voidError } = await searchParams;

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
      supplierCreditApplications: {
        include: { supplierCredit: true },
        orderBy: { appliedAt: "asc" },
      },
      supplierCredits: { orderBy: { creditNumber: "asc" } },
    },
  });
  if (!bill) notFound();

  const applied = [...bill.applications, ...bill.supplierCreditApplications].reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const outstanding =
    bill.status === "VOID" || bill.status === "DRAFT"
      ? new Decimal(0)
      : new Decimal(bill.total.toString()).minus(applied);
  const approve = approveBillAction.bind(null, bill.id);
  const remove = deleteBillAction.bind(null, bill.id);

  const derived =
    bill.status === "APPROVED"
      ? [
          ...(applied.greaterThan(0) && outstanding.greaterThan(0) ? ["PARTIAL"] : []),
          ...(outstanding.greaterThan(0) && bill.dueDate < new Date() ? ["OVERDUE"] : []),
        ]
      : [];
  const statuses = derived.length > 0 ? derived : [bill.status];

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
            {statuses.map((code) => (
              <StatusPill key={code} status={code} />
            ))}
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {bill.contact.name} · their invoice{" "}
            <span className="font-mono">{bill.supplierInvoiceNumber}</span> · dated{" "}
            {longDate(bill.billDate)} · due {longDate(bill.dueDate)}
          </p>
        </div>

        {bill.status === "APPROVED" || bill.status === "PAID" ? (
          <Link
            href={`/supplier-credits/new?bill=${bill.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
          >
            <FileMinus size={14} strokeWidth={2} aria-hidden />
            Supplier credit
          </Link>
        ) : null}
        {bill.status === "APPROVED" && bill.applications.length === 0 ? (
          <VoidBill billId={bill.id} billNumber={bill.billNumber} />
        ) : null}
        {bill.status === "APPROVED" && bill.applications.length > 0 ? (
          <p className="max-w-44 text-[11px] leading-snug text-faint">
            Cannot be voided — a payment has been applied.
          </p>
        ) : null}
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
          <Link
            href={`/bills/${bill.id}/edit`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
            Edit
          </Link>
        ) : null}
        {bill.status === "DRAFT" ? (
          <form action={remove} className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden />
              Delete
            </button>
          </form>
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

      {voidError ? (
        <div className="card mt-5 border-negative bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-negative">{voidError}</p>
        </div>
      ) : null}

      {bill.status === "VOID" ? (
        <div className="card mt-5 border-rule bg-wash/50 px-5 py-3.5">
          <p className="text-[13px] text-muted">
            This bill is void. Its journal entry has been reversed, so it appears in no report.
          </p>
        </div>
      ) : null}

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

      {bill.supplierCredits.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Supplier credits against this bill</p>
          <ul className="mt-3 divide-y divide-rule">
            {bill.supplierCredits.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <Link
                  href={`/supplier-credits/${c.id}`}
                  className="flex items-center gap-2 hover:text-brand"
                >
                  <span className="font-mono text-[12px] font-medium">#{c.creditNumber}</span>
                  <StatusPill status={c.status} />
                  <span className="text-muted">{c.reason}</span>
                </Link>
                <span className="figure">{money(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bill.applications.length > 0 || bill.supplierCreditApplications.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Settled by</p>
          <ul className="mt-3 divide-y divide-rule">
            {bill.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-muted">
                  Payment #{a.payment.paymentNumber} · {shortDate(a.payment.paymentDate)}
                </span>
                <span className="figure">{money(a.amountApplied)}</span>
              </li>
            ))}
            {bill.supplierCreditApplications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <Link
                  href={`/supplier-credits/${a.supplierCreditId}`}
                  className="flex items-center gap-2 text-muted hover:text-brand"
                >
                  <span className="rounded-full bg-tint-violet px-2 py-0.5 text-[11px] font-medium text-icon-violet">
                    Credit
                  </span>
                  <span className="font-mono text-[12px]">#{a.supplierCredit.creditNumber}</span>
                </Link>
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
