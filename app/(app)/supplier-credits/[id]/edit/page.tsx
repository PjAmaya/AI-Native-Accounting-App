import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  SupplierCreditForm,
  type SupplierCreditFormOptions,
  type SupplierCreditValues,
} from "@/components/form/SupplierCreditForm";

export const dynamic = "force-dynamic";

export default async function EditSupplierCreditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const credit = await prisma.supplierCredit.findUnique({
    where: { id },
    include: {
      lines: {
        include: { expenseAccount: true, project: true, taxRate: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!credit) notFound();
  if (credit.status !== "DRAFT") redirect(`/supplier-credits/${id}`);

  const [vendors, bills, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isVendor: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.bill.findMany({
      where: { status: { in: ["APPROVED", "PAID"] } },
      orderBy: { billDate: "desc" },
    }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { isPostable: true, isActive: true, type: { in: ["EXPENSE", "ASSET"] } },
      orderBy: { code: "asc" },
    }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const options: SupplierCreditFormOptions = {
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    bills: bills.map((b) => ({
      value: b.id,
      label: `#${b.billNumber} · ${b.supplierInvoiceNumber} — ${b.total.toString()}`,
      contactId: b.contactId,
    })),
    projects: projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    expenseAccounts: accounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
    taxRates: taxRates.map((t) => ({ value: t.code, label: t.name })),
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  const values: SupplierCreditValues = {
    id: credit.id,
    contactId: credit.contactId,
    supplierCreditNumber: credit.supplierCreditNumber,
    originalBillId: credit.originalBillId ?? "",
    creditDate: credit.creditDate.toISOString().slice(0, 10),
    reason: credit.reason,
    notes: credit.notes ?? "",
    taxTotal: credit.taxTotal.toString(),
    lines: credit.lines.map((line) => ({
      description: line.description,
      amount: line.amount.toString(),
      expenseAccount: line.expenseAccount.code,
      project: line.project?.code ?? "",
      taxRate: line.taxRate?.code ?? "",
    })),
  };

  return (
    <div>
      <Link
        href={`/supplier-credits/${credit.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Credit #{credit.creditNumber}
      </Link>
      <h1 className="page-title mt-3 font-mono">Credit #{credit.creditNumber}</h1>
      <p className="mt-2 text-[14px] text-muted">
        Editing a draft. Nothing is posted until you approve it.
      </p>
      <div className="mt-7">
        <SupplierCreditForm options={options} values={values} />
      </div>
    </div>
  );
}
