import { prisma } from "../db";
import { reverseEntryTx } from "../ledger/post";
import type { TxClient } from "../ledger/txClient";
import type { LockOverride } from "../ledger/periodLock";

export type VoidBillOptions = {
  reason: string;
  reversalDate?: Date;
  lockOverride?: LockOverride;
};

export async function voidBillTx(tx: TxClient, billId: string, options: VoidBillOptions) {
  if (!options.reason.trim()) {
    throw new Error("A reason is required to void a bill.");
  }

  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: { applications: true, journalEntry: true },
  });

  if (!bill) throw new Error(`Bill ${billId} does not exist.`);
  if (bill.status === "VOID") throw new Error(`Bill #${bill.billNumber} is already void.`);
  if (bill.status === "DRAFT") {
    throw new Error(`Bill #${bill.billNumber} is a draft — delete it instead of voiding it.`);
  }
  if (bill.applications.length > 0) {
    throw new Error(
      `Bill #${bill.billNumber} has payments applied. Remove the payment first, ` +
        `or record a supplier credit instead.`,
    );
  }
  if (!bill.journalEntryId || !bill.journalEntry) {
    throw new Error(`Bill #${bill.billNumber} has no journal entry.`);
  }
  if (bill.journalEntry.status === "REVERSED") {
    throw new Error(`Bill #${bill.billNumber} has already been reversed.`);
  }

  const reversal = await reverseEntryTx(
    tx,
    bill.journalEntryId,
    `void: ${options.reason.trim()}`,
    { reversalDate: options.reversalDate, lockOverride: options.lockOverride },
  );

  const voided = await tx.bill.update({
    where: { id: bill.id },
    data: {
      status: "VOID",
      notes: bill.notes
        ? `${bill.notes}\n\nVoided: ${options.reason.trim()}`
        : `Voided: ${options.reason.trim()}`,
    },
    include: { contact: true, lines: true },
  });

  return { bill: voided, reversal };
}

export async function voidBill(billId: string, options: VoidBillOptions) {
  return prisma.$transaction((tx) => voidBillTx(tx, billId, options));
}
