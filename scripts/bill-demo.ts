import "dotenv/config";
import { createBill } from "../lib/invoicing/createBill";
import { prisma } from "../lib/db";

async function showEntry(entryId: string, label: string) {
  const entry = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: { include: { account: true, project: true } } },
  });
  console.log(`  ${label}  entry #${entry.entryNumber} (${entry.status})`);
  for (const line of entry.lines) {
    console.log(
      `    ${`${line.account.code} ${line.account.name}`.padEnd(30)}` +
        ` dr ${line.debit.toString().padStart(9)}` +
        `  cr ${line.credit.toString().padStart(9)}` +
        `  ${line.project ? line.project.code : "-"}`,
    );
  }
}

async function main() {
  console.log("\nbills\n");

  const partner =
    (await prisma.contact.findFirst({ where: { name: "Partner A Consulting" } })) ??
    (await prisma.contact.create({
      data: {
        name: "Partner A Consulting",
        isVendor: true,
        isHstRegistered: true,
        businessNumber: "123456789RT0001",
        paymentTermsDays: 15,
      },
    }));

  const first = await createBill({
    contactId: partner.id,
    supplierInvoiceNumber: "PA-2026-114",
    billDate: new Date("2026-07-31"),
    lines: [
      {
        description: "Delivery - operations diagnostic, July",
        amount: "3000.00",
        expenseAccountCode: "5010",
        taxRateCode: "HST_ON",
        projectCode: "PROJ-A",
      },
    ],
    taxTotal: "390.00",
  });

  console.log(
    `  bill #${first.bill.billNumber}  ${first.bill.supplierInvoiceNumber}  ` +
      `subtotal ${first.bill.subtotal} tax ${first.bill.taxTotal} total ${first.bill.total}  ` +
      `(registered: ${first.isRegistered})`,
  );
  await showEntry(first.entry.id, "  ->");
  first.warnings.forEach((w) => console.log(`    warning: ${w}`));

  try {
    await createBill({
      contactId: partner.id,
      supplierInvoiceNumber: "PA-2026-114",
      billDate: new Date("2026-08-01"),
      lines: [
        { description: "resent copy", amount: "3000.00", expenseAccountCode: "5010", taxRateCode: "HST_ON" },
      ],
    });
    console.log("\n  FAIL  duplicate was allowed");
  } catch (e) {
    console.log(`\n  PASS  duplicate rejected: ${(e as Error).message}`);
  }

  try {
    await createBill({
      contactId: partner.id,
      supplierInvoiceNumber: "PA-2026-115",
      billDate: new Date("2026-08-05"),
      lines: [
        { description: "August delivery", amount: "3000.00", expenseAccountCode: "5010", taxRateCode: "HST_ON" },
      ],
      taxTotal: "39.00",
    });
    console.log("  FAIL  large tax variance was allowed");
  } catch (e) {
    console.log(`  PASS  tax variance rejected: ${(e as Error).message}`);
  }

  const overridden = await createBill({
    contactId: partner.id,
    supplierInvoiceNumber: "PA-2026-115",
    billDate: new Date("2026-08-05"),
    lines: [
      { description: "August delivery", amount: "3000.00", expenseAccountCode: "5010", taxRateCode: "HST_ON" },
    ],
    taxTotal: "389.94",
    acceptTaxVariance: true,
  });
  console.log(
    `\n  bill #${overridden.bill.billNumber}  tax ${overridden.bill.taxTotal} total ${overridden.bill.total} (override accepted)`,
  );
  overridden.warnings.forEach((w) => console.log(`    warning: ${w}`));

  const laptop = await createBill({
    contactId: partner.id,
    supplierInvoiceNumber: "PA-2026-116",
    billDate: new Date("2026-08-10"),
    lines: [
      { description: "Laptop", amount: "2400.00", expenseAccountCode: "6030", taxRateCode: "HST_ON" },
    ],
  });
  console.log(`\n  bill #${laptop.bill.billNumber}  total ${laptop.bill.total}`);
  laptop.warnings.forEach((w) => console.log(`    warning: ${w}`));

  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
