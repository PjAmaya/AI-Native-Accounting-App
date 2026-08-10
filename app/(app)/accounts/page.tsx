import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { accountActivity } from "@/lib/reporting/activity";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

const ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export default async function AccountsPage() {
  const [accounts, activity] = await Promise.all([
    prisma.account.findMany({
      include: { parent: true, _count: { select: { lines: true } } },
      orderBy: { code: "asc" },
    }),
    accountActivity({ to: new Date() }),
  ]);

  const balances = new Map(activity.map((a) => [a.code, a.balance]));
  const grouped = ORDER.map((type) => ({
    type,
    rows: accounts.filter((a) => a.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">General ledger</p>
          <h1 className="page-title mt-1.5">GL accounts</h1>
          <p className="mt-2 text-[14px] text-muted">
            {accounts.filter((a) => a.isActive).length} active of {accounts.length}
          </p>
        </div>
        <Link
          href="/accounts/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New account
        </Link>
      </div>

      <div className="mt-7 grid gap-4">
        {grouped.map((group) => (
          <div key={group.type} className="card overflow-hidden">
            <div className="border-b border-rule bg-wash/40 px-5 py-2.5">
              <span className="eyebrow">{TYPE_LABEL[group.type]}</span>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-rule">
                {group.rows.map((account) => {
                  const balance = balances.get(account.code) ?? new Decimal(0);
                  const isChild = account.parentId !== null;

                  return (
                    <tr
                      key={account.id}
                      className={`hover:bg-wash/30 ${account.isActive ? "" : "opacity-50"}`}
                    >
                      <td className="w-20 py-2.5 pl-5 font-mono text-[12px] text-muted">
                        {account.code}
                      </td>
                      <td className="py-2.5" style={{ paddingLeft: isChild ? 16 : 0 }}>
                        <Link
                          href={`/accounts/${account.id}`}
                          className={`text-[13px] hover:text-brand ${account.isPostable ? "" : "font-semibold"}`}
                        >
                          {account.name}
                        </Link>
                        {!account.isActive ? (
                          <span className="ml-2 text-[11px] text-faint">inactive</span>
                        ) : null}
                      </td>
                      <td className="w-40 py-2.5 text-[11px] text-faint">
                        {account.subType.replace(/_/g, " ").toLowerCase()}
                      </td>
                      <td className="w-16 py-2.5 text-[11px] text-faint">
                        {account.normalBalance === "DEBIT" ? "Dr" : "Cr"}
                      </td>
                      <td className="w-12 py-2.5">
                        {account._count.lines > 0 ? (
                          <Lock size={12} strokeWidth={2} aria-label="Has postings" className="text-faint" />
                        ) : null}
                      </td>
                      <td className="figure w-32 py-2.5 pr-5">
                        {account.isPostable && !balance.isZero() ? money(balance) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] text-faint">
        Balances are inception to date from posted entries. Headings are shown in bold and hold no
        balance of their own.
      </p>
    </div>
  );
}
