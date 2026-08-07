import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, FileMinus } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage() {
  const notes = await prisma.creditNote.findMany({
    include: { contact: true, originalInvoice: true, applications: true },
    orderBy: [{ creditDate: "desc" }, { creditNumber: "desc" }],
  });

  const unapplied = notes
    .filter((n) => n.status === "ISSUED")
    .reduce((sum, n) => {
      const used = n.applications.reduce(
        (s, a) => s.plus(a.amountApplied.toString()),
        new Decimal(0),
      );
      return sum.plus(new Decimal(n.total.toString()).minus(used));
    }, new Decimal(0));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accounts receivable</p>
          <h1 className="page-title mt-1.5">Credit notes</h1>
          <p className="mt-2 text-[14px] text-muted">{money(unapplied)} not yet applied</p>
        </div>
        <Link
          href="/credit-notes/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New credit note
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-amber text-icon-amber">
            <FileMinus size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No credit notes yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Credit</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Client</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Credits</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Reason</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Status</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Unapplied</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {notes.map((note) => {
                const used = note.applications.reduce(
                  (s, a) => s.plus(a.amountApplied.toString()),
                  new Decimal(0),
                );
                const left = new Decimal(note.total.toString()).minus(used);

                return (
                  <tr key={note.id} className="hover:bg-wash/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/credit-notes/${note.id}`}
                        className="font-mono text-[12px] font-medium hover:text-brand"
                      >
                        {note.creditNumber}
                      </Link>
                      <p className="text-[11px] text-faint">{shortDate(note.creditDate)}</p>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{note.contact.name}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted">
                      {note.originalInvoice?.invoiceNumber ?? "—"}
                    </td>
                    <td className="max-w-52 truncate px-3 py-3 text-[12px] text-muted">
                      {note.reason}
                    </td>
                    <td className="px-3 py-3"><StatusPill status={note.status} /></td>
                    <td className="figure px-3 py-3">{money(note.total)}</td>
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
