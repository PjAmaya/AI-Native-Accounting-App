import "dotenv/config";
import { createInvoice } from "../lib/invoicing/createInvoice";
import { issueInvoice } from "../lib/invoicing/issueInvoice";
import { closeBrowser } from "../lib/invoicing/renderInvoicePdf";
import { verifyStoredFile } from "../lib/storage";
import { prisma } from "../lib/db";

async function main() {
  console.log("\nissue with frozen PDF\n");

  const contact = await prisma.contact.findFirstOrThrow({ where: { isCustomer: true } });

  const { invoice } = await createInvoice({
    contactId: contact.id,
    invoiceDate: new Date("2026-09-30"),
    servicePeriodStart: new Date("2026-09-01"),
    servicePeriodEnd: new Date("2026-09-30"),
    lines: [
      {
        description: "September retainer - operations advisory",
        amount: "6500.00",
        revenueAccountCode: "4010",
        projectCode: "PROJ-A",
      },
    ],
  });
  console.log(`  created ${invoice.invoiceNumber}  ${invoice.status}  total ${invoice.total.toString()}`);
  console.log(`  pdfPath before issuing: ${invoice.pdfPath ?? "null"}`);

  const started = Date.now();
  const issued = await issueInvoice(invoice.id);
  console.log(`\n  issued in ${Date.now() - started} ms  status ${issued.status}`);
  console.log(`  pdfPath  ${issued.pdfPath}`);
  console.log(`  pdfHash  ${issued.pdfHash?.slice(0, 16)}...`);

  const check = await verifyStoredFile(issued.pdfPath!, issued.pdfHash!);
  console.log(
    `\n  stored file exists: ${check.exists}   hash matches: ${check.matches ? "PASS" : "FAIL"}`,
  );

  const tampered = await verifyStoredFile(issued.pdfPath!, "0".repeat(64));
  console.log(
    `  wrong-hash check correctly reports mismatch: ${tampered.exists && !tampered.matches ? "PASS" : "FAIL"}`,
  );

  try {
    await issueInvoice(invoice.id);
    console.log("\n  FAIL  double issue was allowed");
  } catch (e) {
    console.log(`\n  PASS  double issue rejected: ${(e as Error).message}`);
  }

  console.log();
}

main()
  .then(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await closeBrowser();
    await prisma.$disconnect();
    process.exit(1);
  });
