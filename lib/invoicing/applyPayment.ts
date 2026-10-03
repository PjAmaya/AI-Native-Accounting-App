import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, postDraftTx, type TxClient } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";
import { sumApplied } from "./applications";
import {
  validateInvoiceApplicationsTx,
  validateBillApplicationsTx,
  type InvoiceApplicationDraft,
  type BillApplicationDraft,
} from "./validateApplications";
import { syncInvoiceStatusTx, syncBillStatusTx } from "./documentStatus";

const AP_CODE = "2010";
const OVERPAYMENT_CODE = "2060";
const PREPAID_CODE = "1300";

export type ApplyPaymentDraft = {
  paymentId: string;
  applicationDate: Date;
  applications?: InvoiceApplicationDraft[];
  billApplications?: BillApplicationDraft[];
};

export function unappliedOf(payment: {
  amount: unknown;
  applications: { amountApplied: unknown }[];
  billApplications: { amountApplied: unknown }[];
}) {
  return new Decimal(String(payment.amount))
    .minus(sumApplied(payment.applications))
    .minus(sumApplied(payment.billApplications));
}

// Applies the unapplied balance of a posted payment to open invoices or bills.
// Each application gets its own posted entry moving the amount out of
// 2060 Customer Overpayments into A/R, or out of 1300 Prepaid Expenses into A/P.
// The original payment entry is left untouched.
export async function applyPaymentTx(tx: TxClient, draft: ApplyPaymentDraft) {
  const payment = await tx.payment.findUnique({
    where: { id: draft.paymentId },
    include: { applications: true, billApplications: true, journalEntry: true, contact: true },
  });
  if (!payment) throw new Error(`Payment ${draft.paymentId} does not exist.`);

  if (!payment.journalEntry || payment.journalEntry.status === "DRAFT") {
    throw new Error(
      `Payment #${payment.paymentNumber} is still a draft. Edit it to change what it is applied to.`,
    );
  }
  if (payment.journalEntry.status === "REVERSED") {
    throw new Error(`Payment #${payment.paymentNumber} has been reversed.`);
  }
  if (draft.applicationDate < payment.paymentDate) {
    throw new Error("The application date cannot be before the payment date.");
  }

  const invoiceDrafts = draft.applications ?? [];
  const billDrafts = draft.billApplications ?? [];
  if (invoiceDrafts.length === 0 && billDrafts.length === 0) {
    throw new Error("Enter an amount to apply.");
  }
  if (payment.direction === "RECEIVED" && billDrafts.length > 0) {
    throw new Error("A received payment cannot be applied to bills.");
  }
  if (payment.direction === "SENT" && invoiceDrafts.length > 0) {
    throw new Error("A sent payment cannot be applied to invoices.");
  }

  const { invoiceByNumber, totalApplied: invoicesApplied } =
    await validateInvoiceApplicationsTx(tx, payment.contact, invoiceDrafts);
  const { billByNumber, totalApplied: billsApplied } =
    await validateBillApplicationsTx(tx, payment.contact, billDrafts);
  const requested = invoicesApplied.plus(billsApplied);

  const unapplied = unappliedOf(payment);
  if (requested.greaterThan(unapplied)) {
    throw new Error(
      `Payment #${payment.paymentNumber} has only ${unapplied.toFixed(2)} unapplied; ` +
        `${requested.toFixed(2)} was requested.`,
    );
  }

  const alreadyOnInvoice = new Set(payment.applications.map((a) => a.invoiceId));
  const alreadyOnBill = new Set(payment.billApplications.map((a) => a.billId));
  const label = `Payment #${payment.paymentNumber} - ${payment.contact.name}`;

  async function postEntry(description: string, lines: DraftLine[]) {
    const entry = await createDraftEntryTx(tx, {
      entryDate: draft.applicationDate,
      description,
      lines,
    });
    return postDraftTx(tx, entry.id);
  }

  for (const application of invoiceDrafts) {
    const invoice = invoiceByNumber.get(application.invoiceNumber)!;
    if (alreadyOnInvoice.has(invoice.id)) {
      throw new Error(`Payment #${payment.paymentNumber} is already applied to ${invoice.invoiceNumber}.`);
    }
    const amount = new Decimal(application.amount).toFixed(2);
    const description = `${label} - applied to ${invoice.invoiceNumber}`;
    const entry = await postEntry(description, [
      { accountCode: OVERPAYMENT_CODE, debit: amount, credit: "0", description, contactId: payment.contactId },
      {
        accountCode: invoice.receivableAccount?.code ?? "1210",
        debit: "0",
        credit: amount,
        description,
        contactId: payment.contactId,
      },
    ]);
    await tx.paymentApplication.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        amountApplied: amount,
        appliedAt: draft.applicationDate,
        journalEntryId: entry.id,
      },
    });
  }

  for (const application of billDrafts) {
    const bill = billByNumber.get(application.billNumber)!;
    if (alreadyOnBill.has(bill.id)) {
      throw new Error(`Payment #${payment.paymentNumber} is already applied to bill #${bill.billNumber}.`);
    }
    const amount = new Decimal(application.amount).toFixed(2);
    const description = `${label} - applied to bill #${bill.billNumber}`;
    const entry = await postEntry(description, [
      { accountCode: AP_CODE, debit: amount, credit: "0", description, contactId: payment.contactId },
      { accountCode: PREPAID_CODE, debit: "0", credit: amount, description, contactId: payment.contactId },
    ]);
    await tx.billApplication.create({
      data: {
        paymentId: payment.id,
        billId: bill.id,
        amountApplied: amount,
        appliedAt: draft.applicationDate,
        journalEntryId: entry.id,
      },
    });
  }

  await syncInvoiceStatusTx(tx, invoiceDrafts.map((a) => invoiceByNumber.get(a.invoiceNumber)!.id));
  await syncBillStatusTx(tx, billDrafts.map((a) => billByNumber.get(a.billNumber)!.id));

  return { applied: requested, remaining: unapplied.minus(requested) };
}

export async function applyPayment(draft: ApplyPaymentDraft) {
  return prisma.$transaction((tx) => applyPaymentTx(tx, draft));
}
