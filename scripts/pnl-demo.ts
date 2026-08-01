import "dotenv/config";
import Decimal from "decimal.js";
import { profitAndLoss, type PnlSection } from "../lib/reporting/profitAndLoss";
import { prisma } from "../lib/db";

const W = 62;

function money(value: Decimal) {
  return value.toFixed(2).padStart(12);
}

function line(label: string, value: Decimal, indent = 0) {
  console.log("  " + " ".repeat(indent) + label.padEnd(W - indent - 12) + money(value));
}

function rule() {
  console.log("  " + "-".repeat(W));
}

function printSection(section: PnlSection) {
  if (section.rows.length === 0) return;
  console.log(`\n  ${section.title}`);
  for (const row of section.rows) {
    line(`${row.code}  ${row.name}`, row.balance, 2);
  }
  line(`Total ${section.title.toLowerCase()}`, section.total, 2);
}

function percent(value: Decimal | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

async function main() {
  const from = new Date("2026-01-01");
  const to = new Date("2026-12-31");
  const pnl = await profitAndLoss(from, to);

  console.log(
    `\n  Profit & Loss   ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}\n`,
  );
  rule();

  printSection(pnl.revenue);
  printSection(pnl.costOfServices);
  rule();
  line("GROSS PROFIT", pnl.grossProfit);

  printSection(pnl.operatingExpenses);
  rule();
  line("OPERATING INCOME", pnl.operatingIncome);

  printSection(pnl.otherIncome);
  printSection(pnl.otherExpenses);
  rule();
  line("NET INCOME", pnl.netIncome);
  rule();

  console.log("\n  EBITDA reconciliation");
  line("Net income", pnl.netIncome, 2);
  if (pnl.addBacks.length === 0) {
    console.log("    (no add-backs in this period)");
  }
  for (const item of pnl.addBacks) {
    line(`${item.code}  ${item.name} (${item.category})`, item.amount, 2);
  }
  line("EBITDA", pnl.ebitda, 2);

  console.log("\n  Ratios");
  console.log(`    Gross margin              ${percent(pnl.ratios.grossMargin)}`);
  console.log(`    Operating margin          ${percent(pnl.ratios.operatingMargin)}`);
  console.log(`    EBITDA margin             ${percent(pnl.ratios.ebitdaMargin)}`);
  console.log(`    Net margin                ${percent(pnl.ratios.netMargin)}`);
  console.log(`    Operating expense ratio   ${percent(pnl.ratios.operatingExpenseRatio)}`);
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
