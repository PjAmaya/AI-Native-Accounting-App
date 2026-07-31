import { prisma } from "../db";
import { postDraftTx, type TxClient } from "../ledger/post";

export async function issueInvoiceTx(tx: TxClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, contact: true },
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} does not exist.`);
  if (invoice.status === "ISSUED") throw new Error(`Invoice ${invoice.invoiceNumber} is already issued.`);
  if (invoice.status === "PAID") throw new Error(`Invoice ${invoice.invoiceNumber} is already paid.`);
  if (invoice.status === "VOID") throw new Error(`Invoice ${invoice.invoiceNumber} is void.`);
  if (!invoice.journalEntryId) {
    throw new Error(`Invoice ${invoice.invoiceNumber} has no journal entry and cannot be issued.`);
  }
  if (invoice.lines.length === 0) {
    throw new Error(`Invoice ${invoice.invoiceNumber} has no lines.`);
  }

  const entry = await postDraftTx(tx, invoice.journalEntryId);

  const arDebit = entry.lines.reduce(
    (sum, line) => sum.plus(line.debit),
    entry.lines[0].debit.minus(entry.lines[0].debit),
  );
  if (!arDebit.equals(invoice.total)) {
    throw new Error(
      `Invoice ${invoice.invoiceNumber} total ${invoice.total.toString()} does not match its journal entry total ${arDebit.toString()}.`,
    );
  }

  return tx.invoice.update({
    where: { id: invoice.id },
    data: { status: "ISSUED", issuedAt: new Date() },
    include: { lines: true, contact: true, journalEntry: { include: { lines: true } } },
  });
}

export async function issueInvoice(invoiceId: string) {
  return prisma.$transaction((tx) => issueInvoiceTx(tx, invoiceId));
}
