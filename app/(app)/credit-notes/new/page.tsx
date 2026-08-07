import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { CreditNoteForm, type CreditNoteFormOptions } from "@/components/form/CreditNoteForm";

export const dynamic = "force-dynamic";

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice: presetInvoiceId } = await searchParams;

  const [clients, invoices, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PAID"] } },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.project.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: {
        isPostable: true,
        isActive: true,
        OR: [{ type: "REVENUE", subType: "OPERATING_REVENUE" }, { type: "EXPENSE" }],
      },
      orderBy: { code: "asc" },
    }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const preset = presetInvoiceId ? invoices.find((i) => i.id === presetInvoiceId) : undefined;

  const options: CreditNoteFormOptions = {
    clients: clients.map((c) => ({ value: c.id, label: c.name })),
    invoices: invoices.map((i) => ({
      value: i.id,
      label: `${i.invoiceNumber} — ${i.total.toString()}`,
      contactId: i.contactId,
    })),
    projects: projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    revenueAccounts: accounts.map((a) => ({
      value: a.code,
      label: a.type === "EXPENSE" ? `${a.code} ${a.name} (recovery)` : `${a.code} ${a.name}`,
    })),
    taxRates: taxRates.map((t) => ({ value: t.code, label: t.name })),
    defaultDate: new Date().toISOString().slice(0, 10),
    presetContactId: preset?.contactId,
    presetInvoiceId: preset?.id,
  };

  return (
    <div>
      <Link href="/credit-notes" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Credit notes
      </Link>
      <h1 className="page-title mt-3">New credit note</h1>
      <p className="mt-2 text-[14px] text-muted">
        Reduces what a client owes. The original invoice stays on record.
      </p>
      <div className="mt-7">
        <CreditNoteForm options={options} />
      </div>
    </div>
  );
}
