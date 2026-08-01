import "dotenv/config";
import { approveBill } from "../lib/invoicing/approveBill";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

const asOf = new Date("2026-12-31");

async function show(label: string) {
  const tb = await trialBalance(asOf);
  const pick = (code: string) => tb.rows.find((r) => r.code === code);
  const sub = pick("5010");
  const ap = pick("2010");
  console.log(
    `  ${label.padEnd(20)} debits ${tb.totalDebits.toFixed(2).padStart(10)}` +
      `   5010 ${(sub ? sub.debit.toFixed(2) : "-").padStart(9)}` +
      `   2010 ${(ap ? ap.credit.toFixed(2) : "-").padStart(9)}` +
      `   ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
}

async function main() {
  console.log("\napprove bill\n");

  const bill = await prisma.bill.findFirstOrThrow({
    where: { billNumber: 1 },
    include: { contact: true },
  });
  console.log(
    `  bill #${bill.billNumber}  ${bill.contact.name}  ${bill.supplierInvoiceNumber}` +
      `  total ${bill.total.toString()}  status ${bill.status}\n`,
  );

  await show("before approving");

  const approved = await approveBill(bill.id);
  console.log(
    `  approved  status ${approved.status}  entry #${approved.journalEntry?.entryNumber} ${approved.journalEntry?.status}`,
  );

  await show("after approving");

  try {
    await approveBill(bill.id);
    console.log("  FAIL  double approval was allowed");
  } catch (e) {
    console.log(`  PASS  double approval rejected: ${(e as Error).message}`);
  }

  const drafts = await prisma.bill.findMany({
    where: { status: "DRAFT" },
    orderBy: { billNumber: "asc" },
  });
  console.log(
    `\n  still in draft: ${drafts.map((b) => `#${b.billNumber} (${b.total.toString()})`).join(", ")}`,
  );
  console.log("  those totals are absent from the trial balance above\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
