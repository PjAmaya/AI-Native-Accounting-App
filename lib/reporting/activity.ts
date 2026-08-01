import Decimal from "decimal.js";
import { prisma } from "../db";
import type { AccountSubType, AccountType, EbitdaAddBack, NormalBalance } from "../generated/prisma/enums";

export type AccountActivity = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  normalBalance: NormalBalance;
  ebitdaAddBack: EbitdaAddBack;
  debits: Decimal;
  credits: Decimal;
  balance: Decimal;
};

export type ActivityWindow = {
  from?: Date;
  to: Date;
};

export async function accountActivity(window: ActivityWindow): Promise<AccountActivity[]> {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      entry: {
        status: { in: ["POSTED", "REVERSED"] },
        entryDate: window.from ? { gte: window.from, lte: window.to } : { lte: window.to },
      },
    },
    _sum: { debit: true, credit: true },
  });

  const sums = new Map(grouped.map((g) => [g.accountId, g]));

  const accounts = await prisma.account.findMany({
    where: { id: { in: grouped.map((g) => g.accountId) } },
    orderBy: { code: "asc" },
  });

  return accounts.map((account) => {
    const s = sums.get(account.id);
    const debits = new Decimal(s?._sum.debit?.toString() ?? "0");
    const credits = new Decimal(s?._sum.credit?.toString() ?? "0");
    const debitNatured = account.type === "ASSET" || account.type === "EXPENSE";
    const balance =
      debitNatured ? debits.minus(credits) : credits.minus(debits);

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      normalBalance: account.normalBalance,
      ebitdaAddBack: account.ebitdaAddBack,
      debits,
      credits,
      balance,
    };
  });
}

export function sumBalances(rows: AccountActivity[]): Decimal {
  return rows.reduce((total, row) => total.plus(row.balance), new Decimal(0));
}

export function bySubType(rows: AccountActivity[], subTypes: AccountSubType[]): AccountActivity[] {
  const wanted = new Set(subTypes);
  return rows.filter((row) => wanted.has(row.subType) && !row.balance.isZero());
}
