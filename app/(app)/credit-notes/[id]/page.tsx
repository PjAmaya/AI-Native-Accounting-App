import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, FileCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, longDate, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { issueCreditNoteAction, applyCreditAction, refundCreditNoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CreditNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const note = await prisma.creditNote.findUnique({
    where: { id },
    include: {
      contact: true,
      originalInvoice: true,
      lines: { include: { revenueAccount: true, project: true, taxRate: true }, orderBy: { lineNumber: "asc" } },
      journalEntry: { include: { lines: { include: { account: true } } } },
      refundEntry: { include: { lines: true } },
      receivableAccount: true,
      applications: { include: { invoice: true }, orderBy: { appliedAt: "asc" } },
    },
  });
  if (!note) notFound();

  const used = note.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const refunded = note.refundEntry
    ? note.refundEntry.lines.reduce((sum, l) => sum.plus(l.debit.toString()), new Decimal(0))
    : new Decimal(0);
  const available = new Decimal(note.total.toString()).minus(used).minus(refunded);

  const bankAccounts = await prisma.account.findMany({
    where: { parent: { code: "1000" }, isActive: true, isPostable: true },
    orderBy: { code: "asc" },
  });

  const openInvoices =
    note.status === "ISSUED" && available.greaterThan(0)
      ? await prisma.invoice.findMany({
          where: { contactId: note.contactId, status: { in: ["ISSUED", "PAID"] } },
          include: { applications: true, creditApplications: true },
          orderBy: { dueDate: "asc" },
        })
      : [];

  const applicable = openInvoices
    .map((invoice) => {
      const settled = [...invoice.applications, ...invoice.creditApplications].reduce(
        (sum, a) => sum.plus(a.amountApplied.toString()),
        new Decimal(0),
      );
      const mine = note.applications.find((a) => a.invoiceId === invoice.id);
      const outstanding = new Decimal(invoice.total.toString())
        .minus(settled)
        .plus(mine ? new Decimal(mine.amountApplied.toString()) : new Decimal(0));
      return { invoice, outstanding, mine: mine?.amountApplied.toString() ?? "" };
    })
    .filter((r) => r.outstanding.greaterThan(0));

  const issue = issueCreditNoteAction.bind(null, note.id);
  const apply = applyCreditAction.bind(null, note.id);
  const refund = refundCreditNoteAction.bind(null, note.id);

  return (
    <div>
      <Link href="/credit-notes" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Credit notes
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title font-mono">{note.creditNumber}</h1>
            <StatusPill status={note.status} />
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {note.contact.name} · {longDate(note.creditDate)}
            {note.originalInvoice ? ` · credits ${note.originalInvoice.invoiceNumber}` : ""}
          </p>
          <p className="mt-1 text-[13px]">{note.reason}</p>
        </div>

        {note.status === "DRAFT" ? (
          <form action={issue} className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              <FileCheck size={14} strokeWidth={2} aria-hidden />
              Issue credit note
            </button>
          </form>
        ) : null}
      </div>

      {error ? (
        <div className="card mt-5 border-negative bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-negative">{error}</p>
        </div>
      ) : null}

      {note.status === "DRAFT" ? (
        <div className="card mt-5 border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px]">
            This is a draft. It reduces nothing until you issue it.
          </p>
        </div>
      ) : null}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-wash/40">
              <th className="px-5 py-2.5 text-left"><span className="eyebrow">Description</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Account</span></th>
              <th className="px-3 py-2.5 text-left"><span className="eyebrow">Project</span></th>
              <th className="px-5 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {note.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-3 text-[13px]">{line.description}</td>
                <td className="px-3 py-3 text-[12px] text-muted">
                  <span className="font-mono">{line.revenueAccount.code}</span>{" "}
                  {line.revenueAccount.name}
                </td>
                <td className="px-3 py-3 text-[12px] text-muted">{line.project?.code ?? "—"}</td>
                <td className="figure px-5 py-3">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-rule bg-wash/30">
            <tr>
              <td colSpan={3} className="px-5 py-2 text-right text-[13px] text-muted">Subtotal</td>
              <td className="figure px-5 py-2">{money(note.subtotal)}</td>
            </tr>
            {new Decimal(note.taxTotal.toString()).greaterThan(0) ? (
              <tr>
                <td colSpan={3} className="px-5 py-2 text-right text-[13px] text-muted">Tax</td>
                <td className="figure px-5 py-2">{money(note.taxTotal)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={3} className="px-5 py-2.5 text-right text-[13px] font-semibold">Total credit</td>
              <td className="figure px-5 py-2.5 !text-[15px] font-semibold">{money(note.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {note.applications.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Applied to</p>
          <ul className="mt-3 divide-y divide-rule">
            {note.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-[13px]">
                <Link href={`/invoices/${a.invoiceId}`} className="font-mono text-[12px] hover:text-brand">
                  {a.invoice.invoiceNumber}
                </Link>
                <span className="figure">{money(a.amountApplied)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-rule pt-3 text-[13px] font-medium">
            <span>Still available</span>
            <span className="figure !text-[15px]">{money(available)}</span>
          </div>
        </div>
      ) : null}

      {applicable.length > 0 ? (
        <form action={apply} className="card mt-4 overflow-hidden">
          <div className="border-b border-rule px-5 py-3">
            <p className="eyebrow">Apply this credit</p>
            <p className="mt-0.5 text-[13px] text-muted">{money(available)} available</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Invoice</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Due</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Apply</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {applicable.map(({ invoice, outstanding, mine }) => (
                <tr key={invoice.id} className="hover:bg-wash/20">
                  <td className="px-5 py-2.5 font-mono text-[12px]">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-2.5 text-[13px] text-muted">{shortDate(invoice.dueDate)}</td>
                  <td className="figure px-3 py-2.5">{outstanding.toFixed(2)}</td>
                  <td className="px-5 py-2 text-right">
                    <input
                      name={`apply:${invoice.invoiceNumber}`}
                      defaultValue={mine}
                      placeholder={Decimal.min(outstanding, available).toFixed(2)}
                      inputMode="decimal"
                      className="w-32 rounded-md border border-rule bg-surface px-2 py-1.5 text-right font-mono tabular-nums text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end border-t border-rule bg-wash/20 px-5 py-3">
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              Apply credit
            </button>
          </div>
        </form>
      ) : null}

      {note.status !== "DRAFT" ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Settlement</p>
          <div className="mt-2 grid gap-1 text-[13px]">
            <div className="flex justify-between text-muted">
              <span>Total credit</span>
              <span className="figure">{money(note.total)}</span>
            </div>
            {used.greaterThan(0) ? (
              <div className="flex justify-between text-muted">
                <span>Applied to invoices</span>
                <span className="figure">{money(used)}</span>
              </div>
            ) : null}
            {refunded.greaterThan(0) ? (
              <div className="flex justify-between text-muted">
                <span>Refunded{note.refundedAt ? ` · ${shortDate(note.refundedAt)}` : ""}</span>
                <span className="figure">{money(refunded)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-rule pt-1.5 font-medium">
              <span>{available.isZero() ? "Fully settled" : "Still owed to client"}</span>
              <span className="figure !text-[15px]">{money(available)}</span>
            </div>
          </div>

          {available.greaterThan(0) && !note.refundEntryId ? (
            <form action={refund} className="mt-4 border-t border-rule pt-4">
              <p className="eyebrow">Refund by transfer</p>
              <div className="mt-2 grid grid-cols-4 gap-3">
                <input
                  name="amount"
                  defaultValue={available.toFixed(2)}
                  inputMode="decimal"
                  aria-label="Refund amount"
                  className="rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-right font-mono tabular-nums text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <select
                  name="bankAccountCode"
                  aria-label="From account"
                  className="rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  {bankAccounts.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} {a.name}</option>
                  ))}
                </select>
                <input
                  name="refundDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  aria-label="Refund date"
                  className="rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-rule px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-wash/60"
                >
                  Record refund
                </button>
              </div>
              <input
                name="reference"
                placeholder="Transfer reference (optional)"
                className="mt-2 w-full rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </form>
          ) : null}
        </div>
      ) : null}

      {note.journalEntry ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">
            Journal entry #{note.journalEntry.entryNumber} · {note.journalEntry.status}
          </p>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-rule">
              {note.journalEntry.lines.map((line) => (
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
