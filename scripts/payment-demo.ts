import "dotenv/config";
import { recordPayment } from "../lib/invoicing/recordPayment";
import { postDraft } from "../lib/ledger/post";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

const asOf = new Date("2026-12-31");

async function show(label: string) {
  const tb = await trialBalance(asOf);
  const pick = (code: string) => tb.rows.find((r) => r.code === code);
  const cash = pick("1010");
  const ar = pick("1200");
  const over = pick("2060");
  console.log(
    `  ${label.padEnd(20)} debits ${tb.totalDebits.toFixed(2).padStart(10)}` +
      `   1010 ${(cash ? cash.debit.toFixed(2) : "-").padStart(9)}` +
      `   1200 ${(ar ? ar.debit.toFixed(2) : "-").padStart(9)}` +
      `   2060 ${(over ? over.credit.toFixed(2) : "-").padStart(7)}` +
      `   ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
}

async function main() {
  console.log("\npayments\n");

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: "INV-2026-0001" },
  });
  if (!invoice) throw new Error("INV-2026-0001 not found.");
  console.log(`  ${invoice.invoiceNumber} total ${invoice.total.toString()}\n`);

  await show("start");

  const first = await recordPayment({
    contactId: invoice.contactId,
    direction: "RECEIVED",
    paymentDate: new Date("2026-08-15"),
    amount: "20000.00",
    bankAccountCode: "1010",
    method: "EFT",
    reference: "ETRF-88213",
    applications: [{ invoiceNumber: "INV-2026-0001", amount: "20000.00" }],
  });
  await postDraft(first.entry.id);
  console.log(`  payment #${first.payment.paymentNumber} applied ${first.totalApplied.toFixed(2)}, unapplied ${first.unapplied.toFixed(2)}`);
  await show("after partial");

  try {
    await recordPayment({
      contactId: invoice.contactId,
      direction: "RECEIVED",
      paymentDate: new Date("2026-08-20"),
      amount: "10000.00",
      bankAccountCode: "1010",
      applications: [{ invoiceNumber: "INV-2026-0001", amount: "10000.00" }],
    });
    console.log("  FAIL  over-application was allowed");
  } catch (e) {
    console.log(`  PASS  over-application rejected: ${(e as Error).message}`);
  }

  const second = await recordPayment({
    contactId: invoice.contactId,
    direction: "RECEIVED",
    paymentDate: new Date("2026-08-20"),
    amount: "8000.00",
    bankAccountCode: "1010",
    method: "EFT",
    reference: "ETRF-88907",
    applications: [{ invoiceNumber: "INV-2026-0001", amount: "7600.00" }],
  });
  await postDraft(second.entry.id);
  console.log(`  payment #${second.payment.paymentNumber} applied ${second.totalApplied.toFixed(2)}, unapplied ${second.unapplied.toFixed(2)}`);
  await show("after overpayment");

  const applications = await prisma.paymentApplication.findMany({
    where: { invoiceId: invoice.id },
    include: { payment: true },
    orderBy: { appliedAt: "asc" },
  });
  const applied = applications.reduce((sum, a) => sum + Number(a.amountApplied), 0);
  console.log(`\n  subledger for ${invoice.invoiceNumber}:`);
  for (const a of applications) {
    console.log(
      `    payment #${a.payment.paymentNumber}  ${a.payment.paymentDate.toISOString().slice(0, 10)}  applied ${a.amountApplied.toString()}`,
    );
  }
  console.log(`    total applied ${applied.toFixed(2)}  outstanding ${(Number(invoice.total) - applied).toFixed(2)}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
