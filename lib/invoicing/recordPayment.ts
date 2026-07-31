import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, type TxClient } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";

const AR_CODE = "1200";
const AP_CODE = "2010";
const OVERPAYMENT_CODE = "2060";
const PREPAID_CODE = "1300";

export type PaymentApplicationDraft = {
  invoiceNumber: string;
  amount: string;
};

export type PaymentDraft = {
  contactId: string;
  direction: "RECEIVED" | "SENT";
  paymentDate: Date;
  amount: string;
  bankAccountCode: string;
  method?: string;
  reference?: string;
  notes?: string;
  currency?: string;
  applications?: PaymentApplicationDraft[];
};

export async function recordPaymentTx(tx: TxClient, draft: PaymentDraft) {
  const amount = new Decimal(draft.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const contact = await tx.contact.findUnique({ where: { id: draft.contactId } });
  if (!contact) throw new Error("Contact does not exist.");
  if (!contact.isActive) throw new Error(`Contact ${contact.name} is inactive.`);
  if (draft.direction === "RECEIVED" && !contact.isCustomer) {
    throw new Error(`Contact ${contact.name} is not marked as a customer.`);
  }
  if (draft.direction === "SENT" && !contact.isVendor) {
    throw new Error(`Contact ${contact.name} is not marked as a vendor.`);
  }

  const bank = await tx.account.findUnique({ where: { code: draft.bankAccountCode } });
  if (!bank) throw new Error(`Account ${draft.bankAccountCode} does not exist.`);
  if (!bank.isActive) throw new Error(`Account ${bank.code} is inactive.`);
  if (!bank.isPostable) throw new Error(`Account ${bank.code} is a heading.`);
  if (bank.type !== "ASSET" && bank.type !== "LIABILITY") {
    throw new Error(`Account ${bank.code} is ${bank.type}; a payment must move through an asset or liability account.`);
  }

  const drafts = draft.applications ?? [];
  const numbers = drafts.map((a) => a.invoiceNumber);
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("The same invoice appears twice in the applications.");
  }

  const invoices = await tx.invoice.findMany({
    where: { invoiceNumber: { in: numbers } },
    include: { applications: true },
  });
  const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  let totalApplied = new Decimal(0);

  for (const application of drafts) {
    const invoice = byNumber.get(application.invoiceNumber);
    if (!invoice) throw new Error(`Invoice ${application.invoiceNumber} does not exist.`);
    if (invoice.contactId !== contact.id) {
      throw new Error(`Invoice ${invoice.invoiceNumber} belongs to a different contact.`);
    }
    if (invoice.status === "DRAFT") {
      throw new Error(`Invoice ${invoice.invoiceNumber} is still a draft and cannot be paid.`);
    }
    if (invoice.status === "VOID") {
      throw new Error(`Invoice ${invoice.invoiceNumber} is void.`);
    }

    const applied = new Decimal(application.amount);
    if (applied.lessThanOrEqualTo(0)) {
      throw new Error(`Applied amount for ${invoice.invoiceNumber} must be greater than zero.`);
    }

    const alreadyApplied = invoice.applications.reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding = new Decimal(invoice.total.toString()).minus(alreadyApplied);

    if (applied.greaterThan(outstanding)) {
      throw new Error(
        `Cannot apply ${applied.toFixed(2)} to ${invoice.invoiceNumber} - only ${outstanding.toFixed(2)} is outstanding.`,
      );
    }

    totalApplied = totalApplied.plus(applied);
  }

  if (totalApplied.greaterThan(amount)) {
    throw new Error(
      `Applications total ${totalApplied.toFixed(2)} but the payment is only ${amount.toFixed(2)}.`,
    );
  }

  const unapplied = amount.minus(totalApplied);

  const lastPayment = await tx.payment.findFirst({
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });
  const paymentNumber = (lastPayment?.paymentNumber ?? 0) + 1;

  const payment = await tx.payment.create({
    data: {
      paymentNumber,
      direction: draft.direction,
      contactId: contact.id,
      paymentDate: draft.paymentDate,
      amount: amount.toFixed(2),
      currency: draft.currency ?? "CAD",
      bankAccountId: bank.id,
      method: draft.method ?? null,
      reference: draft.reference ?? null,
      notes: draft.notes ?? null,
      applications: {
        create: drafts.map((a) => ({
          invoiceId: byNumber.get(a.invoiceNumber)!.id,
          amountApplied: new Decimal(a.amount).toFixed(2),
        })),
      },
    },
    include: { applications: true },
  });

  const label = `Payment #${paymentNumber} - ${contact.name}`;
  const lines: DraftLine[] = [];

  if (draft.direction === "RECEIVED") {
    lines.push({
      accountCode: bank.code,
      debit: amount.toFixed(2),
      credit: "0",
      description: label,
      contactId: contact.id,
    });
    if (totalApplied.greaterThan(0)) {
      lines.push({
        accountCode: AR_CODE,
        debit: "0",
        credit: totalApplied.toFixed(2),
        description: label,
        contactId: contact.id,
      });
    }
    if (unapplied.greaterThan(0)) {
      lines.push({
        accountCode: OVERPAYMENT_CODE,
        debit: "0",
        credit: unapplied.toFixed(2),
        description: `${label} - unapplied`,
        contactId: contact.id,
      });
    }
  } else {
    if (totalApplied.greaterThan(0)) {
      lines.push({
        accountCode: AP_CODE,
        debit: totalApplied.toFixed(2),
        credit: "0",
        description: label,
        contactId: contact.id,
      });
    }
    if (unapplied.greaterThan(0)) {
      lines.push({
        accountCode: PREPAID_CODE,
        debit: unapplied.toFixed(2),
        credit: "0",
        description: `${label} - prepaid`,
        contactId: contact.id,
      });
    }
    lines.push({
      accountCode: bank.code,
      debit: "0",
      credit: amount.toFixed(2),
      description: label,
      contactId: contact.id,
    });
  }

  const entry = await createDraftEntryTx(tx, {
    entryDate: draft.paymentDate,
    description: label,
    lines,
  });

  const linked = await tx.payment.update({
    where: { id: payment.id },
    data: { journalEntryId: entry.id },
    include: { applications: true, contact: true },
  });

  return { payment: linked, entry, totalApplied, unapplied };
}

export async function recordPayment(draft: PaymentDraft) {
  return prisma.$transaction((tx) => recordPaymentTx(tx, draft));
}
