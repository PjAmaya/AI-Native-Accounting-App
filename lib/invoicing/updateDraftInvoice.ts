import { prisma } from "../db";
import { createInvoiceTx } from "./createInvoice";
import type { InvoiceDraft } from "./createInvoice";
import type { TxClient } from "../ledger/txClient";

async function tearDownTx(tx: TxClient, invoiceId: string) {
  const existing = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { applications: true },
  });

  if (!existing) throw new Error(`Invoice ${invoiceId} does not exist.`);
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Invoice ${existing.invoiceNumber} is ${existing.status.toLowerCase()} and can no longer be changed. ` +
        `Issue a credit note or void it instead.`,
    );
  }
  if (existing.applications.length > 0) {
    throw new Error(`Invoice ${existing.invoiceNumber} has payments applied and cannot be changed.`);
  }

  const oldEntryId = existing.journalEntryId;
  const invoiceNumber = existing.invoiceNumber;

  await tx.invoice.update({ where: { id: invoiceId }, data: { journalEntryId: null } });
  await tx.invoice.delete({ where: { id: invoiceId } });
  if (oldEntryId) {
    await tx.journalEntry.delete({ where: { id: oldEntryId } });
  }

  return { invoiceNumber };
}

export async function updateDraftInvoice(invoiceId: string, draft: InvoiceDraft) {
  return prisma.$transaction(async (tx) => {
    const { invoiceNumber } = await tearDownTx(tx, invoiceId);
    return createInvoiceTx(tx, { ...draft, forceInvoiceNumber: invoiceNumber });
  });
}

export async function deleteDraftInvoice(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await tearDownTx(tx, invoiceId);
  });
}
