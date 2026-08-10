import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ProjectForm, type ProjectFormOptions } from "@/components/form/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const [clients, accounts] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({
      where: {
        isPostable: true,
        isActive: true,
        subType: { in: ["COST_OF_SERVICES", "OPERATING_EXPENSE"] },
      },
      orderBy: { code: "asc" },
    }),
  ]);

  const options: ProjectFormOptions = {
    clients: clients.map((c) => ({ value: c.id, label: c.name })),
    costAccounts: accounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
  };

  return (
    <div>
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Projects
      </Link>
      <h1 className="page-title mt-3">New project</h1>
      <div className="mt-7">
        <ProjectForm options={options} />
      </div>
    </div>
  );
}
