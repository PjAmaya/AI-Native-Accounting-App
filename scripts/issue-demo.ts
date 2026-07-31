import "dotenv/config";
import { issueInvoice } from "../lib/invoicing/issueInvoice";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

const asOf = new Date("2026-12-31");

async function show(label: string) {
  const tb = await trialBalance(asOf);
  const ar = tb.rows.find((r) => r.code === "1200");
  const hst = tb.rows.find((r) => r.code === "2100");
  console.log(
    `  ${label.padEnd(18)} debits ${tb.totalDebits.toFixed(2).padStart(10)}` +
      `   1200 AR ${ar ? ar.debit.toFixed(2).padStart(10) : "     absent"}` +
      `   2100 HST ${hst ? hst.credit.toFixed(2).padStart(8) : "  absent"}` +
      `   ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
}

async function main() {
  console.log("\nissue invoice\n");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: "INV-2026-0001" },
  });
  if (!invoice) throw new Error("INV-2026-0001 not found. Run invoice-demo.ts first.");

  await show("before issuing");

  const issued = await issueInvoiceTry(invoice.id);

  await show("after issuing");

  try {
    await issueInvoice(invoice.id);
    console.log("  FAIL  double issue was allowed");
  } catch (e) {
    console.log(`  PASS  double issue rejected: ${(e as Error).message}`);
  }

  console.log(
    `\n  ${issued.invoiceNumber}  ${issued.status}  issued ${issued.issuedAt?.toISOString().slice(0, 10)}` +
      `  entry #${issued.journalEntry?.entryNumber} ${issued.journalEntry?.status}\n`,
  );
}

async function issueInvoiceTry(id: string) {
  return issueInvoice(id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
