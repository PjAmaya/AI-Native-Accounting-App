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

  const rows: AgingRow[] = [];

  for (const invoice of invoices) {
    const total = new Decimal(invoice.total.toString());
    const applied = sumApplied(invoice.applications).plus(sumApplied(invoice.creditApplications));
    const outstanding = total.minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const days = daysPastDue(invoice.dueDate, asOf);
    rows.push({
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
    },
  });

  const rows: AgingRow[] = [];

  for (const bill of bills) {
    const total = new Decimal(bill.total.toString());
    const applied = sumApplied(bill.applications);
    const outstanding = total.minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const days = daysPastDue(bill.dueDate, asOf);
    rows.push({
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
