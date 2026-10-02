import Decimal from "decimal.js";
import { prisma } from "../db";

const AR_CODE = "1200";
const AP_CODE = "2010";

export type AgingBucket = "CURRENT" | "D1_30" | "D31_60" | "D61_90" | "D90_PLUS";

export const AGING_BUCKETS: AgingBucket[] = ["CURRENT", "D1_30", "D31_60", "D61_90", "D90_PLUS"];

export const AGING_LABELS: Record<AgingBucket, string> = {
  CURRENT: "Not yet due",
  D1_30: "1-30 days",
  D31_60: "31-60 days",
  D61_90: "61-90 days",
  D90_PLUS: "90+ days",
};

export type AgingRow = {
  kind: "DOCUMENT" | "CREDIT";
  documentNumber: string;
  contactName: string;
  documentDate: Date;
  dueDate: Date;
  total: Decimal;
  applied: Decimal;
  outstanding: Decimal;
  daysPastDue: number;
  bucket: AgingBucket;
};

export type AgingReport = {
  asOf: Date;
  direction: "AR" | "AP";
  accountCode: string;
  rows: AgingRow[];
  byBucket: Record<AgingBucket, Decimal>;
  byContact: { name: string; outstanding: Decimal }[];
  subledgerTotal: Decimal;
  glBalance: Decimal;
  difference: Decimal;
  ties: boolean;
};

function daysPastDue(dueDate: Date, asOf: Date) {
  return Math.round((asOf.getTime() - dueDate.getTime()) / 86_400_000);
}

function bucketFor(days: number): AgingBucket {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "D1_30";
  if (days <= 60) return "D31_60";
  if (days <= 90) return "D61_90";
  return "D90_PLUS";
}

function sumApplied(applications: { amountApplied: unknown }[]) {
  return applications.reduce(
    (sum, a) => sum.plus(new Decimal(String(a.amountApplied))),
    new Decimal(0),
  );
}

const POSTED_ENTRY = { status: { in: ["POSTED" as const, "REVERSED" as const] } };

// Refund entries are two balanced lines, so the debit total is the refund amount.
function refundedAsOf(
  refundEntry: { entryDate: Date; status: string; lines: { debit: unknown }[] } | null,
  asOf: Date,
) {
  if (!refundEntry || refundEntry.entryDate > asOf || refundEntry.status === "DRAFT") {
    return new Decimal(0);
  }
  return refundEntry.lines.reduce((sum, l) => sum.plus(new Decimal(String(l.debit))), new Decimal(0));
}

// A credit hits the GL in full when issued; applying it posts nothing. Whatever
// has not been applied or refunded by the as-of date stays in the subledger as a
// negative row so the aging ties to the control account.
function unappliedCreditRow(
  documentNumber: string,
  contactName: string,
  creditDate: Date,
  totalValue: unknown,
  applications: { amountApplied: unknown }[],
  refunded: Decimal,
): AgingRow | null {
  const total = new Decimal(String(totalValue)).negated();
  const applied = sumApplied(applications).plus(refunded).negated();
  const outstanding = total.minus(applied);
  if (outstanding.greaterThanOrEqualTo(0)) return null;

  return {
    kind: "CREDIT",
    documentNumber,
    contactName,
    documentDate: creditDate,
    dueDate: creditDate,
    total,
    applied,
    outstanding,
    daysPastDue: 0,
    bucket: "CURRENT",
  };
}

async function glBalanceOf(code: string, asOf: Date) {
  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) throw new Error(`Account ${code} does not exist.`);

  const children = await prisma.account.findMany({
    where: { parentId: account.id },
    select: { id: true },
  });
  const ids = [account.id, ...children.map((c) => c.id)];

  const agg = await prisma.journalLine.aggregate({
    where: {
      accountId: { in: ids },
      entry: { status: { in: ["POSTED", "REVERSED"] }, entryDate: { lte: asOf } },
    },
    _sum: { debit: true, credit: true },
  });

  const debits = new Decimal(agg._sum.debit?.toString() ?? "0");
  const credits = new Decimal(agg._sum.credit?.toString() ?? "0");
  return account.type === "ASSET" ? debits.minus(credits) : credits.minus(debits);
}

function assemble(
  asOf: Date,
  direction: "AR" | "AP",
  accountCode: string,
  rows: AgingRow[],
  glBalance: Decimal,
): AgingReport {
  const byBucket = Object.fromEntries(
    AGING_BUCKETS.map((b) => [b, new Decimal(0)]),
  ) as Record<AgingBucket, Decimal>;

  const contacts = new Map<string, Decimal>();

  for (const row of rows) {
    byBucket[row.bucket] = byBucket[row.bucket].plus(row.outstanding);
    contacts.set(
      row.contactName,
      (contacts.get(row.contactName) ?? new Decimal(0)).plus(row.outstanding),
    );
  }

  const subledgerTotal = rows.reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));
  const difference = subledgerTotal.minus(glBalance);

  return {
    asOf,
    direction,
    accountCode,
    rows: rows.sort((a, b) => b.daysPastDue - a.daysPastDue),
    byBucket,
    byContact: [...contacts.entries()]
      .map(([name, outstanding]) => ({ name, outstanding }))
      .sort((a, b) => b.outstanding.comparedTo(a.outstanding)),
    subledgerTotal,
    glBalance,
    difference,
    ties: difference.isZero(),
  };
}

export async function arAging(asOf: Date): Promise<AgingReport> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PAID"] },
      invoiceDate: { lte: asOf },
    },
    include: {
      contact: true,
      applications: {
        where: {
          payment: {
            paymentDate: { lte: asOf },
            journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
          },
        },
      },
      creditApplications: {
        where: {
          creditNote: {
            creditDate: { lte: asOf },
            journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
          },
        },
      },
    },
  });

  const creditNotes = await prisma.creditNote.findMany({
    where: {
      status: { in: ["ISSUED", "APPLIED", "REFUNDED"] },
      creditDate: { lte: asOf },
      journalEntry: POSTED_ENTRY,
    },
    include: {
      contact: true,
      applications: {
        where: { invoice: { status: { in: ["ISSUED", "PAID"] }, invoiceDate: { lte: asOf } } },
      },
      refundEntry: { include: { lines: true } },
    },
  });

  const rows: AgingRow[] = [];

  for (const note of creditNotes) {
    const row = unappliedCreditRow(
      note.creditNumber,
      note.contact.name,
      note.creditDate,
      note.total,
      note.applications,
      refundedAsOf(note.refundEntry, asOf),
    );
    if (row) rows.push(row);
  }

  for (const invoice of invoices) {
    const total = new Decimal(invoice.total.toString());
    const applied = sumApplied(invoice.applications).plus(sumApplied(invoice.creditApplications));
    const outstanding = total.minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const days = daysPastDue(invoice.dueDate, asOf);
    rows.push({
      kind: "DOCUMENT",
      documentNumber: invoice.invoiceNumber,
      contactName: invoice.contact.name,
      documentDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      total,
      applied,
      outstanding,
      daysPastDue: days,
      bucket: bucketFor(days),
    });
  }

  return assemble(asOf, "AR", AR_CODE, rows, await glBalanceOf(AR_CODE, asOf));
}

export async function apAging(asOf: Date): Promise<AgingReport> {
  const bills = await prisma.bill.findMany({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      billDate: { lte: asOf },
    },
    include: {
      contact: true,
      applications: {
        where: {
          payment: {
            paymentDate: { lte: asOf },
            journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
          },
        },
      },
      supplierCreditApplications: {
        where: {
          supplierCredit: {
            creditDate: { lte: asOf },
            journalEntry: POSTED_ENTRY,
          },
        },
      },
    },
  });

  const supplierCredits = await prisma.supplierCredit.findMany({
    where: {
      status: { in: ["APPROVED", "APPLIED", "REFUNDED"] },
      creditDate: { lte: asOf },
      journalEntry: POSTED_ENTRY,
    },
    include: {
      contact: true,
      applications: {
        where: { bill: { status: { in: ["APPROVED", "PAID"] }, billDate: { lte: asOf } } },
      },
      refundEntry: { include: { lines: true } },
    },
  });

  const rows: AgingRow[] = [];

  for (const credit of supplierCredits) {
    const row = unappliedCreditRow(
      `Supplier credit #${credit.creditNumber} (${credit.supplierCreditNumber})`,
      credit.contact.name,
      credit.creditDate,
      credit.total,
      credit.applications,
      refundedAsOf(credit.refundEntry, asOf),
    );
    if (row) rows.push(row);
  }

  for (const bill of bills) {
    const total = new Decimal(bill.total.toString());
    const applied = sumApplied(bill.applications).plus(sumApplied(bill.supplierCreditApplications));
    const outstanding = total.minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const days = daysPastDue(bill.dueDate, asOf);
    rows.push({
      kind: "DOCUMENT",
      documentNumber: `Bill #${bill.billNumber} (${bill.supplierInvoiceNumber})`,
      contactName: bill.contact.name,
      documentDate: bill.billDate,
      dueDate: bill.dueDate,
      total,
      applied,
      outstanding,
      daysPastDue: days,
      bucket: bucketFor(days),
    });
  }

  return assemble(asOf, "AP", AP_CODE, rows, await glBalanceOf(AP_CODE, asOf));
}
