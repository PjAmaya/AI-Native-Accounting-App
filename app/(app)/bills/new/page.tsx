import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { BillForm, type BillFormOptions } from "@/components/form/BillForm";

export const dynamic = "force-dynamic";

export default async function NewBillPage() {
  const [vendors, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isVendor: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
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

  return (
    <div>
      <Link href="/bills" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Bills
      </Link>
      <h1 className="page-title mt-3">Record a bill</h1>
      <p className="mt-2 text-[14px] text-muted">Enter what the vendor invoiced, exactly as printed.</p>

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
          <BillForm options={options} />
        </div>
      )}
    </div>
  );
}
