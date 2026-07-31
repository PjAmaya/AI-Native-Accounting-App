import "dotenv/config";
import { postEntry } from "../lib/ledger/post";
import { prisma } from "../lib/db";

async function main() {
  const entry = await postEntry({
    entryDate: new Date("2026-07-31"),
    description: "Invoice 1001 - July consulting, Client A",
    lines: [
      { accountCode: "1200", debit: "8000.00", credit: "0", description: "Client A - July" },
      { accountCode: "4010", debit: "0", credit: "8000.00", description: "Consulting fees" },
    ],
  });

  console.log(`\nPosted entry #${entry.entryNumber} — ${entry.description}`);
  for (const line of entry.lines) {
    console.log(`  ${line.lineNumber}. debit ${line.debit}  credit ${line.credit}`);
  }
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n" + e.message + "\n");
    await prisma.$disconnect();
    process.exit(1);
  });