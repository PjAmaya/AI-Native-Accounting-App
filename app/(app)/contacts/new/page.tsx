import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ContactForm } from "@/components/form/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const receivables = await prisma.account.findMany({
    where: { type: "ASSET", isPostable: true, isActive: true, subType: "CURRENT_ASSET" },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Contacts
      </Link>
      <h1 className="page-title mt-3">New contact</h1>
      <div className="mt-7">
        <ContactForm
          receivableAccounts={receivables.map((a) => ({
            value: a.code,
            label: `${a.code} ${a.name}`,
          }))}
        />
      </div>
    </div>
  );
}
