import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { renderInvoicePdf, closeBrowser } from "../lib/invoicing/renderInvoicePdf";
import { prisma } from "../lib/db";

async function main() {
  const invoice = await prisma.invoice.findFirstOrThrow({
    orderBy: { invoiceNumber: "desc" },
  });

  const started = Date.now();
  const { bytes, sha256 } = await renderInvoicePdf(invoice.id);
  const elapsed = Date.now() - started;

  await mkdir("out", { recursive: true });
  const file = `out/${invoice.invoiceNumber}.pdf`;
  await writeFile(file, bytes);

  console.log(`\n  ${invoice.invoiceNumber}   total ${invoice.total.toString()}`);
  console.log(`  wrote ${file}`);
  console.log(`  ${(bytes.length / 1024).toFixed(0)} KB in ${elapsed} ms`);
  console.log(`  sha256 ${sha256}\n`);
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
