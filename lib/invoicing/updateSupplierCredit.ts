import { prisma } from "../db";
import { createSupplierCreditTx, type SupplierCreditDraft } from "./supplierCredit";
import { reverseEntryTx } from "../ledger/post";
import { syncBillStatusTx } from "./documentStatus";
import type { TxClient } from "../ledger/txClient";
import type { LockOverride } from "../ledger/periodLock";

async function tearDownTx(tx: TxClient, creditId: string) {
  const existing = await tx.supplierCredit.findUnique({
    where: { id: creditId },
    include: { applications: true },
  });

  if (!existing) throw new Error(`Supplier credit ${creditId} does not exist.`);
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Supplier credit #${existing.creditNumber} is ${existing.status.toLowerCase()} and can no longer be changed. Void it instead.`,
    );
  }
  if (existing.applications.length > 0) {
    throw new Error(`Supplier credit #${existing.creditNumber} has been applied and cannot be changed.`);
  }

  const oldEntryId = existing.journalEntryId;
  const creditNumber = existing.creditNumber;

  await tx.supplierCredit.update({ where: { id: creditId }, data: { journalEntryId: null } });
  await tx.supplierCredit.delete({ where: { id: creditId } });
  if (oldEntryId) {
    await tx.journalEntry.delete({ where: { id: oldEntryId } });
  }

  return { creditNumber };
}

export async function updateDraftSupplierCredit(creditId: string, draft: SupplierCreditDraft) {
  return prisma.$transaction(async (tx) => {
    const { creditNumber } = await tearDownTx(tx, creditId);
    return createSupplierCreditTx(tx, { ...draft, forceCreditNumber: creditNumber });
  });
}

export async function deleteDraftSupplierCredit(creditId: string) {
  return prisma.$transaction(async (tx) => {
    await tearDownTx(tx, creditId);
  });
}

export type VoidSupplierCreditOptions = {
  reason: string;
  reversalDate?: Date;
  lockOverride?: LockOverride;
};

export async function voidSupplierCreditTx(
  tx: TxClient,
  creditId: string,
  options: VoidSupplierCreditOptions,
) {
  if (!options.reason.trim()) throw new Error("A reason is required to void a supplier credit.");

  const credit = await tx.supplierCredit.findUnique({
    where: { id: creditId },
    include: { applications: true, journalEntry: true },
  });

  if (!credit) throw new Error(`Supplier credit ${creditId} does not exist.`);
  if (credit.status === "VOID") throw new Error(`Supplier credit #${credit.creditNumber} is already void.`);
  if (credit.status === "DRAFT") {
    throw new Error(`Supplier credit #${credit.creditNumber} is a draft — delete it instead.`);
  }
  if (credit.refundEntryId) {
    throw new Error(
      `Supplier credit #${credit.creditNumber} has been refunded and cannot be voided.`,
    );
  }
  if (!credit.journalEntryId || !credit.journalEntry) {
    throw new Error(`Supplier credit #${credit.creditNumber} has no journal entry.`);
  }
  if (credit.journalEntry.status === "REVERSED") {
    throw new Error(`Supplier credit #${credit.creditNumber} has already been reversed.`);
  }

  const billIds = credit.applications.map((a) => a.billId);

  await tx.supplierCreditApplication.deleteMany({ where: { supplierCreditId: credit.id } });

  const reversal = await reverseEntryTx(
    tx,
    credit.journalEntryId,
    `void: ${options.reason.trim()}`,
    { reversalDate: options.reversalDate, lockOverride: options.lockOverride },
  );

  await syncBillStatusTx(tx, billIds);

  const voided = await tx.supplierCredit.update({
    where: { id: credit.id },
    data: {
      status: "VOID",
      notes: credit.notes
        ? `${credit.notes}\n\nVoided: ${options.reason.trim()}`
        : `Voided: ${options.reason.trim()}`,
    },
    include: { contact: true, lines: true },
  });

  return { credit: voided, reversal };
}

export async function voidSupplierCredit(creditId: string, options: VoidSupplierCreditOptions) {
  return prisma.$transaction((tx) => voidSupplierCreditTx(tx, creditId, options));
}
