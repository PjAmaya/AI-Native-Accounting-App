import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { InvoiceForm, type InvoiceFormOptions } from "@/components/form/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const [clients, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({
      where: { isCustomer: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { type: "REVENUE", isPostable: true, isActive: true, subType: "OPERATING_REVENUE" },
      orderBy: { code: "asc" },
    }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const options: InvoiceFormOptions = {
    clients: clients.map((c) => ({ value: c.id, label: c.name })),
    projects: projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    revenueAccounts: accounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
    taxRates: taxRates.map((t) => ({ value: t.code, label: t.name })),
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  return (
    <div>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Invoices
      </Link>
      <h1 className="page-title mt-3">New invoice</h1>

      {clients.length === 0 ? (
        <div className="card mt-7 px-6 py-8 text-center">
          <p className="text-[14px] text-muted">
            No customers yet.{" "}
            <Link href="/contacts/new" className="font-medium text-brand hover:underline">
              Create one first
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-7">
          <InvoiceForm options={options} />
        </div>
      )}
    </div>
  );
}
