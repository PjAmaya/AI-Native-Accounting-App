import "dotenv/config";
import Decimal from "decimal.js";
import { arAging, apAging, AGING_BUCKETS, AGING_LABELS, type AgingReport } from "../lib/reporting/aging";
import { prisma } from "../lib/db";

function m(v: Decimal) {
  return v.toFixed(2).padStart(12);
}

function print(report: AgingReport) {
  console.log(
    `\n  ${report.direction} aging as at ${report.asOf.toISOString().slice(0, 10)}   (GL account ${report.accountCode})\n`,
  );

  if (report.rows.length === 0) {
    console.log("    nothing outstanding\n");
  } else {
    console.log("  Document                                    Due          Days      Total       Applied  Outstanding");
    console.log("  " + "-".repeat(104));
    for (const row of report.rows) {
      console.log(
        "  " +
          `${row.documentNumber} - ${row.contactName}`.slice(0, 42).padEnd(42) +
          row.dueDate.toISOString().slice(0, 10).padStart(12) +
          String(row.daysPastDue).padStart(8) +
          m(row.total) +
          m(row.applied) +
          m(row.outstanding),
      );
    }
  }

  console.log("\n  By bucket");
  for (const bucket of AGING_BUCKETS) {
    const amount = report.byBucket[bucket];
    if (amount.isZero()) continue;
    console.log(`    ${AGING_LABELS[bucket].padEnd(16)}${m(amount)}`);
  }

  console.log("\n  By contact");
  for (const c of report.byContact) {
    console.log(`    ${c.name.padEnd(32)}${m(c.outstanding)}`);
  }

  console.log("\n  Subledger to GL reconciliation");
  console.log(`    Sum of open documents ${m(report.subledgerTotal)}`);
  console.log(`    GL account balance    ${m(report.glBalance)}`);
  console.log(`    Difference            ${m(report.difference)}`);
  console.log(`    ${report.ties ? "TIES" : "DOES NOT TIE - investigate"}`);
}

async function main() {
  const asOf = new Date("2026-12-31");
  print(await arAging(asOf));
  print(await apAging(asOf));
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
