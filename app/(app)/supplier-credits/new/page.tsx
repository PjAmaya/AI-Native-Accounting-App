import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  SupplierCreditForm,
  type SupplierCreditFormOptions,
} from "@/components/form/SupplierCreditForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const { bill: presetBillId } = await searchParams;

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

  const preset = presetBillId ? bills.find((b) => b.id === presetBillId) : undefined;

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
    presetContactId: preset?.contactId,
    presetBillId: preset?.id,
  };

  return (
    <div>
      <Link href="/supplier-credits" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Supplier credits
      </Link>
      <h1 className="page-title mt-3">Record a supplier credit</h1>
      <p className="mt-2 text-[14px] text-muted">
        Reduces what you owe a vendor. Enter what their credit note says.
      </p>

      {vendors.length === 0 ? (
        <div className="card mt-7 px-6 py-8 text-center">
          <p className="text-[14px] text-muted">
            No vendors yet.{" "}
            <Link href="/contacts/new" className="font-medium text-brand hover:underline">
              Create one first
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-7">
          <SupplierCreditForm options={options} />
        </div>
      )}
    </div>
  );
}
