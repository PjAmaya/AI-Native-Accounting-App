import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { ListFilters } from "@/components/ui/ListFilters";

export const dynamic = "force-dynamic";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-tint-blue px-2 py-0.5 text-[11px] font-medium text-icon-blue">
      {children}
    </span>
  );
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const role = sp.role?.trim() || undefined;
  const contacts = await prisma.contact.findMany({
    where: {
      isActive: true,
      ...(role === "customer" ? { isCustomer: true } : {}),
      ...(role === "vendor" ? { isVendor: true } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
  });

  const filtered = Boolean(q || role);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Directory</p>
          <h1 className="page-title mt-1.5">Contacts</h1>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New contact
        </Link>
      </div>

      <form method="get" action="/contacts" className="card mt-6 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="q" className="eyebrow">Search</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Name" className="mt-1 block w-44 rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
          </div>
          <div>
            <label htmlFor="role" className="eyebrow">Role</label>
            <select id="role" name="role" defaultValue={sp.role ?? ""} className="mt-1 block rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15">
              <option value="">Any</option>
              <option value="customer">Client</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]">Filter</button>
          {filtered ? <a href="/contacts" className="px-2 py-2 text-[13px] text-muted hover:text-ink">Clear</a> : null}
        </div>
      </form>

      {contacts.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-blue text-icon-blue">
            <Users size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No contacts yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Name</span></th>
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Role</span></th>
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Location</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Terms</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-wash/30">
                  <td className="px-5 py-3">
                    <Link href={`/contacts/${c.id}`} className="text-[13px] font-medium hover:text-brand">
                      {c.name}
                    </Link>
                    {c.email ? <p className="text-[12px] text-faint">{c.email}</p> : null}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {c.isCustomer ? <Pill>Customer</Pill> : null}
                      {c.isVendor ? <Pill>Vendor</Pill> : null}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted">
                    {!c.postalCode ? (
                      <span className="text-warn">No postal code</span>
                    ) : (
                      [c.city, c.province].filter(Boolean).join(", ") || "—"
                    )}
                  </td>
                  <td className="figure px-5 py-3">{c.paymentTermsDays} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
