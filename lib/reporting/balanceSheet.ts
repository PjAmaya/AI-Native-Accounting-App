import Decimal from "decimal.js";
import { accountActivity, bySubType, sumBalances, type AccountActivity } from "./activity";

export type BsSection = {
  title: string;
  rows: AccountActivity[];
  total: Decimal;
};

export type BalanceSheet = {
  asOf: Date;
  fiscalYearStart: Date;
  currentAssets: BsSection;
  fixedAssets: BsSection;
  totalAssets: Decimal;
  currentLiabilities: BsSection;
  longTermLiabilities: BsSection;
  totalLiabilities: Decimal;
  ownersEquity: BsSection;
  currentPeriodEarnings: Decimal;
  totalEquity: Decimal;
  totalLiabilitiesAndEquity: Decimal;
  balanced: boolean;
  difference: Decimal;
  workingCapital: Decimal;
  currentRatio: Decimal | null;
};

function section(title: string, rows: AccountActivity[]): BsSection {
  return { title, rows, total: sumBalances(rows) };
}

export async function balanceSheet(asOf: Date, fiscalYearStart: Date): Promise<BalanceSheet> {
  if (asOf < fiscalYearStart) {
    throw new Error("As-of date cannot be before the fiscal year start.");
  }

  const inceptionToDate = await accountActivity({ to: asOf });
  const thisYear = await accountActivity({ from: fiscalYearStart, to: asOf });

  const currentAssets = section("Current assets", bySubType(inceptionToDate, ["CURRENT_ASSET"]));
  const fixedAssets = section("Fixed assets", bySubType(inceptionToDate, ["FIXED_ASSET"]));
  const totalAssets = currentAssets.total.plus(fixedAssets.total);

  const currentLiabilities = section(
    "Current liabilities",
    bySubType(inceptionToDate, ["CURRENT_LIABILITY"]),
  );
  const longTermLiabilities = section(
    "Long-term liabilities",
    bySubType(inceptionToDate, ["LONG_TERM_LIABILITY"]),
  );
  const totalLiabilities = currentLiabilities.total.plus(longTermLiabilities.total);

  const ownersEquity = section("Owner's equity", bySubType(inceptionToDate, ["OWNERS_EQUITY"]));

  const periodRevenue = sumBalances(
    thisYear.filter((r) => r.type === "REVENUE"),
  );
  const periodExpenses = sumBalances(
    thisYear.filter((r) => r.type === "EXPENSE"),
  );
  const currentPeriodEarnings = periodRevenue.minus(periodExpenses);

  const totalEquity = ownersEquity.total.plus(currentPeriodEarnings);
  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const difference = totalAssets.minus(totalLiabilitiesAndEquity);

  const workingCapital = currentAssets.total.minus(currentLiabilities.total);
  const currentRatio = currentLiabilities.total.isZero()
    ? null
    : currentAssets.total.dividedBy(currentLiabilities.total).toDecimalPlaces(2);

  return {
    asOf,
    fiscalYearStart,
    currentAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    longTermLiabilities,
    totalLiabilities,
    ownersEquity,
    currentPeriodEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanced: difference.isZero(),
    difference,
    workingCapital,
    currentRatio,
  };
}
