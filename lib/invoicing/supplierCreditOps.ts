import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, postDraftTx } from "../ledger/post";
import { syncBillStatusTx } from "./documentStatus";
import { assertNotOverApplied } from "./applications";
import type { TxClient } from "../ledger/txClient";
import type { DraftLine } from "../ledger/balance";

const AP_CODE = "2010";

export async function approveSupplierCreditTx(tx: TxClient, creditId: string) {
  const credit = await tx.supplierCredit.findUnique({
    where: { id: creditId },
    include: { lines: true },
  });

  if (!credit) throw new Error(`Supplier credit ${creditId} does not exist.`);
  if (credit.status !== "DRAFT") {
    throw new Error(`Supplier credit #${credit.creditNumber} is ${credit.status.toLowerCase()}.`);
  }
  if (!credit.journalEntryId) throw new Error(`Supplier credit #${credit.creditNumber} has no journal entry.`);
  if (credit.lines.length === 0) throw new Error(`Supplier credit #${credit.creditNumber} has no lines.`);

  const entry = await postDraftTx(tx, credit.journalEntryId);

  const debited = entry.lines.reduce(
    (sum, line) => sum.plus(line.debit),
    entry.lines[0].debit.minus(entry.lines[0].debit),
  );
  if (!debited.equals(credit.total)) {
    throw new Error(
      `Supplier credit #${credit.creditNumber} total ${credit.total.toString()} does not match its journal entry debits ${debited.toString()}.`,
    );
  }

  return tx.supplierCredit.update({
    where: { id: credit.id },
    data: { status: "APPROVED", approvedAt: new Date() },
    include: { lines: true, contact: true, originalBill: true },
  });
}

export async function approveSupplierCredit(creditId: string) {
  return prisma.$transaction((tx) => approveSupplierCreditTx(tx, creditId));
}

export async function supplierCreditBalanceTx(tx: TxClient, creditId: string) {
  const credit = await tx.supplierCredit.findUnique({
    where: { id: creditId },
    include: { applications: true, refundEntry: { include: { lines: true } } },
  });
  if (!credit) throw new Error(`Supplier credit ${creditId} does not exist.`);

  const total = new Decimal(credit.total.toString());
  const applied = credit.applications.reduce(
    (sum, a) => sum.plus(a.amountApplied.toString()),
    new Decimal(0),
  );
  const refunded = credit.refundEntry
    ? credit.refundEntry.lines.reduce((sum, l) => sum.plus(l.credit.toString()), new Decimal(0))
    : new Decimal(0);

  return { credit, total, applied, refunded, available: total.minus(applied).minus(refunded) };
}

export type SupplierCreditApplicationDraft = { billNumber: number; amount: string };

export async function applySupplierCreditTx(
  tx: TxClient,
  creditId: string,
  applications: SupplierCreditApplicationDraft[],
) {
  const { credit, available } = await supplierCreditBalanceTx(tx, creditId);

  if (credit.status === "DRAFT") {
    throw new Error(`Supplier credit #${credit.creditNumber} must be approved before it can be applied.`);
  }
  if (credit.status === "VOID") throw new Error(`Supplier credit #${credit.creditNumber} is void.`);

  const numbers = applications.map((a) => a.billNumber);
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("The same bill appears twice.");
  }

  const bills = await tx.bill.findMany({
    where: { billNumber: { in: numbers } },
    include: { applications: true, supplierCreditApplications: true },
  });
  const byNumber = new Map(bills.map((b) => [b.billNumber, b]));

  let totalApplied = new Decimal(0);

  for (const application of applications) {
    const bill = byNumber.get(application.billNumber);
    if (!bill) throw new Error(`Bill #${application.billNumber} does not exist.`);
    if (bill.contactId !== credit.contactId) {
      throw new Error(`Bill #${bill.billNumber} belongs to a different vendor.`);
    }
    if (bill.status === "DRAFT" || bill.status === "VOID") {
      throw new Error(`Bill #${bill.billNumber} is ${bill.status.toLowerCase()}.`);
    }

    const settled = [...bill.applications, ...bill.supplierCreditApplications].reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );

    assertNotOverApplied({
      label: `bill #${bill.billNumber}`,
      total: new Decimal(bill.total.toString()),
      alreadyApplied: settled,
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);
  }

  if (totalApplied.greaterThan(available)) {
    throw new Error(
      `Cannot apply ${totalApplied.toFixed(2)} — only ${available.toFixed(2)} is left on this credit.`,
    );
  }

  for (const application of applications) {
    const bill = byNumber.get(application.billNumber)!;
    await tx.supplierCreditApplication.upsert({
      where: { supplierCreditId_billId: { supplierCreditId: credit.id, billId: bill.id } },
      create: {
        supplierCreditId: credit.id,
        billId: bill.id,
        amountApplied: new Decimal(application.amount).toFixed(2),
      },
      update: { amountApplied: new Decimal(application.amount).toFixed(2) },
    });
  }

  await syncBillStatusTx(tx, applications.map((a) => byNumber.get(a.billNumber)!.id));

  const after = await supplierCreditBalanceTx(tx, creditId);

  return tx.supplierCredit.update({
    where: { id: credit.id },
    data: { status: after.available.lessThanOrEqualTo(0) ? "APPLIED" : "APPROVED" },
    include: { applications: { include: { bill: true } }, contact: true },
  });
}

export async function applySupplierCredit(
  creditId: string,
  applications: SupplierCreditApplicationDraft[],
) {
  return prisma.$transaction((tx) => applySupplierCreditTx(tx, creditId, applications));
}

export async function refundSupplierCreditTx(
  tx: TxClient,
  creditId: string,
  input: { amount: string; bankAccountCode: string; refundDate: Date; reference?: string },
) {
  const { credit, applied, available } = await supplierCreditBalanceTx(tx, creditId);

  if (credit.status === "DRAFT") {
    throw new Error(`Supplier credit #${credit.creditNumber} must be approved first.`);
  }
  if (credit.status === "VOID") throw new Error(`Supplier credit #${credit.creditNumber} is void.`);
  if (credit.refundEntryId) {
    throw new Error(`Supplier credit #${credit.creditNumber} has already been refunded.`);
  }

  const amount = new Decimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw new Error("The refund must be greater than zero.");
  if (amount.greaterThan(available)) {
    throw new Error(
      `Cannot refund ${amount.toFixed(2)} — only ${available.toFixed(2)} is left on this credit.`,
    );
  }

  const bank = await tx.account.findUnique({ where: { code: input.bankAccountCode } });
  if (!bank) throw new Error(`Account ${input.bankAccountCode} does not exist.`);
  if (!bank.isPostable) throw new Error(`Account ${bank.code} is a heading.`);

  const label =
    `Refund of supplier credit #${credit.creditNumber}` +
    (input.reference ? ` (${input.reference})` : "");

  const lines: DraftLine[] = [
    {
      accountCode: bank.code,
      debit: amount.toFixed(2),
      credit: "0",
      description: label,
      contactId: credit.contactId,
    },
    {
      accountCode: AP_CODE,
      debit: "0",
      credit: amount.toFixed(2),
      description: label,
      contactId: credit.contactId,
    },
  ];

  const draft = await createDraftEntryTx(tx, {
    entryDate: input.refundDate,
    description: label,
    lines,
  });
  const entry = await postDraftTx(tx, draft.id);

  const stillAvailable = available.minus(amount);

  return tx.supplierCredit.update({
    where: { id: credit.id },
    data: {
      refundEntryId: entry.id,
      refundedAt: new Date(),
      status: stillAvailable.lessThanOrEqualTo(0)
        ? applied.greaterThan(0)
          ? "APPLIED"
          : "REFUNDED"
        : "APPROVED",
    },
    include: { applications: { include: { bill: true } }, contact: true },
  });
}

export async function refundSupplierCredit(
  creditId: string,
  input: { amount: string; bankAccountCode: string; refundDate: Date; reference?: string },
) {
  return prisma.$transaction((tx) => refundSupplierCreditTx(tx, creditId, input));
}
