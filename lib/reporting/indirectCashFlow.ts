import Decimal from "decimal.js";
import { prisma } from "../db";
import { accountActivity, sumBalances, type AccountActivity } from "./activity";

const CASH_PARENT_CODE = "1000";
const DEBT_CODES = ["2020"];

export type AdjustmentKind = "NON_CASH" | "WORKING_CAPITAL";

export type CashAdjustment = {
  code: string;
  name: string;
  kind: AdjustmentKind;
  change: Decimal;
  cashEffect: Decimal;
};

export type IndirectCashFlow = {
  from: Date;
  to: Date;
  netIncome: Decimal;
  nonCashAdjustments: CashAdjustment[];
  workingCapitalChanges: CashAdjustment[];
  operatingCash: Decimal;
  investing: CashAdjustment[];
  investingCash: Decimal;
  financing: CashAdjustment[];
  financingCash: Decimal;
  netChangeInCash: Decimal;
  openingCash: Decimal;
  closingCash: Decimal;
  reconciles: boolean;
};

function balanceMap(rows: AccountActivity[]) {
  return new Map(rows.map((r) => [r.code, r]));
}

export async function indirectCashFlow(from: Date, to: Date): Promise<IndirectCashFlow> {
  if (to < from) throw new Error("Period end cannot be before period start.");

  const parent = await prisma.account.findUnique({ where: { code: CASH_PARENT_CODE } });
  if (!parent) throw new Error(`Account ${CASH_PARENT_CODE} does not exist.`);
  const cashAccounts = await prisma.account.findMany({ where: { parentId: parent.id } });
  const cashCodes = new Set(cashAccounts.map((a) => a.code));

  const dayBefore = new Date(from.getTime());
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  const openingRows = await accountActivity({ to: dayBefore });
  const closingRows = await accountActivity({ to });
  const periodRows = await accountActivity({ from, to });

  const opening = balanceMap(openingRows);
  const closing = balanceMap(closingRows);

  const openingCash = sumBalances(openingRows.filter((r) => cashCodes.has(r.code)));
  const closingCash = sumBalances(closingRows.filter((r) => cashCodes.has(r.code)));

  const netIncome = sumBalances(periodRows.filter((r) => r.type === "REVENUE")).minus(
    sumBalances(periodRows.filter((r) => r.type === "EXPENSE")),
  );

  const codes = new Set([...opening.keys(), ...closing.keys()]);

  const nonCashAdjustments: CashAdjustment[] = [];
  const workingCapitalChanges: CashAdjustment[] = [];
  const investing: CashAdjustment[] = [];
  const financing: CashAdjustment[] = [];

  for (const code of codes) {
    if (cashCodes.has(code)) continue;

    const row = closing.get(code) ?? opening.get(code)!;
    if (row.type === "REVENUE" || row.type === "EXPENSE") continue;

    const before = opening.get(code)?.balance ?? new Decimal(0);
    const after = closing.get(code)?.balance ?? new Decimal(0);
    const change = after.minus(before);
    if (change.isZero()) continue;

    const cashEffect = row.type === "ASSET" ? change.negated() : change;
    const entry: CashAdjustment = { code, name: row.name, kind: "WORKING_CAPITAL", change, cashEffect };

    const isContra =
      (row.type === "ASSET" && row.normalBalance === "CREDIT") ||
      (row.type !== "ASSET" && row.normalBalance === "DEBIT" && row.type !== "EQUITY");

    if (row.subType === "FIXED_ASSET" && isContra) {
      nonCashAdjustments.push({ ...entry, kind: "NON_CASH" });
    } else if (row.subType === "FIXED_ASSET") {
      investing.push(entry);
    } else if (row.type === "EQUITY" || row.subType === "LONG_TERM_LIABILITY" || DEBT_CODES.includes(code)) {
      financing.push(entry);
    } else {
      workingCapitalChanges.push(entry);
    }
  }

  const sortByCode = (a: CashAdjustment, b: CashAdjustment) => a.code.localeCompare(b.code);
  nonCashAdjustments.sort(sortByCode);
  workingCapitalChanges.sort(sortByCode);
  investing.sort(sortByCode);
  financing.sort(sortByCode);

  const total = (items: CashAdjustment[]) =>
    items.reduce((sum, i) => sum.plus(i.cashEffect), new Decimal(0));

  const operatingCash = netIncome
    .plus(total(nonCashAdjustments))
    .plus(total(workingCapitalChanges));
  const investingCash = total(investing);
  const financingCash = total(financing);
  const netChangeInCash = operatingCash.plus(investingCash).plus(financingCash);

  return {
    from,
    to,
    netIncome,
    nonCashAdjustments,
    workingCapitalChanges,
    operatingCash,
    investing,
    investingCash,
    financing,
    financingCash,
    netChangeInCash,
    openingCash,
    closingCash,
    reconciles: netChangeInCash.equals(closingCash.minus(openingCash)),
  };
}
