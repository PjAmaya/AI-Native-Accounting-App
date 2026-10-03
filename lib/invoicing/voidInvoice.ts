import { prisma } from "../db";
import { reverseEntryTx } from "../ledger/post";
import { creditNoteBalanceTx } from "./creditNoteOps";
import type { TxClient } from "../ledger/txClient";
import type { LockOverride } from "../ledger/periodLock";

export type VoidOptions = {
  reason: string;
  reversalDate?: Date;
  lockOverride?: LockOverride;
};

export async function voidInvoiceTx(
  tx: TxClient,
  invoiceId: string,
  options: VoidOptions,
) {
  if (!options.reason.trim()) {
    throw new Error("A reason is required to void an invoice.");
  }

  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { applications: true, creditApplications: true, journalEntry: true },
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} does not exist.`);
  if (invoice.status === "VOID") throw new Error(`Invoice ${invoice.invoiceNumber} is already void.`);
  if (invoice.status === "DRAFT") {
    throw new Error(`Invoice ${invoice.invoiceNumber} is a draft — delete it instead of voiding it.`);
  }
  if (invoice.applications.length > 0) {
    throw new Error(
      `Invoice ${invoice.invoiceNumber} has payments applied. ` +
        `Remove or refund the payment first, or issue a credit note instead.`,
    );
  }
  if (!invoice.journalEntryId || !invoice.journalEntry) {
    throw new Error(`Invoice ${invoice.invoiceNumber} has no journal entry.`);
  }
  if (invoice.journalEntry.status === "REVERSED") {
    throw new Error(`Invoice ${invoice.invoiceNumber} has already been reversed.`);
  }

  const reversal = await reverseEntryTx(
    tx,
    invoice.journalEntryId,
    `void: ${options.reason.trim()}`,
    { reversalDate: options.reversalDate, lockOverride: options.lockOverride },
  );

  // Release any applied credit back to its credit note so it can be reused.
  if (invoice.creditApplications.length > 0) {
    await tx.creditApplication.deleteMany({ where: { invoiceId: invoice.id } });
    for (const creditNoteId of new Set(invoice.creditApplications.map((a) => a.creditNoteId))) {
      const { available } = await creditNoteBalanceTx(tx, creditNoteId);
      if (available.greaterThan(0)) {
        await tx.creditNote.update({ where: { id: creditNoteId }, data: { status: "ISSUED" } });
      }
    }
  }

  const voided = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "VOID",
      notes: invoice.notes
        ? `${invoice.notes}\n\nVoided: ${options.reason.trim()}`
        : `Voided: ${options.reason.trim()}`,
    },
    include: { contact: true, lines: true },
  });

  return { invoice: voided, reversal };
}

export async function voidInvoice(invoiceId: string, options: VoidOptions) {
  return prisma.$transaction((tx) => voidInvoiceTx(tx, invoiceId, options));
}
