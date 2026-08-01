import "dotenv/config";
import Decimal from "decimal.js";
import { balanceSheet, type BsSection } from "../lib/reporting/balanceSheet";
import { prisma } from "../lib/db";

const W = 62;

function line(label: string, value: Decimal, indent = 0) {
  console.log("  " + " ".repeat(indent) + label.padEnd(W - indent - 12) + value.toFixed(2).padStart(12));
}

function rule() {
  console.log("  " + "-".repeat(W));
}

function printSection(s: BsSection) {
  if (s.rows.length === 0) return;
  console.log(`\n  ${s.title}`);
  for (const row of s.rows) {
    line(`${row.code}  ${row.name}`, row.balance, 2);
  }
  line(`Total ${s.title.toLowerCase()}`, s.total, 2);
}

async function main() {
  const asOf = new Date("2026-12-31");
  const fyStart = new Date("2026-01-01");
  const bs = await balanceSheet(asOf, fyStart);

  console.log(`\n  Balance Sheet as at ${asOf.toISOString().slice(0, 10)}\n`);
  rule();

  printSection(bs.currentAssets);
  printSection(bs.fixedAssets);
  rule();
  line("TOTAL ASSETS", bs.totalAssets);
  rule();

  printSection(bs.currentLiabilities);
  printSection(bs.longTermLiabilities);
  rule();
  line("Total liabilities", bs.totalLiabilities);

  console.log("\n  Equity");
  for (const row of bs.ownersEquity.rows) {
    line(`${row.code}  ${row.name}`, row.balance, 2);
  }
  line("Current period earnings", bs.currentPeriodEarnings, 2);
  line("Total equity", bs.totalEquity, 2);
  rule();
  line("TOTAL LIABILITIES AND EQUITY", bs.totalLiabilitiesAndEquity);
  rule();

  console.log(
    `\n  ${bs.balanced ? "BALANCED" : `OUT OF BALANCE by ${bs.difference.toFixed(2)}`}`,
  );
  console.log(`  Working capital   ${bs.workingCapital.toFixed(2)}`);
  console.log(
    `  Current ratio     ${bs.currentRatio === null ? "n/a" : bs.currentRatio.toFixed(2)}\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
