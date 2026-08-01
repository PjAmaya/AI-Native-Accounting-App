import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, type TxClient } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";
import { assertNotOverApplied, sumApplied } from "./applications";

const AR_CODE = "1200";
const AP_CODE = "2010";
const OVERPAYMENT_CODE = "2060";
const PREPAID_CODE = "1300";

export type InvoiceApplicationDraft = {
  invoiceNumber: string;
  amount: string;
};

export type BillApplicationDraft = {
  billNumber: number;
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
  applications?: InvoiceApplicationDraft[];
  billApplications?: BillApplicationDraft[];
};

export async function recordPaymentTx(tx: TxClient, draft: PaymentDraft) {
  const amount = new Decimal(draft.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const invoiceDrafts = draft.applications ?? [];
  const billDrafts = draft.billApplications ?? [];

  if (draft.direction === "RECEIVED" && billDrafts.length > 0) {
    throw new Error("A received payment cannot be applied to bills.");
  }
  if (draft.direction === "SENT" && invoiceDrafts.length > 0) {
    throw new Error("A sent payment cannot be applied to invoices.");
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

  let totalApplied = new Decimal(0);

  const invoiceNumbers = invoiceDrafts.map((a) => a.invoiceNumber);
  if (new Set(invoiceNumbers).size !== invoiceNumbers.length) {
    throw new Error("The same invoice appears twice in the applications.");
  }
  const invoices = await tx.invoice.findMany({
    where: { invoiceNumber: { in: invoiceNumbers } },
    include: { applications: true },
  });
  const invoiceByNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  for (const application of invoiceDrafts) {
    const invoice = invoiceByNumber.get(application.invoiceNumber);
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

    assertNotOverApplied({
      label: invoice.invoiceNumber,
      total: new Decimal(invoice.total.toString()),
      alreadyApplied: sumApplied(invoice.applications),
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);
  }

  const billNumbers = billDrafts.map((a) => a.billNumber);
  if (new Set(billNumbers).size !== billNumbers.length) {
    throw new Error("The same bill appears twice in the applications.");
  }
  const bills = await tx.bill.findMany({
    where: { billNumber: { in: billNumbers } },
    include: { applications: true },
  });
  const billByNumber = new Map(bills.map((b) => [b.billNumber, b]));

  for (const application of billDrafts) {
    const bill = billByNumber.get(application.billNumber);
    if (!bill) throw new Error(`Bill #${application.billNumber} does not exist.`);
    if (bill.contactId !== contact.id) {
      throw new Error(`Bill #${bill.billNumber} belongs to a different contact.`);
    }
    if (bill.status === "DRAFT") {
      throw new Error(`Bill #${bill.billNumber} is not approved and cannot be paid.`);
    }
    if (bill.status === "VOID") {
      throw new Error(`Bill #${bill.billNumber} is void.`);
    }

    assertNotOverApplied({
      label: `bill #${bill.billNumber}`,
      total: new Decimal(bill.total.toString()),
      alreadyApplied: sumApplied(bill.applications),
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);
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
        create: invoiceDrafts.map((a) => ({
          invoiceId: invoiceByNumber.get(a.invoiceNumber)!.id,
          amountApplied: new Decimal(a.amount).toFixed(2),
        })),
      },
      billApplications: {
        create: billDrafts.map((a) => ({
          billId: billByNumber.get(a.billNumber)!.id,
          amountApplied: new Decimal(a.amount).toFixed(2),
        })),
      },
    },
    include: { applications: true, billApplications: true },
  });

  await markInvoicesPaidTx(tx, invoiceDrafts.map((a) => invoiceByNumber.get(a.invoiceNumber)!.id));
  await markBillsPaidTx(tx, billDrafts.map((a) => billByNumber.get(a.billNumber)!.id));

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
    include: { applications: true, billApplications: true, contact: true },
  });

  return { payment: linked, entry, totalApplied, unapplied };
}

export async function recordPayment(draft: PaymentDraft) {
  return prisma.$transaction((tx) => recordPaymentTx(tx, draft));
}

async function markInvoicesPaidTx(tx: TxClient, invoiceIds: string[]) {
  for (const invoiceId of Array.from(new Set(invoiceIds))) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, total: true },
    });
    if (!invoice || invoice.status !== "ISSUED") continue;

    const agg = await tx.paymentApplication.aggregate({
      where: { invoiceId },
      _sum: { amountApplied: true },
    });
    const applied = new Decimal(agg._sum.amountApplied?.toString() ?? "0");

    if (applied.greaterThanOrEqualTo(new Decimal(invoice.total.toString()))) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
    }
  }
}

async function markBillsPaidTx(tx: TxClient, billIds: string[]) {
  for (const billId of Array.from(new Set(billIds))) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: { id: true, status: true, total: true },
    });
    if (!bill || bill.status !== "APPROVED") continue;

    const agg = await tx.billApplication.aggregate({
      where: { billId },
      _sum: { amountApplied: true },
    });
    const applied = new Decimal(agg._sum.amountApplied?.toString() ?? "0");

    if (applied.greaterThanOrEqualTo(new Decimal(bill.total.toString()))) {
      await tx.bill.update({ where: { id: billId }, data: { status: "PAID" } });
    }
  }
}
