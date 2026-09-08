import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { CreditNoteForm, type CreditNoteFormOptions, type CreditNoteValues } from "@/components/form/CreditNoteForm";

export const dynamic = "force-dynamic";

export default async function EditCreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const note = await prisma.creditNote.findUnique({
    where: { id },
    include: {
      lines: {
        include: { revenueAccount: true, project: true, taxRate: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!note) notFound();
  if (note.status !== "DRAFT") redirect(`/credit-notes/${id}`);

  const [clients, invoices, projects, accounts, taxRates] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PAID"] } },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
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
  };

  const values: CreditNoteValues = {
    id: note.id,
    contactId: note.contactId,
    originalInvoiceId: note.originalInvoiceId ?? "",
    creditDate: note.creditDate.toISOString().slice(0, 10),
    reason: note.reason,
    notes: note.notes ?? "",
    lines: note.lines.map((line) => ({
      description: line.description,
      amount: line.amount.toString(),
      revenueAccount: line.revenueAccount.code,
      project: line.project?.code ?? "",
      taxRate: line.taxRate?.code ?? "",
    })),
  };

  return (
    <div>
      <Link
        href={`/credit-notes/${note.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        {note.creditNumber}
      </Link>
      <h1 className="page-title mt-3 font-mono">{note.creditNumber}</h1>
      <p className="mt-2 text-[14px] text-muted">
        Editing a draft. Nothing is posted until you issue it.
      </p>
      <div className="mt-7">
        <CreditNoteForm options={options} values={values} />
      </div>
    </div>
  );
}
