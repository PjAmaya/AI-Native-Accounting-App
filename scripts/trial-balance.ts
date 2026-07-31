import "dotenv/config";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

async function main() {
  const asOf = new Date("2026-12-31");
  const tb = await trialBalance(asOf);

  console.log(`\nTrial Balance as of ${asOf.toISOString().slice(0, 10)}\n`);
  console.log("  Code   Account                             Debit        Credit");
  console.log("  " + "-".repeat(66));

  for (const row of tb.rows) {
    console.log(
      "  " +
        row.code.padEnd(7) +
        row.name.padEnd(34) +
        row.debit.toFixed(2).padStart(10) +
        row.credit.toFixed(2).padStart(14),
    );
  }

  console.log("  " + "-".repeat(66));
  console.log(
    "  " +
      "TOTAL".padEnd(41) +
      tb.totalDebits.toFixed(2).padStart(10) +
      tb.totalCredits.toFixed(2).padStart(14),
  );
  console.log(`\n  ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });