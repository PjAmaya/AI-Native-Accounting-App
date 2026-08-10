import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { projectPerformance } from "@/lib/reporting/projectPerformance";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { contact: true },
  });
  if (!project) notFound();

  const all = await projectPerformance();
  const perf = all.find((p) => p.code === project.code);
  if (!perf) notFound();

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PAID"] },
      OR: [{ projectId: project.id }, { lines: { some: { projectId: project.id } } }],
    },
    orderBy: { invoiceDate: "desc" },
    take: 25,
  });

  return (
    <div>
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Projects
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            <span className="font-mono text-muted">{project.code}</span> {project.name}
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            {perf.clientName ?? "No client"}
            {project.startDate ? ` · from ${shortDate(project.startDate)}` : ""}
            {project.endDate ? ` to ${shortDate(project.endDate)}` : ""}
            {project.isActive ? "" : " · inactive"}
          </p>
        </div>
        <Link
          href={`/projects/${project.id}/edit`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
        >
          <Pencil size={14} strokeWidth={2} aria-hidden />
          Edit
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Contract</p>
          <p className="kpi mt-1">
            {perf.contractValue ? money(perf.contractValue) : "—"}
          </p>
          <p className="mt-1 text-[12px] text-faint">
            {perf.remainingToInvoice
              ? `${money(perf.remainingToInvoice)} left to bill`
              : "Open-ended"}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Invoiced</p>
          <p className="kpi mt-1">{money(perf.invoiced)}</p>
          <p className="mt-1 text-[12px] text-faint">
            {perf.percentInvoiced ? `${perf.percentInvoiced.toFixed(0)}% of contract` : "To date"}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Cost</p>
          <p className="kpi mt-1">{money(perf.actualCost)}</p>
          <p className="mt-1 text-[12px] text-faint">
            {perf.budgetedCost.isZero()
              ? "No budget set"
              : `${money(perf.budgetedCost)} budgeted`}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Margin</p>
          <p
            className={`kpi mt-1 ${perf.margin.isNegative() ? "text-negative" : "text-positive"}`}
          >
            {money(perf.margin)}
          </p>
          <p className="mt-1 text-[12px] text-faint">
            {perf.marginPercent ? `${perf.marginPercent.toFixed(1)}% realised` : "No revenue yet"}
            {perf.budgetedMarginPercent
              ? ` · ${perf.budgetedMarginPercent.toFixed(1)}% planned`
              : ""}
          </p>
        </div>
      </div>

      {perf.costLines.length > 0 ? (
        <div className="card mt-4 overflow-hidden">
          <div className="border-b border-rule px-5 py-3">
            <p className="eyebrow">Cost against budget</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Account</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Budget</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Actual</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Variance</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {perf.costLines.map((line) => (
                <tr key={line.code} className="hover:bg-wash/20">
                  <td className="px-5 py-2.5 text-[13px]">
                    <span className="font-mono text-[12px] text-muted">{line.code}</span> {line.name}
                    {line.budget.isZero() ? (
                      <span className="ml-2 rounded-full bg-tint-amber px-2 py-0.5 text-[10px] font-medium text-icon-amber">
                        unbudgeted
                      </span>
                    ) : null}
                  </td>
                  <td className="figure px-3 py-2.5">
                    {line.budget.isZero() ? <span className="text-faint">—</span> : money(line.budget)}
                  </td>
                  <td className="figure px-3 py-2.5">{money(line.actual)}</td>
                  <td
                    className={`figure px-5 py-2.5 font-medium ${line.variance.isNegative() ? "text-negative" : line.budget.greaterThan(0) ? "text-positive" : "text-faint"}`}
                  >
                    {line.budget.isZero() ? "—" : money(line.variance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-rule bg-wash/30">
              <tr>
                <td className="px-5 py-2.5 text-[13px] font-semibold">Total</td>
                <td className="figure px-3 py-2.5 font-semibold">{money(perf.budgetedCost)}</td>
                <td className="figure px-3 py-2.5 font-semibold">{money(perf.actualCost)}</td>
                <td
                  className={`figure px-5 py-2.5 font-semibold ${perf.costVariance.isNegative() ? "text-negative" : "text-positive"}`}
                >
                  {money(perf.costVariance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="card mt-4 px-6 py-8 text-center">
          <p className="text-[14px] text-muted">
            No costs recorded and no budget set.{" "}
            <Link href={`/projects/${project.id}/edit`} className="font-medium text-brand hover:underline">
              Add a budget
            </Link>
            .
          </p>
        </div>
      )}

      {invoices.length > 0 ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Invoices</p>
          <ul className="mt-3 divide-y divide-rule">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between py-2 text-[13px]">
                <Link href={`/invoices/${invoice.id}`} className="font-mono text-[12px] hover:text-brand">
                  {invoice.invoiceNumber} · {shortDate(invoice.invoiceDate)}
                </Link>
                <span className="figure">{money(invoice.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {project.notes ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Notes</p>
          <p className="mt-2 whitespace-pre-line text-[13px] text-muted">{project.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
