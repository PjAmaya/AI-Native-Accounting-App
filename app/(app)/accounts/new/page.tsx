import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { AccountForm } from "@/components/form/AccountForm";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const parents = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Chart of accounts
      </Link>
      <h1 className="page-title mt-3">New account</h1>
      <div className="mt-7">
        <AccountForm
          parents={parents.map((p) => ({ value: p.code, label: `${p.code} ${p.name}` }))}
        />
      </div>
    </div>
  );
}
