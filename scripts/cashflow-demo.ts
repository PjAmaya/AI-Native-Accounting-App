import "dotenv/config";
import Decimal from "decimal.js";
import { directCashFlow } from "../lib/reporting/cashFlow";
import type { Granularity } from "../lib/reporting/periods";
import { prisma } from "../lib/db";

function m(v: Decimal) {
  return v.toFixed(2).padStart(12);
}

async function run(granularity: Granularity) {
  const cf = await directCashFlow(new Date("2026-01-01"), new Date("2026-12-31"), granularity);

  console.log(`\n  Direct cash flow — ${granularity}   cash accounts: ${cf.cashAccountCodes.join(", ")}\n`);
  console.log("  Period      Opening      Operating     Investing     Financing    Net change      Closing");
  console.log("  " + "-".repeat(94));

  for (const p of cf.periods) {
    if (p.netChange.isZero() && p.openingCash.isZero()) continue;
    console.log(
      `  ${p.label.padEnd(10)}${m(p.openingCash)}  ${m(p.operating)}  ${m(p.investing)}  ${m(p.financing)}  ${m(p.netChange)} ${m(p.closingCash)}`,
    );
  }

  console.log("  " + "-".repeat(94));
  console.log(
    `  ${"TOTAL".padEnd(10)}${m(cf.openingCash)}${" ".repeat(44)}${m(cf.netChange)} ${m(cf.closingCash)}`,
  );
  console.log(`\n  ${cf.reconciles ? "RECONCILES to the cash account balance" : "DOES NOT RECONCILE"}`);

  const active = cf.periods.filter((p) => p.groups.length > 0);
  for (const p of active) {
    console.log(`\n  ${p.label} detail`);
    for (const g of p.groups) {
      console.log(
        `    ${g.category.padEnd(10)} ${g.code}  ${g.name.padEnd(32)}${m(g.amount)}`,
      );
    }
  }
}

async function main() {
  await run("MONTH");
  await run("QUARTER");
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
