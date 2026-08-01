import Decimal from "decimal.js";
import { accountActivity, bySubType, sumBalances, type AccountActivity } from "./activity";

export type PnlSection = {
  title: string;
  rows: AccountActivity[];
  total: Decimal;
};

export type PnlRatios = {
  grossMargin: Decimal | null;
  operatingMargin: Decimal | null;
  ebitdaMargin: Decimal | null;
  netMargin: Decimal | null;
  operatingExpenseRatio: Decimal | null;
};

export type ProfitAndLoss = {
  from: Date;
  to: Date;
  revenue: PnlSection;
  costOfServices: PnlSection;
  grossProfit: Decimal;
  operatingExpenses: PnlSection;
  operatingIncome: Decimal;
  otherIncome: PnlSection;
  otherExpenses: PnlSection;
  netIncome: Decimal;
  ebitda: Decimal;
  addBacks: { code: string; name: string; category: string; amount: Decimal }[];
  ratios: PnlRatios;
};

function section(title: string, rows: AccountActivity[]): PnlSection {
  return { title, rows, total: sumBalances(rows) };
}

function ratio(numerator: Decimal, denominator: Decimal): Decimal | null {
  if (denominator.isZero()) return null;
  return numerator.dividedBy(denominator).times(100).toDecimalPlaces(1);
}

export async function profitAndLoss(from: Date, to: Date): Promise<ProfitAndLoss> {
  if (to < from) throw new Error("Period end cannot be before period start.");

  const rows = await accountActivity({ from, to });

  const revenue = section("Revenue", bySubType(rows, ["OPERATING_REVENUE"]));
  const costOfServices = section("Cost of services", bySubType(rows, ["COST_OF_SERVICES"]));
  const operatingExpenses = section("Operating expenses", bySubType(rows, ["OPERATING_EXPENSE"]));
  const otherIncome = section("Other income", bySubType(rows, ["OTHER_INCOME"]));
  const otherExpenses = section("Other expenses", bySubType(rows, ["OTHER_EXPENSE"]));

  const grossProfit = revenue.total.minus(costOfServices.total);
  const operatingIncome = grossProfit.minus(operatingExpenses.total);
  const netIncome = operatingIncome.plus(otherIncome.total).minus(otherExpenses.total);

  const addBacks = rows
    .filter((row) => row.ebitdaAddBack !== "NONE" && !row.balance.isZero())
    .map((row) => ({
      code: row.code,
      name: row.name,
      category: row.ebitdaAddBack,
      amount: row.type === "REVENUE" ? row.balance.negated() : row.balance,
    }));

  const ebitda = addBacks.reduce((sum, item) => sum.plus(item.amount), netIncome);

  return {
    from,
    to,
    revenue,
    costOfServices,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    otherIncome,
    otherExpenses,
    netIncome,
    ebitda,
    addBacks,
    ratios: {
      grossMargin: ratio(grossProfit, revenue.total),
      operatingMargin: ratio(operatingIncome, revenue.total),
      ebitdaMargin: ratio(ebitda, revenue.total),
      netMargin: ratio(netIncome, revenue.total),
      operatingExpenseRatio: ratio(operatingExpenses.total, revenue.total),
    },
  };
}
