import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { BillForm, type BillFormOptions, type BillValues } from "@/components/form/BillForm";

export const dynamic = "force-dynamic";

function isoDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      project: true,
      lines: {
        include: { expenseAccount: true, project: true, taxRate: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!bill) notFound();
  if (bill.status !== "DRAFT") redirect(`/bills/${id}`);

  const [vendors, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isVendor: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { isPostable: true, isActive: true, type: { in: ["EXPENSE", "ASSET"] } },
      orderBy: { code: "asc" },
    }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const options: BillFormOptions = {
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    projects: projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    expenseAccounts: accounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
    taxRates: taxRates.map((t) => ({ value: t.code, label: t.name })),
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  const values: BillValues = {
    id: bill.id,
    contactId: bill.contactId,
    supplierInvoiceNumber: bill.supplierInvoiceNumber,
    billDate: isoDate(bill.billDate),
    dueDate: isoDate(bill.dueDate),
    projectCode: bill.project?.code ?? "",
    notes: bill.notes ?? "",
    taxTotal: bill.taxTotal.toString(),
    lines: bill.lines.map((line) => ({
      description: line.description,
      amount: line.amount.toString(),
      expenseAccount: line.expenseAccount.code,
      project: line.project?.code ?? "",
      taxRate: line.taxRate?.code ?? "",
    })),
  };

  return (
    <div>
      <Link href={`/bills/${bill.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Bill #{bill.billNumber}
      </Link>
      <h1 className="page-title mt-3 font-mono">Bill #{bill.billNumber}</h1>
      <p className="mt-2 text-[14px] text-muted">
        Editing a draft. Nothing is posted until you approve it.
      </p>
      <div className="mt-7">
        <BillForm options={options} values={values} />
      </div>
    </div>
  );
}
