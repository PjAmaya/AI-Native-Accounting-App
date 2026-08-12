import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { ListFilters } from "@/components/ui/ListFilters";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

const STORED = new Set(["DRAFT", "ISSUED", "PAID", "VOID"]);

function utcDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    contact?: string;
    project?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const from = utcDate(sp.from);
  const to = utcDate(sp.to);
  const status = sp.status?.trim() || undefined;
  const q = sp.q?.trim() || undefined;

  const [invoices, clients, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...(status && STORED.has(status)
          ? { status: status as "DRAFT" | "ISSUED" | "PAID" | "VOID" }
          : status === "PARTIAL" || status === "OVERDUE"
            ? { status: "ISSUED" }
            : {}),
        ...(sp.contact ? { contactId: sp.contact } : {}),
        ...(sp.project ? { project: { code: sp.project } } : {}),
        ...(from || to
          ? { invoiceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" as const } },
                { clientReference: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: {
        contact: true,
        project: true,
        applications: true,
        creditApplications: { include: { creditNote: true } },
        creditNotes: true,
      },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
    }),
    prisma.contact.findMany({ where: { isCustomer: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { code: "asc" } }),
  ]);

  const today = new Date();

  let rows = invoices.map((invoice) => {
    const applied = [...invoice.applications, ...invoice.creditApplications].reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding =
      invoice.status === "VOID" || invoice.status === "DRAFT"
        ? new Decimal(0)
        : new Decimal(invoice.total.toString()).minus(applied);
    const overdue =
      invoice.status === "ISSUED" && outstanding.greaterThan(0) && invoice.dueDate < today;
    const partial =
      invoice.status === "ISSUED" && applied.greaterThan(0) && outstanding.greaterThan(0);

    const derived =
      invoice.status === "ISSUED"
        ? [...(partial ? ["PARTIAL"] : []), ...(overdue ? ["OVERDUE"] : [])]
        : [];

    return {
      invoice,
      outstanding,
      overdue,
      partial,
      statuses: derived.length > 0 ? derived : [invoice.status],
    };
  });

  if (status === "OVERDUE") rows = rows.filter((r) => r.overdue);
  if (status === "PARTIAL") rows = rows.filter((r) => r.partial);

  const openTotal = rows
    .filter((r) => r.invoice.status === "ISSUED")
    .reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));

  const filtered = Boolean(q || status || sp.contact || sp.project || sp.from || sp.to);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts receivable</p>
          <h1 className="page-title mt-1.5">Invoices</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(openTotal)} outstanding across{" "}
            {rows.filter((r) => r.invoice.status === "ISSUED").length} open
            {filtered ? ` · ${rows.length} shown` : ""}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New invoice
        </Link>
      </div>

      <ListFilters
        basePath="/invoices"
        contactLabel="Client"
        statuses={STATUSES}
        contacts={clients.map((c) => ({ value: c.id, label: c.name }))}
        projects={projects.map((p) => ({ value: p.code, label: `${p.code} ${p.name}` }))}
        current={{
          q: sp.q,
          status: sp.status,
          contact: sp.contact,
          project: sp.project,
          from: sp.from,
          to: sp.to,
        }}
      />

      {rows.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-blue text-icon-blue">
            <FileText size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">
            {filtered ? "No invoices match those filters." : "No invoices yet."}
          </p>
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Invoice</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Client</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Project</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Due</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Status</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ invoice, outstanding, statuses }) => (
                <tr key={invoice.id} className="hover:bg-wash/30">
                  <td className="px-5 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-mono text-[12px] font-medium hover:text-brand"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="text-[11px] text-faint">
                      {shortDate(invoice.invoiceDate)}
                      {invoice.creditNotes.length > 0 || invoice.creditApplications.length > 0 ? (
                        <span className="ml-1.5 rounded-full bg-tint-amber px-1.5 py-0.5 text-[10px] font-medium text-icon-amber">
                          {[
                            ...invoice.creditNotes.map((c) => c.creditNumber),
                            ...invoice.creditApplications.map((a) => a.creditNote.creditNumber),
                          ]
                            .filter((v, i, arr) => arr.indexOf(v) === i)
                            .join(", ")}
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[13px]">{invoice.contact.name}</td>
                  <td className="px-3 py-3 font-mono text-[12px] text-muted">
                    {invoice.project?.code ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted">{shortDate(invoice.dueDate)}</td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap gap-1">
                      {statuses.map((s) => (
                        <StatusPill key={s} status={s} />
                      ))}
                    </span>
                  </td>
                  <td className="figure px-3 py-3">{money(invoice.total)}</td>
                  <td className="figure px-5 py-3">
                    {outstanding.isZero() ? (
                      <span className="text-faint">—</span>
                    ) : (
                      money(outstanding)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
