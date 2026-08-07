import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, Download, FileCheck, Pencil, Trash2, FileMinus, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, longDate, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { issueInvoiceAction, deleteInvoiceAction } from "../actions";
import { VoidInvoice } from "@/components/ui/VoidInvoice";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voidError?: string }>;
}) {
  const { id } = await params;
  const { voidError } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contact: true,
      project: true,
      lines: { include: { project: true, taxRate: true }, orderBy: { lineNumber: "asc" } },
      journalEntry: { include: { lines: { include: { account: true } } } },
      applications: { include: { payment: true }, orderBy: { appliedAt: "asc" } },
      creditApplications: {
        include: { creditNote: true },
        orderBy: { appliedAt: "asc" },
      },
    },
  });
  if (!invoice) notFound();

  const paid = invoice.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const credited = invoice.creditApplications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const applied = paid.plus(credited);
  const outstanding =
    invoice.status === "VOID"
      ? new Decimal(0)
      : new Decimal(invoice.total.toString()).minus(applied);
  const issue = issueInvoiceAction.bind(null, invoice.id);
  const remove = deleteInvoiceAction.bind(null, invoice.id);

  return (
    <div>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Invoices
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title font-mono">{invoice.invoiceNumber}</h1>
            <StatusPill status={invoice.status} />
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {invoice.contact.name} · issued {longDate(invoice.invoiceDate)} · due{" "}
            {longDate(invoice.dueDate)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {invoice.pdfPath ? (
            <a
              href={`/invoices/${invoice.id}/pdf`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
            >
              <Download size={14} strokeWidth={2} aria-hidden />
              PDF
            </a>
          ) : null}
          {invoice.status === "DRAFT" ? (
            <Link
              href={`/invoices/${invoice.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
            >
              <Pencil size={14} strokeWidth={2} aria-hidden />
              Edit
            </Link>
          ) : null}
          {invoice.status === "DRAFT" ? (
            <form action={remove}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden />
                Delete
              </button>
            </form>
          ) : null}
          {invoice.status === "ISSUED" && outstanding.greaterThan(0) ? (
            <Link
              href={`/payments/new?invoice=${invoice.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              <Wallet size={14} strokeWidth={2} aria-hidden />
              Record payment
            </Link>
          ) : null}
          {(invoice.status === "ISSUED" || invoice.status === "PAID") ? (
            <Link
              href={`/credit-notes/new?invoice=${invoice.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
            >
              <FileMinus size={14} strokeWidth={2} aria-hidden />
              Credit note
            </Link>
          ) : null}
          {invoice.status === "ISSUED" && invoice.applications.length === 0 ? (
            <VoidInvoice invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
          ) : null}
          {invoice.status === "DRAFT" ? (
            <form action={issue}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
              >
                <FileCheck size={14} strokeWidth={2} aria-hidden />
                Issue invoice
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {voidError ? (
        <div className="card mt-5 border-negative bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-negative">{voidError}</p>
        </div>
      ) : null}

      {invoice.status === "VOID" ? (
        <div className="card mt-5 border-rule bg-wash/50 px-5 py-3.5">
          <p className="text-[13px] text-muted">
            This invoice is void. Its journal entry has been reversed, so it appears in no report.
            The number stays used and the record stays on file.
          </p>
        </div>
      ) : null}

      {invoice.status === "DRAFT" ? (
        <div className="card mt-5 border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-ink">
            This is a draft. It does not appear in any report until you issue it, which posts the
            journal entry and freezes the PDF.
          </p>
        </div>
      ) : null}

      <div className="card mt-5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-wash/40">
              <th className="px-5 py-2.5 text-left"><span className="eyebrow">Description</span></th>
              <th className="px-5 py-2.5 text-left"><span className="eyebrow">Project</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Qty</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Rate</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-3 text-[13px]">{line.description}</td>
                <td className="px-5 py-3 text-[12px] text-muted">{line.project?.code ?? "—"}</td>
                <td className="figure px-5 py-3">{line.quantity?.toString() ?? "—"}</td>
                <td className="figure px-5 py-3">
                  {line.unitRate ? money(line.unitRate) : "—"}
                </td>
                <td className="figure px-5 py-3">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-rule bg-wash/30">
            <tr>
              <td colSpan={4} className="px-5 py-2 text-right text-[13px] text-muted">Subtotal</td>
              <td className="figure px-5 py-2">{money(invoice.subtotal)}</td>
            </tr>
            {new Decimal(invoice.taxTotal.toString()).greaterThan(0) ? (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-[13px] text-muted">Tax</td>
                <td className="figure px-5 py-2">{money(invoice.taxTotal)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={4} className="px-5 py-2.5 text-right text-[13px] font-semibold">Total</td>
              <td className="figure px-5 py-2.5 !text-[15px] font-semibold">{money(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.applications.length > 0 || invoice.creditApplications.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Settled by</p>
          <ul className="mt-3 divide-y divide-rule">
            {invoice.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <Link
                  href={`/payments/${a.payment.id}/edit`}
                  className="text-muted hover:text-brand"
                >
                  Payment #{a.payment.paymentNumber} · {shortDate(a.payment.paymentDate)}
                </Link>
                <span className="figure">{money(a.amountApplied)}</span>
              </li>
            ))}
            {invoice.creditApplications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <Link
                  href={`/credit-notes/${a.creditNoteId}`}
                  className="flex items-center gap-2 text-muted hover:text-brand"
                >
                  <span className="rounded-full bg-tint-amber px-2 py-0.5 text-[11px] font-medium text-icon-amber">
                    Credit
                  </span>
                  <span className="font-mono text-[12px]">{a.creditNote.creditNumber}</span>
                  <span>· {shortDate(a.creditNote.creditDate)}</span>
                </Link>
                <span className="figure">{money(a.amountApplied)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1 border-t border-rule pt-3 text-[13px]">
            {credited.greaterThan(0) ? (
              <>
                <div className="flex items-center justify-between text-muted">
                  <span>Paid</span>
                  <span className="figure">{money(paid)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Credited</span>
                  <span className="figure">{money(credited)}</span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between font-medium">
              <span>Outstanding</span>
              <span className="figure !text-[15px]">{money(outstanding)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {invoice.journalEntry ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">
            Journal entry #{invoice.journalEntry.entryNumber} · {invoice.journalEntry.status}
          </p>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-rule">
              {invoice.journalEntry.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 text-[13px]">
                    <span className="font-mono text-[12px] text-muted">{line.account.code}</span>{" "}
                    {line.account.name}
                  </td>
                  <td className="figure py-2 w-32">
                    {new Decimal(line.debit.toString()).isZero() ? "" : money(line.debit)}
                  </td>
                  <td className="figure py-2 w-32">
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
