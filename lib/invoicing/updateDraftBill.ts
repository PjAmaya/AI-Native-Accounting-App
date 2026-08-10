import { prisma } from "../db";
import { createBillTx, type BillDraft } from "./createBill";
import type { TxClient } from "../ledger/txClient";

async function tearDownTx(tx: TxClient, billId: string) {
  const existing = await tx.bill.findUnique({
    where: { id: billId },
    include: { applications: true },
  });

  if (!existing) throw new Error(`Bill ${billId} does not exist.`);
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Bill #${existing.billNumber} is ${existing.status.toLowerCase()} and can no longer be changed. ` +
        `Void it instead.`,
    );
  }
  if (existing.applications.length > 0) {
    throw new Error(`Bill #${existing.billNumber} has payments applied and cannot be changed.`);
  }

  const oldEntryId = existing.journalEntryId;
  const billNumber = existing.billNumber;

  await tx.bill.update({ where: { id: billId }, data: { journalEntryId: null } });
  await tx.bill.delete({ where: { id: billId } });
  if (oldEntryId) {
    await tx.journalEntry.delete({ where: { id: oldEntryId } });
  }

  return { billNumber };
}

export async function updateDraftBill(billId: string, draft: BillDraft) {
  return prisma.$transaction(async (tx) => {
    const { billNumber } = await tearDownTx(tx, billId);
    return createBillTx(tx, { ...draft, forceBillNumber: billNumber });
  });
}

export async function deleteDraftBill(billId: string) {
  return prisma.$transaction(async (tx) => {
    await tearDownTx(tx, billId);
  });
}
