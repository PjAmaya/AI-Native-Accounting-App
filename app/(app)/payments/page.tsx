import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: {
      contact: true,
      bankAccount: true,
      journalEntry: true,
      applications: { include: { invoice: true } },
      billApplications: { include: { bill: true } },
    },
    orderBy: [{ paymentDate: "desc" }, { paymentNumber: "desc" }],
  });

  const received = payments
    .filter((p) => p.direction === "RECEIVED")
    .reduce((sum, p) => sum.plus(p.amount.toString()), new Decimal(0));
  const sent = payments
    .filter((p) => p.direction === "SENT")
    .reduce((sum, p) => sum.plus(p.amount.toString()), new Decimal(0));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Cash movement</p>
          <h1 className="page-title mt-1.5">Payments</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(received)} in · {money(sent)} out
          </p>
        </div>
        <Link
          href="/payments/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          Record payment
        </Link>
      </div>

      {payments.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-green text-icon-green">
            <Wallet size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No payments yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Payment</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Contact</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Applied to</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Account</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Entry</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {payments.map((p) => {
                const docs = [
                  ...p.applications.map((a) => a.invoice.invoiceNumber),
                  ...p.billApplications.map((a) => `#${a.bill.billNumber}`),
                ];
                const inbound = p.direction === "RECEIVED";
                const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
                const editable = !p.journalEntry || p.journalEntry.status === "DRAFT";

                const identity = (
                  <span className="flex items-center gap-1.5 font-mono text-[12px] font-medium">
                    <Icon
                      size={13}
                      strokeWidth={2}
                      aria-hidden
                      className={inbound ? "text-icon-green" : "text-icon-violet"}
                    />
                    #{p.paymentNumber}
                  </span>
                );

                return (
                  <tr key={p.id} className="hover:bg-wash/30">
                    <td className="px-5 py-3">
                      {editable ? (
                        <Link href={`/payments/${p.id}/edit`} className="block hover:text-brand">
                          {identity}
                        </Link>
                      ) : (
                        identity
                      )}
                      <p className="text-[11px] text-faint">{shortDate(p.paymentDate)}</p>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{p.contact.name}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted">
                      {docs.length === 0 ? (
                        <span className="text-warn">Unapplied</span>
                      ) : (
                        docs.join(", ")
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted">
                      {p.bankAccount.code}
                    </td>
                    <td className="px-3 py-3">
                      {p.journalEntry ? (
                        <StatusPill status={p.journalEntry.status} />
                      ) : (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </td>
                    <td
                      className={`figure px-5 py-3 font-medium ${inbound ? "text-positive" : "text-negative"}`}
                    >
                      {inbound ? "+" : "-"}
                      {money(p.amount)}
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
