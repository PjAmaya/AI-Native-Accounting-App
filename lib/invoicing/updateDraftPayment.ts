import { prisma } from "../db";
import { recordPaymentTx, type PaymentDraft } from "./recordPayment";
import { syncInvoiceStatusTx, syncBillStatusTx } from "./documentStatus";
import type { TxClient } from "../ledger/txClient";

async function tearDownTx(tx: TxClient, paymentId: string) {
  const existing = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { applications: true, billApplications: true, journalEntry: true },
  });

  if (!existing) throw new Error(`Payment ${paymentId} does not exist.`);

  if (existing.journalEntry && existing.journalEntry.status !== "DRAFT") {
    throw new Error(
      `Payment #${existing.paymentNumber} is posted and can no longer be edited. ` +
        `Reverse its journal entry instead.`,
    );
  }

  const invoiceIds = existing.applications.map((a) => a.invoiceId);
  const billIds = existing.billApplications.map((a) => a.billId);
  const journalEntryId = existing.journalEntryId;
  const paymentNumber = existing.paymentNumber;

  await tx.payment.update({ where: { id: paymentId }, data: { journalEntryId: null } });
  await tx.payment.delete({ where: { id: paymentId } });
  if (journalEntryId) {
    await tx.journalEntry.delete({ where: { id: journalEntryId } });
  }

  await syncInvoiceStatusTx(tx, invoiceIds);
  await syncBillStatusTx(tx, billIds);

  return { paymentNumber };
}

export async function updateDraftPayment(paymentId: string, draft: PaymentDraft) {
  return prisma.$transaction(async (tx) => {
    const { paymentNumber } = await tearDownTx(tx, paymentId);
    return recordPaymentTx(tx, { ...draft, forcePaymentNumber: paymentNumber });
  });
}

export async function deleteDraftPayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    await tearDownTx(tx, paymentId);
  });
}
