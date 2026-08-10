import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { InvoiceForm, type InvoiceFormOptions, type InvoiceValues } from "@/components/form/InvoiceForm";

export const dynamic = "force-dynamic";

function isoDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: true,
      lines: {
        include: { revenueAccount: true, project: true, taxRate: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") redirect(`/invoices/${id}`);

  const [clients, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: {
        isPostable: true,
        isActive: true,
        OR: [
          { type: "REVENUE", subType: "OPERATING_REVENUE" },
          { type: "EXPENSE" },
        ],
      },
      orderBy: { code: "asc" },
    }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const options: InvoiceFormOptions = {
    clients: clients.map((c) => ({ value: c.id, label: c.name })),
    projects: projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    revenueAccounts: accounts.map((a) => ({
      value: a.code,
      label: a.type === "EXPENSE" ? `${a.code} ${a.name} (recovery)` : `${a.code} ${a.name}`,
    })),
    taxRates: taxRates.map((t) => ({ value: t.code, label: t.name })),
    taxRatePercents: Object.fromEntries(
      taxRates.map((t) => [t.code, t.ratePercent.toString()]),
    ),
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  const values: InvoiceValues = {
    id: invoice.id,
    contactId: invoice.contactId,
    invoiceDate: isoDate(invoice.invoiceDate),
    dueDate: isoDate(invoice.dueDate),
    servicePeriodStart: isoDate(invoice.servicePeriodStart),
    servicePeriodEnd: isoDate(invoice.servicePeriodEnd),
    projectCode: invoice.project?.code ?? "",
    clientReference: invoice.clientReference ?? "",
    notes: invoice.notes ?? "",
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity?.toString() ?? "1",
      unitRate: line.unitRate?.toString() ?? line.amount.toString(),
      amount: line.amount.toString(),
      revenueAccount: line.revenueAccount.code,
      project: line.project?.code ?? "",
      taxRate: line.taxRate?.code ?? "",
    })),
  };

  return (
    <div>
      <Link
        href={`/invoices/${invoice.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        {invoice.invoiceNumber}
      </Link>
      <h1 className="page-title mt-3 font-mono">{invoice.invoiceNumber}</h1>
      <p className="mt-2 text-[14px] text-muted">Editing a draft. Nothing is posted until you issue it.</p>
      <div className="mt-7">
        <InvoiceForm options={options} values={values} />
      </div>
    </div>
  );
}
