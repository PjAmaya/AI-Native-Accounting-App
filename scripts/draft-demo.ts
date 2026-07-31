import "dotenv/config";
import { createDraftEntry, postDraft } from "../lib/ledger/post";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

const asOf = new Date("2026-12-31");

async function show(label: string) {
  const tb = await trialBalance(asOf);
  const sub = tb.rows.find((r) => r.code === "5010");
  console.log(
    `  ${label.padEnd(30)} total debits ${tb.totalDebits.toFixed(2).padStart(9)}` +
      `   5010 present: ${sub ? "YES" : "no"}`,
  );
}

async function main() {
  console.log("\ndraft / post lifecycle\n");

  await show("before draft");

  const draft = await createDraftEntry({
    entryDate: new Date("2026-07-31"),
    description: "Partner A - July delivery",
    lines: [
      { accountCode: "5010", debit: "3000.00", credit: "0" },
      { accountCode: "2010", debit: "0", credit: "3000.00" },
    ],
  });
  console.log(`  created draft #${draft.entryNumber} (status ${draft.status})`);

  await show("after draft created");

  const posted = await postDraft(draft.id);
  console.log(`  posted #${posted.entryNumber} (status ${posted.status})`);

  await show("after posting");

  try {
    await postDraft(draft.id);
    console.log("  FAIL  double-posting was allowed");
  } catch (e) {
    console.log(`  PASS  double-post rejected: ${(e as Error).message}`);
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
