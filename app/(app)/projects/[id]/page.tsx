import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, Pencil, Trash2, Upload, FileText, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { projectPerformance } from "@/lib/reporting/projectPerformance";
import { money, shortDate } from "@/lib/format";
import { uploadProjectAttachment, removeProjectAttachment } from "../actions";
import { KIND_LABEL, PROJECT_KINDS } from "@/lib/attachments/labels";
import { deleteProject } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { contact: true, attachments: { orderBy: { createdAt: "desc" } } },
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
            {project.status === "ACTIVE" ? "" : ` · ${project.status.toLowerCase()}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={deleteProject.bind(null, project.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden />
              Delete
            </button>
          </form>
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-wash/50"
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
            Edit
          </Link>
        </div>
      </div>

      {error ? (
        <div className="card mt-5 border-negative bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-negative">{error}</p>
        </div>
      ) : null}

      {project.status !== "ACTIVE" ? (
        <div className="card mt-5 border-rule bg-wash/50 px-5 py-3.5">
          <p className="text-[13px]">
            <span className="font-medium">{project.status.replace("_", " ").toLowerCase()}</span>
            {project.closedAt ? ` since ${shortDate(project.closedAt)}` : ""}
            {project.closureReason ? ` — ${project.closureReason}` : ""}
          </p>
        </div>
      ) : null}

      {project.scope ? (
        <div className="card mt-5 px-5 py-4">
          <p className="eyebrow">Scope</p>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{project.scope}</p>
        </div>
      ) : null}

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

      <div className="card mt-4 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">Attachments</p>
        </div>

        {project.attachments.length > 0 ? (
          <ul className="mt-3 divide-y divide-rule">
            {project.attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span className="tile bg-wash text-faint">
                    <FileText size={14} strokeWidth={1.9} aria-hidden />
                  </span>
                  <div>
                    <a
                      href={`/attachments/${att.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium hover:text-brand"
                    >
                      {att.fileName}
                    </a>
                    <p className="text-[11px] text-faint">
                      {KIND_LABEL[att.kind]} · {(att.byteSize / 1024).toFixed(0)} KB
                      {att.driveWebLink ? (
                        <> · <a href={att.driveWebLink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Drive</a></>
                      ) : null}
                    </p>
                  </div>
                </div>
                <form action={removeProjectAttachment.bind(null, project.id, att.id)}>
                  <button
                    type="submit"
                    aria-label="Remove"
                    className="text-faint transition-colors hover:text-negative"
                  >
                    <X size={14} strokeWidth={2} aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-muted">No files yet.</p>
        )}

        <form
          action={uploadProjectAttachment.bind(null, project.id)}
          className="mt-4 border-t border-rule pt-4"
        >
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label htmlFor="file" className="eyebrow">File</label>
              <input
                id="file"
                name="file"
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx,.xls,.xlsx"
                className="mt-1 block w-full text-[13px] file:mr-3 file:rounded-lg file:border file:border-rule file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:transition-colors hover:file:bg-wash/60"
              />
            </div>
            <div>
              <label htmlFor="att-kind" className="eyebrow">Type</label>
              <select
                id="att-kind"
                name="kind"
                defaultValue="SERVICE_AGREEMENT"
                className="mt-1 block w-full rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              >
                {PROJECT_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="att-date" className="eyebrow">Document date</label>
              <input
                id="att-date"
                name="documentDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 block w-full rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="att-desc" className="eyebrow">Description</label>
              <input
                id="att-desc"
                name="description"
                placeholder="Optional — what this document is"
                className="mt-1 block w-full rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              <Upload size={14} strokeWidth={2} aria-hidden />
              Upload
            </button>
          </div>
        </form>
      </div>

      {project.notes ? (
        <div className="card mt-4 px-5 py-4">
          <p className="eyebrow">Notes</p>
          <p className="mt-2 whitespace-pre-line text-[13px] text-muted">{project.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
