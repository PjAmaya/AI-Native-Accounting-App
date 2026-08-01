import "dotenv/config";
import Decimal from "decimal.js";
import { financialRatios } from "../lib/reporting/financialRatios";
import { prisma } from "../lib/db";

function pct(v: Decimal | null) {
  return v === null ? "n/a" : `${v.toFixed(1)}%`;
}

function num(v: Decimal | null) {
  return v === null ? "n/a" : v.toFixed(2);
}

async function main() {
  const from = new Date("2026-01-01");
  const to = new Date("2026-12-31");
  const r = await financialRatios(from, to);

  console.log(`\n  Financial ratios   ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}   (${r.days} days)\n`);

  console.log("  Inputs");
  console.log(`    Revenue                   ${r.revenue.toFixed(2)}`);
  console.log(`    Net income                ${r.netIncome.toFixed(2)}`);
  console.log(`    Assets    opening ${r.openingAssets.toFixed(2).padStart(10)}   closing ${r.closingAssets.toFixed(2).padStart(10)}   average ${r.averageAssets.toFixed(2).padStart(10)}`);
  console.log(`    Equity    opening ${r.openingEquity.toFixed(2).padStart(10)}   closing ${r.closingEquity.toFixed(2).padStart(10)}   average ${r.averageEquity.toFixed(2).padStart(10)}`);

  console.log("\n  Returns and leverage");
  console.log(`    Return on assets          ${pct(r.returnOnAssets)}`);
  console.log(`    Return on equity          ${pct(r.returnOnEquity)}`);
  console.log(`    Debt to equity            ${num(r.debtToEquity)}   (total liabilities ${r.totalLiabilities.toFixed(2)})`);
  console.log(`    Interest-bearing debt     ${r.interestBearingDebt.toFixed(2)}`);
  if (r.firstPeriod) {
    console.log("\n    NOTE: opening assets were zero, so average-based returns are inflated.");
  }

  console.log("\n  Collection");
  console.log(`    Accounts receivable       ${r.accountsReceivable.toFixed(2)}`);
  console.log(`    Days sales outstanding    ${r.daysSalesOutstanding === null ? "n/a" : r.daysSalesOutstanding.toString() + " days"}`);

  console.log("\n  Revenue concentration");
  for (const client of r.revenueByClient) {
    console.log(
      `    ${client.name.padEnd(28)} ${client.amount.toFixed(2).padStart(12)}   ${client.percentOfRevenue.toFixed(1).padStart(5)}%`,
    );
  }
  console.log(`    Largest client            ${pct(r.largestClientPercent)}`);
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
