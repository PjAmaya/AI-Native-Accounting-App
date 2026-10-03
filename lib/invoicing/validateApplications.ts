import Decimal from "decimal.js";
import type { TxClient } from "../ledger/txClient";
import { assertNotOverApplied, sumApplied } from "./applications";

const DEFAULT_AR_CODE = "1210";

export type InvoiceApplicationDraft = {
  invoiceNumber: string;
  amount: string;
};

export type BillApplicationDraft = {
  billNumber: number;
  amount: string;
};

// Checks each requested invoice application against the contact and the invoice's
// outstanding balance. Returns the invoices by number, the total applied and the
// amount to credit to each receivable account.
export async function validateInvoiceApplicationsTx(
  tx: TxClient,
  contact: { id: string },
  drafts: InvoiceApplicationDraft[],
) {
  const invoiceNumbers = drafts.map((a) => a.invoiceNumber);
  if (new Set(invoiceNumbers).size !== invoiceNumbers.length) {
    throw new Error("The same invoice appears twice in the applications.");
  }
  const invoices = await tx.invoice.findMany({
    where: { invoiceNumber: { in: invoiceNumbers } },
    include: { applications: true, creditApplications: true, receivableAccount: true },
  });
  const invoiceByNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  let totalApplied = new Decimal(0);
  const receivableSplit = new Map<string, Decimal>();

  for (const application of drafts) {
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
      alreadyApplied: sumApplied(invoice.applications).plus(sumApplied(invoice.creditApplications)),
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);

    const code = invoice.receivableAccount?.code ?? DEFAULT_AR_CODE;
    receivableSplit.set(
      code,
      (receivableSplit.get(code) ?? new Decimal(0)).plus(application.amount),
    );
  }

  return { invoiceByNumber, totalApplied, receivableSplit };
}

export async function validateBillApplicationsTx(
  tx: TxClient,
  contact: { id: string },
  drafts: BillApplicationDraft[],
) {
  const billNumbers = drafts.map((a) => a.billNumber);
  if (new Set(billNumbers).size !== billNumbers.length) {
    throw new Error("The same bill appears twice in the applications.");
  }
  const bills = await tx.bill.findMany({
    where: { billNumber: { in: billNumbers } },
    include: { applications: true, supplierCreditApplications: true },
  });
  const billByNumber = new Map(bills.map((b) => [b.billNumber, b]));

  let totalApplied = new Decimal(0);

  for (const application of drafts) {
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
      alreadyApplied: sumApplied(bill.applications).plus(sumApplied(bill.supplierCreditApplications)),
      requested: new Decimal(application.amount),
    });

    totalApplied = totalApplied.plus(application.amount);
  }

  return { billByNumber, totalApplied };
}
