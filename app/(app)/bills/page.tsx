import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { ListFilters } from "@/components/ui/ListFilters";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

const STORED = new Set(["DRAFT", "APPROVED", "PAID", "VOID"]);

function utcDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function BillsPage({
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

  const [bills, vendors, projects] = await Promise.all([
    prisma.bill.findMany({
      where: {
        ...(status && STORED.has(status)
          ? { status: status as "DRAFT" | "APPROVED" | "PAID" | "VOID" }
          : status === "PARTIAL" || status === "OVERDUE"
            ? { status: "APPROVED" }
            : {}),
        ...(sp.contact ? { contactId: sp.contact } : {}),
        ...(sp.project ? { project: { code: sp.project } } : {}),
        ...(from || to
          ? { billDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(q
          ? {
              OR: [
                { supplierInvoiceNumber: { contains: q, mode: "insensitive" as const } },
                { notes: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: {
        contact: true,
        project: true,
        applications: true,
        supplierCreditApplications: { include: { supplierCredit: true } },
        supplierCredits: true,
      },
      orderBy: [{ billDate: "desc" }, { billNumber: "desc" }],
    }),
    prisma.contact.findMany({ where: { isVendor: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { code: "asc" } }),
  ]);

  const today = new Date();

  let rows = bills.map((bill) => {
    const applied = [...bill.applications, ...bill.supplierCreditApplications].reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding =
      bill.status === "VOID" || bill.status === "DRAFT"
        ? new Decimal(0)
        : new Decimal(bill.total.toString()).minus(applied);
    const overdue =
      bill.status === "APPROVED" && outstanding.greaterThan(0) && bill.dueDate < today;
    const partial =
      bill.status === "APPROVED" && applied.greaterThan(0) && outstanding.greaterThan(0);

    const derived =
      bill.status === "APPROVED"
        ? [...(partial ? ["PARTIAL"] : []), ...(overdue ? ["OVERDUE"] : [])]
        : [];

    return {
      bill,
      outstanding,
      overdue,
      partial,
      statuses: derived.length > 0 ? derived : [bill.status],
    };
  });

  if (status === "OVERDUE") rows = rows.filter((r) => r.overdue);
  if (status === "PARTIAL") rows = rows.filter((r) => r.partial);

  const openTotal = rows
    .filter((r) => r.bill.status === "APPROVED")
    .reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));

  const filtered = Boolean(q || status || sp.contact || sp.project || sp.from || sp.to);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts payable</p>
          <h1 className="page-title mt-1.5">Bills</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(openTotal)} owed across{" "}
            {rows.filter((r) => r.bill.status === "APPROVED").length} approved
            {filtered ? ` · ${rows.length} shown` : ""}
          </p>
        </div>
        <Link
          href="/bills/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          Record bill
        </Link>
      </div>

      <ListFilters
        basePath="/bills"
        contactLabel="Vendor"
        statuses={STATUSES}
        contacts={vendors.map((v) => ({ value: v.id, label: v.name }))}
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
          <span className="tile bg-tint-violet text-icon-violet">
            <Receipt size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">
            {filtered ? "No bills match those filters." : "No bills yet."}
          </p>
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Bill</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Vendor</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Their ref</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Due</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Status</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ bill, outstanding, statuses }) => (
                <tr key={bill.id} className="hover:bg-wash/30">
                  <td className="px-5 py-3">
                    <Link
                      href={bill.status === "DRAFT" ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`}
                      className="font-mono text-[12px] font-medium hover:text-brand"
                    >
                      #{bill.billNumber}
                    </Link>
                    <p className="text-[11px] text-faint">
                      {shortDate(bill.billDate)}
                      {bill.supplierCredits.length > 0 ||
                      bill.supplierCreditApplications.length > 0 ? (
                        <span className="ml-1.5 rounded-full bg-tint-violet px-1.5 py-0.5 text-[10px] font-medium text-icon-violet">
                          credit
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[13px]">{bill.contact.name}</td>
                  <td className="px-3 py-3 font-mono text-[12px] text-muted">
                    {bill.supplierInvoiceNumber}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted">{shortDate(bill.dueDate)}</td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap gap-1">
                      {statuses.map((s) => (
                        <StatusPill key={s} status={s} />
                      ))}
                    </span>
                  </td>
                  <td className="figure px-3 py-3">{money(bill.total)}</td>
                  <td className="figure px-5 py-3">
                    {outstanding.isZero() ? <span className="text-faint">—</span> : money(outstanding)}
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
