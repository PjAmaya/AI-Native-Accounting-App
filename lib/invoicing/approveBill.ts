import { prisma } from "../db";
import { postDraftTx, type TxClient } from "../ledger/post";

export async function approveBillTx(tx: TxClient, billId: string) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: { lines: true, contact: true },
  });

  if (!bill) throw new Error(`Bill ${billId} does not exist.`);
  if (bill.status === "APPROVED") throw new Error(`Bill #${bill.billNumber} is already approved.`);
  if (bill.status === "PAID") throw new Error(`Bill #${bill.billNumber} is already paid.`);
  if (bill.status === "VOID") throw new Error(`Bill #${bill.billNumber} is void.`);
  if (!bill.journalEntryId) {
    throw new Error(`Bill #${bill.billNumber} has no journal entry and cannot be approved.`);
  }
  if (bill.lines.length === 0) {
    throw new Error(`Bill #${bill.billNumber} has no lines.`);
  }

  const entry = await postDraftTx(tx, bill.journalEntryId);

  const apCredit = entry.lines.reduce(
    (sum, line) => sum.plus(line.credit),
    entry.lines[0].credit.minus(entry.lines[0].credit),
  );
  if (!apCredit.equals(bill.total)) {
    throw new Error(
      `Bill #${bill.billNumber} total ${bill.total.toString()} does not match its journal entry credits ${apCredit.toString()}.`,
    );
  }

  return tx.bill.update({
    where: { id: bill.id },
    data: { status: "APPROVED", approvedAt: new Date() },
    include: { lines: true, contact: true, journalEntry: { include: { lines: true } } },
  });
}

export async function approveBill(billId: string) {
  return prisma.$transaction((tx) => approveBillTx(tx, billId));
}
