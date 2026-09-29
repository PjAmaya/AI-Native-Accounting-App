import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewAttachmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { bill: true, project: true, supplierCredit: true },
  });
  if (!att) notFound();

  const backHref = att.billId
    ? `/bills/${att.billId}`
    : att.supplierCreditId
      ? `/supplier-credits/${att.supplierCreditId}`
      : att.projectId
        ? `/projects/${att.projectId}`
        : "/";

  const backLabel = att.bill
    ? `Bill #${att.bill.billNumber}`
    : att.supplierCredit
      ? `Supplier credit`
      : att.project
        ? att.project.code
        : "Back";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center gap-3 border-b border-rule px-5 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          {backLabel}
        </Link>
        <span className="truncate text-[13px] font-medium">{att.fileName}</span>
          <a
          href={`/attachments/${id}?download`}
          className="ml-auto rounded-lg border border-rule px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-wash/50"
        >
          Download
        </a>
      </div>
      {att.mimeType === "application/pdf" ? (
        <iframe
          src={`/attachments/${id}`}
          className="flex-1 w-full border-0"
          title={att.fileName}
        />
      ) : att.mimeType.startsWith("image/") ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <img src={`/attachments/${id}`} alt={att.fileName} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[14px] text-muted">Preview not available. Use the download button.</p>
        </div>
      )}
    </div>
  );
}
