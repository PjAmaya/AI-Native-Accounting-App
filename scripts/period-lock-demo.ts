import "dotenv/config";
import { setSoftLock, releaseSoftLock, setHardLock, lockHistory } from "../lib/ledger/periodLock";
import { postEntry } from "../lib/ledger/post";
import { prisma } from "../lib/db";

const WHO = "pabloamaya";

function entry(date: string, description: string) {
  return {
    entryDate: new Date(date),
    description,
    lines: [
      { accountCode: "6080", debit: "50.00", credit: "0" },
      { accountCode: "1010", debit: "0", credit: "50.00" },
    ],
  };
}

async function expectFail(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  FAIL  ${name} — was allowed`);
  } catch (e) {
    console.log(`  PASS  ${name}`);
    console.log(`        ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\nperiod locks\n");

  await setSoftLock(new Date("2026-08-31"), WHO, "August reconciled and closed");
  console.log("  soft lock set through 2026-08-31");

  await expectFail("entry into a soft-locked period is rejected", () =>
    postEntry(entry("2026-08-15", "Office supplies")),
  );

  const overridden = await postEntry({
    ...entry("2026-08-15", "Office supplies - late receipt"),
    lockOverride: { reason: "Receipt surfaced after close; immaterial", performedBy: WHO },
  });
  console.log(`\n  PASS  override accepted — entry #${overridden.entryNumber} posted into a closed period`);

  await setHardLock(new Date("2026-01-31"), WHO, "HST return filed for the period");
  console.log("\n  hard lock set through 2026-01-31");

  await expectFail("entry into a hard-locked period is rejected even with an override", () =>
    postEntry({
      ...entry("2026-01-15", "Backdated entry"),
      lockOverride: { reason: "trying to force it", performedBy: WHO },
    }),
  );

  await expectFail("hard lock cannot move backward", () =>
    setHardLock(new Date("2025-12-31"), WHO, "trying to reopen"),
  );

  await expectFail("releasing a soft lock without a reason is rejected", () =>
    releaseSoftLock(new Date("2026-01-31"), WHO, "   "),
  );

  await releaseSoftLock(new Date("2026-01-31"), WHO, "Reopening Aug-Dec to record year-end adjustments");
  console.log("\n  soft lock released back to 2026-01-31");

  const reopened = await postEntry(entry("2026-08-16", "Office supplies - after reopening"));
  console.log(`  PASS  entry #${reopened.entryNumber} posted normally after release`);

  console.log("\n  lock history (most recent first)");
  for (const e of await lockHistory(10)) {
    const dates =
      (e.previousDate ? e.previousDate.toISOString().slice(0, 10) : "none") +
      " -> " +
      (e.newDate ? e.newDate.toISOString().slice(0, 10) : "none");
    console.log(
      `    ${e.action.padEnd(20)} ${dates.padEnd(24)} ${e.performedBy.padEnd(12)} ${e.reason}`,
    );
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
