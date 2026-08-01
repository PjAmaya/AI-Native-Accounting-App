import Decimal from "decimal.js";
import { prisma } from "../db";
import { periodsBetween, type Granularity, type Period } from "./periods";

const CASH_PARENT_CODE = "1000";
const DEBT_CODES = ["2020"];

export type CashCategory = "OPERATING" | "INVESTING" | "FINANCING";

export type CashFlowGroup = {
  code: string;
  name: string;
  category: CashCategory;
  amount: Decimal;
};

export type CashFlowPeriod = {
  label: string;
  from: Date;
  to: Date;
  openingCash: Decimal;
  operating: Decimal;
  investing: Decimal;
  financing: Decimal;
  inflows: Decimal;
  outflows: Decimal;
  netChange: Decimal;
  closingCash: Decimal;
  groups: CashFlowGroup[];
};

export type DirectCashFlow = {
  from: Date;
  to: Date;
  granularity: Granularity;
  cashAccountCodes: string[];
  periods: CashFlowPeriod[];
  openingCash: Decimal;
  closingCash: Decimal;
  netChange: Decimal;
  reconciles: boolean;
};

async function cashAccountIds() {
  const parent = await prisma.account.findUnique({ where: { code: CASH_PARENT_CODE } });
  if (!parent) throw new Error(`Account ${CASH_PARENT_CODE} does not exist.`);
  const children = await prisma.account.findMany({
    where: { parentId: parent.id },
    orderBy: { code: "asc" },
  });
  if (children.length === 0) {
    throw new Error(`Account ${CASH_PARENT_CODE} has no child accounts, so no cash accounts are defined.`);
  }
  return children;
}

async function cashBalanceAt(ids: string[], date: Date) {
  const agg = await prisma.journalLine.aggregate({
    where: {
      accountId: { in: ids },
      entry: { status: { in: ["POSTED", "REVERSED"] }, entryDate: { lte: date } },
    },
    _sum: { debit: true, credit: true },
  });
  return new Decimal(agg._sum.debit?.toString() ?? "0").minus(
    new Decimal(agg._sum.credit?.toString() ?? "0"),
  );
}

function classify(account: {
  code: string;
  type: string;
  subType: string;
}): CashCategory {
  if (account.subType === "FIXED_ASSET") return "INVESTING";
  if (account.type === "EQUITY") return "FINANCING";
  if (account.subType === "LONG_TERM_LIABILITY") return "FINANCING";
  if (DEBT_CODES.includes(account.code)) return "FINANCING";
  return "OPERATING";
}

async function periodMovements(cashIds: Set<string>, period: Period) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      status: { in: ["POSTED", "REVERSED"] },
      entryDate: { gte: period.from, lte: period.to },
      lines: { some: { accountId: { in: [...cashIds] } } },
    },
    include: { lines: { include: { account: true } } },
  });

  const groups = new Map<string, CashFlowGroup>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (cashIds.has(line.accountId)) continue;

      const amount = new Decimal(line.credit.toString()).minus(
        new Decimal(line.debit.toString()),
      );
      if (amount.isZero()) continue;

      const existing = groups.get(line.account.code);
      if (existing) {
        existing.amount = existing.amount.plus(amount);
      } else {
        groups.set(line.account.code, {
          code: line.account.code,
          name: line.account.name,
          category: classify(line.account),
          amount,
        });
      }
    }
  }

  return [...groups.values()]
    .filter((g) => !g.amount.isZero())
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function directCashFlow(
  from: Date,
  to: Date,
  granularity: Granularity = "MONTH",
): Promise<DirectCashFlow> {
  const accounts = await cashAccountIds();
  const ids = accounts.map((a) => a.id);
  const idSet = new Set(ids);

  const dayBeforeStart = new Date(from.getTime());
  dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);

  const openingCash = await cashBalanceAt(ids, dayBeforeStart);
  let running = openingCash;

  const periods: CashFlowPeriod[] = [];

  for (const period of periodsBetween(from, to, granularity)) {
    const groups = await periodMovements(idSet, period);

    const sumBy = (category: CashCategory) =>
      groups
        .filter((g) => g.category === category)
        .reduce((sum, g) => sum.plus(g.amount), new Decimal(0));

    const operating = sumBy("OPERATING");
    const investing = sumBy("INVESTING");
    const financing = sumBy("FINANCING");
    const netChange = operating.plus(investing).plus(financing);

    const inflows = groups
      .filter((g) => g.amount.greaterThan(0))
      .reduce((sum, g) => sum.plus(g.amount), new Decimal(0));
    const outflows = groups
      .filter((g) => g.amount.lessThan(0))
      .reduce((sum, g) => sum.plus(g.amount), new Decimal(0));

    const opening = running;
    running = running.plus(netChange);

    periods.push({
      label: period.label,
      from: period.from,
      to: period.to,
      openingCash: opening,
      operating,
      investing,
      financing,
      inflows,
      outflows,
      netChange,
      closingCash: running,
      groups,
    });
  }

  const actualClosing = await cashBalanceAt(ids, to);

  return {
    from,
    to,
    granularity,
    cashAccountCodes: accounts.map((a) => a.code),
    periods,
    openingCash,
    closingCash: running,
    netChange: running.minus(openingCash),
    reconciles: running.equals(actualClosing),
  };
}
