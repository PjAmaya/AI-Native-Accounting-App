import "dotenv/config";
import { createInvoice } from "../lib/invoicing/createInvoice";
import { trialBalance } from "../lib/ledger/trialBalance";
import { prisma } from "../lib/db";

async function main() {
  const contact =
    (await prisma.contact.findFirst({ where: { name: "Northwind Group" } })) ??
    (await prisma.contact.create({
      data: {
        name: "Northwind Group",
        isCustomer: true,
        email: "ap@northwind.example",
        city: "Toronto",
        province: "ON",
        paymentTermsDays: 30,
      },
    }));

  for (const p of [
    { code: "PROJ-A", name: "Operations diagnostic" },
    { code: "PROJ-B", name: "Supply chain redesign" },
  ]) {
    await prisma.project.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name, contactId: contact.id },
      update: { name: p.name, contactId: contact.id },
    });
  }

  const { invoice, entry } = await createInvoice({
    contactId: contact.id,
    invoiceDate: new Date("2026-07-31"),
    servicePeriodStart: new Date("2026-07-01"),
    servicePeriodEnd: new Date("2026-07-31"),
    clientReference: "PO-4471",
    lines: [
      {
        description: "Operations diagnostic - July",
        amount: "12000.00",
        revenueAccountCode: "4010",
        taxRateCode: "HST_ON",
        projectCode: "PROJ-A",
      },
      {
        description: "Supply chain redesign - July",
        quantity: "40",
        unitRate: "200.00",
        amount: "8000.00",
        revenueAccountCode: "4010",
        taxRateCode: "HST_ON",
        projectCode: "PROJ-B",
      },
      {
        description: "Advisory for non-resident affiliate",
        amount: "5000.00",
        revenueAccountCode: "4010",
        taxRateCode: "ZERO_RATED",
        projectCode: "PROJ-B",
      },
    ],
  });

  console.log(
    `\n${invoice.invoiceNumber}   ${invoice.status}   due ${invoice.dueDate.toISOString().slice(0, 10)}`,
  );
  console.log(
    `  subtotal ${invoice.subtotal}   tax ${invoice.taxTotal}   total ${invoice.total}\n`,
  );

  const accounts = await prisma.account.findMany();
  const accountLabel = new Map(accounts.map((a) => [a.id, `${a.code} ${a.name}`]));
  const projects = await prisma.project.findMany();
  const projectCode = new Map(projects.map((p) => [p.id, p.code]));

  console.log(`journal entry #${entry.entryNumber}  (${entry.status})`);
  for (const line of entry.lines) {
    console.log(
      `  ${(accountLabel.get(line.accountId) ?? "?").padEnd(28)}` +
        ` dr ${line.debit.toString().padStart(9)}` +
        `  cr ${line.credit.toString().padStart(9)}` +
        `  project ${line.projectId ? projectCode.get(line.projectId) : "-"}`,
    );
  }

  const tb = await trialBalance(new Date("2026-12-31"));
  console.log(
    `\ntrial balance debits ${tb.totalDebits.toFixed(2)}  ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}`,
  );
  console.log("(still 8000.00 — the invoice entry is a DRAFT)\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
