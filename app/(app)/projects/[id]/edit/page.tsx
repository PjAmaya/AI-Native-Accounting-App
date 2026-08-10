import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ProjectForm, type ProjectFormOptions, type ProjectValues } from "@/components/form/ProjectForm";

export const dynamic = "force-dynamic";

function isoDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { budgetLines: { include: { account: true }, orderBy: { account: { code: "asc" } } } },
  });
  if (!project) notFound();

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

  const values: ProjectValues = {
    id: project.id,
    code: project.code,
    name: project.name,
    contactId: project.contactId ?? "",
    isActive: project.isActive,
    startDate: isoDate(project.startDate),
    endDate: isoDate(project.endDate),
    notes: project.notes ?? "",
    contractValue: project.contractValue?.toString() ?? "",
    budgets: project.budgetLines.map((b) => ({
      account: b.account.code,
      amount: b.amount.toString(),
      note: b.notes ?? "",
    })),
  };

  return (
    <div>
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        {project.code}
      </Link>
      <h1 className="page-title mt-3">
        <span className="font-mono text-muted">{project.code}</span> {project.name}
      </h1>
      <div className="mt-7">
        <ProjectForm options={options} values={values} />
      </div>
    </div>
  );
}
