import "dotenv/config";
import Decimal from "decimal.js";
import { indirectCashFlow, type CashAdjustment } from "../lib/reporting/indirectCashFlow";
import { directCashFlow } from "../lib/reporting/cashFlow";
import { prisma } from "../lib/db";

const W = 58;

function line(label: string, value: Decimal, indent = 0) {
  console.log("  " + " ".repeat(indent) + label.padEnd(W - indent - 12) + value.toFixed(2).padStart(12));
}

function rule() {
  console.log("  " + "-".repeat(W));
}

function printAdjustments(items: CashAdjustment[]) {
  for (const item of items) {
    line(`${item.code}  ${item.name}`, item.cashEffect, 2);
  }
}

async function main() {
  const from = new Date("2026-01-01");
  const to = new Date("2026-12-31");

  const cf = await indirectCashFlow(from, to);

  console.log(`\n  Cash Flow (indirect)   ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}\n`);
  rule();

  console.log("  Operating activities");
  line("Net income", cf.netIncome, 2);
  if (cf.nonCashAdjustments.length > 0) {
    console.log("\n    Non-cash items");
    printAdjustments(cf.nonCashAdjustments);
  }
  if (cf.workingCapitalChanges.length > 0) {
    console.log("\n    Changes in working capital");
    printAdjustments(cf.workingCapitalChanges);
  }
  rule();
  line("Cash from operating activities", cf.operatingCash);

  if (cf.investing.length > 0) {
    console.log("\n  Investing activities");
    printAdjustments(cf.investing);
  }
  rule();
  line("Cash from investing activities", cf.investingCash);

  if (cf.financing.length > 0) {
    console.log("\n  Financing activities");
    printAdjustments(cf.financing);
  }
  rule();
  line("Cash from financing activities", cf.financingCash);

  rule();
  line("NET CHANGE IN CASH", cf.netChangeInCash);
  line("Cash at start of period", cf.openingCash);
  line("Cash at end of period", cf.closingCash);
  rule();
  console.log(`\n  ${cf.reconciles ? "RECONCILES to the cash accounts" : "DOES NOT RECONCILE"}`);

  const direct = await directCashFlow(from, to, "YEAR");
  const agree = direct.netChange.equals(cf.netChangeInCash);
  console.log(
    `  Direct method net change  ${direct.netChange.toFixed(2)}   ${agree ? "AGREES with indirect" : "DISAGREES with indirect"}\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
