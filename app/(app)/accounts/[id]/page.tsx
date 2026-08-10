import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { prisma } from "@/lib/db";
import { AccountForm, type AccountValues } from "@/components/form/AccountForm";
import { deleteAccount } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      parent: true,
      _count: {
        select: {
          lines: true,
          children: true,
          invoiceLines: true,
          billLines: true,
          receivableFor: true,
          receivableForInvoices: true,
          taxCollectedFor: true,
          taxRecoverableFor: true,
          paymentsReceived: true,
        },
      },
    },
  });
  if (!account) notFound();

  const parents = await prisma.account.findMany({
    where: { isActive: true, NOT: { id } },
    orderBy: { code: "asc" },
  });

  const values: AccountValues = {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    subType: account.subType,
    normalBalance: account.normalBalance,
    isPostable: account.isPostable,
    isActive: account.isActive,
    capitalCandidate: account.capitalCandidate,
    ebitdaAddBack: account.ebitdaAddBack,
    parentCode: account.parent?.code ?? "",
    postingCount: account._count.lines,
  };

  const c = account._count;
  const referenced =
    c.lines + c.invoiceLines + c.billLines + c.children +
    c.receivableFor + c.receivableForInvoices +
    c.taxCollectedFor + c.taxRecoverableFor + c.paymentsReceived;
  const remove = deleteAccount.bind(null, account.id);

  return (
    <div>
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        GL accounts
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <h1 className="page-title">
          <span className="font-mono text-muted">{account.code}</span> {account.name}
        </h1>
        {account.isActive ? (
          <form action={remove} className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
            >
              <Archive size={14} strokeWidth={2} aria-hidden />
              {referenced > 0 ? "Deactivate" : "Delete"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-7">
        <AccountForm
          values={values}
          parents={parents.map((p) => ({ value: p.code, label: `${p.code} ${p.name}` }))}
        />
      </div>
    </div>
  );
}
