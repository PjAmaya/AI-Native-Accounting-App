import Decimal from "decimal.js";
import { prisma } from "../db";
import { postDraftTx, createDraftEntryTx } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";
import { syncInvoiceStatusTx } from "./documentStatus";
import { assertNotOverApplied } from "./applications";
import type { TxClient } from "../ledger/txClient";

export async function issueCreditNoteTx(tx: TxClient, creditNoteId: string) {
  const note = await tx.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { lines: true, journalEntry: true },
  });

  if (!note) throw new Error(`Credit note ${creditNoteId} does not exist.`);
  if (note.status !== "DRAFT") {
    throw new Error(`Credit note ${note.creditNumber} is ${note.status.toLowerCase()}.`);
  }
  if (!note.journalEntryId) throw new Error(`Credit note ${note.creditNumber} has no journal entry.`);
  if (note.lines.length === 0) throw new Error(`Credit note ${note.creditNumber} has no lines.`);

  const entry = await postDraftTx(tx, note.journalEntryId);

  const credited = entry.lines.reduce(
    (sum, line) => sum.plus(line.credit),
    entry.lines[0].credit.minus(entry.lines[0].credit),
  );
  if (!credited.equals(note.total)) {
    throw new Error(
      `Credit note ${note.creditNumber} total ${note.total.toString()} does not match its journal entry credits ${credited.toString()}.`,
    );
  }

  return tx.creditNote.update({
    where: { id: note.id },
    data: { status: "ISSUED", issuedAt: new Date() },
    include: { lines: true, contact: true, originalInvoice: true },
  });
}

export async function issueCreditNote(creditNoteId: string) {
  return prisma.$transaction((tx) => issueCreditNoteTx(tx, creditNoteId));
}

export type CreditApplicationDraft = {
  invoiceNumber: string;
  amount: string;
};

export async function applyCreditTx(
  tx: TxClient,
  creditNoteId: string,
  applications: CreditApplicationDraft[],
) {
  const note = await tx.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { applications: true },
  });

  if (!note) throw new Error(`Credit note ${creditNoteId} does not exist.`);
  if (note.status === "DRAFT") {
    throw new Error(`Credit note ${note.creditNumber} must be issued before it can be applied.`);
  }
  if (note.status === "VOID") throw new Error(`Credit note ${note.creditNumber} is void.`);

  const alreadyUsed = note.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const available = new Decimal(note.total.toString()).minus(alreadyUsed);
  void available;

  const numbers = applications.map((a) => a.invoiceNumber);
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("The same invoice appears twice.");
  }

  const invoices = await tx.invoice.findMany({
    where: { invoiceNumber: { in: numbers } },
    include: { applications: true, creditApplications: true },
  });
  const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  let totalApplied = new Decimal(0);

  for (const application of applications) {
    const invoice = byNumber.get(application.invoiceNumber);
    if (!invoice) throw new Error(`Invoice ${application.invoiceNumber} does not exist.`);
    if (invoice.contactId !== note.contactId) {
      throw new Error(`Invoice ${invoice.invoiceNumber} belongs to a different client.`);
    }
    if (invoice.status === "DRAFT" || invoice.status === "VOID") {
      throw new Error(`Invoice ${invoice.invoiceNumber} is ${invoice.status.toLowerCase()}.`);
    }

    const settled = invoice.applications
      .reduce((sum, a) => sum.plus(a.amountApplied.toString()), new Decimal(0))
      .plus(
        invoice.creditApplications.reduce(
          (sum, a) => sum.plus(a.amountApplied.toString()),
          new Decimal(0),
        ),
      );

    assertNotOverApplied({
      label: invoice.invoiceNumber,
      total: new Decimal(invoice.total.toString()),
      alreadyApplied: settled,
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);
  }

  if (totalApplied.greaterThan(available)) {
    throw new Error(
      `Cannot apply ${totalApplied.toFixed(2)} — only ${available.toFixed(2)} is left on this credit note.`,
    );
  }

  for (const application of applications) {
    const invoice = byNumber.get(application.invoiceNumber)!;
    await tx.creditApplication.upsert({
      where: {
        creditNoteId_invoiceId: { creditNoteId: note.id, invoiceId: invoice.id },
      },
      create: {
        creditNoteId: note.id,
        invoiceId: invoice.id,
        amountApplied: new Decimal(application.amount).toFixed(2),
      },
      update: {
        amountApplied: new Decimal(application.amount).toFixed(2),
      },
    });
  }

  await syncInvoiceStatusTx(tx, applications.map((a) => byNumber.get(a.invoiceNumber)!.id));

  const refundedSoFar = note.refundEntryId
    ? (await tx.journalEntry.findUnique({
        where: { id: note.refundEntryId },
        include: { lines: true },
      }))?.lines.reduce((sum, l) => sum.plus(l.debit.toString()), new Decimal(0)) ??
      new Decimal(0)
    : new Decimal(0);

  const usedNow = alreadyUsed.plus(totalApplied).plus(refundedSoFar);
  const fullyUsed = usedNow.greaterThanOrEqualTo(new Decimal(note.total.toString()));

  return tx.creditNote.update({
    where: { id: note.id },
    data: { status: fullyUsed ? "APPLIED" : "ISSUED" },
    include: { applications: { include: { invoice: true } }, contact: true },
  });
}

export async function applyCredit(creditNoteId: string, applications: CreditApplicationDraft[]) {
  return prisma.$transaction((tx) => applyCreditTx(tx, creditNoteId, applications));
}

export async function creditNoteBalanceTx(tx: TxClient, creditNoteId: string) {
  const note = await tx.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { applications: true, refundEntry: { include: { lines: true } } },
  });
  if (!note) throw new Error(`Credit note ${creditNoteId} does not exist.`);

  const total = new Decimal(note.total.toString());
  const applied = note.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const refunded = note.refundEntry
    ? note.refundEntry.lines.reduce(
        (sum, l) => sum.plus(l.debit.toString()),
        new Decimal(0),
      )
    : new Decimal(0);

  return { note, total, applied, refunded, available: total.minus(applied).minus(refunded) };
}

export async function refundCreditNoteTx(
  tx: TxClient,
  creditNoteId: string,
  input: { amount: string; bankAccountCode: string; refundDate: Date; reference?: string },
) {
  const { note, applied, refunded, available } = await creditNoteBalanceTx(tx, creditNoteId);

  if (note.status === "DRAFT") {
    throw new Error(`Credit note ${note.creditNumber} must be issued before it can be refunded.`);
  }
  if (note.status === "VOID") throw new Error(`Credit note ${note.creditNumber} is void.`);
  if (note.refundEntryId) {
    throw new Error(`Credit note ${note.creditNumber} has already been refunded.`);
  }

  const amount = new Decimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw new Error("The refund must be greater than zero.");
  if (amount.greaterThan(available)) {
    throw new Error(
      `Cannot refund ${amount.toFixed(2)} — only ${available.toFixed(2)} is left on this credit note.`,
    );
  }

  const bank = await tx.account.findUnique({ where: { code: input.bankAccountCode } });
  if (!bank) throw new Error(`Account ${input.bankAccountCode} does not exist.`);
  if (!bank.isPostable) throw new Error(`Account ${bank.code} is a heading.`);

  const receivable = note.receivableAccountId
    ? await tx.account.findUnique({ where: { id: note.receivableAccountId } })
    : null;
  if (!receivable) throw new Error("This credit note has no receivable account.");

  const label =
    `Refund of ${note.creditNumber}` + (input.reference ? ` (${input.reference})` : "");

  const lines: DraftLine[] = [
    {
      accountCode: receivable.code,
      debit: amount.toFixed(2),
      credit: "0",
      description: label,
      contactId: note.contactId,
    },
    {
      accountCode: bank.code,
      debit: "0",
      credit: amount.toFixed(2),
      description: label,
      contactId: note.contactId,
    },
  ];

  const draft = await createDraftEntryTx(tx, {
    entryDate: input.refundDate,
    description: label,
    lines,
  });
  const entry = await postDraftTx(tx, draft.id);

  const stillAvailable = available.minus(amount);

  return tx.creditNote.update({
    where: { id: note.id },
    data: {
      refundEntryId: entry.id,
      refundedAt: new Date(),
      status: stillAvailable.isZero()
        ? applied.greaterThan(0)
          ? "APPLIED"
          : "REFUNDED"
        : "ISSUED",
    },
    include: { applications: { include: { invoice: true } }, contact: true },
  });
}

export async function refundCreditNote(
  creditNoteId: string,
  input: { amount: string; bankAccountCode: string; refundDate: Date; reference?: string },
) {
  return prisma.$transaction((tx) => refundCreditNoteTx(tx, creditNoteId, input));
}
