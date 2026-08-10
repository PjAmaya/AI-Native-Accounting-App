import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const bills = await prisma.bill.findMany({
    include: { contact: true, applications: true },
    orderBy: [{ billDate: "desc" }, { billNumber: "desc" }],
  });

  const today = new Date();

  const rows = bills.map((bill) => {
    const applied = bill.applications.reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding =
      bill.status === "VOID"
        ? new Decimal(0)
        : new Decimal(bill.total.toString()).minus(applied);
    const overdue = bill.status === "APPROVED" && outstanding.greaterThan(0) && bill.dueDate < today;
    const partial =
      bill.status === "APPROVED" && applied.greaterThan(0) && outstanding.greaterThan(0);
    const statuses =
      bill.status === "APPROVED"
        ? [...(partial ? ["PARTIAL"] : []), ...(overdue ? ["OVERDUE"] : [])]
        : [];

    return {
      bill,
      outstanding,
      statuses: statuses.length > 0 ? statuses : [bill.status],
    };
  });

  const openTotal = rows
    .filter((r) => r.bill.status === "APPROVED")
    .reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts payable</p>
          <h1 className="page-title mt-1.5">Bills</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(openTotal)} owed across {rows.filter((r) => r.bill.status === "APPROVED").length} approved
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

      {rows.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-violet text-icon-violet">
            <Receipt size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No bills yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
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
                    <p className="text-[11px] text-faint">{shortDate(bill.billDate)}</p>
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
