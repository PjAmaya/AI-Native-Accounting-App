import Decimal from "decimal.js";
import { prisma } from "../db";

export type TrialBalanceRow = {
  code: string;
  name: string;
  debit: Decimal;
  credit: Decimal;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebits: Decimal;
  totalCredits: Decimal;
  balanced: boolean;
};

export async function trialBalance(asOf: Date): Promise<TrialBalance> {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      entry: { status: "POSTED", entryDate: { lte: asOf } },
    },
    _sum: { debit: true, credit: true },
  });

  const accounts = await prisma.account.findMany({
    where: { id: { in: grouped.map((g) => g.accountId) } },
    orderBy: { code: "asc" },
  });

  const sums = new Map(grouped.map((g) => [g.accountId, g]));

  const rows: TrialBalanceRow[] = [];
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const account of accounts) {
    const s = sums.get(account.id);
    const debits = new Decimal(s?._sum.debit?.toString() ?? "0");
    const credits = new Decimal(s?._sum.credit?.toString() ?? "0");
    const net = debits.minus(credits);

    if (net.isZero()) continue;

    const debit = net.greaterThan(0) ? net : new Decimal(0);
    const credit = net.lessThan(0) ? net.negated() : new Decimal(0);

    rows.push({ code: account.code, name: account.name, debit, credit });
    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);
  }

  return {
    rows,
    totalDebits,
    totalCredits,
    balanced: totalDebits.equals(totalCredits),
  };
}