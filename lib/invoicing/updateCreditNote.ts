import { prisma } from "../db";
import { createCreditNoteTx, type CreditNoteDraft } from "./createCreditNote";
import type { TxClient } from "../ledger/txClient";

async function tearDownTx(tx: TxClient, creditNoteId: string) {
  const existing = await tx.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { applications: true },
  });

  if (!existing) throw new Error(`Credit note ${creditNoteId} does not exist.`);
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Credit note ${existing.creditNumber} is ${existing.status.toLowerCase()} and can no longer be changed.`,
    );
  }
  if (existing.applications.length > 0) {
    throw new Error(`Credit note ${existing.creditNumber} has been applied and cannot be changed.`);
  }

  const oldEntryId = existing.journalEntryId;
  const creditNumber = existing.creditNumber;

  await tx.creditNote.update({ where: { id: creditNoteId }, data: { journalEntryId: null } });
  await tx.creditNote.delete({ where: { id: creditNoteId } });
  if (oldEntryId) {
    await tx.journalEntry.delete({ where: { id: oldEntryId } });
  }

  return { creditNumber };
}

export async function updateDraftCreditNote(creditNoteId: string, draft: CreditNoteDraft) {
  return prisma.$transaction(async (tx) => {
    const { creditNumber } = await tearDownTx(tx, creditNoteId);
    return createCreditNoteTx(tx, { ...draft, forceCreditNumber: creditNumber });
  });
}

export async function deleteDraftCreditNote(creditNoteId: string) {
  return prisma.$transaction(async (tx) => {
    await tearDownTx(tx, creditNoteId);
  });
}
