import Decimal from "decimal.js";
import { prisma } from "../db";
import { accountActivity, sumBalances } from "./activity";

export type ClientRevenue = {
  name: string;
  amount: Decimal;
  percentOfRevenue: Decimal;
};

export type FinancialRatios = {
  from: Date;
  to: Date;
  days: number;
  revenue: Decimal;
  netIncome: Decimal;
  openingAssets: Decimal;
  closingAssets: Decimal;
  averageAssets: Decimal;
  openingEquity: Decimal;
  closingEquity: Decimal;
  averageEquity: Decimal;
  totalLiabilities: Decimal;
  returnOnAssets: Decimal | null;
  returnOnEquity: Decimal | null;
  debtToEquity: Decimal | null;
  interestBearingDebt: Decimal;
  accountsReceivable: Decimal;
  daysSalesOutstanding: Decimal | null;
  revenueByClient: ClientRevenue[];
  largestClientPercent: Decimal | null;
  firstPeriod: boolean;
};

const AR_CODE = "1200";
const DEBT_CODES = ["2020"];

function dayBefore(date: Date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function pct(numerator: Decimal, denominator: Decimal): Decimal | null {
  if (denominator.isZero() || denominator.isNegative()) return null;
  return numerator.dividedBy(denominator).times(100).toDecimalPlaces(1);
}

async function positionAt(date: Date) {
  const rows = await accountActivity({ to: date });
  const assets = sumBalances(rows.filter((r) => r.type === "ASSET"));
  const liabilities = sumBalances(rows.filter((r) => r.type === "LIABILITY"));
  const permanentEquity = sumBalances(rows.filter((r) => r.type === "EQUITY"));
  const earnings = sumBalances(rows.filter((r) => r.type === "REVENUE")).minus(
    sumBalances(rows.filter((r) => r.type === "EXPENSE")),
  );
  const debt = sumBalances(rows.filter((r) => DEBT_CODES.includes(r.code)));
  const receivables = sumBalances(rows.filter((r) => r.code === AR_CODE));

  return {
    assets,
    liabilities,
    equity: permanentEquity.plus(earnings),
    debt,
    receivables,
  };
}

export async function financialRatios(from: Date, to: Date): Promise<FinancialRatios> {
  if (to < from) throw new Error("Period end cannot be before period start.");

  const opening = await positionAt(dayBefore(from));
  const closing = await positionAt(to);

  const periodRows = await accountActivity({ from, to });
  const revenue = sumBalances(periodRows.filter((r) => r.type === "REVENUE"));
  const expenses = sumBalances(periodRows.filter((r) => r.type === "EXPENSE"));
  const netIncome = revenue.minus(expenses);

  const averageAssets = opening.assets.plus(closing.assets).dividedBy(2);
  const averageEquity = opening.equity.plus(closing.equity).dividedBy(2);

  const days = daysBetween(from, to);

  const grouped = await prisma.journalLine.groupBy({
    by: ["contactId"],
    where: {
      account: { type: "REVENUE" },
      entry: {
        status: { in: ["POSTED", "REVERSED"] },
        entryDate: { gte: from, lte: to },
      },
    },
    _sum: { credit: true, debit: true },
  });

  const contactIds = grouped
    .map((g) => g.contactId)
    .filter((id): id is string => Boolean(id));
  const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds } } });
  const nameById = new Map(contacts.map((c) => [c.id, c.name]));

  const revenueByClient = grouped
    .map((g) => {
      const amount = new Decimal(g._sum.credit?.toString() ?? "0").minus(
        new Decimal(g._sum.debit?.toString() ?? "0"),
      );
      return {
        name: g.contactId ? (nameById.get(g.contactId) ?? "Unknown") : "Unattributed",
        amount,
        percentOfRevenue: pct(amount, revenue) ?? new Decimal(0),
      };
    })
    .filter((r) => !r.amount.isZero())
    .sort((a, b) => b.amount.comparedTo(a.amount));

  return {
    from,
    to,
    days,
    revenue,
    netIncome,
    openingAssets: opening.assets,
    closingAssets: closing.assets,
    averageAssets,
    openingEquity: opening.equity,
    closingEquity: closing.equity,
    averageEquity,
    totalLiabilities: closing.liabilities,
    returnOnAssets: pct(netIncome, averageAssets),
    returnOnEquity: pct(netIncome, averageEquity),
    debtToEquity: closing.equity.isZero() || closing.equity.isNegative()
      ? null
      : closing.liabilities.dividedBy(closing.equity).toDecimalPlaces(2),
    interestBearingDebt: closing.debt,
    accountsReceivable: closing.receivables,
    daysSalesOutstanding: revenue.isZero()
      ? null
      : closing.receivables.dividedBy(revenue).times(days).toDecimalPlaces(0),
    revenueByClient,
    largestClientPercent: revenueByClient.length > 0 ? revenueByClient[0].percentOfRevenue : null,
    firstPeriod: opening.assets.isZero(),
  };
}
