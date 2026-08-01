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
  const ap = pick("2010");
  console.log(
    `  ${label.padEnd(22)} 1010 ${(cash ? cash.debit.toFixed(2) : "-").padStart(10)}` +
      `   2010 ${(ap ? ap.credit.toFixed(2) : "-").padStart(9)}` +
      `   ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
}

async function statusOf(billNumber: number) {
  const bill = await prisma.bill.findUniqueOrThrow({ where: { billNumber } });
  return bill.status;
}

async function main() {
  console.log("\npay a bill\n");

  const bill = await prisma.bill.findUniqueOrThrow({
    where: { billNumber: 1 },
    include: { contact: true },
  });
  console.log(`  bill #1  ${bill.contact.name}  total ${bill.total.toString()}  ${bill.status}\n`);

  await show("start");

  try {
    await recordPayment({
      contactId: bill.contactId,
      direction: "SENT",
      paymentDate: new Date("2026-08-14"),
      amount: "1000.00",
      bankAccountCode: "1010",
      billApplications: [{ billNumber: 2, amount: "1000.00" }],
    });
    console.log("  FAIL  paid an unapproved bill");
  } catch (e) {
    console.log(`  PASS  unapproved bill rejected: ${(e as Error).message}`);
  }

  try {
    await recordPayment({
      contactId: bill.contactId,
      direction: "RECEIVED",
      paymentDate: new Date("2026-08-14"),
      amount: "1000.00",
      bankAccountCode: "1010",
      billApplications: [{ billNumber: 1, amount: "1000.00" }],
    });
    console.log("  FAIL  cross-direction application allowed");
  } catch (e) {
    console.log(`  PASS  cross-direction rejected: ${(e as Error).message}`);
  }

  const partial = await recordPayment({
    contactId: bill.contactId,
    direction: "SENT",
    paymentDate: new Date("2026-08-14"),
    amount: "1390.00",
    bankAccountCode: "1010",
    method: "EFT",
    billApplications: [{ billNumber: 1, amount: "1390.00" }],
  });
  await postDraft(partial.entry.id);
  console.log(`\n  payment #${partial.payment.paymentNumber} applied ${partial.totalApplied.toFixed(2)}`);
  await show("after partial");
  console.log(`  bill #1 status: ${await statusOf(1)}`);

  try {
    await recordPayment({
      contactId: bill.contactId,
      direction: "SENT",
      paymentDate: new Date("2026-08-20"),
      amount: "3000.00",
      bankAccountCode: "1010",
      billApplications: [{ billNumber: 1, amount: "3000.00" }],
    });
    console.log("  FAIL  over-application allowed");
  } catch (e) {
    console.log(`  PASS  over-application rejected: ${(e as Error).message}`);
  }

  const rest = await recordPayment({
    contactId: bill.contactId,
    direction: "SENT",
    paymentDate: new Date("2026-08-20"),
    amount: "2000.00",
    bankAccountCode: "1010",
    method: "EFT",
    billApplications: [{ billNumber: 1, amount: "2000.00" }],
  });
  await postDraft(rest.entry.id);
  console.log(
    `\n  payment #${rest.payment.paymentNumber} applied ${rest.totalApplied.toFixed(2)}, unapplied ${rest.unapplied.toFixed(2)}`,
  );
  await show("after balance");
  console.log(`  bill #1 status: ${await statusOf(1)}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
