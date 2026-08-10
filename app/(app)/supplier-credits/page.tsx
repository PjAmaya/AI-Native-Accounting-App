import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, FileMinus } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

export default async function SupplierCreditsPage() {
  const credits = await prisma.supplierCredit.findMany({
    include: {
      contact: true,
      originalBill: true,
      applications: true,
      refundEntry: { include: { lines: true } },
    },
    orderBy: [{ creditDate: "desc" }, { creditNumber: "desc" }],
  });

  function remaining(c: (typeof credits)[number]) {
    const used = c.applications.reduce(
      (s, a) => s.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const back = c.refundEntry
      ? c.refundEntry.lines.reduce((s, l) => s.plus(l.credit.toString()), new Decimal(0))
      : new Decimal(0);
    return new Decimal(c.total.toString()).minus(used).minus(back);
  }

  const outstanding = credits
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum.plus(remaining(c)), new Decimal(0));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts payable</p>
          <h1 className="page-title mt-1.5">Supplier credits</h1>
          <p className="mt-2 text-[14px] text-muted">{money(outstanding)} owed to us</p>
        </div>
        <Link
          href="/supplier-credits/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          Record credit
        </Link>
      </div>

      {credits.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-violet text-icon-violet">
            <FileMinus size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No supplier credits yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Credit</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Vendor</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Their ref</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Credits</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Status</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {credits.map((credit) => {
                const left = remaining(credit);
                return (
                  <tr key={credit.id} className="hover:bg-wash/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/supplier-credits/${credit.id}`}
                        className="font-mono text-[12px] font-medium hover:text-brand"
                      >
                        #{credit.creditNumber}
                      </Link>
                      <p className="text-[11px] text-faint">{shortDate(credit.creditDate)}</p>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{credit.contact.name}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted">
                      {credit.supplierCreditNumber}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted">
                      {credit.originalBill ? `#${credit.originalBill.billNumber}` : "—"}
                    </td>
                    <td className="px-3 py-3"><StatusPill status={credit.status} /></td>
                    <td className="figure px-3 py-3">{money(credit.total)}</td>
                    <td className="figure px-5 py-3">
                      {left.isZero() ? <span className="text-faint">—</span> : money(left)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
