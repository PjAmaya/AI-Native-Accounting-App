import "dotenv/config";
import { reverseEntry } from "../lib/ledger/post";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

const asOf = new Date("2026-12-31");

async function show(label: string) {
  const tb = await trialBalance(asOf);
  const sub = tb.rows.find((r) => r.code === "5010");
  console.log(
    `  ${label.padEnd(20)} debits ${tb.totalDebits.toFixed(2).padStart(9)}` +
      `   5010: ${sub ? sub.debit.toFixed(2) : "absent"}` +
      `   ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
}

async function main() {
  console.log("\nreversal\n");

  const original = await prisma.journalEntry.findUnique({ where: { entryNumber: 2 } });
  if (!original) throw new Error("Entry #2 not found.");

  await show("before reversal");

  const reversal = await reverseEntry(original.id, "wrong amount");
  console.log(
    `  created #${reversal.entryNumber} reversing #2, dated ${reversal.entryDate.toISOString().slice(0, 10)}`,
  );

  await show("after reversal");

  const refreshed = await prisma.journalEntry.findUnique({ where: { id: original.id } });
  console.log(`  original #2 status is now ${refreshed?.status}`);

  try {
    await reverseEntry(original.id);
    console.log("  FAIL  double reversal was allowed");
  } catch (e) {
    console.log(`  PASS  double reversal rejected: ${(e as Error).message}`);
  }

  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
