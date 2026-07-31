import "dotenv/config";
import { createInvoice } from "../lib/invoicing/createInvoice";
import { issueInvoice } from "../lib/invoicing/issueInvoice";
import { recordPayment } from "../lib/invoicing/recordPayment";
import { postDraft } from "../lib/ledger/post";
import { prisma } from "../lib/db";

async function statusOf(invoiceNumber: string) {
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNumber } });
  return invoice ? `${invoice.status} (total ${invoice.total.toString()})` : "not found";
}

async function main() {
  console.log("\ninvoice PAID status\n");

  console.log(`  INV-2026-0001 (paid before the fix existed): ${await statusOf("INV-2026-0001")}`);

  const contact = await prisma.contact.findFirstOrThrow({ where: { isCustomer: true } });

  const { invoice } = await createInvoice({
    contactId: contact.id,
    invoiceDate: new Date("2026-08-31"),
    lines: [
      {
        description: "August advisory",
        amount: "2000.00",
        revenueAccountCode: "4010",
        taxRateCode: "HST_ON",
      },
    ],
  });
  console.log(`\n  created ${invoice.invoiceNumber}  ${invoice.status}  total ${invoice.total.toString()}`);

  await issueInvoice(invoice.id);
  console.log(`  issued  ${invoice.invoiceNumber}  ${await statusOf(invoice.invoiceNumber)}`);

  const partial = await recordPayment({
    contactId: contact.id,
    direction: "RECEIVED",
    paymentDate: new Date("2026-09-05"),
    amount: "1000.00",
    bankAccountCode: "1010",
    applications: [{ invoiceNumber: invoice.invoiceNumber, amount: "1000.00" }],
  });
  await postDraft(partial.entry.id);
  console.log(`  after 1000.00 partial: ${await statusOf(invoice.invoiceNumber)}`);

  const rest = await recordPayment({
    contactId: contact.id,
    direction: "RECEIVED",
    paymentDate: new Date("2026-09-20"),
    amount: "1260.00",
    bankAccountCode: "1010",
    applications: [{ invoiceNumber: invoice.invoiceNumber, amount: "1260.00" }],
  });
  await postDraft(rest.entry.id);
  console.log(`  after 1260.00 balance: ${await statusOf(invoice.invoiceNumber)}`);

  const final = await prisma.invoice.findUniqueOrThrow({
    where: { invoiceNumber: invoice.invoiceNumber },
  });
  console.log(
    `\n  ${final.status === "PAID" ? "PASS  invoice flipped to PAID" : "FAIL  status is " + final.status}\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
