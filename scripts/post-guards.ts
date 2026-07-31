import "dotenv/config";
import { postEntry } from "../lib/ledger/post";
import { prisma } from "../lib/db";

async function shouldFail(name: string, draft: Parameters<typeof postEntry>[0]) {
  try {
    await postEntry(draft);
    console.log(`  FAIL  ${name} — was accepted but should have been rejected`);
  } catch (e) {
    console.log(`  PASS  ${name}`);
    console.log(`        ${(e as Error).message.split("\n").join(" / ")}`);
  }
}

async function main() {
  const before = await prisma.journalEntry.count();
  console.log(`\npostEntry guards (entries before: ${before})\n`);

  await shouldFail("rejects an unbalanced entry", {
    entryDate: new Date("2026-07-31"),
    description: "unbalanced",
    lines: [
      { accountCode: "1200", debit: "8000.00", credit: "0" },
      { accountCode: "4010", debit: "0", credit: "7999.99" },
    ],
  });

  await shouldFail("rejects a heading account", {
    entryDate: new Date("2026-07-31"),
    description: "posting to a header",
    lines: [
      { accountCode: "1000", debit: "100.00", credit: "0" },
      { accountCode: "4010", debit: "0", credit: "100.00" },
    ],
  });

  await shouldFail("rejects an account that does not exist", {
    entryDate: new Date("2026-07-31"),
    description: "bad account code",
    lines: [
      { accountCode: "9999", debit: "100.00", credit: "0" },
      { accountCode: "4010", debit: "0", credit: "100.00" },
    ],
  });

  const after = await prisma.journalEntry.count();
  console.log(`\nentries after: ${after}`);
  console.log(after === before ? "PASS  nothing was written\n" : "FAIL  something leaked through\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });