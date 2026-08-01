import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { createInvoice } from "../lib/invoicing/createInvoice";
import { renderInvoiceHtml } from "../lib/invoicing/renderInvoice";
import { prisma } from "../lib/db";

async function main() {
  const contact = await prisma.contact.findFirstOrThrow({ where: { isCustomer: true } });

  const { invoice } = await createInvoice({
    contactId: contact.id,
    invoiceDate: new Date("2026-08-31"),
    servicePeriodStart: new Date("2026-08-01"),
    servicePeriodEnd: new Date("2026-08-31"),
    clientReference: "PO-4471",
    notes: "Thank you for the continued engagement.",
    lines: [
      {
        description: "Operations diagnostic - discovery and stakeholder interviews",
        amount: "12000.00",
        revenueAccountCode: "4010",
        projectCode: "PROJ-A",
      },
      {
        description: "Supply chain redesign - process mapping",
        quantity: "40",
        unitRate: "200.00",
        amount: "8000.00",
        revenueAccountCode: "4010",
        projectCode: "PROJ-B",
      },
      {
        description: "Advisory - non-resident affiliate",
        amount: "5000.00",
        revenueAccountCode: "4010",
        projectCode: "PROJ-B",
      },
    ],
  });

  const html = await renderInvoiceHtml(invoice.id);

  await mkdir("out", { recursive: true });
  const file = `out/${invoice.invoiceNumber}.html`;
  await writeFile(file, html, "utf8");

  console.log(`\n  ${invoice.invoiceNumber}  total ${invoice.total.toString()}`);
  console.log(`  wrote ${file}  (${(html.length / 1024).toFixed(0)} KB)\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
