import "dotenv/config";
import { setSoftLock } from "../lib/ledger/periodLock";
import { postEntry } from "../lib/ledger/post";
import { prisma } from "../lib/db";

async function countOverrides() {
  return prisma.periodLockEvent.count({ where: { action: "SOFT_LOCK_OVERRIDE" } });
}

async function main() {
  await setSoftLock(new Date("2026-08-31"), "pabloamaya", "Reclosing August for override test");

  const before = await countOverrides();

  const entry = await postEntry({
    entryDate: new Date("2026-08-20"),
    description: "Override log test",
    lines: [
      { accountCode: "6080", debit: "12.00", credit: "0" },
      { accountCode: "1010", debit: "0", credit: "12.00" },
    ],
    lockOverride: { reason: "Single-log verification", performedBy: "pabloamaya" },
  });

  const after = await countOverrides();
  const added = after - before;

  console.log(`\n  posted entry #${entry.entryNumber} into a soft-locked period`);
  console.log(`  override rows before ${before}, after ${after}, added ${added}`);
  console.log(`  ${added === 1 ? "PASS  exactly one log row per override" : `FAIL  expected 1, got ${added}`}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
