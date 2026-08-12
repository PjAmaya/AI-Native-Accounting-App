import Link from "next/link";
import Decimal from "decimal.js";
import { Plus, FolderKanban } from "lucide-react";
import { projectPerformance } from "@/lib/reporting/projectPerformance";
import { prisma } from "@/lib/db";
import { ListFilters } from "@/components/ui/ListFilters";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; contact?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status?.trim() || undefined;

  const [allRows, projects, clients] = await Promise.all([
    projectPerformance(),
    prisma.project.findMany({ select: { id: true, code: true } }),
    prisma.contact.findMany({ where: { isCustomer: true }, orderBy: { name: "asc" } }),
  ]);

  let rows = allRows;
  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter((r) => r.code.toLowerCase().includes(lower) || r.name.toLowerCase().includes(lower));
  }
  if (status) rows = rows.filter((r) => r.status === status);
  if (sp.contact) rows = rows.filter((r) => r.clientName?.toLowerCase() === clients.find((c) => c.id === sp.contact)?.name.toLowerCase());

  const idByCode = new Map(projects.map((p) => [p.code, p.id]));
  const filtered = Boolean(q || status || sp.contact);

  const totalMargin = rows.reduce((sum, r) => sum.plus(r.margin), new Decimal(0));
  const overBudget = rows.filter((r) => r.costVariance.isNegative()).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Delivery</p>
          <h1 className="page-title mt-1.5">Projects</h1>
          <p className="mt-2 text-[14px] text-muted">
            {money(totalMargin)} margin to date
            {overBudget > 0 ? ` · ${overBudget} over budget` : ""}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          New project
        </Link>
      </div>

      <ListFilters
        basePath="/projects"
        contactLabel="Client"
        statuses={[
          { value: "ACTIVE", label: "Active" },
          { value: "ON_HOLD", label: "On hold" },
          { value: "COMPLETED", label: "Completed" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
        contacts={clients.map((c) => ({ value: c.id, label: c.name }))}
        current={{ q: sp.q, status: sp.status, contact: sp.contact }}
      />

      {rows.length === 0 ? (
        <div className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="tile bg-tint-blue text-icon-blue">
            <FolderKanban size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[14px] text-muted">No projects yet.</p>
        </div>
      ) : (
        <div className="card mt-7 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Project</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Contract</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Invoiced</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Collected</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Budget</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Cost</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">vs budget</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Margin</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.code} className={`hover:bg-wash/30 ${row.status === "ACTIVE" ? "" : "opacity-55"}`}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/projects/${idByCode.get(row.code)}`}
                      className="text-[13px] font-medium hover:text-brand"
                    >
                      <span className="font-mono text-[12px] text-muted">{row.code}</span> {row.name}
                    </Link>
                    <p className="text-[11px] text-faint">
                      {row.clientName ?? "No client"}
                      {row.status !== "ACTIVE" ? ` · ${row.status.replace("_", " ").toLowerCase()}` : ""}
                      {row.percentInvoiced ? ` · ${row.percentInvoiced.toFixed(0)}% invoiced` : ""}
                    </p>
                  </td>
                  <td className="figure px-3 py-3">
                    {row.contractValue ? money(row.contractValue) : <span className="text-faint">—</span>}
                  </td>
                  <td className="figure px-3 py-3">{money(row.invoiced)}</td>
                  <td className="figure px-3 py-3">{money(row.collected)}</td>
                  <td className="figure px-3 py-3">
                    {row.budgetedCost.isZero() ? (
                      <span className="text-faint">—</span>
                    ) : (
                      money(row.budgetedCost)
                    )}
                  </td>
                  <td className="figure px-3 py-3">{money(row.actualCost)}</td>
                  <td
                    className={`figure px-3 py-3 ${row.costVariance.isNegative() ? "text-negative" : row.budgetedCost.greaterThan(0) ? "text-positive" : "text-faint"}`}
                  >
                    {row.budgetedCost.isZero() ? "—" : money(row.costVariance)}
                  </td>
                  <td className="figure px-5 py-3 font-medium">
                    {money(row.margin)}
                    {row.marginPercent ? (
                      <span className="ml-1.5 text-[11px] font-normal text-muted">
                        {row.marginPercent.toFixed(0)}%
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] text-faint">
        Invoiced and cost come from posted journal lines tagged to each project. A negative
        variance means actual cost has exceeded the budget.
      </p>
    </div>
  );
}
