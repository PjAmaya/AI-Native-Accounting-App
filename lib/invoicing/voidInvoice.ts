import { prisma } from "../db";
import { reverseEntryTx } from "../ledger/post";
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
    include: { applications: true, journalEntry: true },
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
